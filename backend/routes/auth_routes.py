"""PROMPTWALL — Auth Routes"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import User
from schemas import RegisterIn, LoginIn, ForgotIn, ResetIn, ChangePwIn, ResendIn, Msg, TokenOut
from security.password_utils import hash_pw, verify_pw
from security.jwt_handler import make_token, make_verify_token, decode_verify_token, make_reset_token, decode_reset_token
from security.rate_limiter import limit_ip, get_ip
from services.email_service import send_verify, send_reset
from auth import current_user
from config import settings

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=Msg, status_code=201)
async def register(body: RegisterIn, request: Request, bg: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    limit_ip(request, settings.AUTH_RATE_LIMIT_PER_MINUTE)
    r = await db.execute(select(User).where(User.email == body.email))
    if r.scalar_one_or_none():
        raise HTTPException(409, {"error": "Email already registered", "code": "EMAIL_EXISTS"})
    u = User(
        name=body.name.strip(), email=body.email,
        password_hash=hash_pw(body.password),
        accepted_policy=True, policy_accepted_at=datetime.utcnow(),
        is_admin=(body.email == settings.SUPER_ADMIN_EMAIL),
    )
    db.add(u)
    await db.flush()
    token = make_verify_token(u.id, u.email)
    u.verification_token = token
    u.verification_token_expires = datetime.utcnow().replace(hour=23, minute=59)
    bg.add_task(send_verify, u.email, u.name, token)
    return Msg(message="Account created! Check your email to verify.")


@router.post("/resend-verification", response_model=Msg)
async def resend_verify(body: ResendIn, bg: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(User).where(User.email == body.email))
    u = r.scalar_one_or_none()
    if u and not u.is_verified:
        token = make_verify_token(u.id, u.email)
        u.verification_token = token
        bg.add_task(send_verify, u.email, u.name, token)
    return Msg(message="If that email is registered and unverified, a new link has been sent.")


@router.post("/verify-email", response_model=TokenOut)
async def verify_email(token: str, db: AsyncSession = Depends(get_db)):
    payload = decode_verify_token(token)
    if not payload:
        raise HTTPException(400, {"error": "Invalid or expired verification link", "code": "INVALID_TOKEN"})
    r = await db.execute(select(User).where(User.id == payload["sub"]))
    u = r.scalar_one_or_none()
    if not u:
        raise HTTPException(404, {"error": "User not found", "code": "NOT_FOUND"})
    if u.is_verified:
        # Already verified — still return token so they get logged in
        jwt = make_token(u.id, u.email, u.is_admin)
        return TokenOut(access_token=jwt, user=u)
    u.is_verified = True
    u.verification_token = None
    jwt = make_token(u.id, u.email, u.is_admin)
    return TokenOut(access_token=jwt, user=u)


@router.post("/login", response_model=TokenOut)
async def login(body: LoginIn, request: Request, db: AsyncSession = Depends(get_db)):
    limit_ip(request, settings.AUTH_RATE_LIMIT_PER_MINUTE)
    now = datetime.utcnow()
    r = await db.execute(select(User).where(User.email == body.email))
    u = r.scalar_one_or_none()
    bad = HTTPException(401, {"error": "Invalid email or password", "code": "INVALID_CREDENTIALS"})
    if not u:
        raise bad
    if u.locked_until and u.locked_until > now:
        mins = int((u.locked_until - now).total_seconds() / 60) + 1
        raise HTTPException(423, {"error": f"Account locked for {mins} more minute(s).", "code": "ACCOUNT_LOCKED"})
    if not verify_pw(body.password, u.password_hash):
        u.failed_attempts += 1
        if u.failed_attempts >= settings.MAX_LOGIN_ATTEMPTS:
            from datetime import timedelta
            u.locked_until = now + timedelta(minutes=settings.LOCKOUT_MINUTES)
        raise bad
    if not u.is_verified:
        raise HTTPException(403, {"error": "Email not verified", "code": "NOT_VERIFIED", "email": u.email})
    if not u.is_active:
        raise HTTPException(403, {"error": "Account suspended", "code": "SUSPENDED"})
    u.failed_attempts = 0
    u.locked_until = None
    u.last_login_at = now
    return TokenOut(access_token=make_token(u.id, u.email, u.is_admin), user=u)


@router.post("/logout", response_model=Msg)
async def logout(u: User = Depends(current_user)):
    return Msg(message="Logged out successfully.")


@router.post("/forgot-password", response_model=Msg)
async def forgot(body: ForgotIn, bg: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(User).where(User.email == body.email))
    u = r.scalar_one_or_none()
    if u and u.is_active:
        token = make_reset_token(u.id, u.email)
        u.reset_token = token
        bg.add_task(send_reset, u.email, u.name, token)
    return Msg(message="If that email exists, a reset link has been sent.")


@router.post("/reset-password", response_model=Msg)
async def reset_password(body: ResetIn, db: AsyncSession = Depends(get_db)):
    payload = decode_reset_token(body.token)
    if not payload:
        raise HTTPException(400, {"error": "Invalid or expired reset link", "code": "INVALID_TOKEN"})
    r = await db.execute(select(User).where(User.id == payload["sub"]))
    u = r.scalar_one_or_none()
    if not u:
        raise HTTPException(404, {"error": "User not found", "code": "NOT_FOUND"})
    u.password_hash = hash_pw(body.new_password)
    u.reset_token = None
    u.failed_attempts = 0
    u.locked_until = None
    return Msg(message="Password reset successfully. You can now sign in.")

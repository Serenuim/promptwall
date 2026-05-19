"""PROMPTWALL — User Routes"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models import User
from schemas import UserOut, UpdateProfileIn, ChangePwIn, Msg
from security.password_utils import verify_pw, hash_pw
from auth import current_user

router = APIRouter(prefix="/api/user", tags=["User"])


@router.get("/profile", response_model=UserOut)
async def profile(u: User = Depends(current_user)):
    return u


@router.put("/profile", response_model=UserOut)
async def update_profile(body: UpdateProfileIn, u: User = Depends(current_user)):
    u.name = body.name
    return u


@router.post("/change-password", response_model=Msg)
async def change_password(body: ChangePwIn, u: User = Depends(current_user)):
    if not verify_pw(body.current_password, u.password_hash):
        from fastapi import HTTPException
        raise HTTPException(400, {"error": "Current password incorrect", "code": "WRONG_PASSWORD"})
    u.password_hash = hash_pw(body.new_password)
    return Msg(message="Password changed successfully.")


@router.get("/plan-limits")
async def plan_limits(u: User = Depends(current_user)):
    from config import settings
    return {
        "plan": "Free",
        "apps_limit": settings.FREE_MAX_APPS,
        "daily_scans_limit": settings.DAILY_REQUEST_LIMIT,
        "scans_used_today": u.daily_scans,
        "scans_remaining": max(0, settings.DAILY_REQUEST_LIMIT - u.daily_scans),
    }

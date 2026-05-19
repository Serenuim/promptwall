"""PROMPTWALL — Auth Guards"""
import hashlib
from fastapi import Depends, HTTPException, Request, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import User, Application
from security.jwt_handler import decode_token
from config import settings

bearer = HTTPBearer(auto_error=False)


async def current_user(
    creds: HTTPAuthorizationCredentials = Security(bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    bad = HTTPException(401, {"error": "Not authenticated", "code": "AUTH_REQUIRED"})
    if not creds:
        raise bad
    payload = decode_token(creds.credentials)
    if not payload:
        raise bad
    r = await db.execute(select(User).where(User.id == payload["sub"]))
    u = r.scalar_one_or_none()
    if not u or not u.is_active:
        raise bad
    return u


async def verified_user(u: User = Depends(current_user)) -> User:
    if not u.is_verified:
        raise HTTPException(403, {"error": "Email not verified", "code": "NOT_VERIFIED"})
    return u


async def admin_user(u: User = Depends(current_user)) -> User:
    if u.email != settings.SUPER_ADMIN_EMAIL or not u.is_admin:
        raise HTTPException(404, detail="Not found")
    return u


def _extract_raw_key(request: Request) -> str | None:
    """
    Extract the raw API key from the request.
    Supports three formats so it works everywhere:
      1. X-API-Key: pw_live_xxxx            (standard header)
      2. Authorization: Bearer pw_live_xxxx  (when user confuses it with JWT)
      3. Authorization: pw_live_xxxx         (bare, without Bearer prefix)
    Returns the raw key string, or None if not found.
    """
    # Priority 1: X-API-Key header (canonical)
    key = request.headers.get("x-api-key") or request.headers.get("X-API-Key")
    if key:
        return key.strip()

    # Priority 2: Authorization header — extract pw_live_ key
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if auth:
        cleaned = auth.strip()
        if cleaned.lower().startswith("bearer "):
            cleaned = cleaned[7:].strip()
        if cleaned.startswith("pw_live_"):
            return cleaned

    return None


async def app_from_api_key(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Application:
    """
    Validate an API key and return the associated Application.
    Accepts X-API-Key header or Authorization: Bearer pw_live_... header.
    """
    raw_key = _extract_raw_key(request)

    if not raw_key:
        raise HTTPException(
            status_code=401,
            detail={
                "error": "Missing API key. Send your key in the X-API-Key header.",
                "code": "MISSING_KEY",
                "hint": 'Header: X-API-Key: pw_live_YOUR_FULL_72_CHAR_KEY',
            },
        )

    if not raw_key.startswith("pw_live_"):
        raise HTTPException(
            status_code=401,
            detail={
                "error": "Invalid API key format. Key must start with pw_live_",
                "code": "INVALID_KEY_FORMAT",
                "hint": "Use your full key from Dashboard → Apps",
            },
        )

    if len(raw_key) != 72:
        raise HTTPException(
            status_code=401,
            detail={
                "error": f"API key has wrong length ({len(raw_key)} chars). Expected 72 chars.",
                "code": "INVALID_KEY_LENGTH",
                "hint": "The display prefix in the dashboard ends in '...' — use the full key from the green banner shown on creation.",
            },
        )

    key_hash = hashlib.sha256(raw_key.encode("utf-8")).hexdigest()

    r = await db.execute(
        select(Application).where(Application.api_key_hash == key_hash)
    )
    app = r.scalar_one_or_none()

    if not app:
        raise HTTPException(
            status_code=401,
            detail={
                "error": "API key not found. It may have been regenerated or deleted.",
                "code": "INVALID_KEY",
                "hint": "Go to Dashboard → Apps → Regenerate Key if you lost your key.",
            },
        )

    if not app.is_active:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "API key has been revoked.",
                "code": "KEY_REVOKED",
                "hint": "Go to Dashboard → Apps → Reactivate to restore access.",
            },
        )

    return app

from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from config import settings


def make_token(user_id: str, email: str, is_admin: bool) -> str:
    exp = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": user_id, "email": email, "is_admin": is_admin, "exp": exp, "iat": datetime.utcnow()},
        settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM,
    )


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        return None


def make_verify_token(user_id: str, email: str) -> str:
    exp = datetime.utcnow() + timedelta(hours=24)
    return jwt.encode(
        {"sub": user_id, "email": email, "type": "verify", "exp": exp},
        settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM,
    )


def decode_verify_token(token: str) -> Optional[dict]:
    try:
        p = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        if p.get("type") != "verify": return None
        return p
    except JWTError:
        return None


def make_reset_token(user_id: str, email: str) -> str:
    exp = datetime.utcnow() + timedelta(hours=1)
    return jwt.encode(
        {"sub": user_id, "email": email, "type": "reset", "exp": exp},
        settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM,
    )


def decode_reset_token(token: str) -> Optional[dict]:
    try:
        p = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        if p.get("type") != "reset": return None
        return p
    except JWTError:
        return None

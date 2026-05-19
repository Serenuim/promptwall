"""PROMPTWALL — Pydantic Schemas"""
import re
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, field_validator

_PW = re.compile(r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$')


def _strong(v: str) -> str:
    if not _PW.match(v):
        raise ValueError("Password must be 8+ chars with uppercase, lowercase, and a number.")
    return v


class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    password: str
    accepted_policy: bool

    @field_validator("name")
    @classmethod
    def name_ok(cls, v):
        v = v.strip()
        if len(v) < 2: raise ValueError("Name must be at least 2 characters")
        return v

    @field_validator("password")
    @classmethod
    def pw_ok(cls, v): return _strong(v)

    @field_validator("accepted_policy")
    @classmethod
    def must_accept(cls, v):
        if not v: raise ValueError("You must accept the privacy policy")
        return v


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def pw_ok(cls, v): return _strong(v)


class ChangePwIn(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def pw_ok(cls, v): return _strong(v)


class ResendIn(BaseModel):
    email: EmailStr


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    is_verified: bool
    is_admin: bool
    accepted_policy: bool
    daily_scans: int
    created_at: datetime
    last_login_at: Optional[datetime]
    model_config = {"from_attributes": True}


class UpdateProfileIn(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def name_ok(cls, v):
        v = v.strip()
        if len(v) < 2: raise ValueError("Name must be at least 2 characters")
        return v


class CreateAppIn(BaseModel):
    name: str
    description: Optional[str] = None

    @field_validator("name")
    @classmethod
    def name_ok(cls, v):
        v = v.strip()
        if len(v) < 2: raise ValueError("App name too short")
        if len(v) > 50: raise ValueError("App name too long")
        return v


class AppOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    api_key_prefix: str
    is_active: bool
    is_demo: bool
    demo_requests_used: int
    total_requests: int
    created_at: datetime
    model_config = {"from_attributes": True}


class AppCreatedOut(AppOut):
    raw_api_key: str  # shown ONCE only — full key


class DetectIn(BaseModel):
    prompt: str
    appId: str

    @field_validator("prompt")
    @classmethod
    def prompt_ok(cls, v):
        v = v.strip()
        if not v: raise ValueError("Prompt cannot be empty")
        if len(v) > 10000: raise ValueError("Prompt too long")
        return v


class DashboardDetectIn(BaseModel):
    prompt: str
    app_id: int

    @field_validator("prompt")
    @classmethod
    def prompt_ok(cls, v):
        v = v.strip()
        if not v: raise ValueError("Prompt cannot be empty")
        return v


class DetectOut(BaseModel):
    risk_score: int
    attack_type: str
    blocked: bool
    explanation: str
    app: str
    scans_used: int
    scans_limit: int
    allowlist_override: bool = False
    is_demo: bool = False
    log_id: Optional[int] = None  # scan log ID for feedback


class ScanLogOut(BaseModel):
    id: int
    app_id: Optional[int]
    prompt: str
    risk_score: int
    attack_type: Optional[str]
    blocked: bool
    endpoint: str
    allowlist_override: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class AllowlistIn(BaseModel):
    app_id: int
    pattern: str
    note: Optional[str] = None

    @field_validator("pattern")
    @classmethod
    def pattern_ok(cls, v):
        v = v.strip()
        if not v: raise ValueError("Pattern cannot be empty")
        return v[:500]


class AllowlistOut(BaseModel):
    id: int
    app_id: int
    pattern: str
    note: Optional[str]
    created_at: datetime
    model_config = {"from_attributes": True}


class SimulateIn(BaseModel):
    message: str
    app_id: Optional[int] = None
    use_demo: bool = False

    @field_validator("message")
    @classmethod
    def msg_ok(cls, v):
        v = v.strip()
        if not v: raise ValueError("Message cannot be empty")
        return v[:2000]


class Msg(BaseModel):
    message: str
    success: bool = True


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ── Feedback ──────────────────────────────────────────────────────
class FeedbackIn(BaseModel):
    scan_log_id: int
    verdict: str   # "accept" | "reject"
    note: Optional[str] = None

    @field_validator("verdict")
    @classmethod
    def verdict_ok(cls, v: str) -> str:
        if v not in ("accept", "reject"):
            raise ValueError("verdict must be 'accept' or 'reject'")
        return v


class FeedbackOut(BaseModel):
    id: int
    scan_log_id: int
    verdict: str
    note: Optional[str]
    created_at: datetime
    model_config = {"from_attributes": True}

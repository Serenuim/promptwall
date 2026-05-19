"""PROMPTWALL — Detection Service"""
import hashlib
import secrets
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException
from models import User, Application, ScanLog, Allowlist
from config import settings

DEMO_REQUEST_LIMIT = 10


def generate_api_key() -> tuple[str, str, str]:
    """
    Returns (raw_key, key_hash, display_prefix).
    raw_key  = full key user must save, e.g. pw_live_a1b2c3d4...64chars
    key_hash = sha256 of raw_key, stored in DB
    display_prefix = first 28 chars + '...' shown in dashboard (pw_live_ + 20 chars visible)
    """
    raw = "pw_live_" + secrets.token_hex(32)   # 8 + 64 = 72 chars total
    key_hash = hashlib.sha256(raw.encode()).hexdigest()
    display_prefix = raw[:28] + "..."           # show enough to identify without being usable
    return raw, key_hash, display_prefix


async def check_daily_limit(db: AsyncSession, user: User, is_demo: bool = False) -> None:
    """Reset counter if day changed, then enforce daily limit. Demo apps skip this."""
    if is_demo:
        return
    now = datetime.utcnow()
    if user.daily_scans_reset_at is None or user.daily_scans_reset_at.date() < now.date():
        user.daily_scans = 0
        user.daily_scans_reset_at = now
    if user.daily_scans >= settings.DAILY_REQUEST_LIMIT:
        raise HTTPException(429, {
            "error": f"Daily limit of {settings.DAILY_REQUEST_LIMIT} requests reached. Resets at midnight UTC.",
            "code": "DAILY_LIMIT_EXCEEDED",
            "scans_used": user.daily_scans,
            "scans_limit": settings.DAILY_REQUEST_LIMIT,
        })


async def run_detection(
    db: AsyncSession,
    user: User,
    app: Application,
    prompt: str,
    endpoint: str,
    ip: str = "unknown",
) -> dict:
    """Full detection pipeline: limit → allowlist → ML/regex → log."""
    from ml_models.load_model import detector

    # Demo app: enforce 10-request cap (does NOT count against daily limit)
    if app.is_demo:
        if app.demo_requests_used >= DEMO_REQUEST_LIMIT:
            raise HTTPException(429, {
                "error": f"Demo app limit of {DEMO_REQUEST_LIMIT} requests reached. Create a real app to continue.",
                "code": "DEMO_LIMIT_EXCEEDED",
                "demo_used": app.demo_requests_used,
                "demo_limit": DEMO_REQUEST_LIMIT,
            })
        app.demo_requests_used += 1
    else:
        await check_daily_limit(db, user)

    # Check allowlist
    al_result = await db.execute(select(Allowlist).where(Allowlist.app_id == app.id))
    allowlist = al_result.scalars().all()
    allowlist_override = any(e.pattern.lower() in prompt.lower() for e in allowlist)

    # Run detection
    score, attack_type = detector.predict(prompt)

    # Apply allowlist override
    if allowlist_override:
        score = max(0, score - 50)
        attack_type = "Allowed (whitelisted)"

    blocked = score >= settings.ML_BLOCK_THRESHOLD and not allowlist_override

    # Increment counters
    if not app.is_demo:
        user.daily_scans += 1
    app.total_requests += 1

    # Log
    log = ScanLog(
        user_id=user.id, app_id=app.id, prompt=prompt,
        risk_score=score, attack_type=attack_type, blocked=blocked,
        endpoint=endpoint, ip_address=ip, allowlist_override=allowlist_override,
    )
    db.add(log)
    await db.flush()

    explanation = (
        f"Detected '{attack_type}' with {score}% confidence." if blocked
        else f"Input classified as safe ({score}% risk score)."
    )

    return {
        "risk_score": score, "attack_type": attack_type, "blocked": blocked,
        "explanation": explanation, "app": app.name,
        "scans_used": user.daily_scans if not app.is_demo else app.demo_requests_used,
        "scans_limit": settings.DAILY_REQUEST_LIMIT if not app.is_demo else DEMO_REQUEST_LIMIT,
        "allowlist_override": allowlist_override, "log_id": log.id, "is_demo": app.is_demo,
    }

"""PROMPTWALL — API Detection + Allowlist + Simulation + Feedback Routes"""
import csv
import io
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from database import get_db
from models import User, Application, ScanLog, Allowlist, FeedbackLog
from schemas import (
    DetectIn, DashboardDetectIn, DetectOut, ScanLogOut,
    AllowlistIn, AllowlistOut, SimulateIn, FeedbackIn, FeedbackOut, Msg,
)
from services.detection_service import run_detection
from security.rate_limiter import get_ip, limit_api_key
from auth import verified_user, app_from_api_key
from config import settings

router = APIRouter(tags=["Detection"])


# ── VERIFY KEY: GET /api/verify-key (quick sanity check) ─────────
@router.get("/api/verify-key")
async def verify_key(
    request: Request,
    db: AsyncSession = Depends(get_db),
    app: Application = Depends(app_from_api_key),
):
    """Test endpoint — confirms your API key is valid."""
    r = await db.execute(select(User).where(User.id == app.owner_id))
    owner = r.scalar_one_or_none()
    return {
        "valid": True,
        "app_name": app.name,
        "app_id": app.id,
        "owner_email": owner.email if owner else None,
        "is_active": app.is_active,
        "total_requests": app.total_requests,
        "daily_limit": settings.DAILY_REQUEST_LIMIT,
        "message": "API key is working correctly.",
    }


# ── EXTERNAL API: POST /api/detect (X-API-Key) ───────────────────
@router.post("/api/detect", response_model=DetectOut)
async def external_detect(
    body: DetectIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
    app: Application = Depends(app_from_api_key),
):
    if not limit_api_key(app.api_key_prefix, settings.API_RATE_LIMIT_PER_MINUTE):
        raise HTTPException(429, {
            "error": "Rate limit exceeded (20 req/min per key).",
            "code": "RATE_LIMITED",
        })

    r = await db.execute(select(User).where(User.id == app.owner_id))
    owner = r.scalar_one_or_none()
    if not owner or not owner.is_active:
        raise HTTPException(401, {"error": "App owner account inactive.", "code": "AUTH_FAILED"})

    ip = get_ip(request)
    result = await run_detection(db, owner, app, body.prompt, endpoint="external", ip=ip)
    return DetectOut(**result)


# ── DASHBOARD SCAN: POST /api/analyze-prompt (JWT) ───────────────
@router.post("/api/analyze-prompt", response_model=DetectOut)
async def dashboard_scan(
    body: DashboardDetectIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
    u: User = Depends(verified_user),
):
    r = await db.execute(
        select(Application).where(Application.id == body.app_id, Application.owner_id == u.id)
    )
    app = r.scalar_one_or_none()
    if not app:
        raise HTTPException(404, {"error": "App not found", "code": "NOT_FOUND"})
    if not app.is_active:
        raise HTTPException(403, {"error": "App is revoked", "code": "APP_REVOKED"})

    ip = get_ip(request)
    result = await run_detection(db, u, app, body.prompt, endpoint="dashboard", ip=ip)
    return DetectOut(**result)


# ── LOGS: GET /api/logs ───────────────────────────────────────────
@router.get("/api/logs", response_model=list[ScanLogOut])
async def get_logs(
    app_id: int | None = None,
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    u: User = Depends(verified_user),
):
    q = select(ScanLog).where(ScanLog.user_id == u.id).order_by(desc(ScanLog.created_at))
    if app_id:
        q = q.where(ScanLog.app_id == app_id)
    q = q.limit(min(limit, 200)).offset(offset)
    r = await db.execute(q)
    return r.scalars().all()


# ── ANALYSIS: GET /api/analysis ───────────────────────────────────
@router.get("/api/analysis")
async def analysis(
    app_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    u: User = Depends(verified_user),
):
    base_where = [ScanLog.user_id == u.id]
    if app_id:
        base_where.append(ScanLog.app_id == app_id)

    total_r  = await db.execute(select(func.count(ScanLog.id)).where(*base_where))
    blocked_r = await db.execute(select(func.count(ScanLog.id)).where(*base_where, ScanLog.blocked == True))
    avg_r    = await db.execute(select(func.avg(ScanLog.risk_score)).where(*base_where))
    attacks_r = await db.execute(
        select(ScanLog.attack_type, func.count(ScanLog.id).label("cnt"))
        .where(*base_where).group_by(ScanLog.attack_type).order_by(desc("cnt"))
    )
    t = total_r.scalar() or 0
    b = blocked_r.scalar() or 0
    return {
        "total_requests": t, "blocked": b, "allowed": t - b,
        "block_rate": round((b / t * 100) if t else 0, 1),
        "avg_risk_score": round(float(avg_r.scalar() or 0), 1),
        "attack_breakdown": [{"attack_type": a or "None", "count": c} for a, c in attacks_r.all()],
    }


# ── ALLOWLIST ─────────────────────────────────────────────────────
@router.get("/api/allowlist", response_model=list[AllowlistOut])
async def get_allowlist(app_id: int, db: AsyncSession = Depends(get_db), u: User = Depends(verified_user)):
    r = await db.execute(
        select(Allowlist).where(Allowlist.app_id == app_id, Allowlist.user_id == u.id)
        .order_by(desc(Allowlist.created_at))
    )
    return r.scalars().all()


@router.post("/api/allowlist", response_model=AllowlistOut, status_code=201)
async def add_allowlist(body: AllowlistIn, db: AsyncSession = Depends(get_db), u: User = Depends(verified_user)):
    r = await db.execute(
        select(Application).where(Application.id == body.app_id, Application.owner_id == u.id)
    )
    if not r.scalar_one_or_none():
        raise HTTPException(404, {"error": "App not found", "code": "NOT_FOUND"})
    entry = Allowlist(user_id=u.id, app_id=body.app_id, pattern=body.pattern, note=body.note)
    db.add(entry)
    await db.flush()
    await db.refresh(entry)
    return entry


@router.delete("/api/allowlist/{entry_id}", response_model=Msg)
async def remove_allowlist(entry_id: int, db: AsyncSession = Depends(get_db), u: User = Depends(verified_user)):
    r = await db.execute(
        select(Allowlist).where(Allowlist.id == entry_id, Allowlist.user_id == u.id)
    )
    entry = r.scalar_one_or_none()
    if not entry:
        raise HTTPException(404, {"error": "Entry not found", "code": "NOT_FOUND"})
    await db.delete(entry)
    return Msg(message="Allowlist entry removed.")


# ── FEEDBACK (Accept / Reject scan results) ───────────────────────
@router.post("/api/feedback", response_model=FeedbackOut, status_code=201)
async def submit_feedback(
    body: FeedbackIn,
    db: AsyncSession = Depends(get_db),
    u: User = Depends(verified_user),
):
    """
    User accepts or rejects a scan result.
    - accept = "this prompt was fine, don't block it"
    - reject = "this prompt was dangerous, should have been blocked"
    Collected for model retraining.
    """
    # Verify the scan belongs to this user
    r = await db.execute(
        select(ScanLog).where(ScanLog.id == body.scan_log_id, ScanLog.user_id == u.id)
    )
    scan = r.scalar_one_or_none()
    if not scan:
        raise HTTPException(404, {"error": "Scan log not found", "code": "NOT_FOUND"})

    # Check for existing feedback (update if exists)
    existing_r = await db.execute(
        select(FeedbackLog).where(FeedbackLog.scan_log_id == body.scan_log_id)
    )
    existing = existing_r.scalar_one_or_none()
    if existing:
        existing.verdict = body.verdict
        existing.note = body.note
        await db.flush()
        await db.refresh(existing)
        return existing

    feedback = FeedbackLog(
        scan_log_id=body.scan_log_id,
        user_id=u.id,
        app_id=scan.app_id,
        verdict=body.verdict,
        note=body.note,
    )
    db.add(feedback)
    await db.flush()
    await db.refresh(feedback)
    return feedback


@router.get("/api/feedback")
async def get_feedback(
    app_id: int | None = None,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    u: User = Depends(verified_user),
):
    """Get all feedback entries with their scan data."""
    q = (
        select(FeedbackLog, ScanLog)
        .join(ScanLog, FeedbackLog.scan_log_id == ScanLog.id)
        .where(FeedbackLog.user_id == u.id)
        .order_by(desc(FeedbackLog.created_at))
        .limit(min(limit, 500))
    )
    if app_id:
        q = q.where(FeedbackLog.app_id == app_id)
    result = await db.execute(q)
    rows = result.all()
    return [
        {
            "feedback_id": fb.id,
            "scan_log_id": fb.scan_log_id,
            "app_id": fb.app_id,
            "verdict": fb.verdict,
            "note": fb.note,
            "feedback_at": fb.created_at,
            "prompt": scan.prompt,
            "risk_score": scan.risk_score,
            "attack_type": scan.attack_type,
            "blocked": scan.blocked,
            "scan_at": scan.created_at,
        }
        for fb, scan in rows
    ]


# ── SIMULATION ────────────────────────────────────────────────────
@router.post("/api/simulate-attack")
async def simulate(
    body: SimulateIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
    u: User = Depends(verified_user),
):
    if body.use_demo:
        r = await db.execute(
            select(Application).where(Application.owner_id == u.id, Application.is_demo == True)
        )
        app = r.scalar_one_or_none()
        if not app:
            raise HTTPException(404, {
                "error": "No demo app found. Create one from the Simulation page.",
                "code": "NO_DEMO_APP",
            })
    elif body.app_id:
        r = await db.execute(
            select(Application).where(Application.id == body.app_id, Application.owner_id == u.id)
        )
        app = r.scalar_one_or_none()
    else:
        r = await db.execute(
            select(Application).where(Application.owner_id == u.id, Application.is_active == True).limit(1)
        )
        app = r.scalar_one_or_none()

    if not app:
        raise HTTPException(404, {"error": "No active app found.", "code": "NO_APP"})

    ip = get_ip(request)
    detection = await run_detection(db, u, app, body.message, endpoint="simulation", ip=ip)

    if detection["blocked"]:
        bot_reply = "⚠️ Your request was flagged and blocked by PROMPTWALL."
    else:
        bot_reply = await _groq_reply(body.message)

    return {"bot_reply": bot_reply, "detection": detection}


async def _groq_reply(message: str) -> str:
    if settings.GROQ_API_KEY:
        try:
            import httpx
            async with httpx.AsyncClient(timeout=10) as c:
                r = await c.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
                    json={
                        "model": settings.GROQ_MODEL,
                        "messages": [
                            {"role": "system", "content": settings.SIMULATION_SYSTEM_PROMPT},
                            {"role": "user", "content": message},
                        ],
                        "max_tokens": 200,
                    },
                )
                if r.status_code == 200:
                    return r.json()["choices"][0]["message"]["content"]
        except Exception:
            pass
    msg = message.lower()
    if any(w in msg for w in ["balance", "account"]):
        return "Your demo account balance is $2,450.00. For real info, please visit a branch."
    if any(w in msg for w in ["transfer", "send"]):
        return "Transfers are processed within 1–3 business days via our secure portal."
    if any(w in msg for w in ["loan", "credit"]):
        return "We offer personal loans from $1,000–$50,000. Contact us for rates."
    if any(w in msg for w in ["hello", "hi", "hey"]):
        return "Hello! I'm SecureBank AI. How can I help you with your banking today?"
    return "Thank you for contacting SecureBank AI. How can I assist you?"


# ── STATUS ────────────────────────────────────────────────────────
@router.get("/api/status")
async def api_status():
    from ml_models.load_model import detector
    return {"status": "operational", "detector": detector.health()}

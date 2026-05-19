"""PROMPTWALL — Admin Routes (manayig@gmail.com only)"""
import csv, io
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from database import get_db
from models import User, Application, ScanLog, FeedbackLog
from auth import admin_user

router = APIRouter(prefix="/api/admin", tags=["Admin"])


@router.get("/stats")
async def stats(db: AsyncSession = Depends(get_db), _: User = Depends(admin_user)):
    users = await db.execute(select(func.count(User.id)))
    apps = await db.execute(select(func.count(Application.id)))
    scans = await db.execute(select(func.count(ScanLog.id)))
    blocked = await db.execute(select(func.count(ScanLog.id)).where(ScanLog.blocked == True))
    feedback = await db.execute(select(func.count(FeedbackLog.id)))
    t = scans.scalar() or 0
    b = blocked.scalar() or 0
    return {
        "total_users": users.scalar() or 0,
        "total_apps": apps.scalar() or 0,
        "total_scans": t,
        "total_blocked": b,
        "block_rate": round((b / t * 100) if t else 0, 1),
        "total_feedback": feedback.scalar() or 0,
    }


@router.get("/users")
async def all_users(search: str = "", limit: int = Query(100, le=500),
                    db: AsyncSession = Depends(get_db), _: User = Depends(admin_user)):
    q = select(User).order_by(desc(User.created_at)).limit(limit)
    r = await db.execute(q)
    users = r.scalars().all()
    if search:
        s = search.lower()
        users = [u for u in users if s in u.email.lower() or s in u.name.lower()]
    result = []
    for u in users:
        app_cnt = await db.execute(select(func.count(Application.id)).where(Application.owner_id == u.id))
        scan_cnt = await db.execute(select(func.count(ScanLog.id)).where(ScanLog.user_id == u.id))
        result.append({
            "id": u.id, "name": u.name, "email": u.email, "plan": "Free",
            "is_verified": u.is_verified, "is_admin": u.is_admin, "is_active": u.is_active,
            "apps": app_cnt.scalar() or 0, "scans": scan_cnt.scalar() or 0, "joined": u.created_at,
        })
    return result


@router.post("/users/{user_id}/action")
async def user_action(user_id: str, action: str,
                      db: AsyncSession = Depends(get_db), admin: User = Depends(admin_user)):
    from fastapi import HTTPException
    if user_id == admin.id:
        raise HTTPException(400, {"error": "Cannot modify own account"})
    r = await db.execute(select(User).where(User.id == user_id))
    u = r.scalar_one_or_none()
    if not u:
        raise HTTPException(404, {"error": "User not found"})
    if action == "suspend": u.is_active = False
    elif action == "unsuspend": u.is_active = True; u.failed_attempts = 0; u.locked_until = None
    elif action == "delete": await db.delete(u); return {"message": f"User {u.email} deleted."}
    elif action == "make-admin": u.is_admin = True
    elif action == "remove-admin": u.is_admin = False
    elif action == "unlock": u.locked_until = None; u.failed_attempts = 0
    else:
        raise HTTPException(400, {"error": f"Unknown action: {action}"})
    return {"message": f"Action '{action}' applied to {u.email}."}


@router.get("/apps")
async def all_apps(limit: int = Query(100, le=500),
                   db: AsyncSession = Depends(get_db), _: User = Depends(admin_user)):
    r = await db.execute(select(Application).order_by(desc(Application.created_at)).limit(limit))
    return [{"id": a.id, "name": a.name, "owner_id": a.owner_id, "is_active": a.is_active,
             "is_demo": a.is_demo, "total_requests": a.total_requests, "created_at": a.created_at}
            for a in r.scalars().all()]


@router.get("/logs")
async def all_logs(search: str = "", app_id: int | None = None,
                   limit: int = Query(200, le=1000),
                   db: AsyncSession = Depends(get_db), _: User = Depends(admin_user)):
    q = select(ScanLog).order_by(desc(ScanLog.created_at)).limit(limit)
    if app_id:
        q = q.where(ScanLog.app_id == app_id)
    r = await db.execute(q)
    logs = r.scalars().all()
    result = []
    for l in logs:
        if search and search.lower() not in (l.prompt or "").lower() and search.lower() not in (l.attack_type or "").lower():
            continue
        result.append({
            "id": l.id, "user_id": l.user_id, "app_id": l.app_id,
            "prompt": l.prompt, "risk_score": l.risk_score, "attack_type": l.attack_type,
            "blocked": l.blocked, "endpoint": l.endpoint, "ip_address": l.ip_address,
            "allowlist_override": l.allowlist_override, "created_at": l.created_at,
        })
    return result


@router.get("/export-csv")
async def export_csv(app_id: int | None = None,
                     db: AsyncSession = Depends(get_db), _: User = Depends(admin_user)):
    q = select(ScanLog).order_by(desc(ScanLog.created_at))
    if app_id:
        q = q.where(ScanLog.app_id == app_id)
    r = await db.execute(q)
    logs = r.scalars().all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id","user_id","app_id","prompt","risk_score","attack_type",
                     "blocked","endpoint","ip_address","allowlist_override","created_at"])
    for l in logs:
        writer.writerow([l.id,l.user_id,l.app_id,l.prompt,l.risk_score,l.attack_type,
                         l.blocked,l.endpoint,l.ip_address,l.allowlist_override,l.created_at])
    output.seek(0)
    date_str = datetime.utcnow().strftime("%Y%m%d")
    fname = f"promptwall_logs_all_{date_str}.csv" if not app_id else f"promptwall_logs_app{app_id}_{date_str}.csv"
    return StreamingResponse(io.BytesIO(output.getvalue().encode()),
                             media_type="text/csv",
                             headers={"Content-Disposition": f"attachment; filename={fname}"})


@router.get("/feedback")
async def all_feedback(app_id: int | None = None,
                       limit: int = Query(500, le=5000),
                       db: AsyncSession = Depends(get_db), _: User = Depends(admin_user)):
    """All user feedback — used for model retraining."""
    q = (select(FeedbackLog, ScanLog)
         .join(ScanLog, FeedbackLog.scan_log_id == ScanLog.id)
         .order_by(desc(FeedbackLog.created_at))
         .limit(limit))
    if app_id:
        q = q.where(FeedbackLog.app_id == app_id)
    result = await db.execute(q)
    return [
        {
            "feedback_id": fb.id, "scan_log_id": fb.scan_log_id,
            "user_id": fb.user_id, "app_id": fb.app_id,
            "verdict": fb.verdict, "note": fb.note, "feedback_at": fb.created_at,
            "prompt": scan.prompt, "risk_score": scan.risk_score,
            "attack_type": scan.attack_type, "model_said_blocked": scan.blocked,
        }
        for fb, scan in result.all()
    ]


@router.get("/export-feedback-csv")
async def export_feedback_csv(app_id: int | None = None,
                               db: AsyncSession = Depends(get_db), _: User = Depends(admin_user)):
    """Export feedback as CSV for model retraining."""
    q = (select(FeedbackLog, ScanLog)
         .join(ScanLog, FeedbackLog.scan_log_id == ScanLog.id)
         .order_by(desc(FeedbackLog.created_at)))
    if app_id:
        q = q.where(FeedbackLog.app_id == app_id)
    result = await db.execute(q)
    rows = result.all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["feedback_id","scan_log_id","user_id","app_id","verdict","note",
                     "feedback_at","prompt","risk_score","attack_type","model_said_blocked"])
    for fb, scan in rows:
        writer.writerow([fb.id, fb.scan_log_id, fb.user_id, fb.app_id, fb.verdict, fb.note,
                         fb.created_at, scan.prompt, scan.risk_score,
                         scan.attack_type, scan.blocked])
    output.seek(0)
    date_str = datetime.utcnow().strftime("%Y%m%d")
    fname = f"promptwall_feedback_{date_str}.csv"
    return StreamingResponse(io.BytesIO(output.getvalue().encode()),
                             media_type="text/csv",
                             headers={"Content-Disposition": f"attachment; filename={fname}"})

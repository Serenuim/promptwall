"""PROMPTWALL — Application Routes"""
import hashlib
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from database import get_db
from models import User, Application, ScanLog
from schemas import CreateAppIn, AppOut, AppCreatedOut, Msg
from services.detection_service import generate_api_key, DEMO_REQUEST_LIMIT
from auth import verified_user
from config import settings

router = APIRouter(prefix="/api/applications", tags=["Applications"])


@router.post("", response_model=AppCreatedOut, status_code=201)
async def create_app(body: CreateAppIn, db: AsyncSession = Depends(get_db), u: User = Depends(verified_user)):
    cnt_r = await db.execute(
        select(func.count(Application.id)).where(Application.owner_id == u.id, Application.is_demo == False)
    )
    if cnt_r.scalar() >= settings.FREE_MAX_APPS:
        raise HTTPException(429, {"error": f"Free plan limit of {settings.FREE_MAX_APPS} apps reached.", "code": "APP_LIMIT"})

    dup = await db.execute(select(Application).where(Application.owner_id == u.id, Application.name == body.name))
    if dup.scalar_one_or_none():
        raise HTTPException(409, {"error": "You already have an app with that name.", "code": "DUPLICATE"})

    raw, key_hash, prefix = generate_api_key()
    app = Application(
        name=body.name.strip(), description=body.description,
        api_key_hash=key_hash, api_key_prefix=prefix, owner_id=u.id, is_demo=False,
    )
    db.add(app)
    await db.flush()
    await db.refresh(app)
    return AppCreatedOut(
        id=app.id, name=app.name, description=app.description,
        api_key_prefix=app.api_key_prefix, is_active=app.is_active,
        is_demo=app.is_demo, total_requests=app.total_requests,
        demo_requests_used=app.demo_requests_used, created_at=app.created_at,
        raw_api_key=raw,
    )


@router.post("/demo", response_model=AppCreatedOut, status_code=201)
async def create_demo_app(db: AsyncSession = Depends(get_db), u: User = Depends(verified_user)):
    """Create or reset a demo app for simulation testing (10-request limit, not counted in daily limit)."""
    # Check if demo app already exists — if so, reset it
    existing = await db.execute(
        select(Application).where(Application.owner_id == u.id, Application.is_demo == True)
    )
    existing_app = existing.scalar_one_or_none()
    if existing_app:
        # Reset demo app
        raw, key_hash, prefix = generate_api_key()
        existing_app.api_key_hash = key_hash
        existing_app.api_key_prefix = prefix
        existing_app.demo_requests_used = 0
        existing_app.is_active = True
        await db.flush()
        await db.refresh(existing_app)
        return AppCreatedOut(
            id=existing_app.id, name=existing_app.name, description=existing_app.description,
            api_key_prefix=existing_app.api_key_prefix, is_active=existing_app.is_active,
            is_demo=existing_app.is_demo, total_requests=existing_app.total_requests,
            demo_requests_used=existing_app.demo_requests_used, created_at=existing_app.created_at,
            raw_api_key=raw,
        )

    raw, key_hash, prefix = generate_api_key()
    app = Application(
        name="Demo App", description="Simulation testing — 10 requests, free.",
        api_key_hash=key_hash, api_key_prefix=prefix, owner_id=u.id, is_demo=True,
    )
    db.add(app)
    await db.flush()
    await db.refresh(app)
    return AppCreatedOut(
        id=app.id, name=app.name, description=app.description,
        api_key_prefix=app.api_key_prefix, is_active=app.is_active,
        is_demo=app.is_demo, total_requests=app.total_requests,
        demo_requests_used=app.demo_requests_used, created_at=app.created_at,
        raw_api_key=raw,
    )


@router.get("", response_model=list[AppOut])
async def list_apps(db: AsyncSession = Depends(get_db), u: User = Depends(verified_user)):
    r = await db.execute(select(Application).where(Application.owner_id == u.id).order_by(Application.created_at.desc()))
    return r.scalars().all()


@router.get("/{app_id}", response_model=AppOut)
async def get_app(app_id: int, db: AsyncSession = Depends(get_db), u: User = Depends(verified_user)):
    r = await db.execute(select(Application).where(Application.id == app_id, Application.owner_id == u.id))
    app = r.scalar_one_or_none()
    if not app:
        raise HTTPException(404, {"error": "App not found", "code": "NOT_FOUND"})
    return app


@router.get("/{app_id}/usage")
async def app_usage(app_id: int, db: AsyncSession = Depends(get_db), u: User = Depends(verified_user)):
    r = await db.execute(select(Application).where(Application.id == app_id, Application.owner_id == u.id))
    app = r.scalar_one_or_none()
    if not app:
        raise HTTPException(404, {"error": "App not found", "code": "NOT_FOUND"})
    from datetime import datetime
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    cnt = await db.execute(
        select(func.count(ScanLog.id)).where(ScanLog.app_id == app_id, ScanLog.created_at >= month_start)
    )
    last_log = await db.execute(
        select(ScanLog).where(ScanLog.app_id == app_id).order_by(ScanLog.created_at.desc()).limit(1)
    )
    last = last_log.scalar_one_or_none()
    return {
        "app_id": app_id, "app_name": app.name, "is_demo": app.is_demo,
        "total_requests": app.total_requests,
        "requests_this_month": cnt.scalar() or 0,
        "daily_limit": DEMO_REQUEST_LIMIT if app.is_demo else settings.DAILY_REQUEST_LIMIT,
        "scans_used_today": app.demo_requests_used if app.is_demo else u.daily_scans,
        "last_used": last.created_at if last else None,
    }


@router.post("/{app_id}/regenerate", response_model=dict)
async def regenerate_key(app_id: int, db: AsyncSession = Depends(get_db), u: User = Depends(verified_user)):
    r = await db.execute(select(Application).where(Application.id == app_id, Application.owner_id == u.id))
    app = r.scalar_one_or_none()
    if not app:
        raise HTTPException(404, {"error": "App not found", "code": "NOT_FOUND"})
    raw, key_hash, prefix = generate_api_key()
    app.api_key_hash = key_hash
    app.api_key_prefix = prefix
    await db.flush()
    return {
        "message": "API key regenerated. Save the full key — it will NOT be shown again.",
        "raw_api_key": raw,
        "api_key_prefix": prefix,
    }


@router.post("/{app_id}/revoke", response_model=Msg)
async def revoke_app(app_id: int, db: AsyncSession = Depends(get_db), u: User = Depends(verified_user)):
    r = await db.execute(select(Application).where(Application.id == app_id, Application.owner_id == u.id))
    app = r.scalar_one_or_none()
    if not app:
        raise HTTPException(404, {"error": "App not found", "code": "NOT_FOUND"})
    app.is_active = False
    return Msg(message=f"API key for '{app.name}' has been revoked.")


@router.post("/{app_id}/activate", response_model=Msg)
async def activate_app(app_id: int, db: AsyncSession = Depends(get_db), u: User = Depends(verified_user)):
    r = await db.execute(select(Application).where(Application.id == app_id, Application.owner_id == u.id))
    app = r.scalar_one_or_none()
    if not app:
        raise HTTPException(404, {"error": "App not found", "code": "NOT_FOUND"})
    app.is_active = True
    return Msg(message=f"'{app.name}' has been reactivated.")


@router.delete("/{app_id}", response_model=Msg)
async def delete_app(app_id: int, db: AsyncSession = Depends(get_db), u: User = Depends(verified_user)):
    r = await db.execute(select(Application).where(Application.id == app_id, Application.owner_id == u.id))
    app = r.scalar_one_or_none()
    if not app:
        raise HTTPException(404, {"error": "App not found", "code": "NOT_FOUND"})
    await db.delete(app)
    return Msg(message=f"'{app.name}' deleted.")

"""PROMPTWALL — FastAPI Application"""
import logging
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from config import settings
from database import init_db
from routes.auth_routes import router as auth_router
from routes.user_routes import router as user_router
from routes.app_routes import router as app_router
from routes.api_routes import router as api_router
from routes.admin_routes import router as admin_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
log = logging.getLogger("promptwall")


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Starting PROMPTWALL...")
    await init_db()
    log.info("DB ready ✓")
    from ml_models.load_model import detector
    log.info(f"Detector: {detector.model_type} ✓")
    yield
    log.info("Shutting down.")


app = FastAPI(
    title="PROMPTWALL API",
    version=settings.APP_VERSION,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)


# ── Security Headers Middleware ────────────────────────────────────
class SecHeaders(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        resp = await call_next(request)
        resp.headers["X-Content-Type-Options"] = "nosniff"
        resp.headers["X-Frame-Options"] = "DENY"
        resp.headers["X-XSS-Protection"] = "1; mode=block"
        resp.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        resp.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        resp.headers["Cache-Control"] = "no-store"
        if not settings.DEBUG:
            resp.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return resp


# ── Request Logger ────────────────────────────────────────────────
class ReqLogger(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        t = time.perf_counter()
        resp = await call_next(request)
        ms = round((time.perf_counter() - t) * 1000, 1)
        log.info(f"{request.method} {request.url.path} → {resp.status_code} [{ms}ms]")
        resp.headers["X-Response-Time"] = f"{ms}ms"
        return resp


# ── CORS — reads from .env ────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-API-Key"],
    expose_headers=["X-Response-Time"],
)
app.add_middleware(SecHeaders)
app.add_middleware(ReqLogger)


# ── Exception Handlers ────────────────────────────────────────────
@app.exception_handler(404)
async def not_found(req, exc):
    return JSONResponse(status_code=404, content={"error": "Not found", "code": "NOT_FOUND"})

@app.exception_handler(500)
async def server_error(req, exc):
    log.error(f"500: {exc}")
    return JSONResponse(status_code=500, content={"error": "Internal server error", "code": "INTERNAL_ERROR"})


# ── Routers ───────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(user_router)
app.include_router(app_router)
app.include_router(api_router)
app.include_router(admin_router)


# ── Health ────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "operational", "version": settings.APP_VERSION}

@app.get("/")
async def root():
    return {"message": "PROMPTWALL API", "version": settings.APP_VERSION, "docs": "/docs" if settings.DEBUG else "disabled"}

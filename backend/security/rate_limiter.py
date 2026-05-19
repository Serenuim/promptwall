import time
from collections import defaultdict, deque
from threading import Lock
from fastapi import Request, HTTPException

_lock = Lock()
_windows: dict[str, deque] = defaultdict(deque)


def _check(key: str, limit: int, window: int = 60) -> bool:
    with _lock:
        w = _windows[key]
        cutoff = time.time() - window
        while w and w[0] < cutoff:
            w.popleft()
        if len(w) >= limit:
            return False
        w.append(time.time())
        return True


def get_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd: return fwd.split(",")[0].strip()
    rip = request.headers.get("x-real-ip")
    if rip: return rip.strip()
    return request.client.host if request.client else "unknown"


def limit_ip(request: Request, per_min: int = 60):
    ip = get_ip(request)
    if not _check(f"ip:{ip}", per_min, 60):
        raise HTTPException(429, detail={"error": "Too many requests", "code": "RATE_LIMITED"})


def limit_api_key(key: str, per_min: int = 20) -> bool:
    return _check(f"key:{key}", per_min, 60)

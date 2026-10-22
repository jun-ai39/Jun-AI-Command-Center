"""Browser request boundaries and bounded local login throttling."""

from collections import deque
from threading import Lock
from time import monotonic

from starlette.datastructures import Headers
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from app.core.config import CORS_ALLOWED_ORIGINS


class RequestSecurityMiddleware:
    """Protect the single-process local API before expensive request handling."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app
        self.login_attempts: deque[float] = deque()
        self.lock = Lock()

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = Headers(scope=scope)
        if scope["method"] not in {"GET", "HEAD", "OPTIONS"}:
            origin = headers.get("origin")
            if (
                origin is not None and origin not in CORS_ALLOWED_ORIGINS
            ) or headers.get("sec-fetch-site") == "cross-site":
                await JSONResponse(
                    {"detail": "Untrusted request origin."}, status_code=403
                )(scope, receive, send)
                return

        if scope["method"] == "POST" and scope["path"].rstrip("/") == "/auth/login":
            now = monotonic()
            with self.lock:
                while self.login_attempts and self.login_attempts[0] <= now - 60:
                    self.login_attempts.popleft()
                limited = len(self.login_attempts) >= 30
                if not limited:
                    self.login_attempts.append(now)
            if limited:
                await JSONResponse(
                    {"detail": "Too many login attempts. Try again later."},
                    status_code=429,
                    headers={"Retry-After": "60"},
                )(scope, receive, send)
                return

        await self.app(scope, receive, send)

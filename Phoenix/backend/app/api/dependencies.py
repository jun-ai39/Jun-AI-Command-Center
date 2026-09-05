"""Reusable time and authentication dependencies."""

from datetime import UTC, datetime
from typing import Annotated, Final
from zoneinfo import ZoneInfo

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import AUTH_SESSION_COOKIE_NAME, DASHBOARD_TIMEZONE
from app.core.security import hash_session_token
from app.db.session import get_db_session
from app.models.auth import UserAccount, UserSession

DASHBOARD_TIME_ZONE: Final[ZoneInfo] = ZoneInfo(DASHBOARD_TIMEZONE)


def get_current_time() -> datetime:
    """Return the current timezone-aware time used by dashboard responses."""
    return datetime.now(tz=DASHBOARD_TIME_ZONE)


DatabaseSession = Annotated[Session, Depends(get_db_session)]
SessionCookie = Annotated[str | None, Cookie(alias=AUTH_SESSION_COOKIE_NAME)]


def unauthorized() -> HTTPException:
    """Build the common response for missing, invalid, or expired sessions."""
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required.",
    )


def get_current_user(
    database_session: DatabaseSession,
    session_token: SessionCookie = None,
) -> UserAccount:
    """Return the active user for a valid opaque browser session."""
    if not session_token:
        raise unauthorized()
    auth_session = database_session.scalar(
        select(UserSession).where(
            UserSession.token_hash == hash_session_token(session_token)
        )
    )
    if auth_session is None:
        raise unauthorized()

    expires_at = auth_session.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    user = auth_session.user
    if expires_at <= datetime.now(tz=UTC) or not user.is_active:
        raise unauthorized()
    return user


CurrentUser = Annotated[UserAccount, Depends(get_current_user)]


def require_admin_user(current_user: CurrentUser) -> UserAccount:
    """Reject an authenticated user who lacks administrator privileges."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator permission required.",
        )
    return current_user


AdminUser = Annotated[UserAccount, Depends(require_admin_user)]

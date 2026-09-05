"""Local login, logout, and current-session endpoints."""

from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.api.dependencies import CurrentUser
from app.core.config import (
    AUTH_SESSION_COOKIE_NAME,
    AUTH_SESSION_COOKIE_SECURE,
    AUTH_SESSION_LIFETIME_HOURS,
)
from app.core.security import (
    DUMMY_PASSWORD_HASH,
    generate_session_token,
    hash_session_token,
    verify_password,
)
from app.db.session import get_db_session
from app.models.auth import UserAccount, UserSession
from app.schemas.auth import AuthenticatedUserResponse, LoginRequest
from app.services.auth import normalize_username

router = APIRouter(prefix="/auth", tags=["authentication"])
DatabaseSession = Annotated[Session, Depends(get_db_session)]
OptionalSessionCookie = Annotated[
    str | None,
    Cookie(alias=AUTH_SESSION_COOKIE_NAME),
]
SESSION_LIFETIME = timedelta(hours=AUTH_SESSION_LIFETIME_HOURS)


def authentication_failed() -> HTTPException:
    """Use one response for unknown users and incorrect passwords."""
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect username or password.",
    )


@router.post(
    "/login",
    response_model=AuthenticatedUserResponse,
    summary="ローカルユーザーとしてログインする",
)
def login(
    payload: LoginRequest,
    response: Response,
    database_session: DatabaseSession,
) -> AuthenticatedUserResponse:
    """Issue one revocable HttpOnly session cookie after password verification."""
    username = normalize_username(payload.username)
    user = database_session.scalar(
        select(UserAccount).where(UserAccount.username == username)
    )
    password_hash = user.password_hash if user is not None else DUMMY_PASSWORD_HASH
    password_matches = verify_password(payload.password, password_hash)
    if user is None or not password_matches or not user.is_active:
        raise authentication_failed()

    now = datetime.now(tz=UTC)
    database_session.execute(delete(UserSession).where(UserSession.expires_at <= now))
    raw_token = generate_session_token()
    database_session.add(
        UserSession(
            user=user,
            token_hash=hash_session_token(raw_token),
            expires_at=now + SESSION_LIFETIME,
        )
    )
    database_session.commit()
    response.set_cookie(
        key=AUTH_SESSION_COOKIE_NAME,
        value=raw_token,
        max_age=int(SESSION_LIFETIME.total_seconds()),
        path="/",
        secure=AUTH_SESSION_COOKIE_SECURE,
        httponly=True,
        samesite="strict",
    )
    return AuthenticatedUserResponse.model_validate(user)


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="現在のローカルセッションを終了する",
)
def logout(
    database_session: DatabaseSession,
    session_token: OptionalSessionCookie = None,
) -> Response:
    """Revoke the current database session and expire its browser cookie."""
    if session_token:
        database_session.execute(
            delete(UserSession).where(
                UserSession.token_hash == hash_session_token(session_token)
            )
        )
        database_session.commit()
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    response.delete_cookie(
        key=AUTH_SESSION_COOKIE_NAME,
        path="/",
        secure=AUTH_SESSION_COOKIE_SECURE,
        httponly=True,
        samesite="strict",
    )
    return response


@router.get(
    "/me",
    response_model=AuthenticatedUserResponse,
    summary="現在のログインユーザーを確認する",
)
def read_current_user(current_user: CurrentUser) -> AuthenticatedUserResponse:
    """Return only non-secret fields for the active local session."""
    return AuthenticatedUserResponse.model_validate(current_user)

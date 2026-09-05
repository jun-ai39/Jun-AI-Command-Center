"""Local user provisioning and authentication services."""

import re
from typing import Final

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.auth import UserAccount

USERNAME_PATTERN: Final[re.Pattern[str]] = re.compile(r"^[a-z0-9._-]{3,50}$")
MINIMUM_PASSWORD_LENGTH: Final[int] = 12
MAXIMUM_PASSWORD_LENGTH: Final[int] = 128


class InitialAdminError(ValueError):
    """Raised when the one-time local administrator cannot be created."""


def normalize_username(username: str) -> str:
    """Normalize a local login name for consistent lookup."""
    return username.strip().lower()


def validate_new_password(password: str) -> None:
    """Reject passwords that are too short or easy to mistype as strong."""
    if not MINIMUM_PASSWORD_LENGTH <= len(password) <= MAXIMUM_PASSWORD_LENGTH:
        raise InitialAdminError("Password must contain 12 to 128 characters.")
    if not any(character.isalpha() for character in password):
        raise InitialAdminError("Password must contain at least one letter.")
    if not any(character.isdigit() for character in password):
        raise InitialAdminError("Password must contain at least one number.")


def create_initial_admin(
    database_session: Session,
    *,
    username: str,
    password: str,
) -> UserAccount:
    """Create the first local administrator without a bundled default password."""
    normalized_username = normalize_username(username)
    if not USERNAME_PATTERN.fullmatch(normalized_username):
        raise InitialAdminError(
            "Username must use 3 to 50 lowercase letters, numbers, dots, "
            "underscores, or hyphens."
        )
    validate_new_password(password)
    if database_session.scalar(select(func.count()).select_from(UserAccount)):
        raise InitialAdminError("The initial administrator already exists.")

    user = UserAccount(
        username=normalized_username,
        password_hash=hash_password(password),
        role="admin",
    )
    database_session.add(user)
    try:
        database_session.commit()
    except IntegrityError as error:
        database_session.rollback()
        raise InitialAdminError("The administrator could not be created.") from error
    database_session.refresh(user)
    return user

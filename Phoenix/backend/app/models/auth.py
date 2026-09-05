"""Local Phoenix users and revocable browser sessions."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def utc_now() -> datetime:
    """Return a timezone-aware UTC timestamp for ORM writes."""
    return datetime.now(tz=UTC)


class UserAccount(Base):
    """One person allowed to sign in to the local Phoenix installation."""

    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "length(username) BETWEEN 3 AND 50",
            name="user_username_length",
        ),
        CheckConstraint(
            "username = lower(trim(username))",
            name="user_username_normalized",
        ),
        CheckConstraint(
            "role IN ('admin', 'user')",
            name="user_role_allowed",
        ),
        UniqueConstraint("username", name="uq_users_username"),
    )

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    username: Mapped[str] = mapped_column(String(50))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(
        String(16),
        default="user",
        server_default="user",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default="1",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        server_default=func.now(),
    )

    sessions: Mapped[list[UserSession]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class UserSession(Base):
    """One revocable login session whose raw browser token is never persisted."""

    __tablename__ = "user_sessions"
    __table_args__ = (
        CheckConstraint(
            "length(token_hash) = 64",
            name="user_session_token_hash_length",
        ),
        UniqueConstraint("token_hash", name="uq_user_sessions_token_hash"),
        Index("ix_user_sessions_user_expiry", "user_id", "expires_at"),
    )

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
    )
    token_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        server_default=func.now(),
    )

    user: Mapped[UserAccount] = relationship(back_populates="sessions")

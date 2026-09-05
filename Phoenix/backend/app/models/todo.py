"""Persistent ToDo model."""

from datetime import UTC, date, datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    Uuid,
    false,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def utc_now() -> datetime:
    """Return a timezone-aware UTC timestamp for ORM writes."""
    return datetime.now(tz=UTC)


class Todo(Base):
    """One actionable item shown on the Phoenix dashboard."""

    __tablename__ = "todos"
    __table_args__ = (
        CheckConstraint(
            "length(trim(title)) BETWEEN 1 AND 200",
            name="todo_title_length",
        ),
        CheckConstraint(
            "priority IN ('high', 'medium', 'low')",
            name="todo_priority_value",
        ),
        CheckConstraint(
            "category IS NULL OR length(trim(category)) BETWEEN 1 AND 30",
            name="todo_category_length",
        ),
        CheckConstraint(
            "is_archived = 0 OR is_completed = 1",
            name="todo_archive_requires_completion",
        ),
        Index(
            "ix_todos_is_archived_is_pinned_is_completed_due_date",
            "is_archived",
            "is_pinned",
            "is_completed",
            "due_date",
        ),
        Index("ix_todos_equipment_id_due_date", "equipment_id", "due_date"),
    )

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    due_date: Mapped[date | None] = mapped_column(Date)
    priority: Mapped[str] = mapped_column(
        String(6),
        default="medium",
        server_default="medium",
    )
    category: Mapped[str | None] = mapped_column(String(30))
    equipment_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("equipment.equipment_id", ondelete="SET NULL"),
    )
    is_pinned: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        server_default=false(),
    )
    is_completed: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        server_default=false(),
    )
    is_archived: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        server_default=false(),
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

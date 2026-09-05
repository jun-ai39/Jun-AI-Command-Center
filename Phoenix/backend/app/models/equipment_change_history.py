"""Persistent equipment improvement and specification change histories."""

from datetime import UTC, date, datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.equipment_master import Equipment
    from app.models.work_report import WorkReport


def utc_now() -> datetime:
    """Return a timezone-aware UTC timestamp for ORM writes."""
    return datetime.now(tz=UTC)


class EquipmentChangeHistory(Base):
    """One intentional physical or specification change to one equipment asset."""

    __tablename__ = "equipment_change_histories"
    __table_args__ = (
        CheckConstraint(
            "length(trim(improvement_point)) BETWEEN 1 AND 200",
            name="equipment_change_improvement_point_length",
        ),
        CheckConstraint(
            "length(trim(change_details)) BETWEEN 1 AND 2000",
            name="equipment_change_details_length",
        ),
        Index(
            "ix_equipment_change_histories_equipment_date",
            "equipment_id",
            "changed_on",
        ),
    )

    change_history_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    equipment_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("equipment.equipment_id", ondelete="RESTRICT"),
    )
    changed_on: Mapped[date] = mapped_column(Date)
    improvement_point: Mapped[str] = mapped_column(String(200))
    change_details: Mapped[str] = mapped_column(Text)
    work_report_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("work_reports.id", ondelete="SET NULL"),
        nullable=True,
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

    equipment: Mapped["Equipment"] = relationship()
    work_report: Mapped["WorkReport | None"] = relationship()

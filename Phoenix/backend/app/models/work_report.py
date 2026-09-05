"""Persistent work report model."""

from datetime import UTC, date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.equipment_master import Department, Equipment


def utc_now() -> datetime:
    """Return a timezone-aware UTC timestamp for ORM writes."""
    return datetime.now(tz=UTC)


class WorkReport(Base):
    """One mobile work report persisted by Phoenix OS."""

    __tablename__ = "work_reports"
    __table_args__ = (
        CheckConstraint(
            "category IS NULL OR category IN ('inspection', 'maintenance', "
            "'trouble', 'improvement', 'other')",
            name="work_report_category_value",
        ),
        CheckConstraint(
            "work_hours BETWEEN 0.25 AND 24",
            name="work_report_hours_range",
        ),
        CheckConstraint(
            "CAST(ROUND(work_hours * 100) AS INTEGER) % 25 = 0",
            name="work_report_hours_quarter",
        ),
        CheckConstraint(
            "length(trim(work_content)) BETWEEN 1 AND 2000",
            name="work_report_content_length",
        ),
        CheckConstraint(
            "phenomenon IS NULL OR length(trim(phenomenon)) BETWEEN 1 AND 2000",
            name="work_report_phenomenon_length",
        ),
        CheckConstraint(
            "cause IS NULL OR length(trim(cause)) BETWEEN 1 AND 2000",
            name="work_report_cause_length",
        ),
        CheckConstraint(
            "result IN ('completed', 'continued', 'follow_up')",
            name="work_report_result_value",
        ),
        CheckConstraint(
            "notes IS NULL OR length(trim(notes)) BETWEEN 1 AND 2000",
            name="work_report_notes_length",
        ),
        Index(
            "ix_work_reports_work_date_created_at",
            "work_date",
            "created_at",
        ),
        Index(
            "ix_work_reports_equipment_id_work_date",
            "equipment_id",
            "work_date",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    work_date: Mapped[date] = mapped_column(Date)
    department_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("departments.id", ondelete="RESTRICT"),
        nullable=True,
    )
    equipment_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("equipment.equipment_id", ondelete="RESTRICT"),
        nullable=True,
    )
    category: Mapped[str | None] = mapped_column(String(20), nullable=True)
    work_hours: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    phenomenon: Mapped[str | None] = mapped_column(Text, nullable=True)
    cause: Mapped[str | None] = mapped_column(Text, nullable=True)
    work_content: Mapped[str] = mapped_column(Text)
    result: Mapped[str] = mapped_column(String(20))
    notes: Mapped[str | None] = mapped_column(Text)
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

    department: Mapped["Department | None"] = relationship("Department")
    equipment: Mapped["Equipment | None"] = relationship("Equipment")

    @property
    def department_name(self) -> str | None:
        """Return the current department label for API display."""
        return self.department.name if self.department is not None else None

    @property
    def equipment_name(self) -> str | None:
        """Return the current equipment label for API display."""
        return self.equipment.name if self.equipment is not None else None

    @property
    def equipment_number(self) -> str | None:
        """Return the optional equipment call number for API display."""
        return self.equipment.equipment_number if self.equipment is not None else None

    @property
    def progress(self) -> str:
        """Expose the legacy result column using the Ver.1.0 progress term."""
        return self.result

    @property
    def is_legacy(self) -> bool:
        """Identify reports created before the seven-field format."""
        return self.phenomenon is None

    @property
    def legacy_category(self) -> str | None:
        """Keep the former category available as read-only legacy detail."""
        return self.category

    @property
    def legacy_work_hours(self) -> Decimal | None:
        """Keep the former work duration available as read-only legacy detail."""
        return self.work_hours

    @property
    def legacy_notes(self) -> str | None:
        """Keep the former notes available as read-only legacy detail."""
        return self.notes

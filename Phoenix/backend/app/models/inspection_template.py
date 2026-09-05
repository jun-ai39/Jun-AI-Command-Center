"""Persistent equipment-specific inspection item master model."""

from datetime import UTC, datetime
from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    Uuid,
    func,
    true,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.equipment_master import Equipment


def utc_now() -> datetime:
    """Return a timezone-aware UTC timestamp for ORM writes."""
    return datetime.now(tz=UTC)


class InspectionTemplateItem(Base):
    """One configurable inspection item belonging to one physical asset."""

    __tablename__ = "inspection_template_items"
    __table_args__ = (
        CheckConstraint(
            "cycle IN ('daily', 'weekly', 'monthly')",
            name="inspection_template_item_cycle_value",
        ),
        CheckConstraint(
            "length(trim(name)) BETWEEN 1 AND 100",
            name="inspection_template_item_name_length",
        ),
        CheckConstraint(
            "input_type IN ('number', 'status')",
            name="inspection_template_item_input_type_value",
        ),
        CheckConstraint(
            "unit IS NULL OR length(trim(unit)) BETWEEN 1 AND 30",
            name="inspection_template_item_unit_length",
        ),
        CheckConstraint(
            "normal_state IS NULL OR " "length(trim(normal_state)) BETWEEN 1 AND 100",
            name="inspection_template_item_normal_state_length",
        ),
        CheckConstraint(
            "check_method IS NULL OR length(trim(check_method)) BETWEEN 1 AND 300",
            name="inspection_template_item_check_method_length",
        ),
        CheckConstraint(
            "caution_note IS NULL OR length(trim(caution_note)) BETWEEN 1 AND 300",
            name="inspection_template_item_caution_note_length",
        ),
        CheckConstraint(
            "(input_type = 'number' AND normal_min IS NOT NULL AND "
            "normal_max IS NOT NULL AND normal_min <= normal_max AND "
            "normal_state IS NULL) OR "
            "(input_type = 'status' AND normal_min IS NULL AND "
            "normal_max IS NULL AND unit IS NULL AND normal_state IS NOT NULL)",
            name="inspection_template_item_normal_rule",
        ),
        CheckConstraint(
            "display_order BETWEEN 0 AND 9999",
            name="inspection_template_item_display_order_range",
        ),
        UniqueConstraint(
            "equipment_id",
            "cycle",
            "name",
            name="uq_inspection_template_items_equipment_cycle_name",
        ),
        Index(
            "ix_inspection_template_items_equipment_cycle_active_order",
            "equipment_id",
            "cycle",
            "is_active",
            "display_order",
            "name",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    equipment_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("equipment.equipment_id", ondelete="CASCADE"),
    )
    cycle: Mapped[str] = mapped_column(String(10))
    name: Mapped[str] = mapped_column(String(100))
    input_type: Mapped[str] = mapped_column(String(10))
    unit: Mapped[str | None] = mapped_column(String(30))
    normal_min: Mapped[Decimal | None] = mapped_column(Numeric(12, 3))
    normal_max: Mapped[Decimal | None] = mapped_column(Numeric(12, 3))
    normal_state: Mapped[str | None] = mapped_column(String(100))
    check_method: Mapped[str | None] = mapped_column(String(300))
    caution_note: Mapped[str | None] = mapped_column(String(300))
    display_order: Mapped[int] = mapped_column(
        Integer,
        default=0,
        server_default="0",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default=true(),
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

    equipment: Mapped["Equipment"] = relationship(
        back_populates="inspection_template_items",
    )

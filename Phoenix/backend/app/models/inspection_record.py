"""Persistent structured equipment inspection records."""

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
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.equipment_master import Equipment
    from app.models.inspection_template import InspectionTemplateItem
    from app.models.work_report import WorkReport


def utc_now() -> datetime:
    """Return a timezone-aware UTC timestamp for ORM writes."""
    return datetime.now(tz=UTC)


class InspectionRecord(Base):
    """One completed equipment inspection for a defined recurrence period."""

    __tablename__ = "inspection_records"
    __table_args__ = (
        CheckConstraint(
            "cycle IN ('daily', 'weekly', 'monthly')",
            name="inspection_record_cycle_value",
        ),
        CheckConstraint(
            "(cycle = 'daily' AND length(period_key) = 10) OR "
            "(cycle = 'weekly' AND length(period_key) = 8) OR "
            "(cycle = 'monthly' AND length(period_key) = 7)",
            name="inspection_record_period_key_shape",
        ),
        CheckConstraint(
            "overall_judgment IN ('normal', 'abnormal')",
            name="inspection_record_overall_judgment_value",
        ),
        UniqueConstraint(
            "equipment_id",
            "cycle",
            "period_key",
            name="uq_inspection_records_equipment_cycle_period",
        ),
        Index(
            "ix_inspection_records_equipment_cycle_date",
            "equipment_id",
            "cycle",
            "inspection_date",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    inspection_date: Mapped[date] = mapped_column(Date)
    equipment_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("equipment.equipment_id", ondelete="RESTRICT"),
    )
    cycle: Mapped[str] = mapped_column(String(10))
    period_key: Mapped[str] = mapped_column(String(10))
    overall_judgment: Mapped[str] = mapped_column(String(10))
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

    linked_work_report: Mapped["WorkReport | None"] = relationship(
        "WorkReport",
        uselist=False,
        viewonly=True,
        foreign_keys="WorkReport.source_inspection_id",
    )
    equipment: Mapped["Equipment"] = relationship(back_populates="inspection_records")
    items: Mapped[list["InspectionRecordItem"]] = relationship(
        back_populates="record",
        cascade="all, delete-orphan",
        order_by="InspectionRecordItem.display_order, InspectionRecordItem.name",
    )

    @property
    def equipment_name(self) -> str:
        """Return the current equipment label for API display."""
        return self.equipment.name

    @property
    def equipment_number(self) -> str | None:
        """Return the optional equipment call number for API display."""
        return self.equipment.equipment_number


class InspectionRecordItem(Base):
    """One measured value and immutable criteria snapshot within a record."""

    __tablename__ = "inspection_record_items"
    __table_args__ = (
        CheckConstraint(
            "length(trim(name)) BETWEEN 1 AND 100",
            name="inspection_record_item_name_length",
        ),
        CheckConstraint(
            "input_type IN ('number', 'status')",
            name="inspection_record_item_input_type_value",
        ),
        CheckConstraint(
            "unit IS NULL OR length(trim(unit)) BETWEEN 1 AND 30",
            name="inspection_record_item_unit_length",
        ),
        CheckConstraint(
            "normal_state IS NULL OR " "length(trim(normal_state)) BETWEEN 1 AND 100",
            name="inspection_record_item_normal_state_length",
        ),
        CheckConstraint(
            "judgment IN ('normal', 'abnormal')",
            name="inspection_record_item_judgment_value",
        ),
        CheckConstraint(
            "(input_type = 'number' AND number_value IS NOT NULL AND "
            "status_value IS NULL AND normal_min IS NOT NULL AND "
            "normal_max IS NOT NULL AND normal_min <= normal_max AND "
            "normal_state IS NULL) OR "
            "(input_type = 'status' AND number_value IS NULL AND "
            "status_value IN ('normal', 'abnormal') AND unit IS NULL AND "
            "normal_min IS NULL AND normal_max IS NULL AND "
            "normal_state IS NOT NULL)",
            name="inspection_record_item_value_rule",
        ),
        CheckConstraint(
            "(input_type = 'number' AND "
            "((number_value BETWEEN normal_min AND normal_max AND "
            "judgment = 'normal') OR "
            "((number_value < normal_min OR number_value > normal_max) AND "
            "judgment = 'abnormal'))) OR "
            "(input_type = 'status' AND judgment = status_value)",
            name="inspection_record_item_judgment_rule",
        ),
        CheckConstraint(
            "display_order BETWEEN 0 AND 9999",
            name="inspection_record_item_display_order_range",
        ),
        UniqueConstraint(
            "inspection_record_id",
            "template_item_id",
            name="uq_inspection_record_items_record_template",
        ),
        Index(
            "ix_inspection_record_items_record_order",
            "inspection_record_id",
            "display_order",
            "name",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    inspection_record_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("inspection_records.id", ondelete="CASCADE"),
    )
    template_item_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("inspection_template_items.id", ondelete="RESTRICT"),
    )
    name: Mapped[str] = mapped_column(String(100))
    input_type: Mapped[str] = mapped_column(String(10))
    number_value: Mapped[Decimal | None] = mapped_column(Numeric(12, 3))
    status_value: Mapped[str | None] = mapped_column(String(10))
    unit: Mapped[str | None] = mapped_column(String(30))
    normal_min: Mapped[Decimal | None] = mapped_column(Numeric(12, 3))
    normal_max: Mapped[Decimal | None] = mapped_column(Numeric(12, 3))
    normal_state: Mapped[str | None] = mapped_column(String(100))
    judgment: Mapped[str] = mapped_column(String(10))
    display_order: Mapped[int] = mapped_column(Integer)

    record: Mapped[InspectionRecord] = relationship(back_populates="items")
    template_item: Mapped["InspectionTemplateItem"] = relationship()

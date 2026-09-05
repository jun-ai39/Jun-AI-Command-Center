"""Persistent department, manufacturer, and equipment master models."""

from datetime import UTC, datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    Uuid,
    func,
    true,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.inspection_record import InspectionRecord
    from app.models.inspection_template import InspectionTemplateItem
    from app.models.troubleshooting import TroubleshootingGuide


def utc_now() -> datetime:
    """Return a timezone-aware UTC timestamp for ORM writes."""
    return datetime.now(tz=UTC)


class Department(Base):
    """One configurable factory department used to group equipment."""

    __tablename__ = "departments"
    __table_args__ = (
        CheckConstraint(
            "length(trim(name)) BETWEEN 1 AND 50",
            name="department_name_length",
        ),
        CheckConstraint(
            "display_order >= 0",
            name="department_display_order_nonnegative",
        ),
        UniqueConstraint("name", name="uq_departments_name"),
        Index(
            "ix_departments_is_active_display_order_name",
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
    name: Mapped[str] = mapped_column(String(50))
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

    equipment: Mapped[list["Equipment"]] = relationship(
        back_populates="department",
    )


class Manufacturer(Base):
    """One reusable equipment manufacturer."""

    __tablename__ = "manufacturers"
    __table_args__ = (
        CheckConstraint(
            "length(trim(name)) BETWEEN 1 AND 100",
            name="manufacturer_name_length",
        ),
        UniqueConstraint("name", name="uq_manufacturers_name"),
        Index(
            "ix_manufacturers_is_active_name",
            "is_active",
            "name",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    name: Mapped[str] = mapped_column(String(100))
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

    equipment: Mapped[list["Equipment"]] = relationship(
        back_populates="manufacturer",
    )


class Equipment(Base):
    """One uniquely identifiable physical equipment asset."""

    __tablename__ = "equipment"
    __table_args__ = (
        CheckConstraint(
            "length(trim(name)) BETWEEN 1 AND 100",
            name="equipment_name_length",
        ),
        CheckConstraint(
            "equipment_number IS NULL OR "
            "length(trim(equipment_number)) BETWEEN 1 AND 100",
            name="equipment_number_length",
        ),
        CheckConstraint(
            "model_number IS NULL OR " "length(trim(model_number)) BETWEEN 1 AND 100",
            name="equipment_model_number_length",
        ),
        CheckConstraint(
            "photo_path IS NULL OR length(trim(photo_path)) BETWEEN 1 AND 500",
            name="equipment_photo_path_length",
        ),
        Index(
            "ix_equipment_department_id_manufacturer_id_name",
            "department_id",
            "manufacturer_id",
            "name",
        ),
        Index(
            "ix_equipment_is_active_name_model_number",
            "is_active",
            "name",
            "model_number",
        ),
    )

    equipment_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    department_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("departments.id", ondelete="RESTRICT"),
    )
    manufacturer_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("manufacturers.id", ondelete="RESTRICT"),
    )
    name: Mapped[str] = mapped_column(String(100))
    equipment_number: Mapped[str | None] = mapped_column(String(100))
    model_number: Mapped[str | None] = mapped_column(String(100))
    photo_path: Mapped[str | None] = mapped_column(String(500))
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

    department: Mapped[Department] = relationship(back_populates="equipment")
    manufacturer: Mapped[Manufacturer] = relationship(back_populates="equipment")
    inspection_template_items: Mapped[list["InspectionTemplateItem"]] = relationship(
        back_populates="equipment",
    )
    inspection_records: Mapped[list["InspectionRecord"]] = relationship(
        back_populates="equipment",
    )
    troubleshooting_guides: Mapped[list["TroubleshootingGuide"]] = relationship(
        back_populates="equipment",
    )

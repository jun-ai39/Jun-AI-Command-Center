"""Persistent equipment troubleshooting guide graph models."""

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
    from app.models.equipment_master import Equipment


def utc_now() -> datetime:
    """Return a timezone-aware UTC timestamp for ORM writes."""
    return datetime.now(tz=UTC)


class TroubleshootingGuide(Base):
    """One symptom-led troubleshooting guide for one physical asset."""

    __tablename__ = "troubleshooting_guides"
    __table_args__ = (
        CheckConstraint(
            "length(trim(symptom)) BETWEEN 1 AND 200",
            name="troubleshooting_guide_symptom_length",
        ),
        CheckConstraint(
            "display_order BETWEEN 0 AND 9999",
            name="troubleshooting_guide_display_order_range",
        ),
        Index(
            "ix_troubleshooting_guides_equipment_active_order",
            "equipment_id",
            "is_active",
            "display_order",
            "symptom",
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
    symptom: Mapped[str] = mapped_column(String(200))
    # API writes a guide first, then its steps, and finally this reference in one
    # transaction. The nullable storage state is never returned as a valid guide.
    start_step_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("troubleshooting_steps.id", ondelete="SET NULL"),
    )
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
        back_populates="troubleshooting_guides",
    )
    steps: Mapped[list["TroubleshootingStep"]] = relationship(
        back_populates="guide",
        cascade="all, delete-orphan",
        foreign_keys="TroubleshootingStep.guide_id",
    )
    branches: Mapped[list["TroubleshootingBranch"]] = relationship(
        back_populates="guide",
        cascade="all, delete-orphan",
    )


class TroubleshootingStep(Base):
    """One question or terminal point within a troubleshooting guide."""

    __tablename__ = "troubleshooting_steps"
    __table_args__ = (
        CheckConstraint(
            "step_type IN ('question', 'complete', 'handoff')",
            name="troubleshooting_step_type_value",
        ),
        CheckConstraint(
            "length(trim(prompt)) BETWEEN 1 AND 500",
            name="troubleshooting_step_prompt_length",
        ),
        CheckConstraint(
            "check_method IS NULL OR " "length(trim(check_method)) BETWEEN 1 AND 500",
            name="troubleshooting_step_check_method_length",
        ),
        CheckConstraint(
            "caution_note IS NULL OR " "length(trim(caution_note)) BETWEEN 1 AND 500",
            name="troubleshooting_step_caution_note_length",
        ),
        Index(
            "ix_troubleshooting_steps_guide_type",
            "guide_id",
            "step_type",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
    )
    guide_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("troubleshooting_guides.id", ondelete="CASCADE"),
    )
    step_type: Mapped[str] = mapped_column(String(10))
    prompt: Mapped[str] = mapped_column(String(500))
    check_method: Mapped[str | None] = mapped_column(String(500))
    caution_note: Mapped[str | None] = mapped_column(String(500))

    guide: Mapped[TroubleshootingGuide] = relationship(
        back_populates="steps",
        foreign_keys=[guide_id],
    )


class TroubleshootingBranch(Base):
    """One YES, NO, or unknown transition between guide steps."""

    __tablename__ = "troubleshooting_branches"
    __table_args__ = (
        CheckConstraint(
            "answer IN ('yes', 'no', 'unknown')",
            name="troubleshooting_branch_answer_value",
        ),
        UniqueConstraint(
            "from_step_id",
            "answer",
            name="uq_troubleshooting_branches_from_step_answer",
        ),
        Index(
            "ix_troubleshooting_branches_guide_from",
            "guide_id",
            "from_step_id",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    guide_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("troubleshooting_guides.id", ondelete="CASCADE"),
    )
    from_step_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("troubleshooting_steps.id", ondelete="RESTRICT"),
    )
    answer: Mapped[str] = mapped_column(String(10))
    to_step_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("troubleshooting_steps.id", ondelete="RESTRICT"),
    )

    guide: Mapped[TroubleshootingGuide] = relationship(
        back_populates="branches",
    )

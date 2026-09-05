"""Structured equipment inspection record API schemas."""

from datetime import UTC, date, datetime
from typing import Literal, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.inspection_template import InspectionCycle, InspectionInputType

InspectionStatusValue = Literal["normal", "abnormal"]
InspectionJudgment = Literal["normal", "abnormal"]
InspectionCompletionStatus = Literal["pending", "completed"]


class InspectionRecordItemInput(BaseModel):
    """One operator-entered value tied to an active template item."""

    model_config = ConfigDict(extra="forbid")

    template_item_id: UUID
    number_value: float | None = Field(
        default=None,
        ge=-999_999_999,
        le=999_999_999,
        allow_inf_nan=False,
    )
    status_value: InspectionStatusValue | None = None

    @model_validator(mode="after")
    def require_exactly_one_value(self) -> Self:
        """Prevent ambiguous item submissions before template validation."""
        has_number = self.number_value is not None
        has_status = self.status_value is not None
        if has_number == has_status:
            raise ValueError("Exactly one inspection value is required.")
        return self


class InspectionRecordCreate(BaseModel):
    """Validated input accepted when completing one equipment inspection."""

    model_config = ConfigDict(extra="forbid")

    inspection_date: date
    equipment_id: UUID
    cycle: InspectionCycle
    items: list[InspectionRecordItemInput] = Field(min_length=1, max_length=100)


class InspectionRecordItemResponse(BaseModel):
    """One persisted value with the criteria used for its judgment."""

    model_config = ConfigDict(extra="forbid", from_attributes=True)

    id: UUID
    template_item_id: UUID
    name: str
    input_type: InspectionInputType
    number_value: float | None
    status_value: InspectionStatusValue | None
    unit: str | None
    normal_min: float | None
    normal_max: float | None
    normal_state: str | None
    judgment: InspectionJudgment
    display_order: int


class InspectionRecordResponse(BaseModel):
    """Public representation of one completed structured inspection."""

    model_config = ConfigDict(extra="forbid", from_attributes=True)

    id: UUID
    inspection_date: date
    equipment_id: UUID
    equipment_name: str
    equipment_number: str | None
    cycle: InspectionCycle
    period_key: str
    overall_judgment: InspectionJudgment
    items: list[InspectionRecordItemResponse]
    created_at: datetime
    updated_at: datetime

    @field_validator("created_at", "updated_at")
    @classmethod
    def normalize_timestamp(cls, value: datetime) -> datetime:
        """Represent SQLite timestamps consistently as UTC."""
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)


class InspectionRecordListResponse(BaseModel):
    """Paginated equipment inspection history."""

    model_config = ConfigDict(extra="forbid")

    items: list[InspectionRecordResponse]
    total: int = Field(ge=0)
    limit: int = Field(ge=1, le=50)
    offset: int = Field(ge=0)


class InspectionCycleStatusSummary(BaseModel):
    """Completion counts for one recurring inspection cycle."""

    model_config = ConfigDict(extra="forbid")

    cycle: InspectionCycle
    total: int = Field(ge=0)
    completed: int = Field(ge=0)
    pending: int = Field(ge=0)

    @model_validator(mode="after")
    def validate_counts(self) -> Self:
        """Keep the cycle total equal to completed plus pending units."""
        if self.total != self.completed + self.pending:
            raise ValueError("Inspection cycle status counts are inconsistent.")
        return self


class InspectionScheduleStatusItem(BaseModel):
    """One equipment-cycle unit due in the target recurrence period."""

    model_config = ConfigDict(extra="forbid")

    equipment_id: UUID
    equipment_name: str
    equipment_number: str | None
    department_id: UUID
    department_name: str
    cycle: InspectionCycle
    period_key: str
    template_item_count: int = Field(ge=1)
    completion_status: InspectionCompletionStatus
    inspection_record_id: UUID | None
    inspection_date: date | None
    overall_judgment: InspectionJudgment | None

    @model_validator(mode="after")
    def validate_completion_details(self) -> Self:
        """Require record details only when the inspection is completed."""
        record_details = (
            self.inspection_record_id,
            self.inspection_date,
            self.overall_judgment,
        )
        if self.completion_status == "completed" and any(
            value is None for value in record_details
        ):
            raise ValueError("Completed inspections require record details.")
        if self.completion_status == "pending" and any(
            value is not None for value in record_details
        ):
            raise ValueError("Pending inspections cannot include record details.")
        return self


class InspectionScheduleStatusResponse(BaseModel):
    """Daily, weekly, and monthly completion state for one target date."""

    model_config = ConfigDict(extra="forbid")

    target_date: date
    cycle_summaries: list[InspectionCycleStatusSummary]
    items: list[InspectionScheduleStatusItem]

    @model_validator(mode="after")
    def validate_summaries(self) -> Self:
        """Ensure every cycle appears once and exactly summarizes the items."""
        expected_cycles: tuple[InspectionCycle, ...] = (
            "daily",
            "weekly",
            "monthly",
        )
        if [summary.cycle for summary in self.cycle_summaries] != list(expected_cycles):
            raise ValueError("Inspection cycle summaries must use the fixed order.")
        for summary in self.cycle_summaries:
            cycle_items = [item for item in self.items if item.cycle == summary.cycle]
            completed = sum(
                item.completion_status == "completed" for item in cycle_items
            )
            if (
                summary.total != len(cycle_items)
                or summary.completed != completed
                or summary.pending != len(cycle_items) - completed
            ):
                raise ValueError("Inspection cycle summary does not match its items.")
        return self

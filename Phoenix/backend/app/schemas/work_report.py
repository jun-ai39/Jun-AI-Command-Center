"""Work report API request and response schemas."""

from datetime import UTC, date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

LegacyWorkReportCategory = Literal[
    "inspection",
    "maintenance",
    "trouble",
    "improvement",
    "other",
]
WorkReportProgress = Literal["completed", "continued", "follow_up"]


class WorkReportCreate(BaseModel):
    """Validated input accepted when saving one work report."""

    model_config = ConfigDict(extra="forbid")

    work_date: date
    department_id: UUID
    equipment_id: UUID
    phenomenon: str = Field(min_length=1, max_length=2000)
    cause: str | None = Field(default=None, max_length=2000)
    work_content: str = Field(min_length=1, max_length=2000)
    progress: WorkReportProgress

    @field_validator("phenomenon", "work_content", mode="before")
    @classmethod
    def normalize_required_text(cls, value: object) -> object:
        """Trim required report text before applying length checks."""
        return value.strip() if isinstance(value, str) else value

    @field_validator("cause", mode="before")
    @classmethod
    def normalize_cause(cls, value: object) -> object:
        """Store an unresolved blank cause as no cause."""
        if not isinstance(value, str):
            return value
        normalized = value.strip()
        return normalized or None


class WorkReportUpdate(WorkReportCreate):
    """Validated replacement fields accepted when editing one work report."""


class WorkReportResponse(BaseModel):
    """Public representation of one persisted work report."""

    model_config = ConfigDict(extra="forbid", from_attributes=True)

    id: UUID
    work_date: date
    department_id: UUID | None
    equipment_id: UUID | None
    department_name: str | None
    equipment_name: str | None
    equipment_number: str | None
    phenomenon: str | None
    cause: str | None
    work_content: str
    progress: WorkReportProgress
    is_legacy: bool
    legacy_category: LegacyWorkReportCategory | None
    legacy_work_hours: float | None
    legacy_notes: str | None
    created_at: datetime
    updated_at: datetime

    @field_validator("created_at", "updated_at")
    @classmethod
    def normalize_timestamp(cls, value: datetime) -> datetime:
        """Represent SQLite timestamps consistently as UTC."""
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)


class WorkReportListResponse(BaseModel):
    """Paginated work reports with the database total."""

    model_config = ConfigDict(extra="forbid")

    items: list[WorkReportResponse]
    total: int = Field(ge=0)
    limit: int = Field(ge=1, le=50)
    offset: int = Field(ge=0)


class WorkReportAttentionSummaryResponse(BaseModel):
    """Counts of saved reports that still require attention."""

    model_config = ConfigDict(extra="forbid")

    continued_count: int = Field(ge=0)
    follow_up_count: int = Field(ge=0)
    attention_count: int = Field(ge=0)

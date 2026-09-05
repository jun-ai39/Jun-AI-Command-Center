"""Equipment improvement and specification change history API schemas."""

from datetime import UTC, date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class EquipmentChangeHistoryCreate(BaseModel):
    """Validated input for one intentional equipment change."""

    model_config = ConfigDict(extra="forbid")

    equipment_id: UUID
    changed_on: date
    improvement_point: str = Field(min_length=1, max_length=200)
    change_details: str = Field(min_length=1, max_length=2000)
    work_report_id: UUID | None = None

    @field_validator("improvement_point", "change_details", mode="before")
    @classmethod
    def normalize_required_text(cls, value: object) -> object:
        """Trim required change text before applying length checks."""
        return value.strip() if isinstance(value, str) else value


class EquipmentChangeHistoryResponse(BaseModel):
    """Public representation of one persisted equipment change."""

    model_config = ConfigDict(extra="forbid", from_attributes=True)

    change_history_id: UUID
    equipment_id: UUID
    changed_on: date
    improvement_point: str
    change_details: str
    work_report_id: UUID | None
    created_at: datetime
    updated_at: datetime

    @field_validator("created_at", "updated_at")
    @classmethod
    def normalize_timestamp(cls, value: datetime) -> datetime:
        """Represent SQLite timestamps consistently as UTC."""
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)


class EquipmentChangeHistoryListResponse(BaseModel):
    """Paginated equipment change histories for one physical asset."""

    model_config = ConfigDict(extra="forbid")

    items: list[EquipmentChangeHistoryResponse]
    total: int = Field(ge=0)
    limit: int = Field(ge=1, le=50)
    offset: int = Field(ge=0)

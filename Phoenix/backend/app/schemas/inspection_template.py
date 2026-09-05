"""Inspection item master API request and response schemas."""

from datetime import UTC, datetime
from typing import Literal, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

InspectionCycle = Literal["daily", "weekly", "monthly"]
InspectionInputType = Literal["number", "status"]


def normalize_required_text(value: object) -> object:
    """Trim required text before applying length validation."""
    return value.strip() if isinstance(value, str) else value


def normalize_optional_text(value: object) -> object:
    """Trim optional text and represent a blank as no value."""
    if not isinstance(value, str):
        return value
    normalized = value.strip()
    return normalized or None


class InspectionTemplateItemCreate(BaseModel):
    """Validated input accepted for one equipment inspection item."""

    model_config = ConfigDict(extra="forbid")

    equipment_id: UUID
    cycle: InspectionCycle
    name: str = Field(min_length=1, max_length=100)
    input_type: InspectionInputType
    unit: str | None = Field(default=None, max_length=30)
    normal_min: float | None = Field(
        default=None,
        ge=-999_999_999,
        le=999_999_999,
        allow_inf_nan=False,
    )
    normal_max: float | None = Field(
        default=None,
        ge=-999_999_999,
        le=999_999_999,
        allow_inf_nan=False,
    )
    normal_state: str | None = Field(default=None, max_length=100)
    check_method: str | None = Field(default=None, max_length=300)
    caution_note: str | None = Field(default=None, max_length=300)
    display_order: int = Field(default=0, ge=0, le=9999)
    is_active: bool = True

    _normalize_name = field_validator("name", mode="before")(normalize_required_text)
    _normalize_optional_fields = field_validator(
        "unit",
        "normal_state",
        "check_method",
        "caution_note",
        mode="before",
    )(normalize_optional_text)

    @model_validator(mode="after")
    def validate_normal_rule(self) -> Self:
        """Require structured criteria that match the selected input type."""
        if self.input_type == "number":
            if self.normal_min is None or self.normal_max is None:
                raise ValueError("Number items require normal_min and normal_max.")
            if self.normal_min > self.normal_max:
                raise ValueError("normal_min must not exceed normal_max.")
            if self.normal_state is not None:
                raise ValueError("Number items cannot define normal_state.")
        else:
            if self.normal_state is None:
                raise ValueError("Status items require normal_state.")
            if self.normal_min is not None or self.normal_max is not None:
                raise ValueError("Status items cannot define numeric limits.")
            if self.unit is not None:
                raise ValueError("Status items cannot define a unit.")
        return self


class InspectionTemplateGuideUpdate(BaseModel):
    """Validated guide-only update for an existing inspection item."""

    model_config = ConfigDict(extra="forbid")

    check_method: str | None = Field(max_length=300)
    caution_note: str | None = Field(max_length=300)

    _normalize_optional_fields = field_validator(
        "check_method",
        "caution_note",
        mode="before",
    )(normalize_optional_text)


class InspectionTemplateItemResponse(BaseModel):
    """Public representation of one persisted inspection item."""

    model_config = ConfigDict(extra="forbid", from_attributes=True)

    id: UUID
    equipment_id: UUID
    cycle: InspectionCycle
    name: str
    input_type: InspectionInputType
    unit: str | None
    normal_min: float | None
    normal_max: float | None
    normal_state: str | None
    check_method: str | None
    caution_note: str | None
    display_order: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    @field_validator("created_at", "updated_at")
    @classmethod
    def normalize_timestamp(cls, value: datetime) -> datetime:
        """Represent SQLite timestamps consistently as UTC."""
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)


class InspectionTemplateItemListResponse(BaseModel):
    """Paginated inspection item master collection."""

    model_config = ConfigDict(extra="forbid")

    items: list[InspectionTemplateItemResponse]
    total: int = Field(ge=0)
    limit: int = Field(ge=1, le=100)
    offset: int = Field(ge=0)

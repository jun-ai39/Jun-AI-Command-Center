"""Equipment master API request and response schemas."""

from datetime import UTC, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


def normalize_required_text(value: object) -> object:
    """Trim a required text value before applying length validation."""
    return value.strip() if isinstance(value, str) else value


def normalize_optional_text(value: object) -> object:
    """Trim optional text and represent blank text as no value."""
    if not isinstance(value, str):
        return value
    normalized = value.strip()
    return normalized or None


class TimestampedResponse(BaseModel):
    """Shared timestamp fields returned by equipment master endpoints."""

    model_config = ConfigDict(extra="forbid", from_attributes=True)

    created_at: datetime
    updated_at: datetime

    @field_validator("created_at", "updated_at")
    @classmethod
    def normalize_timestamp(cls, value: datetime) -> datetime:
        """Represent SQLite timestamps consistently as UTC."""
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)


class DepartmentCreate(BaseModel):
    """Validated input accepted when creating one department."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=50)
    display_order: int = Field(default=0, ge=0)
    is_active: bool = True

    _normalize_name = field_validator("name", mode="before")(normalize_required_text)


class DepartmentResponse(TimestampedResponse):
    """Public representation of one department."""

    id: UUID
    name: str
    display_order: int
    is_active: bool


class DepartmentListResponse(BaseModel):
    """Paginated department collection."""

    model_config = ConfigDict(extra="forbid")

    items: list[DepartmentResponse]
    total: int = Field(ge=0)
    limit: int = Field(ge=1, le=100)
    offset: int = Field(ge=0)


class ManufacturerCreate(BaseModel):
    """Validated input accepted when creating one manufacturer."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=100)
    is_active: bool = True

    _normalize_name = field_validator("name", mode="before")(normalize_required_text)


class ManufacturerResponse(TimestampedResponse):
    """Public representation of one manufacturer."""

    id: UUID
    name: str
    is_active: bool


class ManufacturerListResponse(BaseModel):
    """Paginated manufacturer collection."""

    model_config = ConfigDict(extra="forbid")

    items: list[ManufacturerResponse]
    total: int = Field(ge=0)
    limit: int = Field(ge=1, le=100)
    offset: int = Field(ge=0)


class EquipmentCreate(BaseModel):
    """Validated input accepted when creating one equipment asset."""

    model_config = ConfigDict(extra="forbid")

    department_id: UUID
    manufacturer_id: UUID
    name: str = Field(min_length=1, max_length=100)
    equipment_number: str | None = Field(default=None, max_length=100)
    model_number: str | None = Field(default=None, max_length=100)
    photo_path: str | None = Field(default=None, max_length=500)
    is_active: bool = True

    _normalize_name = field_validator("name", mode="before")(normalize_required_text)
    _normalize_optional_fields = field_validator(
        "equipment_number",
        "model_number",
        "photo_path",
        mode="before",
    )(normalize_optional_text)


class EquipmentResponse(TimestampedResponse):
    """Public representation of one uniquely identified equipment asset."""

    equipment_id: UUID
    department_id: UUID
    manufacturer_id: UUID
    name: str
    equipment_number: str | None
    model_number: str | None
    photo_path: str | None
    is_active: bool


class EquipmentListResponse(BaseModel):
    """Paginated equipment collection."""

    model_config = ConfigDict(extra="forbid")

    items: list[EquipmentResponse]
    total: int = Field(ge=0)
    limit: int = Field(ge=1, le=100)
    offset: int = Field(ge=0)

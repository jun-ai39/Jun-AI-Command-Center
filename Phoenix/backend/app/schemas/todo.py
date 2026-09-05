"""ToDo API request and response schemas."""

from datetime import UTC, date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

TodoPriority = Literal["high", "medium", "low"]


class TodoCreate(BaseModel):
    """Validated input accepted when creating a ToDo item."""

    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    due_date: date | None = None
    priority: TodoPriority = "medium"
    category: str | None = Field(default=None, min_length=1, max_length=30)
    equipment_id: UUID | None = None
    is_pinned: bool = False
    is_completed: bool = False

    @field_validator("title", mode="before")
    @classmethod
    def normalize_title(cls, value: object) -> object:
        """Trim surrounding whitespace before applying length checks."""
        return value.strip() if isinstance(value, str) else value

    @field_validator("description", mode="before")
    @classmethod
    def normalize_description(cls, value: object) -> object:
        """Store a blank optional description as no description."""
        if not isinstance(value, str):
            return value
        normalized = value.strip()
        return normalized or None

    @field_validator("category", mode="before")
    @classmethod
    def normalize_category(cls, value: object) -> object:
        """Store a blank optional category as no category."""
        if not isinstance(value, str):
            return value
        normalized = value.strip()
        return normalized or None


class TodoUpdate(BaseModel):
    """Validated fields accepted when partially updating a ToDo item."""

    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    due_date: date | None = None
    priority: TodoPriority = "medium"
    category: str | None = Field(default=None, min_length=1, max_length=30)
    equipment_id: UUID | None = None
    is_pinned: bool | None = None
    is_completed: bool | None = None
    is_archived: bool | None = None

    @field_validator("title", mode="before")
    @classmethod
    def normalize_title(cls, value: object) -> object:
        """Trim a supplied title before validating its length."""
        return value.strip() if isinstance(value, str) else value

    @field_validator("description", mode="before")
    @classmethod
    def normalize_description(cls, value: object) -> object:
        """Normalize a blank supplied description to no description."""
        if not isinstance(value, str):
            return value
        normalized = value.strip()
        return normalized or None

    @field_validator("category", mode="before")
    @classmethod
    def normalize_category(cls, value: object) -> object:
        """Normalize a blank supplied category to no category."""
        if not isinstance(value, str):
            return value
        normalized = value.strip()
        return normalized or None

    @model_validator(mode="after")
    def require_at_least_one_field(self) -> "TodoUpdate":
        """Reject requests that would not change any field."""
        if not self.model_fields_set:
            raise ValueError("At least one field must be supplied.")
        return self


class TodoResponse(BaseModel):
    """Public representation of a persisted ToDo item."""

    model_config = ConfigDict(extra="forbid", from_attributes=True)

    id: UUID
    title: str
    description: str | None
    due_date: date | None
    priority: TodoPriority
    category: str | None
    equipment_id: UUID | None
    is_pinned: bool
    is_completed: bool
    is_archived: bool
    created_at: datetime
    updated_at: datetime

    @field_validator("created_at", "updated_at")
    @classmethod
    def normalize_timestamp(cls, value: datetime) -> datetime:
        """Represent SQLite timestamps consistently as UTC."""
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)


class TodoListResponse(BaseModel):
    """Paginated ToDo collection."""

    model_config = ConfigDict(extra="forbid")

    items: list[TodoResponse]
    total: int = Field(ge=0)
    limit: int = Field(ge=1, le=100)
    offset: int = Field(ge=0)


class TodoDueSummaryResponse(BaseModel):
    """Pending maintenance schedules due on or before one local date."""

    model_config = ConfigDict(extra="forbid")

    target_date: date
    today_items: list[TodoResponse]
    overdue_items: list[TodoResponse]

"""Schemas that expose authentication state without secret values."""

from datetime import UTC, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class LoginRequest(BaseModel):
    """Credentials supplied only to the login endpoint."""

    model_config = ConfigDict(extra="forbid")

    username: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1, max_length=128)


class AuthenticatedUserResponse(BaseModel):
    """Safe public representation of the signed-in local user."""

    model_config = ConfigDict(extra="forbid", from_attributes=True)

    id: UUID
    username: str
    role: str
    is_active: bool
    created_at: datetime

    @field_validator("created_at")
    @classmethod
    def normalize_timestamp(cls, value: datetime) -> datetime:
        """Represent SQLite timestamps consistently as UTC."""
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)

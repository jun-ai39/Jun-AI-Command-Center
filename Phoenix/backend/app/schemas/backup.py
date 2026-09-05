"""Safe response schemas for local database backups."""

from datetime import datetime
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class BackupCreatedResponse(BaseModel):
    """Metadata for a completed backup without its private filesystem path."""

    model_config = ConfigDict(extra="forbid", from_attributes=True)

    filename: str = Field(
        pattern=r"^phoenix-backup-\d{8}T\d{12}Z-[0-9a-f]{8}\.sqlite3$"
    )
    created_at: datetime
    size_bytes: int = Field(gt=0)
    integrity_status: Literal["ok"]


class BackupIntegrityStatus(StrEnum):
    """Integrity result for a stored backup file."""

    OK = "ok"
    INVALID = "invalid"


class RestorePhase(StrEnum):
    """Safe restore lifecycle states shown to an administrator."""

    NONE = "none"
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"


class BackupListItem(BaseModel):
    """One local backup without its private filesystem path."""

    model_config = ConfigDict(extra="forbid", from_attributes=True)

    filename: str = Field(
        pattern=r"^phoenix-backup-\d{8}T\d{12}Z-[0-9a-f]{8}\.sqlite3$"
    )
    created_at: datetime
    size_bytes: int = Field(ge=0)
    integrity_status: BackupIntegrityStatus
    restorable: bool


class RestoreStatusResponse(BaseModel):
    """Restore state without local filesystem details."""

    model_config = ConfigDict(extra="forbid", from_attributes=True)

    phase: RestorePhase
    filename: str | None = Field(
        default=None,
        pattern=r"^phoenix-backup-\d{8}T\d{12}Z-[0-9a-f]{8}\.sqlite3$",
    )
    safety_backup_filename: str | None = Field(
        default=None,
        pattern=r"^phoenix-backup-\d{8}T\d{12}Z-[0-9a-f]{8}\.sqlite3$",
    )
    restart_required: bool


class BackupCatalogResponse(BaseModel):
    """Verified local backups and the current restore state."""

    model_config = ConfigDict(extra="forbid")

    items: list[BackupListItem]
    total: int = Field(ge=0)
    restore_status: RestoreStatusResponse


class RestoreScheduleRequest(BaseModel):
    """Explicit restore confirmation that must repeat the selected filename."""

    model_config = ConfigDict(extra="forbid")

    confirmation: str = Field(min_length=1, max_length=120)


class RestoreScheduledResponse(BaseModel):
    """Result of safely staging a restore for the next API start."""

    model_config = ConfigDict(extra="forbid", from_attributes=True)

    filename: str = Field(
        pattern=r"^phoenix-backup-\d{8}T\d{12}Z-[0-9a-f]{8}\.sqlite3$"
    )
    safety_backup_filename: str = Field(
        pattern=r"^phoenix-backup-\d{8}T\d{12}Z-[0-9a-f]{8}\.sqlite3$"
    )
    restart_required: Literal[True]

"""Create verified local backups without exposing database paths."""

import json
import os
import re
import sqlite3
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from sqlalchemy.engine import make_url

BACKUP_FILENAME_PATTERN = re.compile(
    r"^phoenix-backup-(?P<timestamp>\d{8}T\d{12}Z)-[0-9a-f]{8}\.sqlite3$"
)
RESTORE_MARKER_FILENAME = ".phoenix-restore-pending.json"
RESTORE_STAGING_FILENAME = ".phoenix-restore-pending.sqlite3"
RESTORE_RECEIPT_FILENAME = ".phoenix-restore-completed.json"


class BackupError(RuntimeError):
    """Raised when a verified backup cannot be completed."""


class BackupUnavailableError(BackupError):
    """Raised when the configured database is not a local SQLite file."""


class BackupRevisionError(BackupError):
    """Raised when a backup schema does not match the active database."""


class RestorePendingError(BackupError):
    """Raised when another verified restore is already awaiting restart."""


@dataclass(frozen=True)
class CreatedBackup:
    """Safe backup metadata returned to the API layer."""

    filename: str
    created_at: datetime
    size_bytes: int
    integrity_status: str = "ok"


@dataclass(frozen=True)
class AvailableBackup:
    """One local backup inspected for restore eligibility."""

    filename: str
    created_at: datetime
    size_bytes: int
    integrity_status: str
    restorable: bool


@dataclass(frozen=True)
class ScheduledRestore:
    """Safe metadata for a restore staged for the next API start."""

    filename: str
    safety_backup_filename: str
    restart_required: bool = True


@dataclass(frozen=True)
class RestoreStatus:
    """Last known restore lifecycle state without private paths."""

    phase: str
    filename: str | None = None
    safety_backup_filename: str | None = None
    restart_required: bool = False


def resolve_sqlite_database_path(database_url: str) -> Path:
    """Resolve one configured file-backed SQLite URL without creating a file."""
    url = make_url(database_url)
    if url.get_backend_name() != "sqlite" or not url.database:
        raise BackupUnavailableError("A file-backed SQLite database is required.")
    if url.database == ":memory:":
        raise BackupUnavailableError(
            "An in-memory SQLite database cannot be backed up."
        )
    return Path(url.database).expanduser().resolve()


def _read_database_revision(database_path: Path) -> str:
    """Read the single Alembic revision required for a compatible restore."""
    try:
        with sqlite3.connect(database_path) as connection:
            row = connection.execute(
                "SELECT version_num FROM alembic_version"
            ).fetchone()
    except sqlite3.Error as error:
        raise BackupRevisionError("The database revision could not be read.") from error
    if row is None or not isinstance(row[0], str) or not row[0]:
        raise BackupRevisionError("The database revision is missing.")
    return row[0]


def _has_valid_integrity(database_path: Path) -> bool:
    """Check a known file without creating or modifying it."""
    if not database_path.is_file():
        return False
    try:
        with sqlite3.connect(database_path) as connection:
            connection.execute("PRAGMA query_only=ON")
            return connection.execute("PRAGMA integrity_check").fetchone() == ("ok",)
    except sqlite3.Error:
        return False


def _resolve_backup_path(backup_directory: Path, filename: str) -> Path:
    """Resolve one strict backup basename inside the configured folder."""
    if not BACKUP_FILENAME_PATTERN.fullmatch(filename):
        raise BackupUnavailableError("The backup filename is invalid.")
    directory = backup_directory.expanduser().resolve()
    backup_path = (directory / filename).resolve()
    if backup_path.parent != directory or not backup_path.is_file():
        raise BackupUnavailableError("The selected backup does not exist.")
    return backup_path


def create_sqlite_backup(
    database_url: str,
    backup_directory: Path,
    *,
    created_at: datetime | None = None,
) -> CreatedBackup:
    """Create, verify, and atomically publish one SQLite backup file."""
    source_path = resolve_sqlite_database_path(database_url)
    if not source_path.is_file():
        raise BackupUnavailableError("The configured SQLite database does not exist.")

    timestamp = (created_at or datetime.now(tz=UTC)).astimezone(UTC)
    filename = (
        f"phoenix-backup-{timestamp:%Y%m%dT%H%M%S%fZ}-" f"{uuid4().hex[:8]}.sqlite3"
    )
    destination_directory = backup_directory.expanduser().resolve()
    destination_directory.mkdir(parents=True, exist_ok=True)
    try:
        os.chmod(destination_directory, 0o700)
    except OSError:
        # Windows may not support POSIX permission bits; the folder remains local
        # and database files are already excluded from version control.
        pass

    final_path = destination_directory / filename
    temporary_path = destination_directory / f".{filename}.pending"
    try:
        with (
            sqlite3.connect(source_path) as source_connection,
            sqlite3.connect(temporary_path) as backup_connection,
        ):
            source_connection.backup(backup_connection)
            integrity_row = backup_connection.execute(
                "PRAGMA integrity_check"
            ).fetchone()
            if integrity_row != ("ok",):
                raise BackupError("SQLite integrity verification failed.")
        try:
            os.chmod(temporary_path, 0o600)
        except OSError:
            pass
        temporary_path.replace(final_path)
    except (OSError, sqlite3.Error, BackupError) as error:
        temporary_path.unlink(missing_ok=True)
        if isinstance(error, BackupError):
            raise
        raise BackupError("SQLite backup creation failed.") from error

    return CreatedBackup(
        filename=filename,
        created_at=timestamp,
        size_bytes=final_path.stat().st_size,
    )


def list_sqlite_backups(backup_directory: Path) -> list[AvailableBackup]:
    """Inspect strict local backup files and return newest first."""
    directory = backup_directory.expanduser().resolve()
    if not directory.is_dir():
        return []
    items: list[AvailableBackup] = []
    for backup_path in directory.iterdir():
        match = BACKUP_FILENAME_PATTERN.fullmatch(backup_path.name)
        if match is None or not backup_path.is_file():
            continue
        created_at = datetime.strptime(
            match.group("timestamp"), "%Y%m%dT%H%M%S%fZ"
        ).replace(tzinfo=UTC)
        integrity_ok = _has_valid_integrity(backup_path)
        items.append(
            AvailableBackup(
                filename=backup_path.name,
                created_at=created_at,
                size_bytes=backup_path.stat().st_size,
                integrity_status="ok" if integrity_ok else "invalid",
                restorable=integrity_ok,
            )
        )
    return sorted(items, key=lambda item: item.created_at, reverse=True)


def _write_restore_state(path: Path, payload: dict[str, str]) -> None:
    """Write restore metadata atomically without exposing filesystem paths."""
    temporary_path = path.with_suffix(f"{path.suffix}.tmp")
    temporary_path.write_text(json.dumps(payload), encoding="utf-8")
    try:
        os.chmod(temporary_path, 0o600)
    except OSError:
        pass
    temporary_path.replace(path)


def _copy_verified_database(source_path: Path, destination_path: Path) -> None:
    """Copy one SQLite file through the online backup API and verify the copy."""
    temporary_path = destination_path.with_suffix(f"{destination_path.suffix}.tmp")
    try:
        with (
            sqlite3.connect(source_path) as source_connection,
            sqlite3.connect(temporary_path) as destination_connection,
        ):
            source_connection.backup(destination_connection)
        if not _has_valid_integrity(temporary_path):
            raise BackupError("The staged restore failed integrity verification.")
        temporary_path.replace(destination_path)
    except (OSError, sqlite3.Error, BackupError) as error:
        temporary_path.unlink(missing_ok=True)
        if isinstance(error, BackupError):
            raise
        raise BackupError("The restore candidate could not be staged.") from error


def schedule_sqlite_restore(
    database_url: str,
    backup_directory: Path,
    filename: str,
) -> ScheduledRestore:
    """Stage a verified backup for replacement before the next DB connection."""
    database_path = resolve_sqlite_database_path(database_url)
    if not database_path.is_file():
        raise BackupUnavailableError("The configured SQLite database does not exist.")
    selected_backup_path = _resolve_backup_path(backup_directory, filename)
    if not _has_valid_integrity(selected_backup_path):
        raise BackupError("The selected backup failed integrity verification.")
    if _read_database_revision(selected_backup_path) != _read_database_revision(
        database_path
    ):
        raise BackupRevisionError("The backup revision does not match the database.")

    marker_path = database_path.parent / RESTORE_MARKER_FILENAME
    staging_path = database_path.parent / RESTORE_STAGING_FILENAME
    if marker_path.exists() or staging_path.exists():
        raise RestorePendingError("Another restore is already pending.")

    safety_backup = create_sqlite_backup(database_url, backup_directory)
    try:
        _copy_verified_database(selected_backup_path, staging_path)
        _write_restore_state(
            marker_path,
            {
                "filename": filename,
                "safety_backup_filename": safety_backup.filename,
                "requested_at": datetime.now(tz=UTC).isoformat(),
            },
        )
    except (OSError, BackupError):
        staging_path.unlink(missing_ok=True)
        marker_path.unlink(missing_ok=True)
        raise
    return ScheduledRestore(
        filename=filename,
        safety_backup_filename=safety_backup.filename,
    )


def _load_restore_state(path: Path) -> dict[str, str]:
    """Read and validate the safe filename fields stored in a restore marker."""
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise BackupError("The restore marker is invalid.") from error
    if not isinstance(payload, dict):
        raise BackupError("The restore marker is invalid.")
    filename = payload.get("filename")
    safety_filename = payload.get("safety_backup_filename")
    if (
        not isinstance(filename, str)
        or BACKUP_FILENAME_PATTERN.fullmatch(filename) is None
        or not isinstance(safety_filename, str)
        or BACKUP_FILENAME_PATTERN.fullmatch(safety_filename) is None
    ):
        raise BackupError("The restore marker contains invalid filenames.")
    return {"filename": filename, "safety_backup_filename": safety_filename}


def apply_pending_sqlite_restore(database_url: str) -> RestoreStatus:
    """Apply a staged restore before SQLAlchemy opens the configured database."""
    database_path = resolve_sqlite_database_path(database_url)
    marker_path = database_path.parent / RESTORE_MARKER_FILENAME
    staging_path = database_path.parent / RESTORE_STAGING_FILENAME
    receipt_path = database_path.parent / RESTORE_RECEIPT_FILENAME
    if not marker_path.is_file():
        return read_restore_status(database_url)

    filename: str | None = None
    safety_filename: str | None = None
    try:
        state = _load_restore_state(marker_path)
        filename = state["filename"]
        safety_filename = state["safety_backup_filename"]
        if not _has_valid_integrity(staging_path):
            raise BackupError("The staged restore is not a valid SQLite database.")
        if _read_database_revision(staging_path) != _read_database_revision(
            database_path
        ):
            raise BackupRevisionError("The staged revision no longer matches.")
        with sqlite3.connect(staging_path) as connection:
            connection.execute("DELETE FROM user_sessions")
            connection.commit()
        if not _has_valid_integrity(staging_path):
            raise BackupError("The staged restore changed unexpectedly.")
        staging_path.replace(database_path)
        marker_path.unlink(missing_ok=True)
        status = RestoreStatus(
            phase="completed",
            filename=filename,
            safety_backup_filename=safety_filename,
        )
    except (OSError, sqlite3.Error, BackupError):
        staging_path.unlink(missing_ok=True)
        marker_path.unlink(missing_ok=True)
        status = RestoreStatus(
            phase="failed",
            filename=filename,
            safety_backup_filename=safety_filename,
        )

    _write_restore_state(
        receipt_path,
        {
            "phase": status.phase,
            "filename": status.filename or "",
            "safety_backup_filename": status.safety_backup_filename or "",
            "applied_at": datetime.now(tz=UTC).isoformat(),
        },
    )
    return status


def read_restore_status(database_url: str) -> RestoreStatus:
    """Return pending or last completed restore state without private paths."""
    database_path = resolve_sqlite_database_path(database_url)
    marker_path = database_path.parent / RESTORE_MARKER_FILENAME
    receipt_path = database_path.parent / RESTORE_RECEIPT_FILENAME
    if marker_path.is_file():
        try:
            state = _load_restore_state(marker_path)
        except BackupError:
            return RestoreStatus(phase="failed")
        return RestoreStatus(
            phase="pending",
            filename=state["filename"],
            safety_backup_filename=state["safety_backup_filename"],
            restart_required=True,
        )
    if receipt_path.is_file():
        try:
            payload = json.loads(receipt_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return RestoreStatus(phase="failed")
        phase = payload.get("phase")
        filename = payload.get("filename")
        safety_filename = payload.get("safety_backup_filename")
        if phase not in {"completed", "failed"}:
            return RestoreStatus(phase="failed")
        safe_filename = (
            filename
            if isinstance(filename, str) and BACKUP_FILENAME_PATTERN.fullmatch(filename)
            else None
        )
        safe_safety_filename = (
            safety_filename
            if isinstance(safety_filename, str)
            and BACKUP_FILENAME_PATTERN.fullmatch(safety_filename)
            else None
        )
        return RestoreStatus(
            phase=phase,
            filename=safe_filename,
            safety_backup_filename=safe_safety_filename,
        )
    return RestoreStatus(phase="none")

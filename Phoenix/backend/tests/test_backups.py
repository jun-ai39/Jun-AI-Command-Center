"""Tests for verified administrator-only SQLite backups."""

import sqlite3
from datetime import UTC, datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import get_current_user
from app.main import app
from app.models.auth import UserAccount
from app.services.backup import (
    RESTORE_MARKER_FILENAME,
    RESTORE_RECEIPT_FILENAME,
    RESTORE_STAGING_FILENAME,
    BackupError,
    BackupRevisionError,
    BackupUnavailableError,
    apply_pending_sqlite_restore,
    create_sqlite_backup,
    list_sqlite_backups,
    read_restore_status,
    resolve_sqlite_database_path,
    schedule_sqlite_restore,
)

pytestmark = pytest.mark.usefixtures("authenticated_business_api")

client = TestClient(app)


def create_source_database(
    path: Path,
    *,
    content: str = "架空の包装機点検",
    revision: str = "20260828_0017",
    session_count: int = 1,
) -> None:
    """Create one fictional SQLite database for an isolated backup test."""
    with sqlite3.connect(path) as connection:
        connection.execute("CREATE TABLE work_reports (content TEXT NOT NULL)")
        connection.execute("CREATE TABLE alembic_version (version_num TEXT NOT NULL)")
        connection.execute("CREATE TABLE user_sessions (token_hash TEXT NOT NULL)")
        connection.execute(
            "INSERT INTO work_reports (content) VALUES (?)",
            (content,),
        )
        connection.execute(
            "INSERT INTO alembic_version (version_num) VALUES (?)",
            (revision,),
        )
        connection.executemany(
            "INSERT INTO user_sessions (token_hash) VALUES (?)",
            [(f"fictional-session-{index}",) for index in range(session_count)],
        )
        connection.commit()


def test_backup_service_creates_verified_snapshot_without_changing_source(
    tmp_path: Path,
) -> None:
    """The service should copy committed data and expose only safe metadata."""
    source_path = tmp_path / "source.sqlite3"
    create_source_database(source_path)
    source_size = source_path.stat().st_size
    created_at = datetime(2026, 8, 29, 1, 2, 3, 456789, tzinfo=UTC)

    result = create_sqlite_backup(
        f"sqlite:///{source_path.as_posix()}",
        tmp_path / "backups",
        created_at=created_at,
    )

    backup_path = tmp_path / "backups" / result.filename
    assert result.created_at == created_at
    assert result.size_bytes == backup_path.stat().st_size
    assert result.integrity_status == "ok"
    assert result.filename.startswith("phoenix-backup-20260829T010203456789Z-")
    assert source_path.stat().st_size == source_size
    assert not list((tmp_path / "backups").glob("*.pending"))
    with sqlite3.connect(backup_path) as connection:
        assert connection.execute("PRAGMA integrity_check").fetchone() == ("ok",)
        assert connection.execute("SELECT content FROM work_reports").fetchone() == (
            "架空の包装機点検",
        )


@pytest.mark.parametrize(
    "database_url",
    ("sqlite:///:memory:", "postgresql://localhost/phoenix"),
)
def test_backup_service_rejects_non_file_sqlite_sources(database_url: str) -> None:
    """The local backup implementation must not guess at unsupported sources."""
    with pytest.raises(BackupUnavailableError):
        resolve_sqlite_database_path(database_url)


def test_backup_service_removes_partial_file_when_source_is_invalid(
    tmp_path: Path,
) -> None:
    """A failed backup must not leave a file that looks complete."""
    source_path = tmp_path / "invalid.sqlite3"
    source_path.write_text("not a sqlite database", encoding="utf-8")
    backup_directory = tmp_path / "backups"

    with pytest.raises(BackupError):
        create_sqlite_backup(
            f"sqlite:///{source_path.as_posix()}",
            backup_directory,
        )

    assert not list(backup_directory.iterdir())


def test_backup_catalog_marks_corrupt_files_and_orders_newest_first(
    tmp_path: Path,
) -> None:
    """Only strict filenames should appear and corruption must be explicit."""
    source_path = tmp_path / "catalog-source.sqlite3"
    backup_directory = tmp_path / "backups"
    create_source_database(source_path)
    older = create_sqlite_backup(
        f"sqlite:///{source_path.as_posix()}",
        backup_directory,
        created_at=datetime(2026, 8, 28, tzinfo=UTC),
    )
    newer = create_sqlite_backup(
        f"sqlite:///{source_path.as_posix()}",
        backup_directory,
        created_at=datetime(2026, 8, 29, tzinfo=UTC),
    )
    invalid_name = "phoenix-backup-20260829T120000000000Z-deadbeef.sqlite3"
    (backup_directory / invalid_name).write_text("invalid", encoding="utf-8")
    (backup_directory / "unrelated.txt").write_text("ignored", encoding="utf-8")

    items = list_sqlite_backups(backup_directory)

    assert [item.filename for item in items] == [
        invalid_name,
        newer.filename,
        older.filename,
    ]
    assert items[0].integrity_status == "invalid"
    assert items[0].restorable is False
    assert all(item.restorable for item in items[1:])


def test_restore_is_staged_then_applied_before_database_use(tmp_path: Path) -> None:
    """The live file should change only when the pending startup step runs."""
    database_path = tmp_path / "phoenix.sqlite3"
    backup_source_path = tmp_path / "older.sqlite3"
    backup_directory = tmp_path / "backups"
    create_source_database(database_path, content="現在の架空データ", session_count=2)
    create_source_database(
        backup_source_path,
        content="復元対象の架空データ",
        session_count=3,
    )
    selected = create_sqlite_backup(
        f"sqlite:///{backup_source_path.as_posix()}",
        backup_directory,
    )
    database_url = f"sqlite:///{database_path.as_posix()}"

    scheduled = schedule_sqlite_restore(
        database_url,
        backup_directory,
        selected.filename,
    )

    assert scheduled.restart_required is True
    assert scheduled.filename == selected.filename
    assert (tmp_path / RESTORE_MARKER_FILENAME).is_file()
    assert (tmp_path / RESTORE_STAGING_FILENAME).is_file()
    assert read_restore_status(database_url).phase == "pending"
    with sqlite3.connect(database_path) as connection:
        assert connection.execute("SELECT content FROM work_reports").fetchone() == (
            "現在の架空データ",
        )

    applied = apply_pending_sqlite_restore(database_url)

    assert applied.phase == "completed"
    assert applied.filename == selected.filename
    assert not (tmp_path / RESTORE_MARKER_FILENAME).exists()
    assert not (tmp_path / RESTORE_STAGING_FILENAME).exists()
    assert (tmp_path / RESTORE_RECEIPT_FILENAME).is_file()
    assert read_restore_status(database_url).phase == "completed"
    assert (backup_directory / scheduled.safety_backup_filename).is_file()
    with sqlite3.connect(database_path) as connection:
        assert connection.execute("SELECT content FROM work_reports").fetchone() == (
            "復元対象の架空データ",
        )
        assert connection.execute("SELECT count(*) FROM user_sessions").fetchone() == (
            0,
        )


def test_restore_rejects_revision_mismatch_and_path_traversal(tmp_path: Path) -> None:
    """A selected backup must be local, verified, and schema-compatible."""
    database_path = tmp_path / "phoenix.sqlite3"
    older_path = tmp_path / "older.sqlite3"
    backup_directory = tmp_path / "backups"
    create_source_database(database_path)
    create_source_database(older_path, revision="20260826_0016")
    incompatible = create_sqlite_backup(
        f"sqlite:///{older_path.as_posix()}",
        backup_directory,
    )
    database_url = f"sqlite:///{database_path.as_posix()}"

    with pytest.raises(BackupRevisionError):
        schedule_sqlite_restore(
            database_url,
            backup_directory,
            incompatible.filename,
        )
    with pytest.raises(BackupUnavailableError):
        schedule_sqlite_restore(database_url, backup_directory, "../phoenix.sqlite3")
    assert not (tmp_path / RESTORE_MARKER_FILENAME).exists()


def test_admin_can_create_backup_without_receiving_private_path(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The API should return verified metadata and keep the folder private."""
    source_path = tmp_path / "api-source.sqlite3"
    backup_directory = tmp_path / "private-backups"
    create_source_database(source_path)
    monkeypatch.setenv(
        "PHOENIX_DATABASE_URL",
        f"sqlite:///{source_path.as_posix()}",
    )
    monkeypatch.setenv("PHOENIX_BACKUP_DIRECTORY", str(backup_directory))

    response = client.post("/backups")

    assert response.status_code == 201
    payload = response.json()
    assert payload["integrity_status"] == "ok"
    assert payload["size_bytes"] > 0
    assert set(payload) == {
        "filename",
        "created_at",
        "size_bytes",
        "integrity_status",
    }
    assert str(tmp_path) not in response.text
    assert (backup_directory / payload["filename"]).is_file()

    catalog_response = client.get("/backups")
    assert catalog_response.status_code == 200
    catalog = catalog_response.json()
    assert catalog["total"] == 1
    assert catalog["items"][0]["filename"] == payload["filename"]
    assert catalog["items"][0]["integrity_status"] == "ok"
    assert catalog["items"][0]["restorable"] is True
    assert catalog["restore_status"]["phase"] == "none"

    restore_response = client.post(
        f"/backups/{payload['filename']}/restore",
        json={"confirmation": payload["filename"]},
    )
    assert restore_response.status_code == 202
    assert restore_response.json()["filename"] == payload["filename"]
    assert restore_response.json()["restart_required"] is True
    assert client.get("/backups").json()["restore_status"]["phase"] == "pending"


def test_normal_user_cannot_create_database_backup(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Being signed in is insufficient for the destructive admin boundary."""
    source_path = tmp_path / "normal-user-source.sqlite3"
    create_source_database(source_path)
    monkeypatch.setenv(
        "PHOENIX_DATABASE_URL",
        f"sqlite:///{source_path.as_posix()}",
    )
    existing_override = app.dependency_overrides[get_current_user]
    app.dependency_overrides[get_current_user] = lambda: UserAccount(
        username="operator",
        password_hash="test-only",
        role="user",
        is_active=True,
    )
    try:
        create_response = client.post("/backups")
        list_response = client.get("/backups")
    finally:
        app.dependency_overrides[get_current_user] = existing_override

    assert create_response.status_code == 403
    assert list_response.status_code == 403
    assert create_response.json() == {"detail": "Administrator permission required."}


def test_backup_endpoint_reports_unavailable_source_without_creating_it(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A missing configured source must remain missing and return a safe error."""
    source_path = tmp_path / "missing.sqlite3"
    backup_directory = tmp_path / "backups"
    monkeypatch.setenv(
        "PHOENIX_DATABASE_URL",
        f"sqlite:///{source_path.as_posix()}",
    )
    monkeypatch.setenv("PHOENIX_BACKUP_DIRECTORY", str(backup_directory))

    response = client.post("/backups")

    assert response.status_code == 409
    assert not source_path.exists()
    assert not backup_directory.exists()


def test_backup_endpoint_is_in_openapi_schema() -> None:
    """The administrator operation should remain visible in the API contract."""
    response = client.get("/openapi.json")

    assert response.status_code == 200
    assert "get" in response.json()["paths"]["/backups"]
    assert "post" in response.json()["paths"]["/backups"]
    assert "post" in response.json()["paths"]["/backups/{filename}/restore"]

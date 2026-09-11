"""Exercise photo snapshots using only temporary databases and images."""

import sqlite3
from contextlib import closing
from pathlib import Path

import pytest

from app.services.backup import (
    RESTORE_STAGING_FILENAME,
    BackupError,
    apply_pending_sqlite_restore,
    create_sqlite_backup,
    list_sqlite_backups,
    schedule_sqlite_restore,
)
from app.services.backup_photos import PHOTO_TABLE


@pytest.fixture
def scenario(tmp_path, monkeypatch):
    photos = tmp_path / "photos"
    photos.mkdir()
    monkeypatch.setenv("PHOENIX_EQUIPMENT_PHOTO_DIRECTORY", str(photos))
    db = tmp_path / "source.sqlite3"
    identifier = "a" * 32 + ".jpg"
    with closing(sqlite3.connect(db)) as connection:
        connection.executescript(
            "CREATE TABLE equipment(photo_path TEXT);"
            "CREATE TABLE alembic_version(version_num TEXT);"
            "INSERT INTO alembic_version VALUES ('test');"
            "CREATE TABLE user_sessions(token TEXT);"
            "INSERT INTO user_sessions VALUES ('session');"
        )
        connection.execute("INSERT INTO equipment VALUES (?)", (identifier,))
        connection.commit()
    (photos / identifier).write_bytes(b"original photo bytes")
    return db, photos, tmp_path / "backups", identifier


def test_photo_roundtrip_and_safety_backup(scenario):
    db, photos, backups, identifier = scenario
    url = f"sqlite:///{db}"
    saved = create_sqlite_backup(url, backups)
    (photos / identifier).unlink()
    replacement = "b" * 32 + ".jpg"
    (photos / replacement).write_bytes(b"replacement")
    with closing(sqlite3.connect(db)) as connection:
        connection.execute("UPDATE equipment SET photo_path=?", (replacement,))
        connection.commit()
    scheduled = schedule_sqlite_restore(url, backups, saved.filename)
    assert apply_pending_sqlite_restore(url).phase == "completed"
    assert (photos / identifier).read_bytes() == b"original photo bytes"
    assert (photos / replacement).read_bytes() == b"replacement"
    with closing(sqlite3.connect(db)) as connection:
        assert (
            connection.execute("SELECT photo_path FROM equipment").fetchone()[0]
            == identifier
        )
        assert (
            connection.execute("SELECT count(*) FROM user_sessions").fetchone()[0] == 0
        )
        assert not connection.execute(
            "SELECT 1 FROM sqlite_master WHERE name=?", (PHOTO_TABLE,)
        ).fetchone()
    with closing(
        sqlite3.connect(backups / scheduled.safety_backup_filename)
    ) as connection:
        assert (
            connection.execute(f"SELECT content FROM {PHOTO_TABLE}").fetchone()[0]
            == b"replacement"
        )


def test_missing_photo_never_publishes_backup(scenario):
    db, photos, backups, identifier = scenario
    (photos / identifier).unlink()
    with pytest.raises(BackupError):
        create_sqlite_backup(f"sqlite:///{db}", backups)
    assert not list(backups.iterdir())


@pytest.mark.parametrize("damage", ["checksum", "missing", "path"])
def test_damaged_photo_backup_is_not_restorable(scenario, damage):
    db, photos, backups, identifier = scenario
    saved = create_sqlite_backup(f"sqlite:///{db}", backups)
    with closing(sqlite3.connect(backups / saved.filename)) as connection:
        if damage == "checksum":
            connection.execute(f"UPDATE {PHOTO_TABLE} SET content=x'00'")
        elif damage == "missing":
            connection.execute(f"DELETE FROM {PHOTO_TABLE}")
        else:
            connection.execute("UPDATE equipment SET photo_path='../outside.jpg'")
        connection.commit()
    assert not list_sqlite_backups(backups)[0].restorable
    with pytest.raises(BackupError):
        schedule_sqlite_restore(f"sqlite:///{db}", backups, saved.filename)


def test_legacy_requires_referenced_photo(scenario):
    db, photos, backups, identifier = scenario
    saved = create_sqlite_backup(f"sqlite:///{db}", backups)
    with closing(sqlite3.connect(backups / saved.filename)) as connection:
        connection.execute(f"DROP TABLE {PHOTO_TABLE}")
        connection.commit()
    assert list_sqlite_backups(backups)[0].restorable
    (photos / identifier).unlink()
    assert not list_sqlite_backups(backups)[0].restorable


def test_db_replace_failure_keeps_current_db(scenario, monkeypatch):
    db, photos, backups, identifier = scenario
    url = f"sqlite:///{db}"
    saved = create_sqlite_backup(url, backups)
    schedule_sqlite_restore(url, backups, saved.filename)
    (photos / identifier).unlink()
    before = db.read_bytes()
    original_replace = Path.replace

    def fail_replace(self, target):
        if self.name == RESTORE_STAGING_FILENAME:
            raise OSError("simulated disk failure")
        return original_replace(self, target)

    monkeypatch.setattr(Path, "replace", fail_replace)
    assert apply_pending_sqlite_restore(url).phase == "failed"
    assert db.read_bytes() == before
    assert not (photos / identifier).exists()


def test_conflicting_live_photo_is_not_overwritten(scenario):
    db, photos, backups, identifier = scenario
    url = f"sqlite:///{db}"
    saved = create_sqlite_backup(url, backups)
    schedule_sqlite_restore(url, backups, saved.filename)
    (photos / identifier).write_bytes(b"conflicting live bytes")
    before = db.read_bytes()
    assert apply_pending_sqlite_restore(url).phase == "failed"
    assert db.read_bytes() == before
    assert (photos / identifier).read_bytes() == b"conflicting live bytes"

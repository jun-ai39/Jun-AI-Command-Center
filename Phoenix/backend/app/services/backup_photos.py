"""Keep immutable equipment photos inside a SQLite backup snapshot."""

import hashlib
import os
import re
import sqlite3
from pathlib import Path

from app.core.config import get_equipment_photo_directory

PHOTO_TABLE = "phoenix_backup_photos_v1"
IDENTIFIER = re.compile(r"^[0-9a-f]{32}\.jpg$")
MAX_PHOTO_BYTES = 40 * 1024 * 1024


def references(connection: sqlite3.Connection) -> set[str]:
    """Older databases without the equipment table have no photo references."""
    columns = connection.execute("PRAGMA table_info(equipment)").fetchall()
    if not any(row[1] == "photo_path" for row in columns):
        return set()
    values = {
        row[0]
        for row in connection.execute(
            "SELECT photo_path FROM equipment WHERE photo_path IS NOT NULL"
        )
    }
    if any(
        not isinstance(value, str) or not IDENTIFIER.fullmatch(value)
        for value in values
    ):
        raise ValueError("Invalid equipment photo reference.")
    return values


def read_photo(identifier: str) -> bytes:
    directory = get_equipment_photo_directory()
    path = directory / identifier
    if path.is_symlink() or not path.is_file():
        raise ValueError("A referenced equipment photo is missing.")
    with path.open("rb") as stream:
        content = stream.read(MAX_PHOTO_BYTES + 1)
    if not content or len(content) > MAX_PHOTO_BYTES:
        raise ValueError("Invalid equipment photo size.")
    return content


def embed_photos(connection: sqlite3.Connection) -> None:
    connection.execute(f"DROP TABLE IF EXISTS {PHOTO_TABLE}")
    connection.execute(
        f"CREATE TABLE {PHOTO_TABLE} (identifier TEXT PRIMARY KEY, "
        "sha256 TEXT NOT NULL, content BLOB NOT NULL)"
    )
    for identifier in sorted(references(connection)):
        content = read_photo(identifier)
        connection.execute(
            f"INSERT INTO {PHOTO_TABLE} VALUES (?, ?, ?)",
            (identifier, hashlib.sha256(content).hexdigest(), content),
        )
    connection.commit()


def photo_payloads(connection: sqlite3.Connection):
    """Validate the exact reference set; legacy backups require live photos."""
    expected = references(connection)
    exists = connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (PHOTO_TABLE,)
    ).fetchone()
    if not exists:
        for identifier in sorted(expected):
            yield identifier, read_photo(identifier)
        return
    actual = {
        row[0] for row in connection.execute(f"SELECT identifier FROM {PHOTO_TABLE}")
    }
    if actual != expected:
        raise ValueError("Backup photo references do not match.")
    for identifier in sorted(expected):
        size = connection.execute(
            f"SELECT length(content) FROM {PHOTO_TABLE} WHERE identifier=?",
            (identifier,),
        ).fetchone()[0]
        if not isinstance(size, int) or not 0 < size <= MAX_PHOTO_BYTES:
            raise ValueError("Invalid backup photo size.")
        digest, content = connection.execute(
            f"SELECT sha256, content FROM {PHOTO_TABLE} WHERE identifier=?",
            (identifier,),
        ).fetchone()
        if (
            not isinstance(content, bytes)
            or hashlib.sha256(content).hexdigest() != digest
        ):
            raise ValueError("Backup photo checksum failed.")
        yield identifier, content


def validate_photos(connection: sqlite3.Connection) -> None:
    for _identifier, _content in photo_payloads(connection):
        pass


def install_photos(connection: sqlite3.Connection, created: list[Path]) -> None:
    """Never overwrite a live photo; DB replacement is the final commit point."""
    directory = get_equipment_photo_directory()
    for identifier, content in photo_payloads(connection):
        directory.mkdir(parents=True, exist_ok=True)
        path = directory / identifier
        if path.exists() or path.is_symlink():
            if read_photo(identifier) != content:
                raise ValueError("An existing photo conflicts with the backup.")
            continue
        with path.open("xb") as stream:
            created.append(path)
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
    connection.execute(f"DROP TABLE IF EXISTS {PHOTO_TABLE}")
    connection.commit()

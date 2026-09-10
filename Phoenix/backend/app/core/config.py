"""Non-secret application constants."""

import os
from pathlib import Path
from typing import Final

PHOENIX_ROOT: Final[Path] = Path(__file__).resolve().parents[3]
DEFAULT_DATABASE_PATH: Final[Path] = PHOENIX_ROOT / "database" / "phoenix.sqlite3"
DEFAULT_DATABASE_URL: Final[str] = f"sqlite:///{DEFAULT_DATABASE_PATH.as_posix()}"
DEFAULT_BACKUP_DIRECTORY: Final[Path] = PHOENIX_ROOT / "backups"
DEFAULT_EQUIPMENT_PHOTO_DIRECTORY: Final[Path] = (
    PHOENIX_ROOT / "database" / "equipment_photos"
)

APP_NAME: Final[str] = "Phoenix OS API"
APP_VERSION: Final[str] = "0.1.0"
API_VERSION: Final[str] = "v1"
DASHBOARD_TIMEZONE: Final[str] = "Asia/Tokyo"
AUTH_SESSION_LIFETIME_HOURS: Final[int] = 12
AUTH_SESSION_COOKIE_NAME: Final[str] = "phoenix_session"
# Localhost uses HTTP. A future LAN/HTTPS deployment must set this to True.
AUTH_SESSION_COOKIE_SECURE: Final[bool] = False
CORS_ALLOWED_ORIGINS: Final[tuple[str, ...]] = (
    "http://127.0.0.1:5173",
    "http://localhost:5173",
)


def get_database_url() -> str:
    """Return the server-side database URL or the local SQLite default."""
    return os.environ.get("PHOENIX_DATABASE_URL") or DEFAULT_DATABASE_URL


def get_backup_directory() -> Path:
    """Return the private local directory used for SQLite backups."""
    configured_path = os.environ.get("PHOENIX_BACKUP_DIRECTORY")
    if configured_path:
        return Path(configured_path).expanduser().resolve()
    return DEFAULT_BACKUP_DIRECTORY


def get_equipment_photo_directory() -> Path:
    """Return the private local directory used for equipment photos."""
    configured_path = os.environ.get("PHOENIX_EQUIPMENT_PHOTO_DIRECTORY")
    if configured_path:
        return Path(configured_path).expanduser().resolve()
    return DEFAULT_EQUIPMENT_PHOTO_DIRECTORY

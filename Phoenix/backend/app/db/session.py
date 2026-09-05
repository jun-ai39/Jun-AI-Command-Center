"""SQLAlchemy engine and session lifecycle."""

from collections.abc import Iterator
from sqlite3 import Connection as SQLiteConnection
from typing import Final

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import ConnectionPoolEntry

from app.core.config import get_database_url
from app.services.backup import apply_pending_sqlite_restore


def enable_sqlite_foreign_keys(
    dbapi_connection: SQLiteConnection,
    _connection_record: ConnectionPoolEntry,
) -> None:
    """Enable SQLite foreign-key checks for every new connection."""
    previous_autocommit = dbapi_connection.autocommit
    dbapi_connection.autocommit = True
    try:
        cursor = dbapi_connection.cursor()
        try:
            cursor.execute("PRAGMA foreign_keys=ON")
        finally:
            cursor.close()
    finally:
        dbapi_connection.autocommit = previous_autocommit


def create_database_engine(database_url: str) -> Engine:
    """Create an engine configured for SQLite or a future database."""
    connect_args: dict[str, bool] = {}
    is_sqlite = database_url.startswith("sqlite")
    if is_sqlite:
        connect_args["check_same_thread"] = False
        connect_args["autocommit"] = False

    database_engine = create_engine(
        database_url,
        connect_args=connect_args,
        pool_pre_ping=True,
    )
    if is_sqlite:
        event.listen(database_engine, "connect", enable_sqlite_foreign_keys)

    return database_engine


def create_session_factory(database_engine: Engine) -> sessionmaker[Session]:
    """Create consistently configured SQLAlchemy sessions."""
    return sessionmaker(
        bind=database_engine,
        class_=Session,
        autoflush=False,
        expire_on_commit=False,
    )


DATABASE_URL: Final[str] = get_database_url()
apply_pending_sqlite_restore(DATABASE_URL)
DATABASE_ENGINE: Final[Engine] = create_database_engine(DATABASE_URL)
DATABASE_SESSION_FACTORY: Final[sessionmaker[Session]] = create_session_factory(
    DATABASE_ENGINE
)


def get_db_session() -> Iterator[Session]:
    """Yield one database session and always close it after the request."""
    with DATABASE_SESSION_FACTORY() as session:
        yield session

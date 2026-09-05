"""Tests for the persistent ToDo model."""

from datetime import date, datetime
from pathlib import Path
from uuid import UUID

import pytest
from sqlalchemy import Engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from app.db.base import Base
from app.db.session import create_database_engine, create_session_factory
from app.models.todo import Todo


def create_todo_database(
    database_path: Path,
) -> tuple[Engine, sessionmaker[Session]]:
    """Create an isolated engine and session factory for model tests."""
    database_engine = create_database_engine(f"sqlite:///{database_path.as_posix()}")
    Base.metadata.create_all(database_engine)
    return database_engine, create_session_factory(database_engine)


def test_todo_model_persists_typed_defaults(tmp_path: Path) -> None:
    """A valid item should persist with identifiers and timestamps."""
    database_engine, session_factory = create_todo_database(
        tmp_path / "todo-model.sqlite3"
    )

    try:
        with session_factory() as session:
            todo = Todo(
                title="SQLAlchemyを学ぶ",
                description="Phoenixの永続化基盤を理解する",
                due_date=date(2026, 7, 21),
            )
            session.add(todo)
            session.commit()
            session.refresh(todo)

            assert isinstance(todo.id, UUID)
            assert todo.title == "SQLAlchemyを学ぶ"
            assert todo.description == "Phoenixの永続化基盤を理解する"
            assert todo.due_date == date(2026, 7, 21)
            assert todo.priority == "medium"
            assert todo.category is None
            assert todo.is_pinned is False
            assert todo.is_completed is False
            assert todo.is_archived is False
            assert isinstance(todo.created_at, datetime)
            assert isinstance(todo.updated_at, datetime)
    finally:
        database_engine.dispose()


def test_todo_model_rejects_archiving_an_incomplete_item(tmp_path: Path) -> None:
    """The database should keep incomplete work out of the archive."""
    database_engine, session_factory = create_todo_database(
        tmp_path / "invalid-archive.sqlite3"
    )

    try:
        with session_factory() as session:
            session.add(
                Todo(
                    title="未完了のまま保管しない",
                    is_completed=False,
                    is_archived=True,
                )
            )
            with pytest.raises(IntegrityError):
                session.commit()
            session.rollback()
    finally:
        database_engine.dispose()


def test_todo_model_rejects_invalid_priority(tmp_path: Path) -> None:
    """The database should reject priority values outside the public contract."""
    database_engine, session_factory = create_todo_database(
        tmp_path / "invalid-priority.sqlite3"
    )

    try:
        with session_factory() as session:
            session.add(Todo(title="無効な優先度", priority="urgent"))
            with pytest.raises(IntegrityError):
                session.commit()
            session.rollback()
    finally:
        database_engine.dispose()


@pytest.mark.parametrize("invalid_category", ["   ", "x" * 31])
def test_todo_model_rejects_invalid_category(
    tmp_path: Path,
    invalid_category: str,
) -> None:
    """The database should reject blank and oversized category values."""
    database_engine, session_factory = create_todo_database(
        tmp_path / "invalid-category.sqlite3"
    )

    try:
        with session_factory() as session:
            session.add(Todo(title="無効なカテゴリ", category=invalid_category))
            with pytest.raises(IntegrityError):
                session.commit()
            session.rollback()
    finally:
        database_engine.dispose()


@pytest.mark.parametrize("invalid_title", ["   ", "x" * 201])
def test_todo_model_rejects_invalid_title(
    tmp_path: Path,
    invalid_title: str,
) -> None:
    """The database should reject blank and oversized titles."""
    database_engine, session_factory = create_todo_database(
        tmp_path / "invalid-todo.sqlite3"
    )

    try:
        with session_factory() as session:
            session.add(Todo(title=invalid_title))
            with pytest.raises(IntegrityError):
                session.commit()
            session.rollback()
    finally:
        database_engine.dispose()

"""Tests for the persistent equipment master models."""

from datetime import datetime
from pathlib import Path
from uuid import UUID, uuid4

import pytest
from sqlalchemy import Engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from app.db.base import Base
from app.db.session import create_database_engine, create_session_factory
from app.models.equipment_master import Department, Equipment, Manufacturer


def create_equipment_master_database(
    database_path: Path,
) -> tuple[Engine, sessionmaker[Session]]:
    """Create an isolated engine and session factory for model tests."""
    database_engine = create_database_engine(f"sqlite:///{database_path.as_posix()}")
    Base.metadata.create_all(database_engine)
    return database_engine, create_session_factory(database_engine)


def test_equipment_master_persists_relationships(tmp_path: Path) -> None:
    """One equipment asset should retain its department and manufacturer."""
    database_engine, session_factory = create_equipment_master_database(
        tmp_path / "equipment-master-model.sqlite3"
    )

    try:
        with session_factory() as session:
            department = Department(name="菓子パン", display_order=10)
            manufacturer = Manufacturer(name="架空Aメーカー")
            session.add_all((department, manufacturer))
            session.flush()

            equipment_item = Equipment(
                department_id=department.id,
                manufacturer_id=manufacturer.id,
                name="包装機",
                equipment_number="No.2",
                model_number="TEST-200",
                photo_path=None,
            )
            session.add(equipment_item)
            session.commit()
            session.refresh(equipment_item)

            assert isinstance(department.id, UUID)
            assert isinstance(manufacturer.id, UUID)
            assert isinstance(equipment_item.equipment_id, UUID)
            assert equipment_item.department.name == "菓子パン"
            assert equipment_item.manufacturer.name == "架空Aメーカー"
            assert equipment_item.name == "包装機"
            assert equipment_item.equipment_number == "No.2"
            assert equipment_item.model_number == "TEST-200"
            assert equipment_item.is_active is True
            assert isinstance(equipment_item.created_at, datetime)
            assert isinstance(equipment_item.updated_at, datetime)
    finally:
        database_engine.dispose()


def test_department_model_rejects_duplicate_names(tmp_path: Path) -> None:
    """The database should prevent ambiguous duplicate department names."""
    database_engine, session_factory = create_equipment_master_database(
        tmp_path / "duplicate-department.sqlite3"
    )

    try:
        with session_factory() as session:
            session.add_all(
                (
                    Department(name="物流", display_order=10),
                    Department(name="物流", display_order=20),
                )
            )
            with pytest.raises(IntegrityError):
                session.commit()
            session.rollback()
    finally:
        database_engine.dispose()


@pytest.mark.parametrize(
    ("field_name", "invalid_value"),
    [
        ("name", "   "),
        ("equipment_number", "   "),
        ("model_number", "   "),
        ("photo_path", "   "),
    ],
)
def test_equipment_model_rejects_blank_storage_values(
    tmp_path: Path,
    field_name: str,
    invalid_value: str,
) -> None:
    """Database constraints should reject blank equipment fields."""
    database_engine, session_factory = create_equipment_master_database(
        tmp_path / f"invalid-equipment-{field_name}.sqlite3"
    )

    try:
        with session_factory() as session:
            department = Department(name="食パン")
            manufacturer = Manufacturer(name="架空Bメーカー")
            session.add_all((department, manufacturer))
            session.flush()
            values: dict[str, object] = {
                "department_id": department.id,
                "manufacturer_id": manufacturer.id,
                "name": "ミキサー",
                "equipment_number": None,
                "model_number": None,
                "photo_path": None,
            }
            values[field_name] = invalid_value
            session.add(Equipment(**values))

            with pytest.raises(IntegrityError):
                session.commit()
            session.rollback()
    finally:
        database_engine.dispose()


def test_equipment_model_rejects_unknown_master_references(tmp_path: Path) -> None:
    """Foreign keys should prevent equipment from losing its master context."""
    database_engine, session_factory = create_equipment_master_database(
        tmp_path / "unknown-equipment-reference.sqlite3"
    )

    try:
        with session_factory() as session:
            session.add(
                Equipment(
                    department_id=uuid4(),
                    manufacturer_id=uuid4(),
                    name="架空設備",
                    equipment_number=None,
                    model_number=None,
                    photo_path=None,
                )
            )
            with pytest.raises(IntegrityError):
                session.commit()
            session.rollback()
    finally:
        database_engine.dispose()

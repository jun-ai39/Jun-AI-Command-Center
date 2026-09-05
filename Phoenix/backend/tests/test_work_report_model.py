"""Tests for the persistent work report model."""

from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from uuid import UUID

import pytest
from sqlalchemy import Engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from app.db.base import Base
from app.db.session import create_database_engine, create_session_factory
from app.models.equipment_master import Department, Equipment, Manufacturer
from app.models.work_report import WorkReport


def create_work_report_database(
    database_path: Path,
) -> tuple[Engine, sessionmaker[Session]]:
    """Create an isolated engine and session factory for model tests."""
    database_engine = create_database_engine(f"sqlite:///{database_path.as_posix()}")
    Base.metadata.create_all(database_engine)
    return database_engine, create_session_factory(database_engine)


def test_work_report_model_persists_typed_values(tmp_path: Path) -> None:
    """A valid work report should persist with identifiers and timestamps."""
    database_engine, session_factory = create_work_report_database(
        tmp_path / "work-report-model.sqlite3"
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
            session.flush()
            work_report = WorkReport(
                work_date=date(2026, 8, 16),
                department_id=department.id,
                equipment_id=equipment_item.equipment_id,
                phenomenon="ベルトが緩んでいる",
                cause="経年による伸び",
                work_content="架空設備Aのベルト張力を調整",
                result="completed",
            )
            session.add(work_report)
            session.commit()
            session.refresh(work_report)

            assert isinstance(work_report.id, UUID)
            assert work_report.work_date == date(2026, 8, 16)
            assert work_report.department_id == department.id
            assert work_report.equipment_id == equipment_item.equipment_id
            assert work_report.department_name == "菓子パン"
            assert work_report.equipment_name == "包装機"
            assert work_report.equipment_number == "No.2"
            assert work_report.phenomenon == "ベルトが緩んでいる"
            assert work_report.cause == "経年による伸び"
            assert work_report.work_content == "架空設備Aのベルト張力を調整"
            assert work_report.result == "completed"
            assert work_report.progress == "completed"
            assert work_report.is_legacy is False
            assert work_report.legacy_category is None
            assert work_report.legacy_work_hours is None
            assert work_report.legacy_notes is None
            assert isinstance(work_report.created_at, datetime)
            assert isinstance(work_report.updated_at, datetime)
    finally:
        database_engine.dispose()


@pytest.mark.parametrize(
    ("field_name", "invalid_value"),
    [
        ("category", "unknown"),
        ("work_hours", Decimal("0")),
        ("work_hours", Decimal("0.30")),
        ("work_hours", Decimal("24.25")),
        ("work_content", "   "),
        ("work_content", "x" * 2001),
        ("phenomenon", "   "),
        ("phenomenon", "x" * 2001),
        ("cause", "   "),
        ("cause", "x" * 2001),
        ("result", "unknown"),
        ("notes", "   "),
        ("notes", "x" * 2001),
    ],
)
def test_work_report_model_rejects_invalid_storage_values(
    tmp_path: Path,
    field_name: str,
    invalid_value: object,
) -> None:
    """Database constraints should reject invalid reports independently of UI."""
    database_engine, session_factory = create_work_report_database(
        tmp_path / f"invalid-{field_name}.sqlite3"
    )
    values: dict[str, object] = {
        "work_date": date(2026, 8, 16),
        "phenomenon": "架空設備から異音がする",
        "cause": None,
        "work_content": "架空設備を点検",
        "result": "completed",
        "notes": None,
    }
    values[field_name] = invalid_value

    try:
        with session_factory() as session:
            session.add(WorkReport(**values))
            with pytest.raises(IntegrityError):
                session.commit()
            session.rollback()
    finally:
        database_engine.dispose()

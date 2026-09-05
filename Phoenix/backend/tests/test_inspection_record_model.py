"""Tests for inspection record database judgment constraints."""

from datetime import date
from pathlib import Path

import pytest
from sqlalchemy.exc import IntegrityError

from app.db.base import Base
from app.db.session import create_database_engine, create_session_factory
from app.models.equipment_master import Department, Equipment, Manufacturer
from app.models.inspection_record import InspectionRecord, InspectionRecordItem
from app.models.inspection_template import InspectionTemplateItem


def test_database_rejects_numeric_judgment_that_disagrees_with_value(
    tmp_path: Path,
) -> None:
    """Storage must reject a normal judgment for an out-of-range value."""
    database_engine = create_database_engine(
        f"sqlite:///{(tmp_path / 'invalid-inspection-judgment.sqlite3').as_posix()}"
    )
    Base.metadata.create_all(database_engine)
    session_factory = create_session_factory(database_engine)

    try:
        with session_factory() as session:
            department = Department(name="菓子パン")
            manufacturer = Manufacturer(name="架空Aメーカー")
            equipment = Equipment(
                department=department,
                manufacturer=manufacturer,
                name="架空包装機",
                equipment_number="No.2",
                model_number="TEST-200",
                photo_path=None,
            )
            template = InspectionTemplateItem(
                equipment=equipment,
                cycle="daily",
                name="モーター電流",
                input_type="number",
                unit="A",
                normal_min=10,
                normal_max=15,
                normal_state=None,
                display_order=10,
            )
            record = InspectionRecord(
                inspection_date=date(2026, 8, 21),
                equipment=equipment,
                cycle="daily",
                period_key="2026-08-21",
                overall_judgment="normal",
                items=[
                    InspectionRecordItem(
                        template_item=template,
                        name=template.name,
                        input_type="number",
                        number_value=20,
                        status_value=None,
                        unit="A",
                        normal_min=10,
                        normal_max=15,
                        normal_state=None,
                        judgment="normal",
                        display_order=10,
                    )
                ],
            )
            session.add(record)

            with pytest.raises(IntegrityError):
                session.commit()
            session.rollback()
    finally:
        database_engine.dispose()

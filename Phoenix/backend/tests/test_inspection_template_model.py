"""Tests for the persistent inspection item master model."""

from pathlib import Path

import pytest
from sqlalchemy.exc import IntegrityError

from app.db.base import Base
from app.db.session import create_database_engine, create_session_factory
from app.models.equipment_master import Department, Equipment, Manufacturer
from app.models.inspection_template import InspectionTemplateItem


def test_inspection_template_item_persists_structured_criteria(
    tmp_path: Path,
) -> None:
    """Number and status items should retain mutually exclusive criteria."""
    database_engine = create_database_engine(
        f"sqlite:///{(tmp_path / 'inspection-template-model.sqlite3').as_posix()}"
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
                name="包装機",
                equipment_number="No.2",
                model_number="TEST-200",
                photo_path=None,
            )
            session.add(equipment)
            session.flush()
            current_item = InspectionTemplateItem(
                equipment=equipment,
                cycle="daily",
                name="モーター電流",
                input_type="number",
                unit="A",
                normal_min=10,
                normal_max=15,
                normal_state=None,
                check_method="操作盤の電流表示を運転中に確認する",
                caution_note="回転部へ手を近づけない",
                display_order=10,
            )
            sound_item = InspectionTemplateItem(
                equipment=equipment,
                cycle="daily",
                name="異音",
                input_type="status",
                unit=None,
                normal_min=None,
                normal_max=None,
                normal_state="異音なし",
                display_order=20,
            )
            session.add_all((current_item, sound_item))
            session.commit()

            assert current_item.equipment.name == "包装機"
            assert float(current_item.normal_min or 0) == 10
            assert float(current_item.normal_max or 0) == 15
            assert current_item.normal_state is None
            assert current_item.check_method == "操作盤の電流表示を運転中に確認する"
            assert current_item.caution_note == "回転部へ手を近づけない"
            assert sound_item.normal_min is None
            assert sound_item.normal_max is None
            assert sound_item.normal_state == "異音なし"
            assert equipment.inspection_template_items == [current_item, sound_item]
    finally:
        database_engine.dispose()


@pytest.mark.parametrize(
    ("input_type", "unit", "normal_min", "normal_max", "normal_state"),
    [
        ("number", "A", None, 15, None),
        ("number", "A", 20, 15, None),
        ("status", None, None, None, None),
        ("status", "A", None, None, "異音なし"),
    ],
)
def test_inspection_template_model_rejects_invalid_normal_rules(
    tmp_path: Path,
    input_type: str,
    unit: str | None,
    normal_min: int | None,
    normal_max: int | None,
    normal_state: str | None,
) -> None:
    """Database constraints should preserve the structured criteria contract."""
    database_engine = create_database_engine(
        f"sqlite:///{(tmp_path / f'invalid-{input_type}-{unit}.sqlite3').as_posix()}"
    )
    Base.metadata.create_all(database_engine)
    session_factory = create_session_factory(database_engine)

    try:
        with session_factory() as session:
            department = Department(name="物流")
            manufacturer = Manufacturer(name="架空Bメーカー")
            equipment = Equipment(
                department=department,
                manufacturer=manufacturer,
                name="コンベアー",
                equipment_number="No.1",
                model_number=None,
                photo_path=None,
            )
            session.add(equipment)
            session.flush()
            session.add(
                InspectionTemplateItem(
                    equipment=equipment,
                    cycle="daily",
                    name="架空点検項目",
                    input_type=input_type,
                    unit=unit,
                    normal_min=normal_min,
                    normal_max=normal_max,
                    normal_state=normal_state,
                    display_order=10,
                )
            )

            with pytest.raises(IntegrityError):
                session.commit()
            session.rollback()
    finally:
        database_engine.dispose()

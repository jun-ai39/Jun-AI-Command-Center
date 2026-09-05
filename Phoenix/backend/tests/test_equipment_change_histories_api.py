"""Tests for the equipment improvement and specification change history API."""

from collections.abc import Iterator
from datetime import date, datetime
from pathlib import Path
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.db.base import Base
from app.db.session import (
    create_database_engine,
    create_session_factory,
    get_db_session,
)
from app.main import app
from app.models.equipment_change_history import EquipmentChangeHistory
from app.models.equipment_master import Department, Equipment, Manufacturer
from app.models.work_report import WorkReport

pytestmark = pytest.mark.usefixtures("authenticated_business_api")

DEPARTMENT_ID = UUID("91000000-0000-4000-8000-000000000001")
MANUFACTURER_ID = UUID("92000000-0000-4000-8000-000000000001")
EQUIPMENT_ID = UUID("93000000-0000-4000-8000-000000000001")
OTHER_EQUIPMENT_ID = UUID("93000000-0000-4000-8000-000000000002")


@pytest.fixture
def change_history_client(
    tmp_path: Path,
) -> Iterator[tuple[TestClient, sessionmaker[Session]]]:
    """Provide an isolated API client with two fictional equipment assets."""
    database_engine = create_database_engine(
        f"sqlite:///{(tmp_path / 'equipment-changes-api.sqlite3').as_posix()}"
    )
    session_factory = create_session_factory(database_engine)
    Base.metadata.create_all(database_engine)
    with session_factory() as session:
        department = Department(
            id=DEPARTMENT_ID,
            name="菓子パン",
            display_order=10,
        )
        manufacturer = Manufacturer(
            id=MANUFACTURER_ID,
            name="架空Aメーカー",
        )
        session.add_all((department, manufacturer))
        session.flush()
        session.add_all(
            (
                Equipment(
                    equipment_id=EQUIPMENT_ID,
                    department_id=department.id,
                    manufacturer_id=manufacturer.id,
                    name="包装機",
                    equipment_number="No.2",
                    model_number="TEST-200",
                    photo_path=None,
                ),
                Equipment(
                    equipment_id=OTHER_EQUIPMENT_ID,
                    department_id=department.id,
                    manufacturer_id=manufacturer.id,
                    name="包装機",
                    equipment_number="No.3",
                    model_number="TEST-300",
                    photo_path=None,
                ),
            )
        )
        session.commit()

    def override_db_session() -> Iterator[Session]:
        with session_factory() as session:
            yield session

    app.dependency_overrides[get_db_session] = override_db_session
    try:
        with TestClient(app) as client:
            yield client, session_factory
    finally:
        app.dependency_overrides.pop(get_db_session, None)
        database_engine.dispose()


def create_work_report(
    session_factory: sessionmaker[Session],
    *,
    equipment_id: UUID = EQUIPMENT_ID,
    work_content: str = "チェーンガイド形状を変更",
) -> UUID:
    """Persist one fictional report that can be linked by a change history."""
    with session_factory() as session:
        report = WorkReport(
            work_date=date(2026, 8, 26),
            department_id=DEPARTMENT_ID,
            equipment_id=equipment_id,
            phenomenon="チェーンガイドが摩耗しやすい",
            cause="ガイド入口の角部へ荷重が集中",
            work_content=work_content,
            result="completed",
        )
        session.add(report)
        session.commit()
        return report.id


def valid_change_payload(
    *,
    work_report_id: UUID | None = None,
    equipment_id: UUID = EQUIPMENT_ID,
) -> dict[str, object]:
    """Return one valid fictional equipment change request."""
    return {
        "equipment_id": str(equipment_id),
        "changed_on": "2026-08-26",
        "improvement_point": "  チェーンガイド  ",
        "change_details": (
            "  摩耗抑制のため、直線形状だったガイドをR付き形状へ変更した。  "
        ),
        "work_report_id": str(work_report_id) if work_report_id else None,
    }


def test_change_history_list_requires_equipment_and_starts_empty(
    change_history_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """The equipment-specific list should require one immutable equipment ID."""
    client, _session_factory = change_history_client

    assert client.get("/equipment-change-histories").status_code == 422
    response = client.get(
        "/equipment-change-histories",
        params={"equipment_id": str(EQUIPMENT_ID)},
    )

    assert response.status_code == 200
    assert response.json() == {"items": [], "total": 0, "limit": 5, "offset": 0}


def test_create_change_history_persists_normalized_item_and_report_link(
    change_history_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """A valid request should persist only the concise equipment change fields."""
    client, session_factory = change_history_client
    work_report_id = create_work_report(session_factory)

    response = client.post(
        "/equipment-change-histories",
        json=valid_change_payload(work_report_id=work_report_id),
    )

    assert response.status_code == 201
    created = response.json()
    assert str(UUID(created["change_history_id"])) == created["change_history_id"]
    assert created["equipment_id"] == str(EQUIPMENT_ID)
    assert created["changed_on"] == "2026-08-26"
    assert created["improvement_point"] == "チェーンガイド"
    assert created["change_details"] == (
        "摩耗抑制のため、直線形状だったガイドをR付き形状へ変更した。"
    )
    assert created["work_report_id"] == str(work_report_id)
    assert datetime.fromisoformat(created["created_at"]).tzinfo is not None
    assert datetime.fromisoformat(created["updated_at"]).tzinfo is not None

    with session_factory() as session:
        persisted = session.scalar(select(EquipmentChangeHistory))
        assert persisted is not None
        assert persisted.equipment_id == EQUIPMENT_ID
        assert persisted.changed_on == date(2026, 8, 26)
        assert persisted.improvement_point == "チェーンガイド"
        assert persisted.work_report_id == work_report_id


def test_create_change_history_allows_no_related_report(
    change_history_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """A historical equipment change may be saved without duplicate report input."""
    client, _session_factory = change_history_client

    response = client.post(
        "/equipment-change-histories",
        json=valid_change_payload(),
    )

    assert response.status_code == 201
    assert response.json()["work_report_id"] is None


def test_list_change_histories_filters_orders_and_paginates(
    change_history_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """One equipment list should be newest-first with an independent total."""
    client, _session_factory = change_history_client
    requests = (
        (EQUIPMENT_ID, "2026-08-24", "旧ガイド"),
        (EQUIPMENT_ID, "2026-08-27", "新ガイド"),
        (OTHER_EQUIPMENT_ID, "2026-08-28", "別設備"),
    )
    for equipment_id, changed_on, improvement_point in requests:
        payload = valid_change_payload(equipment_id=equipment_id)
        payload["changed_on"] = changed_on
        payload["improvement_point"] = improvement_point
        response = client.post("/equipment-change-histories", json=payload)
        assert response.status_code == 201

    first_page = client.get(
        "/equipment-change-histories",
        params={"equipment_id": str(EQUIPMENT_ID), "limit": 1},
    )
    second_page = client.get(
        "/equipment-change-histories",
        params={"equipment_id": str(EQUIPMENT_ID), "limit": 1, "offset": 1},
    )

    assert first_page.status_code == 200
    assert first_page.json()["total"] == 2
    assert first_page.json()["items"][0]["improvement_point"] == "新ガイド"
    assert second_page.status_code == 200
    assert second_page.json()["total"] == 2
    assert second_page.json()["items"][0]["improvement_point"] == "旧ガイド"


@pytest.mark.parametrize(
    ("field_name", "invalid_value"),
    [
        ("changed_on", "2026-02-30"),
        ("improvement_point", "   "),
        ("improvement_point", "x" * 201),
        ("change_details", "   "),
        ("change_details", "x" * 2001),
        ("unexpected", True),
    ],
)
def test_create_change_history_rejects_invalid_body(
    change_history_client: tuple[TestClient, sessionmaker[Session]],
    field_name: str,
    invalid_value: object,
) -> None:
    """Invalid or unexpected fields should never create a history row."""
    client, session_factory = change_history_client
    payload = valid_change_payload()
    payload[field_name] = invalid_value

    response = client.post("/equipment-change-histories", json=payload)

    assert response.status_code == 422
    with session_factory() as session:
        assert session.scalar(select(EquipmentChangeHistory)) is None


def test_create_change_history_rejects_missing_or_inactive_equipment(
    change_history_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """New change histories should target an equipment available for field use."""
    client, session_factory = change_history_client

    missing_response = client.post(
        "/equipment-change-histories",
        json=valid_change_payload(equipment_id=uuid4()),
    )
    with session_factory() as session:
        equipment = session.get(Equipment, OTHER_EQUIPMENT_ID)
        assert equipment is not None
        equipment.is_active = False
        session.commit()
    inactive_response = client.post(
        "/equipment-change-histories",
        json=valid_change_payload(equipment_id=OTHER_EQUIPMENT_ID),
    )

    assert missing_response.status_code == 422
    assert inactive_response.status_code == 422
    assert missing_response.json() == {"detail": "Selected equipment is not active."}
    assert inactive_response.json() == missing_response.json()


def test_create_change_history_rejects_missing_or_other_equipment_report(
    change_history_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """An optional report must exist and refer to the same physical equipment."""
    client, session_factory = change_history_client
    other_report_id = create_work_report(
        session_factory,
        equipment_id=OTHER_EQUIPMENT_ID,
        work_content="別設備の架空変更",
    )

    missing_response = client.post(
        "/equipment-change-histories",
        json=valid_change_payload(work_report_id=uuid4()),
    )
    mismatched_response = client.post(
        "/equipment-change-histories",
        json=valid_change_payload(work_report_id=other_report_id),
    )

    assert missing_response.status_code == 422
    assert missing_response.json() == {"detail": "Selected work report was not found."}
    assert mismatched_response.status_code == 422
    assert mismatched_response.json() == {
        "detail": "Selected work report does not belong to the equipment."
    }


def test_deleting_related_report_keeps_change_history(
    change_history_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """The equipment knowledge should survive if its optional report is removed."""
    client, session_factory = change_history_client
    work_report_id = create_work_report(session_factory)
    created = client.post(
        "/equipment-change-histories",
        json=valid_change_payload(work_report_id=work_report_id),
    ).json()

    with session_factory() as session:
        report = session.get(WorkReport, work_report_id)
        assert report is not None
        session.delete(report)
        session.commit()
        persisted = session.get(
            EquipmentChangeHistory,
            UUID(created["change_history_id"]),
        )
        assert persisted is not None
        assert persisted.work_report_id is None

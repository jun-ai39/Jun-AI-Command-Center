"""Tests for the equipment inspection item master API."""

from collections.abc import Iterator
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
from app.models.inspection_template import InspectionTemplateItem

pytestmark = pytest.mark.usefixtures("authenticated_business_api")


@pytest.fixture
def inspection_template_client(
    tmp_path: Path,
) -> Iterator[tuple[TestClient, sessionmaker[Session]]]:
    """Provide an API client backed by an isolated SQLite database."""
    database_engine = create_database_engine(
        f"sqlite:///{(tmp_path / 'inspection-template-api.sqlite3').as_posix()}"
    )
    session_factory = create_session_factory(database_engine)
    Base.metadata.create_all(database_engine)

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


def create_equipment(client: TestClient, *, is_active: bool = True) -> str:
    """Create one fictional equipment hierarchy and return its immutable ID."""
    suffix = uuid4().hex[:8]
    department_response = client.post(
        "/departments",
        json={"name": f"架空部門-{suffix}", "display_order": 10},
    )
    manufacturer_response = client.post(
        "/manufacturers",
        json={"name": f"架空メーカー-{suffix}"},
    )
    assert department_response.status_code == 201
    assert manufacturer_response.status_code == 201
    equipment_response = client.post(
        "/equipment",
        json={
            "department_id": department_response.json()["id"],
            "manufacturer_id": manufacturer_response.json()["id"],
            "name": "架空包装機",
            "equipment_number": "No.2",
            "model_number": "TEST-200",
            "photo_path": None,
            "is_active": is_active,
        },
    )
    assert equipment_response.status_code == 201
    return str(equipment_response.json()["equipment_id"])


def number_payload(equipment_id: str, **overrides: object) -> dict[str, object]:
    """Return a valid numeric inspection item request."""
    payload: dict[str, object] = {
        "equipment_id": equipment_id,
        "cycle": "daily",
        "name": "モーター電流",
        "input_type": "number",
        "unit": "A",
        "normal_min": 10,
        "normal_max": 15,
        "normal_state": None,
        "check_method": "操作盤の電流表示を運転中に確認する",
        "caution_note": "回転部へ手を近づけない",
        "display_order": 10,
        "is_active": True,
    }
    payload.update(overrides)
    return payload


def test_create_number_and_status_inspection_items(
    inspection_template_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """Both supported item types should persist with normalized criteria."""
    client, session_factory = inspection_template_client
    equipment_id = create_equipment(client)

    number_response = client.post(
        "/inspection-template-items",
        json=number_payload(
            equipment_id,
            name="  モーター電流  ",
            unit="  A  ",
            check_method="  操作盤の電流表示を運転中に確認する  ",
            caution_note="  回転部へ手を近づけない  ",
        ),
    )
    status_response = client.post(
        "/inspection-template-items",
        json={
            "equipment_id": equipment_id,
            "cycle": "weekly",
            "name": "  ベルト状態  ",
            "input_type": "status",
            "unit": None,
            "normal_min": None,
            "normal_max": None,
            "normal_state": "  亀裂・緩みなし  ",
            "check_method": "  停止状態でベルト表面を目視する  ",
            "caution_note": "  会社の停止手順を優先する  ",
            "display_order": 20,
            "is_active": True,
        },
    )

    assert number_response.status_code == 201
    assert number_response.json()["name"] == "モーター電流"
    assert number_response.json()["unit"] == "A"
    assert number_response.json()["normal_min"] == 10
    assert number_response.json()["normal_max"] == 15
    assert (
        number_response.json()["check_method"] == "操作盤の電流表示を運転中に確認する"
    )
    assert number_response.json()["caution_note"] == "回転部へ手を近づけない"
    assert status_response.status_code == 201
    assert status_response.json()["normal_state"] == "亀裂・緩みなし"
    assert status_response.json()["check_method"] == "停止状態でベルト表面を目視する"
    assert status_response.json()["caution_note"] == "会社の停止手順を優先する"
    assert status_response.json()["unit"] is None
    with session_factory() as session:
        assert len(session.scalars(select(InspectionTemplateItem)).all()) == 2


def test_list_inspection_items_filters_equipment_and_uses_cycle_order(
    inspection_template_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """One equipment list should use daily, weekly, then monthly order."""
    client, _session_factory = inspection_template_client
    selected_equipment_id = create_equipment(client)
    other_equipment_id = create_equipment(client)
    payloads = (
        number_payload(
            selected_equipment_id,
            cycle="monthly",
            name="温度",
            unit="℃",
            display_order=10,
        ),
        number_payload(
            selected_equipment_id,
            cycle="daily",
            name="流量",
            unit="L/min",
            normal_min=20,
            normal_max=30,
            display_order=20,
        ),
        number_payload(
            selected_equipment_id,
            cycle="daily",
            name="電流",
            display_order=10,
        ),
        number_payload(
            selected_equipment_id,
            cycle="weekly",
            name="圧力",
            unit="MPa",
            normal_min=0.2,
            normal_max=0.4,
        ),
        number_payload(other_equipment_id, name="他設備の項目"),
    )
    for payload in payloads:
        assert (
            client.post("/inspection-template-items", json=payload).status_code == 201
        )

    response = client.get(
        "/inspection-template-items",
        params={"equipment_id": selected_equipment_id, "limit": 100, "offset": 0},
    )

    assert response.status_code == 200
    assert response.json()["total"] == 4
    assert [item["name"] for item in response.json()["items"]] == [
        "電流",
        "流量",
        "圧力",
        "温度",
    ]


@pytest.mark.parametrize(
    "overrides",
    [
        {"normal_min": None},
        {"normal_min": 20, "normal_max": 10},
        {"input_type": "status", "normal_min": None, "normal_max": None},
        {"cycle": "yearly"},
        {"display_order": -1},
        {"check_method": "x" * 301},
        {"caution_note": "x" * 301},
    ],
)
def test_create_inspection_item_rejects_invalid_body(
    inspection_template_client: tuple[TestClient, sessionmaker[Session]],
    overrides: dict[str, object],
) -> None:
    """Invalid cycle or normal rules should never reach storage."""
    client, _session_factory = inspection_template_client
    equipment_id = create_equipment(client)

    response = client.post(
        "/inspection-template-items",
        json=number_payload(equipment_id, **overrides),
    )

    assert response.status_code == 422


def test_create_inspection_item_rejects_inactive_or_unknown_equipment(
    inspection_template_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """Configuration should only attach to a registered active asset."""
    client, _session_factory = inspection_template_client
    inactive_equipment_id = create_equipment(client, is_active=False)

    inactive_response = client.post(
        "/inspection-template-items",
        json=number_payload(inactive_equipment_id),
    )
    unknown_response = client.post(
        "/inspection-template-items",
        json=number_payload(str(uuid4())),
    )

    assert inactive_response.status_code == 422
    assert unknown_response.status_code == 422
    assert inactive_response.json() == {"detail": "Selected equipment is not active."}


def test_duplicate_equipment_cycle_and_name_returns_conflict(
    inspection_template_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """Duplicate labels within one equipment cycle should stay unambiguous."""
    client, session_factory = inspection_template_client
    equipment_id = create_equipment(client)
    payload = number_payload(equipment_id)

    assert client.post("/inspection-template-items", json=payload).status_code == 201
    duplicate_response = client.post("/inspection-template-items", json=payload)

    assert duplicate_response.status_code == 409
    assert duplicate_response.json() == {
        "detail": "Inspection item already exists for this equipment and cycle."
    }
    with session_factory() as session:
        assert len(session.scalars(select(InspectionTemplateItem)).all()) == 1


def test_update_inspection_guide_changes_only_guide_fields(
    inspection_template_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """Guide edits should persist without changing the inspection definition."""
    client, session_factory = inspection_template_client
    equipment_id = create_equipment(client)
    created_response = client.post(
        "/inspection-template-items",
        json=number_payload(equipment_id),
    )
    assert created_response.status_code == 201
    created = created_response.json()

    response = client.patch(
        f"/inspection-template-items/{created['id']}/guide",
        json={
            "check_method": "  操作盤の表示を正面から確認する  ",
            "caution_note": "  異常値の場合は経験者へ引き継ぐ  ",
        },
    )

    assert response.status_code == 200
    updated = response.json()
    assert updated["check_method"] == "操作盤の表示を正面から確認する"
    assert updated["caution_note"] == "異常値の場合は経験者へ引き継ぐ"
    for unchanged_field in (
        "equipment_id",
        "cycle",
        "name",
        "input_type",
        "unit",
        "normal_min",
        "normal_max",
        "normal_state",
        "display_order",
        "is_active",
    ):
        assert updated[unchanged_field] == created[unchanged_field]
    with session_factory() as session:
        persisted = session.get(InspectionTemplateItem, UUID(updated["id"]))
        assert persisted is not None
        assert persisted.check_method == "操作盤の表示を正面から確認する"
        assert persisted.caution_note == "異常値の場合は経験者へ引き継ぐ"


def test_update_inspection_guide_can_clear_values_and_rejects_invalid_requests(
    inspection_template_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """Blank guide text should clear safely and invalid targets should fail."""
    client, _session_factory = inspection_template_client
    equipment_id = create_equipment(client)
    created = client.post(
        "/inspection-template-items",
        json=number_payload(equipment_id),
    ).json()

    cleared_response = client.patch(
        f"/inspection-template-items/{created['id']}/guide",
        json={"check_method": "   ", "caution_note": ""},
    )
    too_long_response = client.patch(
        f"/inspection-template-items/{created['id']}/guide",
        json={"check_method": "x" * 301, "caution_note": None},
    )
    missing_field_response = client.patch(
        f"/inspection-template-items/{created['id']}/guide",
        json={"check_method": None},
    )
    unknown_response = client.patch(
        f"/inspection-template-items/{uuid4()}/guide",
        json={"check_method": None, "caution_note": None},
    )

    assert cleared_response.status_code == 200
    assert cleared_response.json()["check_method"] is None
    assert cleared_response.json()["caution_note"] is None
    assert too_long_response.status_code == 422
    assert missing_field_response.status_code == 422
    assert unknown_response.status_code == 404

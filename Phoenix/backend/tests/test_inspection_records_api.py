"""Tests for structured equipment inspection record endpoints."""

from collections.abc import Iterator
from datetime import date
from pathlib import Path
from typing import cast
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.api.routes.inspection_records import get_inspection_period_key
from app.db.base import Base
from app.db.session import (
    create_database_engine,
    create_session_factory,
    get_db_session,
)
from app.main import app
from app.models.equipment_master import Equipment
from app.models.inspection_record import InspectionRecord, InspectionRecordItem
from app.models.inspection_template import InspectionTemplateItem
from app.schemas.inspection_template import InspectionCycle

pytestmark = pytest.mark.usefixtures("authenticated_business_api")


@pytest.fixture
def inspection_record_client(
    tmp_path: Path,
) -> Iterator[tuple[TestClient, sessionmaker[Session]]]:
    """Provide an API client backed by an isolated SQLite database."""
    database_engine = create_database_engine(
        f"sqlite:///{(tmp_path / 'inspection-record-api.sqlite3').as_posix()}"
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
    """Create one fictional equipment hierarchy and return its ID."""
    suffix = uuid4().hex[:8]
    department = client.post(
        "/departments",
        json={"name": f"架空部門-{suffix}", "display_order": 10},
    )
    manufacturer = client.post(
        "/manufacturers",
        json={"name": f"架空メーカー-{suffix}"},
    )
    assert department.status_code == 201
    assert manufacturer.status_code == 201
    equipment = client.post(
        "/equipment",
        json={
            "department_id": department.json()["id"],
            "manufacturer_id": manufacturer.json()["id"],
            "name": "架空包装機",
            "equipment_number": "No.2",
            "model_number": "TEST-200",
            "photo_path": None,
            "is_active": is_active,
        },
    )
    assert equipment.status_code == 201
    return str(equipment.json()["equipment_id"])


def create_number_template(
    client: TestClient,
    equipment_id: str,
    *,
    cycle: str = "daily",
) -> dict[str, object]:
    """Create one fictional numeric inspection template."""
    response = client.post(
        "/inspection-template-items",
        json={
            "equipment_id": equipment_id,
            "cycle": cycle,
            "name": "モーター電流",
            "input_type": "number",
            "unit": "A",
            "normal_min": 10,
            "normal_max": 15,
            "normal_state": None,
            "display_order": 10,
            "is_active": True,
        },
    )
    assert response.status_code == 201
    return response.json()


def create_status_template(
    client: TestClient,
    equipment_id: str,
    *,
    cycle: str = "daily",
) -> dict[str, object]:
    """Create one fictional status inspection template."""
    response = client.post(
        "/inspection-template-items",
        json={
            "equipment_id": equipment_id,
            "cycle": cycle,
            "name": "異音",
            "input_type": "status",
            "unit": None,
            "normal_min": None,
            "normal_max": None,
            "normal_state": "異音・振動なし",
            "display_order": 20,
            "is_active": True,
        },
    )
    assert response.status_code == 201
    return response.json()


def record_payload(
    equipment_id: str,
    number_template_id: str,
    status_template_id: str,
    **overrides: object,
) -> dict[str, object]:
    """Return one reusable inspection completion request."""
    payload: dict[str, object] = {
        "inspection_date": "2026-08-21",
        "equipment_id": equipment_id,
        "cycle": "daily",
        "items": [
            {
                "template_item_id": number_template_id,
                "number_value": 16,
                "status_value": None,
            },
            {
                "template_item_id": status_template_id,
                "number_value": None,
                "status_value": "normal",
            },
        ],
    }
    payload.update(overrides)
    return payload


def test_create_and_get_inspection_record_with_automatic_judgment(
    inspection_record_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """Measured values and criteria snapshots should persist atomically."""
    client, session_factory = inspection_record_client
    equipment_id = create_equipment(client)
    number_template = create_number_template(client, equipment_id)
    status_template = create_status_template(client, equipment_id)

    response = client.post(
        "/inspection-records",
        json=record_payload(
            equipment_id,
            str(number_template["id"]),
            str(status_template["id"]),
        ),
    )

    assert response.status_code == 201
    created = response.json()
    assert created["equipment_name"] == "架空包装機"
    assert created["equipment_number"] == "No.2"
    assert created["period_key"] == "2026-08-21"
    assert created["overall_judgment"] == "abnormal"
    assert [item["name"] for item in created["items"]] == [
        "モーター電流",
        "異音",
    ]
    assert created["items"][0]["number_value"] == 16
    assert created["items"][0]["normal_min"] == 10
    assert created["items"][0]["normal_max"] == 15
    assert created["items"][0]["judgment"] == "abnormal"
    assert created["items"][1]["status_value"] == "normal"
    assert created["items"][1]["normal_state"] == "異音・振動なし"
    assert created["items"][1]["judgment"] == "normal"

    detail = client.get(f"/inspection-records/{created['id']}")
    assert detail.status_code == 200
    assert detail.json() == created
    with session_factory() as session:
        assert session.scalar(select(InspectionRecord)) is not None
        assert len(session.scalars(select(InspectionRecordItem)).all()) == 2


def test_record_keeps_criteria_snapshot_after_template_changes(
    inspection_record_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """Historical judgment criteria must not change with the current master."""
    client, session_factory = inspection_record_client
    equipment_id = create_equipment(client)
    number_template = create_number_template(client, equipment_id)
    status_template = create_status_template(client, equipment_id)
    created = client.post(
        "/inspection-records",
        json=record_payload(
            equipment_id,
            str(number_template["id"]),
            str(status_template["id"]),
        ),
    ).json()

    with session_factory() as session:
        template = session.get(
            InspectionTemplateItem,
            UUID(str(number_template["id"])),
        )
        assert template is not None
        template.normal_min = 100
        template.normal_max = 200
        session.commit()

    detail = client.get(f"/inspection-records/{created['id']}").json()
    assert detail["items"][0]["normal_min"] == 10
    assert detail["items"][0]["normal_max"] == 15
    assert detail["items"][0]["judgment"] == "abnormal"


def test_list_inspection_records_returns_one_equipment_newest_first(
    inspection_record_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """Equipment history should be filtered, ordered, and paginated."""
    client, _session_factory = inspection_record_client
    equipment_id = create_equipment(client)
    other_equipment_id = create_equipment(client)

    daily_number = create_number_template(client, equipment_id, cycle="daily")
    daily_status = create_status_template(client, equipment_id, cycle="daily")
    weekly_number = create_number_template(client, equipment_id, cycle="weekly")
    weekly_status = create_status_template(client, equipment_id, cycle="weekly")
    other_number = create_number_template(client, other_equipment_id, cycle="daily")
    other_status = create_status_template(client, other_equipment_id, cycle="daily")

    daily = client.post(
        "/inspection-records",
        json=record_payload(
            equipment_id,
            str(daily_number["id"]),
            str(daily_status["id"]),
            inspection_date="2026-08-20",
        ),
    )
    weekly = client.post(
        "/inspection-records",
        json=record_payload(
            equipment_id,
            str(weekly_number["id"]),
            str(weekly_status["id"]),
            inspection_date="2026-08-21",
            cycle="weekly",
        ),
    )
    other = client.post(
        "/inspection-records",
        json=record_payload(
            other_equipment_id,
            str(other_number["id"]),
            str(other_status["id"]),
            inspection_date="2026-08-22",
        ),
    )
    assert daily.status_code == 201
    assert weekly.status_code == 201
    assert other.status_code == 201

    first_page = client.get(
        "/inspection-records",
        params={"equipment_id": equipment_id, "limit": 1, "offset": 0},
    )
    second_page = client.get(
        "/inspection-records",
        params={"equipment_id": equipment_id, "limit": 1, "offset": 1},
    )

    assert first_page.status_code == 200
    assert first_page.json()["total"] == 2
    assert first_page.json()["limit"] == 1
    assert first_page.json()["offset"] == 0
    assert [item["id"] for item in first_page.json()["items"]] == [weekly.json()["id"]]
    assert [item["id"] for item in second_page.json()["items"]] == [daily.json()["id"]]


def test_list_inspection_records_validates_required_query_parameters(
    inspection_record_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """History requests must identify one equipment and use safe page bounds."""
    client, _session_factory = inspection_record_client

    assert client.get("/inspection-records").status_code == 422
    assert (
        client.get(
            "/inspection-records",
            params={"equipment_id": str(uuid4()), "limit": 51},
        ).status_code
        == 422
    )


@pytest.mark.parametrize(
    ("cycle", "inspection_date", "expected"),
    [
        ("daily", date(2026, 8, 21), "2026-08-21"),
        ("weekly", date(2026, 1, 1), "2026-W01"),
        ("weekly", date(2027, 1, 1), "2026-W53"),
        ("monthly", date(2026, 8, 21), "2026-08"),
    ],
)
def test_period_key_uses_daily_iso_weekly_and_monthly_boundaries(
    cycle: str,
    inspection_date: date,
    expected: str,
) -> None:
    """Period keys should remain stable around ISO year boundaries."""
    assert (
        get_inspection_period_key(
            inspection_date,
            cast(InspectionCycle, cycle),
        )
        == expected
    )


@pytest.mark.parametrize(
    ("cycle", "first_date", "duplicate_date"),
    [
        ("daily", "2026-08-21", "2026-08-21"),
        ("weekly", "2026-08-17", "2026-08-23"),
        ("monthly", "2026-08-01", "2026-08-31"),
    ],
)
def test_duplicate_inspection_period_returns_conflict(
    inspection_record_client: tuple[TestClient, sessionmaker[Session]],
    cycle: str,
    first_date: str,
    duplicate_date: str,
) -> None:
    """One equipment cycle should only be completed once per period."""
    client, _session_factory = inspection_record_client
    equipment_id = create_equipment(client)
    number_template = create_number_template(client, equipment_id, cycle=cycle)
    status_template = create_status_template(client, equipment_id, cycle=cycle)
    base = record_payload(
        equipment_id,
        str(number_template["id"]),
        str(status_template["id"]),
        cycle=cycle,
        inspection_date=first_date,
    )
    duplicate = {**base, "inspection_date": duplicate_date}

    assert client.post("/inspection-records", json=base).status_code == 201
    duplicate_response = client.post("/inspection-records", json=duplicate)

    assert duplicate_response.status_code == 409
    assert duplicate_response.json() == {
        "detail": "Inspection already exists for this equipment and period."
    }


@pytest.mark.parametrize("case", ["missing", "duplicate", "wrong_type"])
def test_create_record_rejects_values_that_do_not_match_active_templates(
    inspection_record_client: tuple[TestClient, sessionmaker[Session]],
    case: str,
) -> None:
    """A record must include one correctly typed value for every active item."""
    client, _session_factory = inspection_record_client
    equipment_id = create_equipment(client)
    number_template = create_number_template(client, equipment_id)
    status_template = create_status_template(client, equipment_id)
    payload = record_payload(
        equipment_id,
        str(number_template["id"]),
        str(status_template["id"]),
    )
    items = list(cast(list[dict[str, object]], payload["items"]))
    if case == "missing":
        items = items[:1]
    elif case == "duplicate":
        items[1] = items[0]
    else:
        items[0] = {
            "template_item_id": number_template["id"],
            "number_value": None,
            "status_value": "normal",
        }
    payload["items"] = items

    response = client.post("/inspection-records", json=payload)

    assert response.status_code == 422


def test_create_record_rejects_missing_configuration_and_inactive_equipment(
    inspection_record_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """Only active configured equipment can produce inspection records."""
    client, _session_factory = inspection_record_client
    active_equipment_id = create_equipment(client)
    inactive_equipment_id = create_equipment(client, is_active=False)
    placeholder_item = {
        "template_item_id": str(uuid4()),
        "number_value": 12,
        "status_value": None,
    }

    missing_config = client.post(
        "/inspection-records",
        json={
            "inspection_date": "2026-08-21",
            "equipment_id": active_equipment_id,
            "cycle": "daily",
            "items": [placeholder_item],
        },
    )
    inactive = client.post(
        "/inspection-records",
        json={
            "inspection_date": "2026-08-21",
            "equipment_id": inactive_equipment_id,
            "cycle": "daily",
            "items": [placeholder_item],
        },
    )

    assert missing_config.status_code == 422
    assert missing_config.json() == {
        "detail": "No active inspection items are configured."
    }
    assert inactive.status_code == 422
    assert inactive.json() == {"detail": "Selected equipment is not active."}


def test_get_inspection_record_returns_not_found(
    inspection_record_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """A missing inspection record should return a stable response."""
    client, _session_factory = inspection_record_client

    response = client.get(f"/inspection-records/{uuid4()}")

    assert response.status_code == 404
    assert response.json() == {"detail": "Inspection record not found."}


def test_inspection_status_summarizes_completed_and_pending_cycles(
    inspection_record_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """Active template groups should become one status unit per equipment cycle."""
    client, _session_factory = inspection_record_client
    equipment_id = create_equipment(client)
    other_equipment_id = create_equipment(client)
    daily_number = create_number_template(client, equipment_id, cycle="daily")
    daily_status = create_status_template(client, equipment_id, cycle="daily")
    create_number_template(client, equipment_id, cycle="monthly")
    create_number_template(client, other_equipment_id, cycle="weekly")
    completed = client.post(
        "/inspection-records",
        json=record_payload(
            equipment_id,
            str(daily_number["id"]),
            str(daily_status["id"]),
            inspection_date="2026-08-21",
        ),
    )
    assert completed.status_code == 201

    response = client.get(
        "/inspection-status",
        params={"target_date": "2026-08-21"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["target_date"] == "2026-08-21"
    assert payload["cycle_summaries"] == [
        {"cycle": "daily", "total": 1, "completed": 1, "pending": 0},
        {"cycle": "weekly", "total": 1, "completed": 0, "pending": 1},
        {"cycle": "monthly", "total": 1, "completed": 0, "pending": 1},
    ]
    assert [item["cycle"] for item in payload["items"]] == [
        "daily",
        "weekly",
        "monthly",
    ]
    daily_item = payload["items"][0]
    assert daily_item["equipment_id"] == equipment_id
    assert daily_item["period_key"] == "2026-08-21"
    assert daily_item["template_item_count"] == 2
    assert daily_item["completion_status"] == "completed"
    assert daily_item["inspection_record_id"] == completed.json()["id"]
    assert daily_item["inspection_date"] == "2026-08-21"
    assert daily_item["overall_judgment"] == "abnormal"
    assert payload["items"][1]["completion_status"] == "pending"
    assert payload["items"][1]["inspection_record_id"] is None


def test_inspection_status_matches_iso_week_and_month_periods(
    inspection_record_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """Earlier records in the same ISO week or month should count as completed."""
    client, _session_factory = inspection_record_client
    equipment_id = create_equipment(client)
    weekly = create_number_template(client, equipment_id, cycle="weekly")
    monthly = create_number_template(client, equipment_id, cycle="monthly")
    for cycle, inspection_date, template in (
        ("weekly", "2026-08-17", weekly),
        ("monthly", "2026-08-01", monthly),
    ):
        response = client.post(
            "/inspection-records",
            json={
                "inspection_date": inspection_date,
                "equipment_id": equipment_id,
                "cycle": cycle,
                "items": [
                    {
                        "template_item_id": template["id"],
                        "number_value": 12,
                        "status_value": None,
                    }
                ],
            },
        )
        assert response.status_code == 201

    status_response = client.get(
        "/inspection-status",
        params={"target_date": "2026-08-21"},
    )

    assert status_response.status_code == 200
    items = status_response.json()["items"]
    assert [(item["cycle"], item["period_key"]) for item in items] == [
        ("weekly", "2026-W34"),
        ("monthly", "2026-08"),
    ]
    assert all(item["completion_status"] == "completed" for item in items)


def test_inspection_status_excludes_inactive_templates_and_equipment(
    inspection_record_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """Normal users should only see currently active inspection work."""
    client, session_factory = inspection_record_client
    inactive_template_equipment_id = create_equipment(client)
    inactive_equipment_id = create_equipment(client)
    inactive_template = client.post(
        "/inspection-template-items",
        json={
            "equipment_id": inactive_template_equipment_id,
            "cycle": "daily",
            "name": "外観",
            "input_type": "status",
            "unit": None,
            "normal_min": None,
            "normal_max": None,
            "normal_state": "損傷なし",
            "display_order": 10,
            "is_active": False,
        },
    )
    assert inactive_template.status_code == 201
    create_number_template(client, inactive_equipment_id)
    with session_factory() as session:
        equipment = session.get(Equipment, UUID(inactive_equipment_id))
        assert equipment is not None
        equipment.is_active = False
        session.commit()

    response = client.get(
        "/inspection-status",
        params={"target_date": "2026-08-21"},
    )

    assert response.status_code == 200
    assert response.json()["items"] == []
    assert response.json()["cycle_summaries"] == [
        {"cycle": "daily", "total": 0, "completed": 0, "pending": 0},
        {"cycle": "weekly", "total": 0, "completed": 0, "pending": 0},
        {"cycle": "monthly", "total": 0, "completed": 0, "pending": 0},
    ]


def test_inspection_status_requires_a_valid_target_date(
    inspection_record_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """The browser local date must be explicit and valid."""
    client, _session_factory = inspection_record_client

    assert client.get("/inspection-status").status_code == 422
    assert (
        client.get(
            "/inspection-status",
            params={"target_date": "2026-02-30"},
        ).status_code
        == 422
    )

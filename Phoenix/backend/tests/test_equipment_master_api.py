"""Tests for the equipment master API."""

from collections.abc import Iterator
from datetime import datetime
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
from app.models.equipment_master import Department, Equipment, Manufacturer

pytestmark = pytest.mark.usefixtures("authenticated_business_api")


@pytest.fixture
def equipment_master_client(
    tmp_path: Path,
) -> Iterator[tuple[TestClient, sessionmaker[Session]]]:
    """Provide an API client backed by an isolated SQLite database."""
    database_engine = create_database_engine(
        f"sqlite:///{(tmp_path / 'equipment-master-api.sqlite3').as_posix()}"
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


def create_department(
    client: TestClient,
    *,
    name: str = "菓子パン",
    display_order: int = 10,
    is_active: bool = True,
) -> dict[str, object]:
    """Create and return one fictional test department."""
    response = client.post(
        "/departments",
        json={
            "name": name,
            "display_order": display_order,
            "is_active": is_active,
        },
    )
    assert response.status_code == 201
    return response.json()


def create_manufacturer(
    client: TestClient,
    *,
    name: str = "架空Aメーカー",
    is_active: bool = True,
) -> dict[str, object]:
    """Create and return one fictional test manufacturer."""
    response = client.post(
        "/manufacturers",
        json={"name": name, "is_active": is_active},
    )
    assert response.status_code == 201
    return response.json()


def equipment_payload(
    department_id: str,
    manufacturer_id: str,
    **overrides: object,
) -> dict[str, object]:
    """Return one reusable fictional equipment request body."""
    payload: dict[str, object] = {
        "department_id": department_id,
        "manufacturer_id": manufacturer_id,
        "name": "包装機",
        "equipment_number": "No.2",
        "model_number": "TEST-200",
        "photo_path": None,
        "is_active": True,
    }
    payload.update(overrides)
    return payload


def test_create_and_get_equipment_with_immutable_identifier(
    equipment_master_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """Fictional equipment should persist with normalized master references."""
    client, session_factory = equipment_master_client
    department = create_department(client, name="  菓子パン  ")
    manufacturer = create_manufacturer(client, name="  架空Aメーカー  ")
    payload = equipment_payload(
        str(department["id"]),
        str(manufacturer["id"]),
        name="  包装機  ",
        equipment_number="  No.2  ",
        model_number="  TEST-200  ",
        photo_path="   ",
    )

    response = client.post("/equipment", json=payload)

    assert response.status_code == 201
    created = response.json()
    assert str(UUID(created["equipment_id"])) == created["equipment_id"]
    assert created["department_id"] == department["id"]
    assert created["manufacturer_id"] == manufacturer["id"]
    assert created["name"] == "包装機"
    assert created["equipment_number"] == "No.2"
    assert created["model_number"] == "TEST-200"
    assert created["photo_path"] is None
    assert created["is_active"] is True
    assert datetime.fromisoformat(created["created_at"]).tzinfo is not None
    assert datetime.fromisoformat(created["updated_at"]).tzinfo is not None

    detail_response = client.get(f"/equipment/{created['equipment_id']}")
    assert detail_response.status_code == 200
    assert detail_response.json() == created

    with session_factory() as session:
        persisted = session.get(Equipment, UUID(created["equipment_id"]))
        assert persisted is not None
        assert persisted.department_id == UUID(str(department["id"]))
        assert persisted.manufacturer_id == UUID(str(manufacturer["id"]))


def test_list_master_data_uses_stable_order_and_filters(
    equipment_master_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """Master lists should expose totals and tree-building filters."""
    client, _session_factory = equipment_master_client
    department_b = create_department(client, name="物流", display_order=20)
    department_a = create_department(client, name="菓子パン", display_order=10)
    manufacturer_b = create_manufacturer(client, name="架空Bメーカー")
    manufacturer_a = create_manufacturer(client, name="架空Aメーカー")

    for payload in (
        equipment_payload(
            str(department_a["id"]),
            str(manufacturer_a["id"]),
            name="包装機",
        ),
        equipment_payload(
            str(department_a["id"]),
            str(manufacturer_b["id"]),
            name="ミキサー",
        ),
        equipment_payload(
            str(department_b["id"]),
            str(manufacturer_a["id"]),
            name="コンベアー",
            is_active=False,
        ),
    ):
        assert client.post("/equipment", json=payload).status_code == 201

    departments_response = client.get("/departments")
    manufacturers_response = client.get("/manufacturers")
    equipment_response = client.get(
        "/equipment",
        params={
            "department_id": department_a["id"],
            "manufacturer_id": manufacturer_a["id"],
            "is_active": True,
        },
    )

    assert departments_response.status_code == 200
    assert departments_response.json()["total"] == 2
    assert [item["name"] for item in departments_response.json()["items"]] == [
        "菓子パン",
        "物流",
    ]
    assert manufacturers_response.status_code == 200
    assert manufacturers_response.json()["total"] == 2
    assert [item["name"] for item in manufacturers_response.json()["items"]] == [
        "架空Aメーカー",
        "架空Bメーカー",
    ]
    assert equipment_response.status_code == 200
    assert equipment_response.json()["total"] == 1
    assert equipment_response.json()["items"][0]["name"] == "包装機"


@pytest.mark.parametrize(
    ("path", "payload"),
    [
        ("/departments", {"name": "   ", "display_order": 0}),
        ("/departments", {"name": "物流", "display_order": -1}),
        ("/manufacturers", {"name": "   "}),
        ("/manufacturers", {"name": "x" * 101}),
    ],
)
def test_create_master_rejects_invalid_body(
    equipment_master_client: tuple[TestClient, sessionmaker[Session]],
    path: str,
    payload: dict[str, object],
) -> None:
    """Invalid master input should never reach the database."""
    client, _session_factory = equipment_master_client

    response = client.post(path, json=payload)

    assert response.status_code == 422


def test_duplicate_master_names_return_conflict(
    equipment_master_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """Duplicate department and manufacturer names should return conflicts."""
    client, session_factory = equipment_master_client
    create_department(client, name="物流")
    create_manufacturer(client, name="架空Aメーカー")

    duplicate_department = client.post(
        "/departments",
        json={"name": "物流", "display_order": 30},
    )
    duplicate_manufacturer = client.post(
        "/manufacturers",
        json={"name": "架空Aメーカー"},
    )

    assert duplicate_department.status_code == 409
    assert duplicate_manufacturer.status_code == 409
    with session_factory() as session:
        assert len(session.scalars(select(Department)).all()) == 1
        assert len(session.scalars(select(Manufacturer)).all()) == 1


@pytest.mark.parametrize(
    ("missing_field", "expected_detail"),
    [
        ("department_id", "Department not found."),
        ("manufacturer_id", "Manufacturer not found."),
    ],
)
def test_create_equipment_rejects_unknown_master_reference(
    equipment_master_client: tuple[TestClient, sessionmaker[Session]],
    missing_field: str,
    expected_detail: str,
) -> None:
    """Equipment should not be created outside the master hierarchy."""
    client, session_factory = equipment_master_client
    department = create_department(client)
    manufacturer = create_manufacturer(client)
    payload = equipment_payload(
        str(department["id"]),
        str(manufacturer["id"]),
    )
    payload[missing_field] = str(uuid4())

    response = client.post("/equipment", json=payload)

    assert response.status_code == 404
    assert response.json() == {"detail": expected_detail}
    with session_factory() as session:
        assert session.scalar(select(Equipment)) is None


def test_get_equipment_returns_not_found(
    equipment_master_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """A missing equipment identifier should return a stable response."""
    client, _session_factory = equipment_master_client

    response = client.get(f"/equipment/{uuid4()}")

    assert response.status_code == 404
    assert response.json() == {"detail": "Equipment not found."}

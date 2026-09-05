"""Tests for the work report creation and history API."""

from collections.abc import Iterator
from datetime import date, datetime
from decimal import Decimal
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
from app.models.work_report import WorkReport

pytestmark = pytest.mark.usefixtures("authenticated_business_api")

DEPARTMENT_ID = UUID("10000000-0000-4000-8000-000000000001")
MANUFACTURER_ID = UUID("20000000-0000-4000-8000-000000000001")
EQUIPMENT_ID = UUID("30000000-0000-4000-8000-000000000001")


@pytest.fixture
def work_report_client(
    tmp_path: Path,
) -> Iterator[tuple[TestClient, sessionmaker[Session]]]:
    """Provide an API client and isolated database session factory."""
    database_engine = create_database_engine(
        f"sqlite:///{(tmp_path / 'work-reports-api.sqlite3').as_posix()}"
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
        session.add(
            Equipment(
                equipment_id=EQUIPMENT_ID,
                department_id=department.id,
                manufacturer_id=manufacturer.id,
                name="包装機",
                equipment_number="No.2",
                model_number="TEST-200",
                photo_path=None,
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


def valid_work_report_payload() -> dict[str, object]:
    """Return fictional valid input reused by API validation tests."""
    return {
        "work_date": "2026-08-16",
        "department_id": str(DEPARTMENT_ID),
        "equipment_id": str(EQUIPMENT_ID),
        "phenomenon": "  ベルトが緩んでいる  ",
        "cause": "  経年による伸び  ",
        "work_content": "  架空設備Aのベルト張力を調整  ",
        "progress": "completed",
    }


def test_create_work_report_persists_normalized_item(
    work_report_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """A valid request should return and persist the normalized report."""
    client, session_factory = work_report_client

    response = client.post("/work-reports", json=valid_work_report_payload())

    assert response.status_code == 201
    created = response.json()
    assert str(UUID(created["id"])) == created["id"]
    assert created["work_date"] == "2026-08-16"
    assert created["department_id"] == str(DEPARTMENT_ID)
    assert created["equipment_id"] == str(EQUIPMENT_ID)
    assert created["department_name"] == "菓子パン"
    assert created["equipment_name"] == "包装機"
    assert created["equipment_number"] == "No.2"
    assert created["phenomenon"] == "ベルトが緩んでいる"
    assert created["cause"] == "経年による伸び"
    assert created["work_content"] == "架空設備Aのベルト張力を調整"
    assert created["progress"] == "completed"
    assert created["is_legacy"] is False
    assert created["legacy_category"] is None
    assert created["legacy_work_hours"] is None
    assert created["legacy_notes"] is None
    assert datetime.fromisoformat(created["created_at"]).tzinfo is not None
    assert datetime.fromisoformat(created["updated_at"]).tzinfo is not None

    with session_factory() as session:
        persisted = session.scalar(select(WorkReport))
        assert persisted is not None
        assert persisted.id == UUID(created["id"])
        assert persisted.work_date == date(2026, 8, 16)
        assert persisted.department_id == DEPARTMENT_ID
        assert persisted.equipment_id == EQUIPMENT_ID
        assert persisted.phenomenon == "ベルトが緩んでいる"
        assert persisted.cause == "経年による伸び"
        assert persisted.work_content == "架空設備Aのベルト張力を調整"


def test_create_work_report_normalizes_blank_cause(
    work_report_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """Blank unresolved cause should be stored as no cause."""
    client, _session_factory = work_report_client
    payload = valid_work_report_payload()
    payload["cause"] = "   "

    response = client.post("/work-reports", json=payload)

    assert response.status_code == 201
    assert response.json()["cause"] is None


@pytest.mark.parametrize(
    ("field_name", "invalid_value"),
    [
        ("work_date", "2026-02-30"),
        ("phenomenon", "   "),
        ("phenomenon", "x" * 2001),
        ("cause", "x" * 2001),
        ("work_content", "   "),
        ("work_content", "x" * 2001),
        ("progress", "unknown"),
        ("unexpected", True),
    ],
)
def test_create_work_report_rejects_invalid_body(
    work_report_client: tuple[TestClient, sessionmaker[Session]],
    field_name: str,
    invalid_value: object,
) -> None:
    """Invalid or unexpected input should never reach the database."""
    client, session_factory = work_report_client
    payload = valid_work_report_payload()
    payload[field_name] = invalid_value

    response = client.post("/work-reports", json=payload)

    assert response.status_code == 422
    with session_factory() as session:
        assert session.scalar(select(WorkReport)) is None


def test_create_work_report_rejects_missing_required_fields(
    work_report_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """A report without required fields should be rejected."""
    client, _session_factory = work_report_client

    response = client.post("/work-reports", json={})

    assert response.status_code == 422


def test_create_work_report_rejects_department_equipment_mismatch(
    work_report_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """A report must not connect equipment to a different department."""
    client, session_factory = work_report_client
    other_department_id = uuid4()
    with session_factory() as session:
        session.add(
            Department(
                id=other_department_id,
                name="物流",
                display_order=20,
            )
        )
        session.commit()
    payload = valid_work_report_payload()
    payload["department_id"] = str(other_department_id)

    response = client.post("/work-reports", json=payload)

    assert response.status_code == 422
    assert response.json() == {
        "detail": "Selected equipment does not belong to the department."
    }
    with session_factory() as session:
        assert session.scalar(select(WorkReport)) is None


def test_create_work_report_rejects_inactive_equipment(
    work_report_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """Inactive equipment must not be selected for a new report."""
    client, session_factory = work_report_client
    with session_factory() as session:
        equipment_item = session.get(Equipment, EQUIPMENT_ID)
        assert equipment_item is not None
        equipment_item.is_active = False
        session.commit()

    response = client.post("/work-reports", json=valid_work_report_payload())

    assert response.status_code == 422
    assert response.json() == {"detail": "Selected equipment is not active."}


def test_list_work_reports_keeps_legacy_unassigned_report(
    work_report_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """Rows created before equipment linking should remain readable."""
    client, session_factory = work_report_client
    with session_factory() as session:
        session.add(
            WorkReport(
                work_date=date(2026, 8, 15),
                category="maintenance",
                work_hours=Decimal("1.00"),
                work_content="設備連携前の架空日報",
                result="completed",
                notes=None,
            )
        )
        session.commit()

    response = client.get("/work-reports")

    assert response.status_code == 200
    report = response.json()["items"][0]
    assert report["work_content"] == "設備連携前の架空日報"
    assert report["department_id"] is None
    assert report["equipment_id"] is None
    assert report["department_name"] is None
    assert report["equipment_name"] is None
    assert report["equipment_number"] is None
    assert report["phenomenon"] is None
    assert report["cause"] is None
    assert report["progress"] == "completed"
    assert report["is_legacy"] is True
    assert report["legacy_category"] == "maintenance"
    assert report["legacy_work_hours"] == 1.0
    assert report["legacy_notes"] is None


def test_update_work_report_persists_normalized_fields(
    work_report_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """Editing should replace all input fields while keeping the report identity."""
    client, session_factory = work_report_client
    created_response = client.post("/work-reports", json=valid_work_report_payload())
    assert created_response.status_code == 201
    created = created_response.json()
    update_payload = {
        "work_date": "2026-08-17",
        "department_id": str(DEPARTMENT_ID),
        "equipment_id": str(EQUIPMENT_ID),
        "phenomenon": "  安全カバーが扱いにくい  ",
        "cause": "  取っ手が小さい  ",
        "work_content": "  架空設備Aの安全カバーを改善  ",
        "progress": "follow_up",
    }

    response = client.patch(
        f"/work-reports/{created['id']}",
        json=update_payload,
    )

    assert response.status_code == 200
    updated = response.json()
    assert updated["id"] == created["id"]
    assert updated["created_at"] == created["created_at"]
    assert datetime.fromisoformat(updated["updated_at"]).tzinfo is not None
    assert updated["work_date"] == "2026-08-17"
    assert updated["phenomenon"] == "安全カバーが扱いにくい"
    assert updated["cause"] == "取っ手が小さい"
    assert updated["work_content"] == "架空設備Aの安全カバーを改善"
    assert updated["progress"] == "follow_up"

    with session_factory() as session:
        persisted = session.get(WorkReport, UUID(created["id"]))
        assert persisted is not None
        assert persisted.work_date == date(2026, 8, 17)
        assert persisted.phenomenon == "安全カバーが扱いにくい"
        assert persisted.cause == "取っ手が小さい"
        assert persisted.work_content == "架空設備Aの安全カバーを改善"
        assert persisted.result == "follow_up"


def test_update_legacy_report_keeps_former_details(
    work_report_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """Converting an old report should not erase its former stored details."""
    client, session_factory = work_report_client
    legacy_id = uuid4()
    with session_factory() as session:
        session.add(
            WorkReport(
                id=legacy_id,
                work_date=date(2026, 8, 15),
                department_id=DEPARTMENT_ID,
                equipment_id=EQUIPMENT_ID,
                category="trouble",
                work_hours=Decimal("2.00"),
                work_content="移行前の架空故障対応",
                result="continued",
                notes="架空部品の入荷待ち",
            )
        )
        session.commit()

    response = client.patch(
        f"/work-reports/{legacy_id}",
        json=valid_work_report_payload(),
    )

    assert response.status_code == 200
    updated = response.json()
    assert updated["is_legacy"] is False
    assert updated["legacy_category"] == "trouble"
    assert updated["legacy_work_hours"] == 2.0
    assert updated["legacy_notes"] == "架空部品の入荷待ち"
    with session_factory() as session:
        persisted = session.get(WorkReport, legacy_id)
        assert persisted is not None
        assert persisted.category == "trouble"
        assert persisted.work_hours == Decimal("2.00")
        assert persisted.notes == "架空部品の入荷待ち"


def test_update_work_report_rejects_invalid_body_without_changing_item(
    work_report_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """An invalid edit should leave the original persisted report unchanged."""
    client, session_factory = work_report_client
    created_response = client.post("/work-reports", json=valid_work_report_payload())
    assert created_response.status_code == 201
    created = created_response.json()
    invalid_payload = valid_work_report_payload()
    invalid_payload["phenomenon"] = "   "

    response = client.patch(
        f"/work-reports/{created['id']}",
        json=invalid_payload,
    )

    assert response.status_code == 422
    with session_factory() as session:
        persisted = session.get(WorkReport, UUID(created["id"]))
        assert persisted is not None
        assert persisted.work_date == date(2026, 8, 16)
        assert persisted.phenomenon == "ベルトが緩んでいる"
        assert persisted.work_content == "架空設備Aのベルト張力を調整"


def test_update_work_report_returns_not_found(
    work_report_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """Editing a missing report should return a stable not-found response."""
    client, _session_factory = work_report_client

    response = client.patch(
        f"/work-reports/{uuid4()}",
        json=valid_work_report_payload(),
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Work report not found."}


def test_list_work_reports_returns_empty_page(
    work_report_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """An empty database should return an explicit empty first page."""
    client, _session_factory = work_report_client

    response = client.get("/work-reports")

    assert response.status_code == 200
    assert response.json() == {"items": [], "total": 0, "limit": 5, "offset": 0}


def test_list_work_reports_returns_newest_page_and_total(
    work_report_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """The list endpoint should page reports by work date from newest to oldest."""
    client, _session_factory = work_report_client
    created_ids: dict[str, str] = {}
    for work_date, work_content in (
        ("2026-08-14", "架空設備Aの点検"),
        ("2026-08-16", "架空設備Cの点検"),
        ("2026-08-15", "架空設備Bの点検"),
    ):
        payload = valid_work_report_payload()
        payload["work_date"] = work_date
        payload["work_content"] = work_content
        create_response = client.post("/work-reports", json=payload)
        assert create_response.status_code == 201
        created_ids[work_date] = create_response.json()["id"]

    response = client.get("/work-reports", params={"limit": 2, "offset": 1})

    assert response.status_code == 200
    page = response.json()
    assert page["total"] == 3
    assert page["limit"] == 2
    assert page["offset"] == 1
    assert [item["work_date"] for item in page["items"]] == [
        "2026-08-15",
        "2026-08-14",
    ]
    assert [item["id"] for item in page["items"]] == [
        created_ids["2026-08-15"],
        created_ids["2026-08-14"],
    ]


def test_list_work_reports_filters_one_work_date_and_filtered_total(
    work_report_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """A work-date search should return only that day's reports and count."""
    client, _session_factory = work_report_client
    for work_date, work_content in (
        ("2026-08-15", "架空設備Aの点検"),
        ("2026-08-16", "架空設備Bの整備"),
        ("2026-08-15", "架空設備Cの清掃"),
    ):
        payload = valid_work_report_payload()
        payload["work_date"] = work_date
        payload["work_content"] = work_content
        assert client.post("/work-reports", json=payload).status_code == 201

    response = client.get(
        "/work-reports",
        params={"work_date": "2026-08-15", "limit": 1},
    )

    assert response.status_code == 200
    page = response.json()
    assert page["total"] == 2
    assert page["limit"] == 1
    assert len(page["items"]) == 1
    assert page["items"][0]["work_date"] == "2026-08-15"


def test_list_work_reports_filters_one_progress_and_filtered_total(
    work_report_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """A progress filter should return and count only matching reports."""
    client, _session_factory = work_report_client
    for progress, work_content in (
        ("continued", "架空設備Aの部品入荷後に作業を継続"),
        ("completed", "架空設備Bの給油を完了"),
        ("continued", "架空設備Cの停止原因を継続調査"),
    ):
        payload = valid_work_report_payload()
        payload["progress"] = progress
        payload["work_content"] = work_content
        assert client.post("/work-reports", json=payload).status_code == 201

    response = client.get(
        "/work-reports",
        params={"progress": "continued", "limit": 1},
    )

    assert response.status_code == 200
    page = response.json()
    assert page["total"] == 2
    assert page["limit"] == 1
    assert len(page["items"]) == 1
    assert page["items"][0]["progress"] == "continued"


def test_list_work_reports_combines_date_and_progress_filters(
    work_report_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """Date and progress filters should return their intersection."""
    client, _session_factory = work_report_client
    for work_date, progress, work_content in (
        ("2026-08-15", "continued", "架空設備Aの原因を継続調査"),
        ("2026-08-15", "completed", "架空設備Bの復旧を完了"),
        ("2026-08-16", "continued", "架空設備Cの原因を継続調査"),
    ):
        payload = valid_work_report_payload()
        payload["work_date"] = work_date
        payload["progress"] = progress
        payload["work_content"] = work_content
        assert client.post("/work-reports", json=payload).status_code == 201

    response = client.get(
        "/work-reports",
        params={
            "work_date": "2026-08-15",
            "progress": "continued",
        },
    )

    assert response.status_code == 200
    page = response.json()
    assert page["total"] == 1
    assert len(page["items"]) == 1
    assert page["items"][0]["work_date"] == "2026-08-15"
    assert page["items"][0]["progress"] == "continued"


def test_list_work_reports_combines_basic_history_search_filters(
    work_report_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """Date, department, work content, and progress should intersect."""
    client, session_factory = work_report_client
    other_department_id = uuid4()
    other_equipment_id = uuid4()
    with session_factory() as session:
        session.add(
            Department(
                id=other_department_id,
                name="物流",
                display_order=20,
            )
        )
        session.flush()
        session.add(
            Equipment(
                equipment_id=other_equipment_id,
                department_id=other_department_id,
                manufacturer_id=MANUFACTURER_ID,
                name="架空コンベアー",
                equipment_number="No.1",
                model_number="TEST-CV-1",
                photo_path=None,
            )
        )
        session.commit()

    matching_payload = valid_work_report_payload()
    matching_payload.update(
        {
            "work_date": "2026-08-18",
            "work_content": "包装機の駆動ベルトを交換",
            "progress": "continued",
        }
    )
    matching = client.post("/work-reports", json=matching_payload)
    assert matching.status_code == 201

    for work_content, progress in (
        ("包装機のチェーンを給油", "continued"),
        ("包装機の駆動ベルトを交換して完了", "completed"),
    ):
        payload = valid_work_report_payload()
        payload.update(
            {
                "work_date": "2026-08-18",
                "work_content": work_content,
                "progress": progress,
            }
        )
        assert client.post("/work-reports", json=payload).status_code == 201

    other_department_payload = valid_work_report_payload()
    other_department_payload.update(
        {
            "work_date": "2026-08-18",
            "department_id": str(other_department_id),
            "equipment_id": str(other_equipment_id),
            "work_content": "コンベアーの駆動ベルトを交換",
            "progress": "continued",
        }
    )
    assert (
        client.post("/work-reports", json=other_department_payload).status_code == 201
    )

    response = client.get(
        "/work-reports",
        params={
            "work_date": "2026-08-18",
            "department_id": str(DEPARTMENT_ID),
            "work_content_query": "  ベルト  ",
            "progress": "continued",
        },
    )

    assert response.status_code == 200
    page = response.json()
    assert page["total"] == 1
    assert [item["id"] for item in page["items"]] == [matching.json()["id"]]


@pytest.mark.parametrize(
    ("query_name", "query_value"),
    [
        ("department_id", "not-a-uuid"),
        ("work_content_query", "   "),
        ("work_content_query", "x" * 201),
    ],
)
def test_list_work_reports_rejects_invalid_basic_history_search_filters(
    work_report_client: tuple[TestClient, sessionmaker[Session]],
    query_name: str,
    query_value: str,
) -> None:
    """Malformed normal-user search input should be rejected before querying."""
    client, _session_factory = work_report_client

    response = client.get("/work-reports", params={query_name: query_value})

    assert response.status_code == 422


def test_list_work_reports_filters_one_equipment_and_limits_latest_items(
    work_report_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """Equipment cards should receive only the selected asset's latest reports."""
    client, session_factory = work_report_client
    other_equipment_id = uuid4()
    with session_factory() as session:
        session.add(
            Equipment(
                equipment_id=other_equipment_id,
                department_id=DEPARTMENT_ID,
                manufacturer_id=MANUFACTURER_ID,
                name="架空ミキサー",
                equipment_number="No.1",
                model_number="TEST-MIX-1",
                photo_path=None,
            )
        )
        session.commit()

    for index in range(6):
        payload = valid_work_report_payload()
        payload["work_date"] = f"2026-08-{10 + index:02d}"
        payload["phenomenon"] = f"包装機の架空現象{index}"
        assert client.post("/work-reports", json=payload).status_code == 201
    other_payload = valid_work_report_payload()
    other_payload["equipment_id"] = str(other_equipment_id)
    other_payload["phenomenon"] = "ミキサーの架空現象"
    assert client.post("/work-reports", json=other_payload).status_code == 201

    response = client.get(
        "/work-reports",
        params={"equipment_id": str(EQUIPMENT_ID), "limit": 5},
    )

    assert response.status_code == 200
    page = response.json()
    assert page["total"] == 6
    assert len(page["items"]) == 5
    assert all(item["equipment_id"] == str(EQUIPMENT_ID) for item in page["items"])
    assert [item["work_date"] for item in page["items"]] == [
        "2026-08-15",
        "2026-08-14",
        "2026-08-13",
        "2026-08-12",
        "2026-08-11",
    ]


def test_list_work_reports_rejects_invalid_work_date(
    work_report_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """An impossible work date should be rejected before querying."""
    client, _session_factory = work_report_client

    response = client.get("/work-reports", params={"work_date": "2026-02-30"})

    assert response.status_code == 422


def test_list_work_reports_rejects_invalid_progress(
    work_report_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """An unknown work progress should be rejected before querying."""
    client, _session_factory = work_report_client

    response = client.get("/work-reports", params={"progress": "unknown"})

    assert response.status_code == 422


def test_get_work_report_attention_summary_returns_zero_for_empty_database(
    work_report_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """An empty database should return a valid all-zero attention summary."""
    client, _session_factory = work_report_client

    response = client.get("/work-reports/attention-summary")

    assert response.status_code == 200
    assert response.json() == {
        "continued_count": 0,
        "follow_up_count": 0,
        "attention_count": 0,
    }


def test_get_work_report_attention_summary_counts_only_attention_results(
    work_report_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """The summary should count all continued and follow-up saved reports."""
    client, _session_factory = work_report_client
    for progress, work_content in (
        ("continued", "架空設備Aの部品到着後に作業を継続"),
        ("completed", "架空設備Bの点検を完了"),
        ("follow_up", "架空設備Cの試運転結果を経過確認"),
        ("continued", "架空設備Dの停止原因を継続調査"),
    ):
        payload = valid_work_report_payload()
        payload["progress"] = progress
        payload["work_content"] = work_content
        assert client.post("/work-reports", json=payload).status_code == 201

    response = client.get("/work-reports/attention-summary")

    assert response.status_code == 200
    assert response.json() == {
        "continued_count": 2,
        "follow_up_count": 1,
        "attention_count": 3,
    }


@pytest.mark.parametrize(
    "query",
    [
        {"limit": 0},
        {"limit": 51},
        {"offset": -1},
    ],
)
def test_list_work_reports_rejects_invalid_pagination(
    work_report_client: tuple[TestClient, sessionmaker[Session]],
    query: dict[str, int],
) -> None:
    """Invalid page bounds should be rejected before querying the database."""
    client, _session_factory = work_report_client

    response = client.get("/work-reports", params=query)

    assert response.status_code == 422

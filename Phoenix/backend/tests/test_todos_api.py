"""Tests for the ToDo creation and listing API."""

from collections.abc import Iterator
from datetime import datetime
from pathlib import Path
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.base import Base
from app.db.session import (
    create_database_engine,
    create_session_factory,
    get_db_session,
)
from app.main import app

pytestmark = pytest.mark.usefixtures("authenticated_business_api")


@pytest.fixture
def todo_client(tmp_path: Path) -> Iterator[TestClient]:
    """Provide an API client backed by an isolated SQLite database."""
    database_engine = create_database_engine(
        f"sqlite:///{(tmp_path / 'todos-api.sqlite3').as_posix()}"
    )
    session_factory = create_session_factory(database_engine)
    Base.metadata.create_all(database_engine)

    def override_db_session() -> Iterator[Session]:
        with session_factory() as session:
            yield session

    app.dependency_overrides[get_db_session] = override_db_session
    try:
        with TestClient(app) as client:
            yield client
    finally:
        app.dependency_overrides.pop(get_db_session, None)
        database_engine.dispose()


def create_test_equipment(
    client: TestClient,
    *,
    name: str = "架空包装機",
    is_active: bool = True,
) -> str:
    """Create one fictional equipment option for schedule-link tests."""
    department = client.post(
        "/departments",
        json={"name": f"架空部門-{name}", "display_order": 10},
    )
    manufacturer = client.post(
        "/manufacturers",
        json={"name": f"架空メーカー-{name}"},
    )
    assert department.status_code == 201
    assert manufacturer.status_code == 201
    equipment = client.post(
        "/equipment",
        json={
            "department_id": department.json()["id"],
            "manufacturer_id": manufacturer.json()["id"],
            "name": name,
            "equipment_number": "No.2",
            "model_number": None,
            "photo_path": None,
            "is_active": is_active,
        },
    )
    assert equipment.status_code == 201
    return str(equipment.json()["equipment_id"])


def test_todo_list_starts_empty(todo_client: TestClient) -> None:
    """A new database should return an explicit empty collection."""
    response = todo_client.get("/todos")

    assert response.status_code == 200
    assert response.json() == {
        "items": [],
        "total": 0,
        "limit": 50,
        "offset": 0,
    }


def test_create_todo_persists_normalized_item(todo_client: TestClient) -> None:
    """A valid request should create an item that appears in the list."""
    response = todo_client.post(
        "/todos",
        json={
            "title": "  APIテストを完了する  ",
            "description": "  作成後に一覧取得も確認する  ",
            "due_date": "2026-07-21",
            "priority": "high",
            "category": "  学習  ",
        },
    )

    assert response.status_code == 201
    created = response.json()
    assert str(UUID(created["id"])) == created["id"]
    assert created["title"] == "APIテストを完了する"
    assert created["description"] == "作成後に一覧取得も確認する"
    assert created["due_date"] == "2026-07-21"
    assert created["priority"] == "high"
    assert created["category"] == "学習"
    assert created["equipment_id"] is None
    assert created["is_pinned"] is False
    assert created["is_completed"] is False
    assert created["is_archived"] is False
    assert datetime.fromisoformat(created["created_at"]).tzinfo is not None
    assert datetime.fromisoformat(created["updated_at"]).tzinfo is not None

    list_response = todo_client.get("/todos")
    assert list_response.status_code == 200
    assert list_response.json()["total"] == 1
    assert list_response.json()["items"][0]["id"] == created["id"]


def test_create_todo_can_restore_completed_state(todo_client: TestClient) -> None:
    """A CSV import should persist its explicit completion state in one request."""
    response = todo_client.post(
        "/todos",
        json={
            "title": "完了状態を復元する",
            "is_completed": True,
        },
    )

    assert response.status_code == 201
    assert response.json()["is_completed"] is True

    list_response = todo_client.get("/todos")
    assert list_response.status_code == 200
    assert list_response.json()["items"][0]["is_completed"] is True


def test_create_todo_links_active_equipment_into_due_summary(
    todo_client: TestClient,
) -> None:
    """One active equipment ID should persist through the normal-user summary."""
    equipment_id = create_test_equipment(todo_client)

    response = todo_client.post(
        "/todos",
        json={
            "title": "包装機を点検する",
            "due_date": "2026-08-26",
            "equipment_id": equipment_id,
        },
    )

    assert response.status_code == 201
    assert response.json()["equipment_id"] == equipment_id
    summary = todo_client.get(
        "/todos/due-summary",
        params={"target_date": "2026-08-26"},
    ).json()
    assert summary["today_items"][0]["equipment_id"] == equipment_id


def test_create_todo_rejects_missing_or_inactive_equipment(
    todo_client: TestClient,
) -> None:
    """New schedules should link only to equipment available for field use."""
    inactive_equipment_id = create_test_equipment(
        todo_client,
        name="架空停止設備",
        is_active=False,
    )

    for equipment_id in (str(uuid4()), inactive_equipment_id):
        response = todo_client.post(
            "/todos",
            json={"title": "無効な設備リンク", "equipment_id": equipment_id},
        )
        assert response.status_code == 422
        assert response.json() == {"detail": "Selected equipment is not active."}


def test_update_todo_can_set_and_clear_equipment(todo_client: TestClient) -> None:
    """Editing should add or remove one optional equipment link."""
    equipment_id = create_test_equipment(todo_client, name="架空コンベアー")
    created = todo_client.post("/todos", json={"title": "給油予定"}).json()

    linked = todo_client.patch(
        f"/todos/{created['id']}",
        json={"equipment_id": equipment_id},
    )
    assert linked.status_code == 200
    assert linked.json()["equipment_id"] == equipment_id

    cleared = todo_client.patch(
        f"/todos/{created['id']}",
        json={"equipment_id": None},
    )
    assert cleared.status_code == 200
    assert cleared.json()["equipment_id"] is None


def test_todo_list_is_ordered_and_paginated(todo_client: TestClient) -> None:
    """Dated items should precede undated items with stable pagination."""
    create_responses = [
        todo_client.post(
            "/todos",
            json={"title": "期限なし"},
        ),
        todo_client.post(
            "/todos",
            json={"title": "2番目", "due_date": "2026-07-22"},
        ),
        todo_client.post(
            "/todos",
            json={"title": "1番目", "due_date": "2026-07-21"},
        ),
    ]
    assert all(response.status_code == 201 for response in create_responses)
    assert all(response.json()["priority"] == "medium" for response in create_responses)
    assert all(response.json()["category"] is None for response in create_responses)

    response = todo_client.get("/todos", params={"limit": 2, "offset": 1})

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 3
    assert payload["limit"] == 2
    assert payload["offset"] == 1
    assert [item["title"] for item in payload["items"]] == [
        "2番目",
        "期限なし",
    ]


def test_pinned_todo_is_persisted_and_listed_first(todo_client: TestClient) -> None:
    """Pinning an item should persist it and move it ahead of normal ordering."""
    first = todo_client.post(
        "/todos",
        json={"title": "通常ToDo", "due_date": "2026-07-21"},
    ).json()
    pinned = todo_client.post(
        "/todos",
        json={"title": "固定対象", "due_date": "2026-07-30"},
    ).json()

    response = todo_client.patch(
        f"/todos/{pinned['id']}",
        json={"is_pinned": True},
    )

    assert response.status_code == 200
    assert response.json()["is_pinned"] is True
    listed = todo_client.get("/todos").json()["items"]
    assert [item["id"] for item in listed] == [pinned["id"], first["id"]]


@pytest.mark.parametrize(
    "request_body",
    [
        {"title": "   "},
        {"title": "x" * 201},
        {"title": "有効", "priority": "urgent"},
        {"title": "有効", "category": "x" * 31},
        {"title": "有効", "unexpected": True},
    ],
)
def test_create_todo_rejects_invalid_body(
    todo_client: TestClient,
    request_body: dict[str, object],
) -> None:
    """Invalid or unexpected input should never reach the database."""
    response = todo_client.post("/todos", json=request_body)

    assert response.status_code == 422


@pytest.mark.parametrize(
    "params",
    [
        {"limit": 101},
        {"offset": -1},
    ],
)
def test_todo_list_rejects_invalid_pagination(
    todo_client: TestClient,
    params: dict[str, int],
) -> None:
    """Pagination must remain within the documented safety limits."""
    response = todo_client.get("/todos", params=params)

    assert response.status_code == 422


def test_due_summary_groups_today_and_overdue_active_todos(
    todo_client: TestClient,
) -> None:
    """The normal-user summary should exclude completed, archived, and undated work."""
    todo_client.post(
        "/todos",
        json={"title": "期限超過", "due_date": "2026-08-21", "priority": "low"},
    )
    today_low = todo_client.post(
        "/todos",
        json={"title": "本日・低", "due_date": "2026-08-22", "priority": "low"},
    ).json()
    today_high = todo_client.post(
        "/todos",
        json={"title": "本日・高", "due_date": "2026-08-22", "priority": "high"},
    ).json()
    completed = todo_client.post(
        "/todos",
        json={
            "title": "完了済み",
            "due_date": "2026-08-22",
            "is_completed": True,
        },
    ).json()
    todo_client.patch(
        f"/todos/{completed['id']}",
        json={"is_archived": True},
    )
    todo_client.post("/todos", json={"title": "期限なし"})
    todo_client.post(
        "/todos",
        json={"title": "将来", "due_date": "2026-08-23"},
    )

    response = todo_client.get(
        "/todos/due-summary",
        params={"target_date": "2026-08-22"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["target_date"] == "2026-08-22"
    assert [item["title"] for item in payload["overdue_items"]] == ["期限超過"]
    assert [item["id"] for item in payload["today_items"]] == [
        today_high["id"],
        today_low["id"],
    ]


def test_due_summary_requires_a_valid_target_date(todo_client: TestClient) -> None:
    """The browser's local date must be supplied explicitly."""
    assert todo_client.get("/todos/due-summary").status_code == 422
    assert (
        todo_client.get(
            "/todos/due-summary",
            params={"target_date": "2026-02-30"},
        ).status_code
        == 422
    )


def test_todo_creation_allows_local_frontend_origin(
    todo_client: TestClient,
) -> None:
    """The local frontend should pass the POST CORS preflight check."""
    origin = "http://127.0.0.1:5173"
    response = todo_client.options(
        "/todos",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin
    assert "POST" in response.headers["access-control-allow-methods"]
    assert "content-type" in response.headers["access-control-allow-headers"].lower()


def test_update_todo_changes_supplied_fields(todo_client: TestClient) -> None:
    """A partial update should preserve omitted fields and normalize input."""
    created = todo_client.post(
        "/todos",
        json={
            "title": "更新前",
            "description": "維持する説明",
            "due_date": "2026-07-30",
            "priority": "low",
            "category": "仕事",
        },
    ).json()

    response = todo_client.patch(
        f"/todos/{created['id']}",
        json={
            "title": "  更新後  ",
            "priority": "high",
            "category": "  設備保全  ",
            "is_completed": True,
        },
    )

    assert response.status_code == 200
    updated = response.json()
    assert updated["title"] == "更新後"
    assert updated["description"] == "維持する説明"
    assert updated["due_date"] == "2026-07-30"
    assert updated["priority"] == "high"
    assert updated["category"] == "設備保全"
    assert updated["is_completed"] is True


def test_update_todo_can_clear_optional_fields(todo_client: TestClient) -> None:
    """Optional description and due date should be explicitly clearable."""
    created = todo_client.post(
        "/todos",
        json={
            "title": "任意項目を消す",
            "description": "削除対象",
            "due_date": "2026-07-30",
            "category": "一時分類",
        },
    ).json()

    response = todo_client.patch(
        f"/todos/{created['id']}",
        json={"description": "   ", "due_date": None, "category": "   "},
    )

    assert response.status_code == 200
    assert response.json()["description"] is None
    assert response.json()["due_date"] is None
    assert response.json()["category"] is None


def test_completed_todo_can_be_archived_and_restored(
    todo_client: TestClient,
) -> None:
    """A completed item should keep its data while moving in and out of archive."""
    created = todo_client.post(
        "/todos",
        json={"title": "完了記録を保管する", "is_completed": True},
    ).json()

    archived_response = todo_client.patch(
        f"/todos/{created['id']}",
        json={"is_archived": True},
    )

    assert archived_response.status_code == 200
    assert archived_response.json()["is_completed"] is True
    assert archived_response.json()["is_archived"] is True
    current = todo_client.post(
        "/todos",
        json={"title": "現在のToDo"},
    ).json()
    listed = todo_client.get("/todos").json()["items"]
    assert [item["id"] for item in listed] == [current["id"], created["id"]]
    assert listed[1]["is_archived"] is True

    restored_response = todo_client.patch(
        f"/todos/{created['id']}",
        json={"is_archived": False},
    )

    assert restored_response.status_code == 200
    assert restored_response.json()["is_archived"] is False
    assert restored_response.json()["title"] == "完了記録を保管する"


def test_incomplete_todo_cannot_be_archived(todo_client: TestClient) -> None:
    """The API should explain why unfinished work cannot enter the archive."""
    created = todo_client.post(
        "/todos",
        json={"title": "まだ対応中"},
    ).json()

    response = todo_client.patch(
        f"/todos/{created['id']}",
        json={"is_archived": True},
    )

    assert response.status_code == 422
    assert response.json() == {"detail": "Only completed ToDos can be archived."}


@pytest.mark.parametrize(
    "request_body",
    [
        {},
        {"title": "   "},
        {"unexpected": True},
    ],
)
def test_update_todo_rejects_invalid_body(
    todo_client: TestClient,
    request_body: dict[str, object],
) -> None:
    """Empty, invalid, and unknown updates should be rejected."""
    created = todo_client.post("/todos", json={"title": "変更しない"}).json()

    response = todo_client.patch(f"/todos/{created['id']}", json=request_body)

    assert response.status_code == 422


def test_delete_todo_removes_it_from_collection(todo_client: TestClient) -> None:
    """Deleting an item should return no body and remove persisted data."""
    created = todo_client.post("/todos", json={"title": "削除対象"}).json()

    response = todo_client.delete(f"/todos/{created['id']}")

    assert response.status_code == 204
    assert response.content == b""
    assert todo_client.get("/todos").json()["total"] == 0


@pytest.mark.parametrize("method", ["patch", "delete"])
def test_item_operations_return_404_for_missing_todo(
    todo_client: TestClient,
    method: str,
) -> None:
    """Item operations should share a stable response for unknown IDs."""
    missing_id = "00000000-0000-0000-0000-000000000000"
    request = getattr(todo_client, method)
    kwargs = {"json": {"is_completed": True}} if method == "patch" else {}

    response = request(f"/todos/{missing_id}", **kwargs)

    assert response.status_code == 404
    assert response.json() == {"detail": "ToDo not found."}


def test_todo_mutations_allow_local_frontend_origin(
    todo_client: TestClient,
) -> None:
    """The local frontend should pass mutation CORS preflight checks."""
    origin = "http://127.0.0.1:5173"
    for method in ("PATCH", "DELETE"):
        response = todo_client.options(
            "/todos/00000000-0000-0000-0000-000000000000",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": method,
                "Access-Control-Request-Headers": "Content-Type",
            },
        )

        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == origin
        assert method in response.headers["access-control-allow-methods"]


def test_todo_operations_are_in_openapi_schema() -> None:
    """Collection and item operations should remain in the API contract."""
    response = TestClient(app).get("/openapi.json")

    assert response.status_code == 200
    assert {"get", "post"}.issubset(response.json()["paths"]["/todos"])
    assert {"patch", "delete"}.issubset(response.json()["paths"]["/todos/{todo_id}"])

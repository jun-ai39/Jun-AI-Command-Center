"""Tests for the equipment troubleshooting guide graph API."""

from collections.abc import Iterator
from copy import deepcopy
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from app.db.base import Base
from app.db.session import (
    create_database_engine,
    create_session_factory,
    get_db_session,
)
from app.main import app
from app.models.troubleshooting import (
    TroubleshootingBranch,
    TroubleshootingGuide,
    TroubleshootingStep,
)

pytestmark = pytest.mark.usefixtures("authenticated_business_api")


@pytest.fixture
def troubleshooting_client(
    tmp_path: Path,
) -> Iterator[tuple[TestClient, sessionmaker[Session]]]:
    """Provide an API client backed by an isolated SQLite database."""
    database_engine = create_database_engine(
        f"sqlite:///{(tmp_path / 'troubleshooting-api.sqlite3').as_posix()}"
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
            "name": "架空コンベアー",
            "equipment_number": "No.3",
            "model_number": "TEST-CV-300",
            "photo_path": None,
            "is_active": is_active,
        },
    )
    assert equipment_response.status_code == 201
    return str(equipment_response.json()["equipment_id"])


def guide_payload(equipment_id: str) -> dict[str, object]:
    """Return one valid, safe, fictional troubleshooting graph."""
    switch_step_id = str(uuid4())
    power_step_id = str(uuid4())
    complete_step_id = str(uuid4())
    handoff_step_id = str(uuid4())
    return {
        "equipment_id": equipment_id,
        "symptom": "コンベアーが動かない",
        "start_step_id": switch_step_id,
        "display_order": 10,
        "is_active": True,
        "steps": [
            {
                "step_id": switch_step_id,
                "step_type": "question",
                "prompt": "運転スイッチは入っていますか？",
                "check_method": "操作盤の外側から表示を確認する",
                "caution_note": "盤を開けない",
            },
            {
                "step_id": power_step_id,
                "step_type": "question",
                "prompt": "電源表示は点灯していますか？",
                "check_method": "表示灯だけを目視する",
                "caution_note": "測定や盤内確認は行わない",
            },
            {
                "step_id": complete_step_id,
                "step_type": "complete",
                "prompt": "安全を確認して運転担当者へ状態を共有してください。",
                "check_method": None,
                "caution_note": None,
            },
            {
                "step_id": handoff_step_id,
                "step_type": "handoff",
                "prompt": "ここから先は経験者へ引き継いでください。",
                "check_method": None,
                "caution_note": "会社の安全手順を優先する",
            },
        ],
        "branches": [
            {
                "from_step_id": switch_step_id,
                "answer": "yes",
                "to_step_id": power_step_id,
            },
            {
                "from_step_id": switch_step_id,
                "answer": "no",
                "to_step_id": complete_step_id,
            },
            {
                "from_step_id": switch_step_id,
                "answer": "unknown",
                "to_step_id": handoff_step_id,
            },
            {
                "from_step_id": power_step_id,
                "answer": "yes",
                "to_step_id": complete_step_id,
            },
            {
                "from_step_id": power_step_id,
                "answer": "no",
                "to_step_id": handoff_step_id,
            },
            {
                "from_step_id": power_step_id,
                "answer": "unknown",
                "to_step_id": handoff_step_id,
            },
        ],
    }


def test_create_and_get_complete_troubleshooting_graph(
    troubleshooting_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """One complete graph should persist atomically and reload by guide ID."""
    client, session_factory = troubleshooting_client
    equipment_id = create_equipment(client)
    payload = guide_payload(equipment_id)
    payload["symptom"] = "  コンベアーが動かない  "
    steps = payload["steps"]
    assert isinstance(steps, list)
    steps[0]["prompt"] = "  運転スイッチは入っていますか？  "
    steps[0]["check_method"] = "  操作盤の外側から表示を確認する  "

    response = client.post("/troubleshooting-guides", json=payload)

    assert response.status_code == 201
    created = response.json()
    assert created["equipment_id"] == equipment_id
    assert created["symptom"] == "コンベアーが動かない"
    assert created["start_step_id"] == payload["start_step_id"]
    assert created["steps"][0]["step_id"] == payload["start_step_id"]
    assert created["steps"][0]["prompt"] == "運転スイッチは入っていますか？"
    assert created["steps"][0]["check_method"] == "操作盤の外側から表示を確認する"
    assert len(created["steps"]) == 4
    assert len(created["branches"]) == 6

    detail_response = client.get(f"/troubleshooting-guides/{created['id']}")
    assert detail_response.status_code == 200
    assert detail_response.json() == created

    with session_factory() as session:
        assert (
            session.scalar(select(func.count()).select_from(TroubleshootingGuide)) == 1
        )
        assert (
            session.scalar(select(func.count()).select_from(TroubleshootingStep)) == 4
        )
        assert (
            session.scalar(select(func.count()).select_from(TroubleshootingBranch)) == 6
        )


def test_list_troubleshooting_guides_filters_equipment_and_active_state(
    troubleshooting_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """Guide summaries should support equipment and active filters."""
    client, _session_factory = troubleshooting_client
    selected_equipment_id = create_equipment(client)
    other_equipment_id = create_equipment(client)
    inactive_payload = guide_payload(selected_equipment_id)
    inactive_payload["symptom"] = "異音がする"
    inactive_payload["display_order"] = 20
    inactive_payload["is_active"] = False

    assert (
        client.post(
            "/troubleshooting-guides",
            json=guide_payload(selected_equipment_id),
        ).status_code
        == 201
    )
    assert (
        client.post("/troubleshooting-guides", json=inactive_payload).status_code == 201
    )
    assert (
        client.post(
            "/troubleshooting-guides",
            json=guide_payload(other_equipment_id),
        ).status_code
        == 201
    )

    response = client.get(
        "/troubleshooting-guides",
        params={"equipment_id": selected_equipment_id, "is_active": True},
    )

    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["symptom"] == "コンベアーが動かない"
    assert "steps" not in response.json()["items"][0]


def test_create_rejects_inactive_or_unknown_equipment(
    troubleshooting_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """Guides should attach only to a registered active physical asset."""
    client, _session_factory = troubleshooting_client
    inactive_equipment_id = create_equipment(client, is_active=False)

    inactive_response = client.post(
        "/troubleshooting-guides",
        json=guide_payload(inactive_equipment_id),
    )
    unknown_response = client.post(
        "/troubleshooting-guides",
        json=guide_payload(str(uuid4())),
    )

    assert inactive_response.status_code == 422
    assert unknown_response.status_code == 422
    assert inactive_response.json() == {"detail": "Selected equipment is not active."}


def invalid_graph_payloads(equipment_id: str) -> list[dict[str, object]]:
    """Build structurally unsafe graph variants rejected before storage."""
    missing_answer = guide_payload(equipment_id)
    missing_answer["branches"] = missing_answer["branches"][:-1]

    unknown_to_complete = guide_payload(equipment_id)
    complete_id = unknown_to_complete["steps"][2]["step_id"]
    unknown_to_complete["branches"][2]["to_step_id"] = complete_id

    terminal_branch = guide_payload(equipment_id)
    terminal_branch["branches"].append(
        {
            "from_step_id": terminal_branch["steps"][2]["step_id"],
            "answer": "yes",
            "to_step_id": terminal_branch["steps"][3]["step_id"],
        }
    )

    cross_guide = guide_payload(equipment_id)
    cross_guide["branches"][0]["to_step_id"] = str(uuid4())

    cyclic = guide_payload(equipment_id)
    cyclic["branches"][3]["to_step_id"] = cyclic["start_step_id"]

    unreachable = guide_payload(equipment_id)
    unreachable["steps"].append(
        {
            "step_id": str(uuid4()),
            "step_type": "handoff",
            "prompt": "到達できない引継ぎ",
            "check_method": None,
            "caution_note": None,
        }
    )
    return [
        missing_answer,
        unknown_to_complete,
        terminal_branch,
        cross_guide,
        cyclic,
        unreachable,
    ]


def test_create_rejects_incomplete_cyclic_or_cross_guide_graphs(
    troubleshooting_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """Invalid graph structures should never leave partial database rows."""
    client, session_factory = troubleshooting_client
    equipment_id = create_equipment(client)

    for payload in invalid_graph_payloads(equipment_id):
        response = client.post("/troubleshooting-guides", json=payload)
        assert response.status_code == 422

    with session_factory() as session:
        assert (
            session.scalar(select(func.count()).select_from(TroubleshootingGuide)) == 0
        )
        assert (
            session.scalar(select(func.count()).select_from(TroubleshootingStep)) == 0
        )
        assert (
            session.scalar(select(func.count()).select_from(TroubleshootingBranch)) == 0
        )


def test_create_rolls_back_whole_graph_when_a_storage_conflict_occurs(
    troubleshooting_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """A step ID collision should not leave a second partial guide behind."""
    client, session_factory = troubleshooting_client
    equipment_id = create_equipment(client)
    payload = guide_payload(equipment_id)

    assert client.post("/troubleshooting-guides", json=payload).status_code == 201
    conflicting_payload = deepcopy(payload)
    conflicting_payload["symptom"] = "別の架空症状"
    conflict_response = client.post(
        "/troubleshooting-guides",
        json=conflicting_payload,
    )

    assert conflict_response.status_code == 409
    with session_factory() as session:
        assert (
            session.scalar(select(func.count()).select_from(TroubleshootingGuide)) == 1
        )
        persisted = session.scalar(select(TroubleshootingGuide))
        assert persisted is not None
        assert persisted.symptom == "コンベアーが動かない"


def test_get_unknown_troubleshooting_guide_returns_not_found(
    troubleshooting_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """Unknown immutable guide IDs should have a stable not-found response."""
    client, _session_factory = troubleshooting_client

    response = client.get(f"/troubleshooting-guides/{uuid4()}")

    assert response.status_code == 404
    assert response.json() == {"detail": "Troubleshooting guide not found."}

"""Tests for the dashboard foundation endpoint."""

from collections.abc import Iterator
from datetime import datetime
from typing import Final
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import get_current_time
from app.main import app

pytestmark = pytest.mark.usefixtures("authenticated_business_api")

client = TestClient(app)
FIXED_CURRENT_TIME: Final[datetime] = datetime(
    2026,
    7,
    20,
    8,
    30,
    tzinfo=ZoneInfo("Asia/Tokyo"),
)


def get_fixed_current_time() -> datetime:
    """Return a stable timestamp for deterministic endpoint tests."""
    return FIXED_CURRENT_TIME


@pytest.fixture(autouse=True)
def override_current_time() -> Iterator[None]:
    """Replace the clock only while each dashboard test is running."""
    app.dependency_overrides[get_current_time] = get_fixed_current_time
    yield
    app.dependency_overrides.pop(get_current_time, None)


def test_dashboard_returns_foundation_snapshot() -> None:
    """The endpoint should expose the date and honest module readiness."""
    response = client.get("/dashboard")

    assert response.status_code == 200
    assert response.json() == {
        "generated_at": "2026-07-20T08:30:00+09:00",
        "today": "2026-07-20",
        "timezone": "Asia/Tokyo",
        "modules": [
            {"key": "weather", "state": "not_configured"},
            {"key": "news", "state": "not_configured"},
            {"key": "ai_summary", "state": "not_configured"},
            {"key": "todo", "state": "not_configured"},
            {"key": "calendar", "state": "not_configured"},
        ],
    }


def test_dashboard_is_in_openapi_schema() -> None:
    """The dashboard endpoint should remain visible in the API contract."""
    response = client.get("/openapi.json")

    assert response.status_code == 200
    assert "/dashboard" in response.json()["paths"]


def test_unknown_dashboard_route_returns_not_found() -> None:
    """Unexpected dashboard subpaths must not be accepted silently."""
    response = client.get("/dashboard/unknown")

    assert response.status_code == 404

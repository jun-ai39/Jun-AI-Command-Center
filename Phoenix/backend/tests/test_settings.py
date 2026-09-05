"""Tests for the authenticated-safe settings endpoint."""

import pytest
from fastapi.testclient import TestClient

from app.main import app

pytestmark = pytest.mark.usefixtures("authenticated_business_api")

client = TestClient(app)


def test_settings_returns_authenticated_safe_defaults() -> None:
    """The endpoint should return defaults and honest connection states."""
    response = client.get("/settings")

    assert response.status_code == 200
    assert response.json() == {
        "preferences": {
            "theme": "dark",
            "language": "ja",
            "timezone": "Asia/Tokyo",
        },
        "integrations": [
            {"provider": "openai", "state": "not_configured"},
            {"provider": "github", "state": "not_configured"},
            {"provider": "google", "state": "not_configured"},
        ],
        "api_management": {
            "secret_storage": "server_side_only",
            "secret_values_exposed": False,
        },
    }


def test_settings_integration_entries_never_include_credentials() -> None:
    """Public integration entries must expose status fields only."""
    response = client.get("/settings")

    assert response.status_code == 200
    integrations = response.json()["integrations"]
    assert all(
        set(integration) == {"provider", "state"} for integration in integrations
    )


def test_settings_is_in_openapi_schema() -> None:
    """The settings endpoint should remain visible in the API contract."""
    response = client.get("/openapi.json")

    assert response.status_code == 200
    assert "/settings" in response.json()["paths"]


def test_unknown_settings_route_returns_not_found() -> None:
    """Unexpected settings subpaths must not be accepted silently."""
    response = client.get("/settings/unknown")

    assert response.status_code == 404

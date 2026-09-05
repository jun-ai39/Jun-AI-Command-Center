"""Tests for the public version endpoint."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_version_returns_public_release_metadata() -> None:
    """The endpoint should return a stable, non-sensitive response."""
    response = client.get("/version")

    assert response.status_code == 200
    assert response.json() == {
        "name": "Phoenix OS API",
        "version": "0.1.0",
        "api_version": "v1",
    }


def test_version_is_in_openapi_schema() -> None:
    """The version endpoint should remain visible in the API contract."""
    response = client.get("/openapi.json")

    assert response.status_code == 200
    assert "/version" in response.json()["paths"]


def test_unknown_version_route_returns_not_found() -> None:
    """Unexpected version subpaths must not be accepted silently."""
    response = client.get("/version/unknown")

    assert response.status_code == 404

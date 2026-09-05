"""Tests for the public health endpoint."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_returns_service_status() -> None:
    """The endpoint should return a stable, non-sensitive response."""
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "phoenix-api",
        "version": "0.1.0",
    }


def test_health_is_in_openapi_schema() -> None:
    """The health endpoint should remain visible in the API contract."""
    response = client.get("/openapi.json")

    assert response.status_code == 200
    assert "/health" in response.json()["paths"]


def test_health_allows_local_frontend_origin() -> None:
    """The development frontend should pass the CORS preflight check."""
    origin = "http://127.0.0.1:5173"
    response = client.options(
        "/health",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin
    assert set(response.headers["access-control-allow-methods"].split(", ")) == {
        "DELETE",
        "GET",
        "PATCH",
        "POST",
    }


def test_health_does_not_allow_unknown_origin() -> None:
    """Unknown websites must not receive a CORS allow-origin header."""
    response = client.get(
        "/health",
        headers={"Origin": "https://example.com"},
    )

    assert response.status_code == 200
    assert "access-control-allow-origin" not in response.headers

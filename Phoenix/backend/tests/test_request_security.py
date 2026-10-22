"""Exercise browser rejection and login throttling without a real database."""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.request_security import RequestSecurityMiddleware


def client_for_security() -> TestClient:
    application = FastAPI()
    application.add_middleware(RequestSecurityMiddleware)

    @application.post("/auth/login")
    @application.post("/backups")
    def mutate() -> dict[str, bool]:
        return {"executed": True}

    return TestClient(application)


def test_untrusted_browser_cannot_mutate() -> None:
    with client_for_security() as client:
        for origin in ("https://attacker.example", "null", "http://localhost:9999"):
            for path in ("/auth/login", "/backups"):
                assert client.post(path, headers={"Origin": origin}).status_code == 403
        assert (
            client.post(
                "/backups", headers={"Sec-Fetch-Site": "cross-site"}
            ).status_code
            == 403
        )


def test_local_frontend_and_non_browser_clients_work() -> None:
    with client_for_security() as client:
        for origin in ("http://localhost:5173", "http://127.0.0.1:5173"):
            assert (
                client.post("/backups", headers={"Origin": origin}).status_code == 200
            )
        assert client.post("/backups").status_code == 200


def test_login_limit_cannot_be_bypassed_with_forwarded_ip(monkeypatch) -> None:
    now = [100.0]
    monkeypatch.setattr("app.core.request_security.monotonic", lambda: now[0])
    with client_for_security() as client:
        for index in range(30):
            assert (
                client.post(
                    "/auth/login", headers={"X-Forwarded-For": f"192.0.2.{index}"}
                ).status_code
                == 200
            )
        for path in ("/auth/login", "/auth/login/"):
            response = client.post(path)
            assert response.status_code == 429
            assert response.headers["Retry-After"] == "60"
        assert client.post("/backups").status_code == 200
        now[0] += 60
        assert client.post("/auth/login").status_code == 200

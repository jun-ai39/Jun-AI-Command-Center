"""Tests for local Phoenix users, sessions, and authentication endpoints."""

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from app.api.dependencies import require_admin_user
from app.commands import create_admin as create_admin_command
from app.core.config import AUTH_SESSION_COOKIE_NAME
from app.core.security import hash_password, verify_password
from app.db.base import Base
from app.db.session import (
    create_database_engine,
    create_session_factory,
    get_db_session,
)
from app.main import app
from app.models.auth import UserAccount, UserSession
from app.services.auth import InitialAdminError, create_initial_admin

ADMIN_PASSWORD = "Phoenix-local-2026"
TEST_EQUIPMENT_ID = "30000000-0000-4000-8000-000000000001"
TEST_RESOURCE_ID = "40000000-0000-4000-8000-000000000001"
PROTECTED_BUSINESS_ENDPOINTS = (
    "/dashboard",
    "/settings",
    "/todos",
    "/work-reports",
    f"/equipment-change-histories?equipment_id={TEST_EQUIPMENT_ID}",
    "/departments",
    "/inspection-template-items",
    f"/inspection-records?equipment_id={TEST_EQUIPMENT_ID}",
    "/troubleshooting-guides",
)
PROTECTED_BUSINESS_REQUESTS = (
    ("GET", "/dashboard"),
    ("GET", "/settings"),
    ("GET", "/backups"),
    ("POST", "/backups"),
    (
        "POST",
        "/backups/phoenix-backup-20260829T010203456789Z-a1b2c3d4.sqlite3/restore",
    ),
    ("GET", "/todos"),
    ("GET", "/todos/due-summary?target_date=2026-08-29"),
    ("POST", "/todos"),
    ("PATCH", f"/todos/{TEST_RESOURCE_ID}"),
    ("DELETE", f"/todos/{TEST_RESOURCE_ID}"),
    ("GET", "/work-reports"),
    ("GET", "/work-reports/attention-summary"),
    ("POST", "/work-reports"),
    ("PATCH", f"/work-reports/{TEST_RESOURCE_ID}"),
    (
        "GET",
        f"/equipment-change-histories?equipment_id={TEST_EQUIPMENT_ID}",
    ),
    ("POST", "/equipment-change-histories"),
    ("GET", "/departments"),
    ("POST", "/departments"),
    ("GET", "/manufacturers"),
    ("POST", "/manufacturers"),
    ("GET", "/equipment"),
    ("GET", f"/equipment/{TEST_EQUIPMENT_ID}"),
    ("POST", "/equipment"),
    ("GET", "/inspection-template-items"),
    ("POST", "/inspection-template-items"),
    ("PATCH", f"/inspection-template-items/{TEST_RESOURCE_ID}/guide"),
    ("GET", f"/inspection-records?equipment_id={TEST_EQUIPMENT_ID}"),
    ("GET", "/inspection-status?target_date=2026-08-29"),
    ("GET", f"/inspection-records/{TEST_RESOURCE_ID}"),
    ("POST", "/inspection-records"),
    ("GET", "/troubleshooting-guides"),
    ("GET", f"/troubleshooting-guides/{TEST_RESOURCE_ID}"),
    ("POST", "/troubleshooting-guides"),
)


@pytest.fixture
def auth_client(
    tmp_path: Path,
) -> Iterator[tuple[TestClient, sessionmaker[Session]]]:
    """Provide a local API client with one fictional initial administrator."""
    database_engine = create_database_engine(
        f"sqlite:///{(tmp_path / 'auth-api.sqlite3').as_posix()}"
    )
    session_factory = create_session_factory(database_engine)
    Base.metadata.create_all(database_engine)
    with session_factory() as session:
        create_initial_admin(
            session,
            username="Jun.Admin",
            password=ADMIN_PASSWORD,
        )

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


def test_initial_admin_is_normalized_and_password_is_hashed(tmp_path: Path) -> None:
    """Provisioning should store an administrator without storing its password."""
    database_engine = create_database_engine(
        f"sqlite:///{(tmp_path / 'initial-admin.sqlite3').as_posix()}"
    )
    session_factory = create_session_factory(database_engine)
    Base.metadata.create_all(database_engine)
    try:
        with session_factory() as session:
            user = create_initial_admin(
                session,
                username="  JUN.Admin  ",
                password=ADMIN_PASSWORD,
            )
            assert user.username == "jun.admin"
            assert user.role == "admin"
            assert user.password_hash != ADMIN_PASSWORD
            assert user.password_hash.startswith("$argon2")
            assert verify_password(ADMIN_PASSWORD, user.password_hash)
    finally:
        database_engine.dispose()


@pytest.mark.parametrize(
    ("username", "password"),
    [
        ("x", ADMIN_PASSWORD),
        ("jun admin", ADMIN_PASSWORD),
        ("jun", "short1"),
        ("jun", "letters-only-password"),
        ("jun", "123456789012"),
    ],
)
def test_initial_admin_rejects_invalid_credentials(
    tmp_path: Path,
    username: str,
    password: str,
) -> None:
    """Weak setup input must not leave a partial local user behind."""
    database_engine = create_database_engine(
        f"sqlite:///{(tmp_path / 'invalid-admin.sqlite3').as_posix()}"
    )
    session_factory = create_session_factory(database_engine)
    Base.metadata.create_all(database_engine)
    try:
        with session_factory() as session:
            with pytest.raises(InitialAdminError):
                create_initial_admin(
                    session,
                    username=username,
                    password=password,
                )
            assert session.scalar(select(func.count()).select_from(UserAccount)) == 0
    finally:
        database_engine.dispose()


def test_initial_admin_can_only_be_created_once(tmp_path: Path) -> None:
    """The bootstrap command must not silently create another administrator."""
    database_engine = create_database_engine(
        f"sqlite:///{(tmp_path / 'one-admin.sqlite3').as_posix()}"
    )
    session_factory = create_session_factory(database_engine)
    Base.metadata.create_all(database_engine)
    try:
        with session_factory() as session:
            create_initial_admin(
                session,
                username="jun",
                password=ADMIN_PASSWORD,
            )
            with pytest.raises(
                InitialAdminError,
                match="initial administrator already exists",
            ):
                create_initial_admin(
                    session,
                    username="second.admin",
                    password="Phoenix-second-2026",
                )
            assert session.scalar(select(func.count()).select_from(UserAccount)) == 1
    finally:
        database_engine.dispose()


def test_create_admin_command_prompts_twice_without_password_argument(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """The bootstrap command should keep the password out of shell history."""
    database_engine = create_database_engine(
        f"sqlite:///{(tmp_path / 'admin-command.sqlite3').as_posix()}"
    )
    session_factory = create_session_factory(database_engine)
    Base.metadata.create_all(database_engine)
    password_inputs = iter((ADMIN_PASSWORD, ADMIN_PASSWORD))
    monkeypatch.setattr(
        create_admin_command,
        "DATABASE_SESSION_FACTORY",
        session_factory,
    )
    monkeypatch.setattr(
        create_admin_command,
        "getpass",
        lambda _prompt: next(password_inputs),
    )
    monkeypatch.setattr("sys.argv", ["create_admin", "--username", "Jun.Admin"])
    try:
        assert create_admin_command.main() == 0
        assert "Initial administrator created: jun.admin" in capsys.readouterr().out
        with session_factory() as session:
            assert session.scalar(select(func.count()).select_from(UserAccount)) == 1
    finally:
        database_engine.dispose()


def test_login_sets_revocable_httponly_cookie_and_me_returns_safe_user(
    auth_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """Successful login should expose no password or raw token in API or storage."""
    client, session_factory = auth_client

    response = client.post(
        "/auth/login",
        json={"username": " JUN.ADMIN ", "password": ADMIN_PASSWORD},
    )

    assert response.status_code == 200
    assert response.json()["username"] == "jun.admin"
    assert response.json()["role"] == "admin"
    assert "password" not in response.text.lower()
    set_cookie = response.headers["set-cookie"].lower()
    assert "httponly" in set_cookie
    assert "samesite=strict" in set_cookie
    raw_token = client.cookies.get(AUTH_SESSION_COOKIE_NAME)
    assert raw_token is not None

    with session_factory() as session:
        persisted = session.scalar(select(UserSession))
        assert persisted is not None
        assert persisted.token_hash != raw_token
        assert len(persisted.token_hash) == 64

    current_user = client.get("/auth/me")
    assert current_user.status_code == 200
    assert current_user.json()["username"] == "jun.admin"
    assert "password" not in current_user.text.lower()


@pytest.mark.parametrize(("method", "path"), PROTECTED_BUSINESS_REQUESTS)
def test_every_business_api_operation_rejects_missing_session(
    auth_client: tuple[TestClient, sessionmaker[Session]],
    method: str,
    path: str,
) -> None:
    """Every business API operation should reject a request without a session."""
    client, _session_factory = auth_client

    response = client.request(
        method,
        path,
        json={} if method in {"POST", "PATCH"} else None,
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Authentication required."}


def test_authenticated_session_unlocks_every_business_api_group(
    auth_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """One real login cookie should unlock all protected business API groups."""
    client, _session_factory = auth_client
    login_response = client.post(
        "/auth/login",
        json={"username": "jun.admin", "password": ADMIN_PASSWORD},
    )
    assert login_response.status_code == 200

    for path in PROTECTED_BUSINESS_ENDPOINTS:
        response = client.get(path)
        assert response.status_code == 200, path


def test_normal_user_session_can_access_business_api(
    auth_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """STEP130 should require login without introducing role restrictions."""
    client, session_factory = auth_client
    user_password = "Phoenix-user-2026"
    with session_factory() as session:
        session.add(
            UserAccount(
                username="operator",
                password_hash=hash_password(user_password),
                role="user",
            )
        )
        session.commit()

    login_response = client.post(
        "/auth/login",
        json={"username": "operator", "password": user_password},
    )

    assert login_response.status_code == 200
    assert login_response.json()["role"] == "user"
    assert client.get("/todos").status_code == 200


def test_normal_user_cannot_change_administrator_configuration(
    auth_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """Master and guide mutations must enforce the prepared two-role boundary."""
    client, session_factory = auth_client
    user_password = "Phoenix-user-2026"
    with session_factory() as session:
        session.add(
            UserAccount(
                username="operator",
                password_hash=hash_password(user_password),
                role="user",
            )
        )
        session.commit()
    assert (
        client.post(
            "/auth/login",
            json={"username": "operator", "password": user_password},
        ).status_code
        == 200
    )

    admin_mutations = (
        ("POST", "/departments"),
        ("POST", "/manufacturers"),
        ("POST", "/equipment"),
        ("POST", "/inspection-template-items"),
        ("PATCH", f"/inspection-template-items/{TEST_RESOURCE_ID}/guide"),
        ("POST", "/troubleshooting-guides"),
        ("GET", "/backups"),
        ("POST", "/backups"),
    )
    for method, path in admin_mutations:
        response = client.request(
            method,
            path,
            json={} if method in {"POST", "PATCH"} else None,
        )
        assert response.status_code == 403, (method, path, response.text)
        assert response.json() == {"detail": "Administrator permission required."}

    assert client.get("/departments").status_code == 200
    assert client.get("/inspection-template-items").status_code == 200
    assert client.get("/troubleshooting-guides").status_code == 200


@pytest.mark.parametrize("path", ("/health", "/version"))
def test_non_sensitive_system_endpoints_remain_public(
    auth_client: tuple[TestClient, sessionmaker[Session]],
    path: str,
) -> None:
    """Local startup checks must remain available before login."""
    client, _session_factory = auth_client

    assert client.get(path).status_code == 200


@pytest.mark.parametrize(
    ("username", "password"),
    [
        ("missing.user", ADMIN_PASSWORD),
        ("jun.admin", "Incorrect-password-2026"),
    ],
)
def test_login_uses_one_error_for_unknown_user_and_wrong_password(
    auth_client: tuple[TestClient, sessionmaker[Session]],
    username: str,
    password: str,
) -> None:
    """A failed login should not reveal whether a username exists."""
    client, session_factory = auth_client

    response = client.post(
        "/auth/login",
        json={"username": username, "password": password},
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Incorrect username or password."}
    with session_factory() as session:
        assert session.scalar(select(func.count()).select_from(UserSession)) == 0


def test_inactive_user_cannot_login(
    auth_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """Disabling a local account should block new sessions immediately."""
    client, session_factory = auth_client
    with session_factory() as session:
        user = session.scalar(select(UserAccount))
        assert user is not None
        user.is_active = False
        session.commit()

    response = client.post(
        "/auth/login",
        json={"username": "jun.admin", "password": ADMIN_PASSWORD},
    )

    assert response.status_code == 401


def test_missing_and_expired_sessions_are_rejected(
    auth_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """The current-user endpoint should require a non-expired database session."""
    client, session_factory = auth_client
    assert client.get("/auth/me").status_code == 401
    assert (
        client.post(
            "/auth/login",
            json={"username": "jun.admin", "password": ADMIN_PASSWORD},
        ).status_code
        == 200
    )
    with session_factory() as session:
        auth_session = session.scalar(select(UserSession))
        assert auth_session is not None
        auth_session.expires_at = datetime.now(tz=UTC) - timedelta(seconds=1)
        session.commit()

    response = client.get("/auth/me")

    assert response.status_code == 401
    assert response.json() == {"detail": "Authentication required."}
    assert client.get("/todos").status_code == 401


def test_logout_revokes_database_session_and_cookie(
    auth_client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    """Logout should make a copied browser session unusable immediately."""
    client, session_factory = auth_client
    client.post(
        "/auth/login",
        json={"username": "jun.admin", "password": ADMIN_PASSWORD},
    )
    raw_token = client.cookies.get(AUTH_SESSION_COOKIE_NAME)
    assert raw_token is not None

    response = client.post("/auth/logout")

    assert response.status_code == 204
    assert AUTH_SESSION_COOKIE_NAME not in client.cookies
    with session_factory() as session:
        assert session.scalar(select(func.count()).select_from(UserSession)) == 0
    client.cookies.set(AUTH_SESSION_COOKIE_NAME, raw_token)
    assert client.get("/auth/me").status_code == 401


def test_admin_dependency_distinguishes_role() -> None:
    """The prepared role guard should return 403 for a signed-in normal user."""
    admin = UserAccount(
        username="admin",
        password_hash=hash_password(ADMIN_PASSWORD),
        role="admin",
    )
    normal_user = UserAccount(
        username="operator",
        password_hash=hash_password("Phoenix-user-2026"),
        role="user",
    )

    assert require_admin_user(admin) is admin
    with pytest.raises(HTTPException) as error:
        require_admin_user(normal_user)
    assert error.value.status_code == 403
    assert error.value.detail == "Administrator permission required."

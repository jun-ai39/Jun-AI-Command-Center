"""Shared test-only authentication boundaries."""

from collections.abc import Iterator
from datetime import UTC, datetime
from uuid import UUID

import pytest

from app.api.dependencies import get_current_user
from app.main import app
from app.models.auth import UserAccount


def get_authenticated_test_user() -> UserAccount:
    """Return a fictional signed-in administrator for focused business tests."""
    return UserAccount(
        id=UUID("a1000000-0000-4000-8000-000000000001"),
        username="test.admin",
        password_hash="not-used-by-dependency-override",
        role="admin",
        is_active=True,
        created_at=datetime(2026, 8, 29, tzinfo=UTC),
        updated_at=datetime(2026, 8, 29, tzinfo=UTC),
    )


@pytest.fixture
def authenticated_business_api() -> Iterator[None]:
    """Keep business tests focused while the auth suite uses real sessions."""
    app.dependency_overrides[get_current_user] = get_authenticated_test_user
    try:
        yield
    finally:
        app.dependency_overrides.pop(get_current_user, None)

"""Authenticated settings overview endpoint."""

from fastapi import APIRouter

from app.core.config import DASHBOARD_TIMEZONE
from app.schemas.settings import (
    ApiManagementPolicy,
    DisplayPreferences,
    IntegrationConnection,
    IntegrationProvider,
    IntegrationState,
    LanguageCode,
    SecretStoragePolicy,
    SettingsResponse,
    ThemeMode,
)

router = APIRouter(tags=["settings"])


@router.get(
    "/settings",
    response_model=SettingsResponse,
    summary="公開可能な設定情報を取得する",
)
async def get_settings() -> SettingsResponse:
    """Return preferences and integration states without secret values."""
    return SettingsResponse(
        preferences=DisplayPreferences(
            theme=ThemeMode.DARK,
            language=LanguageCode.JAPANESE,
            timezone=DASHBOARD_TIMEZONE,
        ),
        integrations=[
            IntegrationConnection(
                provider=provider,
                state=IntegrationState.NOT_CONFIGURED,
            )
            for provider in IntegrationProvider
        ],
        api_management=ApiManagementPolicy(
            secret_storage=SecretStoragePolicy.SERVER_SIDE_ONLY,
            secret_values_exposed=False,
        ),
    )

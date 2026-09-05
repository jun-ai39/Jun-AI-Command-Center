"""Settings endpoint response schemas."""

from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict


class ThemeMode(StrEnum):
    """Supported interface themes."""

    DARK = "dark"
    LIGHT = "light"
    SYSTEM = "system"


class LanguageCode(StrEnum):
    """Supported interface languages."""

    JAPANESE = "ja"


class IntegrationProvider(StrEnum):
    """External services planned for Phoenix settings."""

    OPENAI = "openai"
    GITHUB = "github"
    GOOGLE = "google"


class IntegrationState(StrEnum):
    """Public connection state for an external service."""

    NOT_CONFIGURED = "not_configured"


class SecretStoragePolicy(StrEnum):
    """Allowed location for future API credentials."""

    SERVER_SIDE_ONLY = "server_side_only"


class DisplayPreferences(BaseModel):
    """Non-sensitive defaults used by the interface."""

    model_config = ConfigDict(extra="forbid")

    theme: ThemeMode
    language: LanguageCode
    timezone: str


class IntegrationConnection(BaseModel):
    """Safe public status for one external integration."""

    model_config = ConfigDict(extra="forbid")

    provider: IntegrationProvider
    state: IntegrationState


class ApiManagementPolicy(BaseModel):
    """Public security policy without any credential values."""

    model_config = ConfigDict(extra="forbid")

    secret_storage: SecretStoragePolicy
    secret_values_exposed: Literal[False]


class SettingsResponse(BaseModel):
    """Public-safe Phoenix settings overview."""

    model_config = ConfigDict(extra="forbid")

    preferences: DisplayPreferences
    integrations: list[IntegrationConnection]
    api_management: ApiManagementPolicy

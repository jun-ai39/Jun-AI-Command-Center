"""Dashboard endpoint response schemas."""

from datetime import date, datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict


class DashboardModuleKey(StrEnum):
    """Modules planned for the Version 1 dashboard."""

    WEATHER = "weather"
    NEWS = "news"
    AI_SUMMARY = "ai_summary"
    TODO = "todo"
    CALENDAR = "calendar"


class DashboardModuleState(StrEnum):
    """Current availability of a dashboard module."""

    NOT_CONFIGURED = "not_configured"


class DashboardModule(BaseModel):
    """Machine-readable readiness for one dashboard module."""

    model_config = ConfigDict(extra="forbid")

    key: DashboardModuleKey
    state: DashboardModuleState


class DashboardResponse(BaseModel):
    """Public dashboard foundation data."""

    model_config = ConfigDict(extra="forbid")

    generated_at: datetime
    today: date
    timezone: str
    modules: list[DashboardModule]

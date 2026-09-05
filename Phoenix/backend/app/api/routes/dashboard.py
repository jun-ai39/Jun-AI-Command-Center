"""Dashboard overview endpoint."""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.dependencies import get_current_time
from app.core.config import DASHBOARD_TIMEZONE
from app.schemas.dashboard import (
    DashboardModule,
    DashboardModuleKey,
    DashboardModuleState,
    DashboardResponse,
)

router = APIRouter(tags=["dashboard"])


@router.get(
    "/dashboard",
    response_model=DashboardResponse,
    summary="ダッシュボードの基礎情報を取得する",
)
async def get_dashboard(
    current_time: Annotated[datetime, Depends(get_current_time)],
) -> DashboardResponse:
    """Return today's date and honest readiness for planned modules."""
    return DashboardResponse(
        generated_at=current_time,
        today=current_time.date(),
        timezone=DASHBOARD_TIMEZONE,
        modules=[
            DashboardModule(
                key=module_key,
                state=DashboardModuleState.NOT_CONFIGURED,
            )
            for module_key in DashboardModuleKey
        ],
    )

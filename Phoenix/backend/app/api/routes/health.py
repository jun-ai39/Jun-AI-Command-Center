"""System health endpoint."""

from fastapi import APIRouter

from app.core.config import APP_VERSION
from app.schemas.health import HealthResponse

router = APIRouter(tags=["system"])


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="APIの稼働状態を確認する",
)
async def get_health() -> HealthResponse:
    """Return the public, non-sensitive API health status."""
    return HealthResponse(
        status="ok",
        service="phoenix-api",
        version=APP_VERSION,
    )

"""Public application version endpoint."""

from fastapi import APIRouter

from app.core.config import API_VERSION, APP_NAME, APP_VERSION
from app.schemas.version import VersionResponse

router = APIRouter(tags=["system"])


@router.get(
    "/version",
    response_model=VersionResponse,
    summary="APIのバージョン情報を確認する",
)
async def get_version() -> VersionResponse:
    """Return public release metadata without runtime or secret details."""
    return VersionResponse(
        name=APP_NAME,
        version=APP_VERSION,
        api_version=API_VERSION,
    )

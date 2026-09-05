"""Version endpoint response schema."""

from pydantic import BaseModel, ConfigDict


class VersionResponse(BaseModel):
    """Public application and API contract version information."""

    model_config = ConfigDict(extra="forbid")

    name: str
    version: str
    api_version: str

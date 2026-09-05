"""Health endpoint response schema."""

from typing import Literal

from pydantic import BaseModel, ConfigDict


class HealthResponse(BaseModel):
    """Public health information returned by the API."""

    model_config = ConfigDict(extra="forbid")

    status: Literal["ok"]
    service: Literal["phoenix-api"]
    version: str

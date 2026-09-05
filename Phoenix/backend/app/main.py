"""FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import APP_NAME, APP_VERSION, CORS_ALLOWED_ORIGINS


def create_app() -> FastAPI:
    """Create and configure the Phoenix OS API application."""
    application = FastAPI(
        title=APP_NAME,
        version=APP_VERSION,
        description="Jun AI Command Centerを支えるPhoenix OS API",
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Accept", "Content-Type"],
    )
    application.include_router(api_router)
    return application


app = create_app()

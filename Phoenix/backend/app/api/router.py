"""Top-level public and authenticated API routers."""

from fastapi import APIRouter, Depends

from app.api.dependencies import get_current_user
from app.api.routes.auth import router as auth_router
from app.api.routes.backups import router as backups_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.equipment_change_histories import (
    router as equipment_change_histories_router,
)
from app.api.routes.equipment_master import router as equipment_master_router
from app.api.routes.health import router as health_router
from app.api.routes.inspection_records import router as inspection_records_router
from app.api.routes.inspection_templates import router as inspection_templates_router
from app.api.routes.settings import router as settings_router
from app.api.routes.todos import router as todos_router
from app.api.routes.troubleshooting import router as troubleshooting_router
from app.api.routes.version import router as version_router
from app.api.routes.work_reports import router as work_reports_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(health_router)
api_router.include_router(version_router)

business_api_router = APIRouter(dependencies=[Depends(get_current_user)])
business_api_router.include_router(backups_router)
business_api_router.include_router(dashboard_router)
business_api_router.include_router(settings_router)
business_api_router.include_router(todos_router)
business_api_router.include_router(work_reports_router)
business_api_router.include_router(equipment_change_histories_router)
business_api_router.include_router(equipment_master_router)
business_api_router.include_router(inspection_templates_router)
business_api_router.include_router(inspection_records_router)
business_api_router.include_router(troubleshooting_router)
api_router.include_router(business_api_router)

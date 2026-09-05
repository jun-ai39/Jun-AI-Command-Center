"""SQLAlchemy models registered with the Phoenix metadata."""

from app.models.auth import UserAccount, UserSession
from app.models.equipment_change_history import EquipmentChangeHistory
from app.models.equipment_master import Department, Equipment, Manufacturer
from app.models.inspection_record import InspectionRecord, InspectionRecordItem
from app.models.inspection_template import InspectionTemplateItem
from app.models.todo import Todo
from app.models.troubleshooting import (
    TroubleshootingBranch,
    TroubleshootingGuide,
    TroubleshootingStep,
)
from app.models.work_report import WorkReport

__all__ = [
    "Department",
    "Equipment",
    "EquipmentChangeHistory",
    "InspectionRecord",
    "InspectionRecordItem",
    "InspectionTemplateItem",
    "Manufacturer",
    "Todo",
    "TroubleshootingBranch",
    "TroubleshootingGuide",
    "TroubleshootingStep",
    "UserAccount",
    "UserSession",
    "WorkReport",
]

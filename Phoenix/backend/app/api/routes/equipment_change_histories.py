"""Equipment improvement and specification change history endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.session import get_db_session
from app.models.equipment_change_history import EquipmentChangeHistory
from app.models.equipment_master import Equipment
from app.models.work_report import WorkReport
from app.schemas.equipment_change_history import (
    EquipmentChangeHistoryCreate,
    EquipmentChangeHistoryListResponse,
    EquipmentChangeHistoryResponse,
)

router = APIRouter(tags=["equipment-change-histories"])
DatabaseSession = Annotated[Session, Depends(get_db_session)]
EquipmentFilter = Annotated[UUID, Query()]
PageLimit = Annotated[int, Query(ge=1, le=50)]
PageOffset = Annotated[int, Query(ge=0)]


def validate_change_references(
    database_session: Session,
    payload: EquipmentChangeHistoryCreate,
) -> tuple[Equipment, WorkReport | None]:
    """Validate the active equipment and optional same-equipment work report."""
    equipment = database_session.get(Equipment, payload.equipment_id)
    if equipment is None or not equipment.is_active:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Selected equipment is not active.",
        )

    if payload.work_report_id is None:
        return equipment, None
    work_report = database_session.get(WorkReport, payload.work_report_id)
    if work_report is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Selected work report was not found.",
        )
    if work_report.equipment_id != equipment.equipment_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Selected work report does not belong to the equipment.",
        )
    return equipment, work_report


@router.get(
    "/equipment-change-histories",
    response_model=EquipmentChangeHistoryListResponse,
    summary="設備別の改良・変更履歴を取得する",
)
def list_equipment_change_histories(
    equipment_id: EquipmentFilter,
    database_session: DatabaseSession,
    limit: PageLimit = 5,
    offset: PageOffset = 0,
) -> EquipmentChangeHistoryListResponse:
    """Return newest-first change histories for one immutable equipment ID."""
    condition = EquipmentChangeHistory.equipment_id == equipment_id
    total = (
        database_session.scalar(
            select(func.count()).select_from(EquipmentChangeHistory).where(condition)
        )
        or 0
    )
    histories = database_session.scalars(
        select(EquipmentChangeHistory)
        .where(condition)
        .order_by(
            EquipmentChangeHistory.changed_on.desc(),
            EquipmentChangeHistory.created_at.desc(),
            EquipmentChangeHistory.change_history_id.desc(),
        )
        .offset(offset)
        .limit(limit)
    ).all()
    return EquipmentChangeHistoryListResponse(
        items=[
            EquipmentChangeHistoryResponse.model_validate(history)
            for history in histories
        ],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post(
    "/equipment-change-histories",
    response_model=EquipmentChangeHistoryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="設備の改良・変更履歴を保存する",
)
def create_equipment_change_history(
    payload: EquipmentChangeHistoryCreate,
    database_session: DatabaseSession,
) -> EquipmentChangeHistoryResponse:
    """Validate and persist one equipment change without altering its work report."""
    equipment, work_report = validate_change_references(database_session, payload)
    history = EquipmentChangeHistory(
        equipment=equipment,
        changed_on=payload.changed_on,
        improvement_point=payload.improvement_point,
        change_details=payload.change_details,
        work_report=work_report,
    )
    database_session.add(history)
    try:
        database_session.commit()
    except IntegrityError as error:
        database_session.rollback()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Equipment change history violates a storage constraint.",
        ) from error

    database_session.refresh(history)
    return EquipmentChangeHistoryResponse.model_validate(history)

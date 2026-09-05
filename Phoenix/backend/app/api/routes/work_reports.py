"""Work report creation and history endpoints."""

from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.db.session import get_db_session
from app.models.equipment_master import Department, Equipment
from app.models.work_report import WorkReport
from app.schemas.work_report import (
    WorkReportAttentionSummaryResponse,
    WorkReportCreate,
    WorkReportListResponse,
    WorkReportProgress,
    WorkReportResponse,
    WorkReportUpdate,
)

router = APIRouter(tags=["work-reports"])
DatabaseSession = Annotated[Session, Depends(get_db_session)]
PageLimit = Annotated[int, Query(ge=1, le=50)]
PageOffset = Annotated[int, Query(ge=0)]
WorkDateFilter = Annotated[date | None, Query()]
WorkProgressFilter = Annotated[WorkReportProgress | None, Query()]
EquipmentFilter = Annotated[UUID | None, Query()]
DepartmentFilter = Annotated[UUID | None, Query()]
WorkContentQuery = Annotated[str | None, Query(min_length=1, max_length=200)]


def get_work_report_or_404(
    database_session: Session,
    work_report_id: UUID,
) -> WorkReport:
    """Return one persisted work report or a stable not-found response."""
    work_report = database_session.get(WorkReport, work_report_id)
    if work_report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Work report not found.",
        )
    return work_report


def validate_active_equipment_selection(
    database_session: Session,
    department_id: UUID,
    equipment_id: UUID,
) -> tuple[Department, Equipment]:
    """Validate that one active equipment belongs to the selected department."""
    department = database_session.get(Department, department_id)
    if department is None or not department.is_active:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Selected department is not active.",
        )
    equipment_item = database_session.get(Equipment, equipment_id)
    if equipment_item is None or not equipment_item.is_active:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Selected equipment is not active.",
        )
    if equipment_item.department_id != department.id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Selected equipment does not belong to the department.",
        )
    return department, equipment_item


@router.get(
    "/work-reports",
    response_model=WorkReportListResponse,
    summary="最新の作業日報を取得する",
)
def list_work_reports(
    database_session: DatabaseSession,
    limit: PageLimit = 5,
    offset: PageOffset = 0,
    work_date: WorkDateFilter = None,
    department_id: DepartmentFilter = None,
    work_content_query: WorkContentQuery = None,
    progress: WorkProgressFilter = None,
    equipment_id: EquipmentFilter = None,
) -> WorkReportListResponse:
    """Return newest-first work reports for the supplied optional filters."""
    count_query = select(func.count()).select_from(WorkReport)
    items_query = select(WorkReport).options(
        selectinload(WorkReport.department),
        selectinload(WorkReport.equipment),
    )
    if work_date is not None:
        count_query = count_query.where(WorkReport.work_date == work_date)
        items_query = items_query.where(WorkReport.work_date == work_date)
    if department_id is not None:
        count_query = count_query.where(WorkReport.department_id == department_id)
        items_query = items_query.where(WorkReport.department_id == department_id)
    if work_content_query is not None:
        normalized_query = work_content_query.strip()
        if not normalized_query:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Work content query must not be blank.",
            )
        content_filter = WorkReport.work_content.icontains(
            normalized_query,
            autoescape=True,
        )
        count_query = count_query.where(content_filter)
        items_query = items_query.where(content_filter)
    if progress is not None:
        count_query = count_query.where(WorkReport.result == progress)
        items_query = items_query.where(WorkReport.result == progress)
    if equipment_id is not None:
        count_query = count_query.where(WorkReport.equipment_id == equipment_id)
        items_query = items_query.where(WorkReport.equipment_id == equipment_id)

    total = database_session.scalar(count_query) or 0
    work_reports = database_session.scalars(
        items_query.order_by(
            WorkReport.work_date.desc(),
            WorkReport.created_at.desc(),
            WorkReport.id.desc(),
        )
        .offset(offset)
        .limit(limit)
    ).all()

    return WorkReportListResponse(
        items=[WorkReportResponse.model_validate(item) for item in work_reports],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/work-reports/attention-summary",
    response_model=WorkReportAttentionSummaryResponse,
    summary="要対応の作業日報件数を取得する",
)
def get_work_report_attention_summary(
    database_session: DatabaseSession,
) -> WorkReportAttentionSummaryResponse:
    """Count all saved continued and follow-up reports independently of filters."""
    grouped_counts = database_session.execute(
        select(WorkReport.result, func.count())
        .where(WorkReport.result.in_(("continued", "follow_up")))
        .group_by(WorkReport.result)
    ).all()
    counts = {result: count for result, count in grouped_counts}
    continued_count = counts.get("continued", 0)
    follow_up_count = counts.get("follow_up", 0)

    return WorkReportAttentionSummaryResponse(
        continued_count=continued_count,
        follow_up_count=follow_up_count,
        attention_count=continued_count + follow_up_count,
    )


@router.post(
    "/work-reports",
    response_model=WorkReportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="作業日報を保存する",
)
def create_work_report(
    payload: WorkReportCreate,
    database_session: DatabaseSession,
) -> WorkReportResponse:
    """Validate and persist one mobile work report."""
    department, equipment_item = validate_active_equipment_selection(
        database_session,
        payload.department_id,
        payload.equipment_id,
    )
    work_report = WorkReport(
        work_date=payload.work_date,
        department=department,
        equipment=equipment_item,
        phenomenon=payload.phenomenon,
        cause=payload.cause,
        work_content=payload.work_content,
        result=payload.progress,
    )
    database_session.add(work_report)
    try:
        database_session.commit()
    except IntegrityError as error:
        database_session.rollback()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Work report data violates a storage constraint.",
        ) from error

    database_session.refresh(work_report)
    return WorkReportResponse.model_validate(work_report)


@router.patch(
    "/work-reports/{work_report_id}",
    response_model=WorkReportResponse,
    summary="保存済み作業日報を更新する",
)
def update_work_report(
    work_report_id: UUID,
    payload: WorkReportUpdate,
    database_session: DatabaseSession,
) -> WorkReportResponse:
    """Validate and replace the editable fields of one work report."""
    work_report = get_work_report_or_404(database_session, work_report_id)
    department, equipment_item = validate_active_equipment_selection(
        database_session,
        payload.department_id,
        payload.equipment_id,
    )
    work_report.work_date = payload.work_date
    work_report.department = department
    work_report.equipment = equipment_item
    work_report.phenomenon = payload.phenomenon
    work_report.cause = payload.cause
    work_report.work_content = payload.work_content
    work_report.result = payload.progress

    try:
        database_session.commit()
    except IntegrityError as error:
        database_session.rollback()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Work report data violates a storage constraint.",
        ) from error

    database_session.refresh(work_report)
    return WorkReportResponse.model_validate(work_report)

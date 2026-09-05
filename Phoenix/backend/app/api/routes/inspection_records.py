"""Structured inspection completion and detail endpoints."""

from datetime import date
from decimal import Decimal
from typing import Annotated, cast
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.db.session import get_db_session
from app.models.equipment_master import Department, Equipment
from app.models.inspection_record import InspectionRecord, InspectionRecordItem
from app.models.inspection_template import InspectionTemplateItem
from app.schemas.inspection_record import (
    InspectionCycleStatusSummary,
    InspectionJudgment,
    InspectionRecordCreate,
    InspectionRecordListResponse,
    InspectionRecordResponse,
    InspectionScheduleStatusItem,
    InspectionScheduleStatusResponse,
)
from app.schemas.inspection_template import InspectionCycle

router = APIRouter(tags=["inspection-records"])
DatabaseSession = Annotated[Session, Depends(get_db_session)]
PageLimit = Annotated[int, Query(ge=1, le=50)]
PageOffset = Annotated[int, Query(ge=0)]
EquipmentFilter = Annotated[UUID, Query()]
TargetDate = Annotated[date, Query()]


def get_inspection_period_key(
    inspection_date: date,
    cycle: InspectionCycle,
) -> str:
    """Return a stable daily, ISO-weekly, or monthly duplicate key."""
    if cycle == "daily":
        return inspection_date.isoformat()
    if cycle == "weekly":
        iso_year, iso_week, _iso_weekday = inspection_date.isocalendar()
        return f"{iso_year}-W{iso_week:02d}"
    return inspection_date.strftime("%Y-%m")


def get_inspection_record_or_404(
    database_session: Session,
    inspection_record_id: UUID,
) -> InspectionRecord:
    """Load one record with display relationships or return a stable 404."""
    record = database_session.scalar(
        select(InspectionRecord)
        .options(
            selectinload(InspectionRecord.equipment),
            selectinload(InspectionRecord.items),
        )
        .where(InspectionRecord.id == inspection_record_id)
    )
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inspection record not found.",
        )
    return record


@router.get(
    "/inspection-records",
    response_model=InspectionRecordListResponse,
    summary="設備別の最新点検記録を取得する",
)
def list_inspection_records(
    database_session: DatabaseSession,
    equipment_id: EquipmentFilter,
    limit: PageLimit = 5,
    offset: PageOffset = 0,
) -> InspectionRecordListResponse:
    """Return newest-first structured inspections for one physical asset."""
    total = (
        database_session.scalar(
            select(func.count())
            .select_from(InspectionRecord)
            .where(InspectionRecord.equipment_id == equipment_id)
        )
        or 0
    )
    records = database_session.scalars(
        select(InspectionRecord)
        .options(
            selectinload(InspectionRecord.equipment),
            selectinload(InspectionRecord.items),
        )
        .where(InspectionRecord.equipment_id == equipment_id)
        .order_by(
            InspectionRecord.inspection_date.desc(),
            InspectionRecord.created_at.desc(),
            InspectionRecord.id.desc(),
        )
        .offset(offset)
        .limit(limit)
    ).all()
    return InspectionRecordListResponse(
        items=[InspectionRecordResponse.model_validate(record) for record in records],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/inspection-status",
    response_model=InspectionScheduleStatusResponse,
    summary="周期別の点検実施状況を取得する",
)
def get_inspection_status(
    database_session: DatabaseSession,
    target_date: TargetDate,
) -> InspectionScheduleStatusResponse:
    """Derive due equipment-cycle units and completion for one local date."""
    cycle_order = case(
        (InspectionTemplateItem.cycle == "daily", 10),
        (InspectionTemplateItem.cycle == "weekly", 20),
        else_=30,
    )
    template_rows = database_session.execute(
        select(
            Equipment.equipment_id.label("equipment_id"),
            Equipment.name.label("equipment_name"),
            Equipment.equipment_number.label("equipment_number"),
            Department.id.label("department_id"),
            Department.name.label("department_name"),
            Department.display_order.label("department_display_order"),
            InspectionTemplateItem.cycle.label("cycle"),
            func.count(InspectionTemplateItem.id).label("template_item_count"),
        )
        .join(Equipment, Equipment.equipment_id == InspectionTemplateItem.equipment_id)
        .join(Department, Department.id == Equipment.department_id)
        .where(
            InspectionTemplateItem.is_active.is_(True),
            Equipment.is_active.is_(True),
            Department.is_active.is_(True),
        )
        .group_by(
            Equipment.equipment_id,
            Equipment.name,
            Equipment.equipment_number,
            Department.id,
            Department.name,
            Department.display_order,
            InspectionTemplateItem.cycle,
        )
        .order_by(
            cycle_order.asc(),
            Department.display_order.asc(),
            Department.name.asc(),
            Equipment.name.asc(),
            Equipment.equipment_number.asc(),
            Equipment.equipment_id.asc(),
        )
    ).all()

    cycles: tuple[InspectionCycle, ...] = ("daily", "weekly", "monthly")
    period_key_by_cycle = {
        cycle: get_inspection_period_key(target_date, cycle) for cycle in cycles
    }
    equipment_ids = {row.equipment_id for row in template_rows}
    records: list[InspectionRecord] = []
    if equipment_ids:
        period_conditions = [
            and_(
                InspectionRecord.cycle == cycle,
                InspectionRecord.period_key == period_key,
            )
            for cycle, period_key in period_key_by_cycle.items()
        ]
        records = list(
            database_session.scalars(
                select(InspectionRecord).where(
                    InspectionRecord.equipment_id.in_(equipment_ids),
                    or_(*period_conditions),
                )
            ).all()
        )
    record_by_unit = {
        (record.equipment_id, record.cycle, record.period_key): record
        for record in records
    }

    items: list[InspectionScheduleStatusItem] = []
    for row in template_rows:
        cycle = cast(InspectionCycle, row.cycle)
        period_key = period_key_by_cycle[cycle]
        record = record_by_unit.get((row.equipment_id, cycle, period_key))
        items.append(
            InspectionScheduleStatusItem(
                equipment_id=row.equipment_id,
                equipment_name=row.equipment_name,
                equipment_number=row.equipment_number,
                department_id=row.department_id,
                department_name=row.department_name,
                cycle=cycle,
                period_key=period_key,
                template_item_count=row.template_item_count,
                completion_status="completed" if record is not None else "pending",
                inspection_record_id=record.id if record is not None else None,
                inspection_date=record.inspection_date if record is not None else None,
                overall_judgment=(
                    cast(InspectionJudgment, record.overall_judgment)
                    if record is not None
                    else None
                ),
            )
        )

    cycle_summaries = []
    for cycle in cycles:
        cycle_items = [item for item in items if item.cycle == cycle]
        completed = sum(item.completion_status == "completed" for item in cycle_items)
        cycle_summaries.append(
            InspectionCycleStatusSummary(
                cycle=cycle,
                total=len(cycle_items),
                completed=completed,
                pending=len(cycle_items) - completed,
            )
        )
    return InspectionScheduleStatusResponse(
        target_date=target_date,
        cycle_summaries=cycle_summaries,
        items=items,
    )


@router.get(
    "/inspection-records/{inspection_record_id}",
    response_model=InspectionRecordResponse,
    summary="保存済み点検記録の詳細を取得する",
)
def get_inspection_record(
    inspection_record_id: UUID,
    database_session: DatabaseSession,
) -> InspectionRecordResponse:
    """Return one persisted inspection with immutable criteria snapshots."""
    return InspectionRecordResponse.model_validate(
        get_inspection_record_or_404(database_session, inspection_record_id)
    )


@router.post(
    "/inspection-records",
    response_model=InspectionRecordResponse,
    status_code=status.HTTP_201_CREATED,
    summary="設備点検結果を保存する",
)
def create_inspection_record(
    payload: InspectionRecordCreate,
    database_session: DatabaseSession,
) -> InspectionRecordResponse:
    """Validate all active template items, judge values, and save atomically."""
    equipment = database_session.get(Equipment, payload.equipment_id)
    if equipment is None or not equipment.is_active:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Selected equipment is not active.",
        )

    period_key = get_inspection_period_key(payload.inspection_date, payload.cycle)
    existing_id = database_session.scalar(
        select(InspectionRecord.id).where(
            InspectionRecord.equipment_id == equipment.equipment_id,
            InspectionRecord.cycle == payload.cycle,
            InspectionRecord.period_key == period_key,
        )
    )
    if existing_id is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Inspection already exists for this equipment and period.",
        )

    template_items = database_session.scalars(
        select(InspectionTemplateItem)
        .where(
            InspectionTemplateItem.equipment_id == equipment.equipment_id,
            InspectionTemplateItem.cycle == payload.cycle,
            InspectionTemplateItem.is_active.is_(True),
        )
        .order_by(
            InspectionTemplateItem.display_order.asc(),
            InspectionTemplateItem.name.asc(),
            InspectionTemplateItem.id.asc(),
        )
    ).all()
    if not template_items:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="No active inspection items are configured.",
        )

    input_ids = [item.template_item_id for item in payload.items]
    if len(input_ids) != len(set(input_ids)):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Inspection item values contain duplicates.",
        )
    template_ids = {item.id for item in template_items}
    if set(input_ids) != template_ids:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Inspection values must match all active template items.",
        )
    inputs_by_id = {item.template_item_id: item for item in payload.items}

    record_items: list[InspectionRecordItem] = []
    for template in template_items:
        input_item = inputs_by_id[template.id]
        if template.input_type == "number":
            if input_item.number_value is None or input_item.status_value is not None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="Inspection value does not match its numeric template.",
                )
            number_value = Decimal(str(input_item.number_value))
            if template.normal_min is None or template.normal_max is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="Inspection template criteria are incomplete.",
                )
            judgment = (
                "normal"
                if template.normal_min <= number_value <= template.normal_max
                else "abnormal"
            )
            record_items.append(
                InspectionRecordItem(
                    template_item=template,
                    name=template.name,
                    input_type=template.input_type,
                    number_value=number_value,
                    status_value=None,
                    unit=template.unit,
                    normal_min=template.normal_min,
                    normal_max=template.normal_max,
                    normal_state=None,
                    judgment=judgment,
                    display_order=template.display_order,
                )
            )
        else:
            if input_item.status_value is None or input_item.number_value is not None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="Inspection value does not match its status template.",
                )
            if template.normal_state is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="Inspection template criteria are incomplete.",
                )
            record_items.append(
                InspectionRecordItem(
                    template_item=template,
                    name=template.name,
                    input_type=template.input_type,
                    number_value=None,
                    status_value=input_item.status_value,
                    unit=None,
                    normal_min=None,
                    normal_max=None,
                    normal_state=template.normal_state,
                    judgment=input_item.status_value,
                    display_order=template.display_order,
                )
            )

    overall_judgment = (
        "abnormal"
        if any(item.judgment == "abnormal" for item in record_items)
        else "normal"
    )
    inspection_record = InspectionRecord(
        inspection_date=payload.inspection_date,
        equipment=equipment,
        cycle=payload.cycle,
        period_key=period_key,
        overall_judgment=overall_judgment,
        items=record_items,
    )
    database_session.add(inspection_record)
    try:
        database_session.commit()
    except IntegrityError as error:
        database_session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Inspection already exists for this equipment and period.",
        ) from error
    database_session.refresh(inspection_record)
    return InspectionRecordResponse.model_validate(inspection_record)

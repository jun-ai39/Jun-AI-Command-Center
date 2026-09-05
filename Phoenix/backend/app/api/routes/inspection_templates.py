"""Equipment-specific inspection item master endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import case, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies import AdminUser
from app.db.session import get_db_session
from app.models.equipment_master import Equipment
from app.models.inspection_template import InspectionTemplateItem
from app.schemas.inspection_template import (
    InspectionCycle,
    InspectionTemplateGuideUpdate,
    InspectionTemplateItemCreate,
    InspectionTemplateItemListResponse,
    InspectionTemplateItemResponse,
)

router = APIRouter(tags=["inspection-templates"])
DatabaseSession = Annotated[Session, Depends(get_db_session)]
PageLimit = Annotated[int, Query(ge=1, le=100)]
PageOffset = Annotated[int, Query(ge=0)]
EquipmentFilter = Annotated[UUID | None, Query()]
CycleFilter = Annotated[InspectionCycle | None, Query()]
ActiveFilter = Annotated[bool | None, Query()]


@router.get(
    "/inspection-template-items",
    response_model=InspectionTemplateItemListResponse,
    summary="設備別点検項目マスターを取得する",
)
def list_inspection_template_items(
    database_session: DatabaseSession,
    limit: PageLimit = 100,
    offset: PageOffset = 0,
    equipment_id: EquipmentFilter = None,
    cycle: CycleFilter = None,
    is_active: ActiveFilter = None,
) -> InspectionTemplateItemListResponse:
    """Return inspection items in cycle and configured display order."""
    count_query = select(func.count()).select_from(InspectionTemplateItem)
    items_query = select(InspectionTemplateItem)
    for condition in (
        (
            InspectionTemplateItem.equipment_id == equipment_id
            if equipment_id is not None
            else None
        ),
        InspectionTemplateItem.cycle == cycle if cycle is not None else None,
        (
            InspectionTemplateItem.is_active == is_active
            if is_active is not None
            else None
        ),
    ):
        if condition is not None:
            count_query = count_query.where(condition)
            items_query = items_query.where(condition)

    cycle_order = case(
        (InspectionTemplateItem.cycle == "daily", 10),
        (InspectionTemplateItem.cycle == "weekly", 20),
        else_=30,
    )
    total = database_session.scalar(count_query) or 0
    items = database_session.scalars(
        items_query.order_by(
            InspectionTemplateItem.equipment_id.asc(),
            cycle_order.asc(),
            InspectionTemplateItem.display_order.asc(),
            InspectionTemplateItem.name.asc(),
            InspectionTemplateItem.id.asc(),
        )
        .offset(offset)
        .limit(limit)
    ).all()
    return InspectionTemplateItemListResponse(
        items=[InspectionTemplateItemResponse.model_validate(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post(
    "/inspection-template-items",
    response_model=InspectionTemplateItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="設備別点検項目マスターを登録する",
)
def create_inspection_template_item(
    payload: InspectionTemplateItemCreate,
    database_session: DatabaseSession,
    _admin_user: AdminUser,
) -> InspectionTemplateItemResponse:
    """Validate one active equipment reference and persist its inspection item."""
    equipment = database_session.get(Equipment, payload.equipment_id)
    if equipment is None or not equipment.is_active:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Selected equipment is not active.",
        )

    inspection_item = InspectionTemplateItem(**payload.model_dump())
    database_session.add(inspection_item)
    try:
        database_session.commit()
    except IntegrityError as error:
        database_session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Inspection item already exists for this equipment and cycle.",
        ) from error
    database_session.refresh(inspection_item)
    return InspectionTemplateItemResponse.model_validate(inspection_item)


@router.patch(
    "/inspection-template-items/{item_id}/guide",
    response_model=InspectionTemplateItemResponse,
    summary="登録済み点検項目のガイドを更新する",
)
def update_inspection_template_guide(
    item_id: UUID,
    payload: InspectionTemplateGuideUpdate,
    database_session: DatabaseSession,
    _admin_user: AdminUser,
) -> InspectionTemplateItemResponse:
    """Update only the field guidance without changing inspection criteria."""
    inspection_item = database_session.get(InspectionTemplateItem, item_id)
    if inspection_item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inspection item was not found.",
        )

    inspection_item.check_method = payload.check_method
    inspection_item.caution_note = payload.caution_note
    try:
        database_session.commit()
    except IntegrityError as error:
        database_session.rollback()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Inspection guide details are invalid.",
        ) from error
    database_session.refresh(inspection_item)
    return InspectionTemplateItemResponse.model_validate(inspection_item)

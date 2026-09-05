"""Department, manufacturer, and equipment master endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies import AdminUser
from app.db.session import get_db_session
from app.models.equipment_master import Department, Equipment, Manufacturer
from app.schemas.equipment_master import (
    DepartmentCreate,
    DepartmentListResponse,
    DepartmentResponse,
    EquipmentCreate,
    EquipmentListResponse,
    EquipmentResponse,
    ManufacturerCreate,
    ManufacturerListResponse,
    ManufacturerResponse,
)

router = APIRouter(tags=["equipment-master"])
DatabaseSession = Annotated[Session, Depends(get_db_session)]
PageLimit = Annotated[int, Query(ge=1, le=100)]
PageOffset = Annotated[int, Query(ge=0)]
ActiveFilter = Annotated[bool | None, Query()]
DepartmentFilter = Annotated[UUID | None, Query()]
ManufacturerFilter = Annotated[UUID | None, Query()]


def commit_master_record(database_session: Session, conflict_detail: str) -> None:
    """Commit one master record and return a stable conflict response."""
    try:
        database_session.commit()
    except IntegrityError as error:
        database_session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=conflict_detail,
        ) from error


@router.get(
    "/departments",
    response_model=DepartmentListResponse,
    summary="部門マスター一覧を取得する",
)
def list_departments(
    database_session: DatabaseSession,
    limit: PageLimit = 100,
    offset: PageOffset = 0,
    is_active: ActiveFilter = None,
) -> DepartmentListResponse:
    """Return departments in their configurable display order."""
    count_query = select(func.count()).select_from(Department)
    items_query = select(Department)
    if is_active is not None:
        count_query = count_query.where(Department.is_active == is_active)
        items_query = items_query.where(Department.is_active == is_active)

    total = database_session.scalar(count_query) or 0
    departments = database_session.scalars(
        items_query.order_by(
            Department.display_order.asc(),
            Department.name.asc(),
            Department.id.asc(),
        )
        .offset(offset)
        .limit(limit)
    ).all()
    return DepartmentListResponse(
        items=[DepartmentResponse.model_validate(item) for item in departments],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post(
    "/departments",
    response_model=DepartmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="部門マスターを登録する",
)
def create_department(
    payload: DepartmentCreate,
    database_session: DatabaseSession,
    _admin_user: AdminUser,
) -> DepartmentResponse:
    """Validate and persist one configurable department."""
    department = Department(**payload.model_dump())
    database_session.add(department)
    commit_master_record(database_session, "Department name already exists.")
    database_session.refresh(department)
    return DepartmentResponse.model_validate(department)


@router.get(
    "/manufacturers",
    response_model=ManufacturerListResponse,
    summary="メーカーマスター一覧を取得する",
)
def list_manufacturers(
    database_session: DatabaseSession,
    limit: PageLimit = 100,
    offset: PageOffset = 0,
    is_active: ActiveFilter = None,
) -> ManufacturerListResponse:
    """Return manufacturers in stable name order."""
    count_query = select(func.count()).select_from(Manufacturer)
    items_query = select(Manufacturer)
    if is_active is not None:
        count_query = count_query.where(Manufacturer.is_active == is_active)
        items_query = items_query.where(Manufacturer.is_active == is_active)

    total = database_session.scalar(count_query) or 0
    manufacturers = database_session.scalars(
        items_query.order_by(Manufacturer.name.asc(), Manufacturer.id.asc())
        .offset(offset)
        .limit(limit)
    ).all()
    return ManufacturerListResponse(
        items=[ManufacturerResponse.model_validate(item) for item in manufacturers],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post(
    "/manufacturers",
    response_model=ManufacturerResponse,
    status_code=status.HTTP_201_CREATED,
    summary="メーカーマスターを登録する",
)
def create_manufacturer(
    payload: ManufacturerCreate,
    database_session: DatabaseSession,
    _admin_user: AdminUser,
) -> ManufacturerResponse:
    """Validate and persist one reusable manufacturer."""
    manufacturer = Manufacturer(**payload.model_dump())
    database_session.add(manufacturer)
    commit_master_record(database_session, "Manufacturer name already exists.")
    database_session.refresh(manufacturer)
    return ManufacturerResponse.model_validate(manufacturer)


@router.get(
    "/equipment",
    response_model=EquipmentListResponse,
    summary="設備マスター一覧を取得する",
)
def list_equipment(
    database_session: DatabaseSession,
    limit: PageLimit = 100,
    offset: PageOffset = 0,
    department_id: DepartmentFilter = None,
    manufacturer_id: ManufacturerFilter = None,
    is_active: ActiveFilter = None,
) -> EquipmentListResponse:
    """Return equipment with optional tree-building master filters."""
    count_query = select(func.count()).select_from(Equipment)
    items_query = select(Equipment)
    for condition in (
        Equipment.department_id == department_id if department_id is not None else None,
        (
            Equipment.manufacturer_id == manufacturer_id
            if manufacturer_id is not None
            else None
        ),
        Equipment.is_active == is_active if is_active is not None else None,
    ):
        if condition is not None:
            count_query = count_query.where(condition)
            items_query = items_query.where(condition)

    total = database_session.scalar(count_query) or 0
    equipment_items = database_session.scalars(
        items_query.order_by(
            Equipment.department_id.asc(),
            Equipment.manufacturer_id.asc(),
            Equipment.name.asc(),
            Equipment.equipment_number.asc(),
            Equipment.equipment_id.asc(),
        )
        .offset(offset)
        .limit(limit)
    ).all()
    return EquipmentListResponse(
        items=[EquipmentResponse.model_validate(item) for item in equipment_items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/equipment/{equipment_id}",
    response_model=EquipmentResponse,
    summary="設備マスターの詳細を取得する",
)
def get_equipment(
    equipment_id: UUID,
    database_session: DatabaseSession,
) -> EquipmentResponse:
    """Return one equipment asset by its immutable identifier."""
    equipment_item = database_session.get(Equipment, equipment_id)
    if equipment_item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Equipment not found.",
        )
    return EquipmentResponse.model_validate(equipment_item)


@router.post(
    "/equipment",
    response_model=EquipmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="設備マスターを登録する",
)
def create_equipment(
    payload: EquipmentCreate,
    database_session: DatabaseSession,
    _admin_user: AdminUser,
) -> EquipmentResponse:
    """Validate references and persist one physical equipment asset."""
    department = database_session.get(Department, payload.department_id)
    if department is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Department not found.",
        )
    manufacturer = database_session.get(Manufacturer, payload.manufacturer_id)
    if manufacturer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Manufacturer not found.",
        )

    equipment_item = Equipment(**payload.model_dump())
    database_session.add(equipment_item)
    commit_master_record(
        database_session,
        "Equipment data violates a storage constraint.",
    )
    database_session.refresh(equipment_item)
    return EquipmentResponse.model_validate(equipment_item)

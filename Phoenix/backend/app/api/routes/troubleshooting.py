"""Equipment troubleshooting guide graph endpoints."""

from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import case, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies import AdminUser
from app.db.session import get_db_session
from app.models.equipment_master import Equipment
from app.models.troubleshooting import (
    TroubleshootingBranch,
    TroubleshootingGuide,
    TroubleshootingStep,
)
from app.schemas.troubleshooting import (
    TroubleshootingBranchResponse,
    TroubleshootingGuideCreate,
    TroubleshootingGuideDetailResponse,
    TroubleshootingGuideListResponse,
    TroubleshootingGuideSummaryResponse,
    TroubleshootingStepResponse,
)

router = APIRouter(tags=["troubleshooting"])
DatabaseSession = Annotated[Session, Depends(get_db_session)]
PageLimit = Annotated[int, Query(ge=1, le=100)]
PageOffset = Annotated[int, Query(ge=0)]
EquipmentFilter = Annotated[UUID | None, Query()]
ActiveFilter = Annotated[bool | None, Query()]


def build_guide_detail(
    database_session: Session,
    guide: TroubleshootingGuide,
) -> TroubleshootingGuideDetailResponse:
    """Load one persisted graph in a stable order for API consumers."""
    start_order = case((TroubleshootingStep.id == guide.start_step_id, 0), else_=1)
    steps = database_session.scalars(
        select(TroubleshootingStep)
        .where(TroubleshootingStep.guide_id == guide.id)
        .order_by(start_order.asc(), TroubleshootingStep.id.asc())
    ).all()
    answer_order = case(
        (TroubleshootingBranch.answer == "yes", 10),
        (TroubleshootingBranch.answer == "no", 20),
        else_=30,
    )
    branches = database_session.scalars(
        select(TroubleshootingBranch)
        .where(TroubleshootingBranch.guide_id == guide.id)
        .order_by(
            TroubleshootingBranch.from_step_id.asc(),
            answer_order.asc(),
            TroubleshootingBranch.id.asc(),
        )
    ).all()
    return TroubleshootingGuideDetailResponse(
        id=guide.id,
        equipment_id=guide.equipment_id,
        symptom=guide.symptom,
        start_step_id=guide.start_step_id,
        display_order=guide.display_order,
        is_active=guide.is_active,
        created_at=guide.created_at,
        updated_at=guide.updated_at,
        steps=[
            TroubleshootingStepResponse(
                step_id=step.id,
                step_type=step.step_type,
                prompt=step.prompt,
                check_method=step.check_method,
                caution_note=step.caution_note,
            )
            for step in steps
        ],
        branches=[
            TroubleshootingBranchResponse(
                branch_id=branch.id,
                from_step_id=branch.from_step_id,
                answer=branch.answer,
                to_step_id=branch.to_step_id,
            )
            for branch in branches
        ],
    )


@router.get(
    "/troubleshooting-guides",
    response_model=TroubleshootingGuideListResponse,
    summary="設備別トラブルシューティングガイドを取得する",
)
def list_troubleshooting_guides(
    database_session: DatabaseSession,
    limit: PageLimit = 100,
    offset: PageOffset = 0,
    equipment_id: EquipmentFilter = None,
    is_active: ActiveFilter = None,
) -> TroubleshootingGuideListResponse:
    """Return guide summaries with optional equipment and active filters."""
    count_query = select(func.count()).select_from(TroubleshootingGuide)
    items_query = select(TroubleshootingGuide)
    for condition in (
        (
            TroubleshootingGuide.equipment_id == equipment_id
            if equipment_id is not None
            else None
        ),
        (
            TroubleshootingGuide.is_active == is_active
            if is_active is not None
            else None
        ),
    ):
        if condition is not None:
            count_query = count_query.where(condition)
            items_query = items_query.where(condition)

    total = database_session.scalar(count_query) or 0
    guides = database_session.scalars(
        items_query.order_by(
            TroubleshootingGuide.equipment_id.asc(),
            TroubleshootingGuide.display_order.asc(),
            TroubleshootingGuide.symptom.asc(),
            TroubleshootingGuide.id.asc(),
        )
        .offset(offset)
        .limit(limit)
    ).all()
    return TroubleshootingGuideListResponse(
        items=[
            TroubleshootingGuideSummaryResponse.model_validate(guide)
            for guide in guides
        ],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/troubleshooting-guides/{guide_id}",
    response_model=TroubleshootingGuideDetailResponse,
    summary="トラブルシューティングガイドの分岐を取得する",
)
def get_troubleshooting_guide(
    guide_id: UUID,
    database_session: DatabaseSession,
) -> TroubleshootingGuideDetailResponse:
    """Return one complete troubleshooting guide graph."""
    guide = database_session.get(TroubleshootingGuide, guide_id)
    if guide is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Troubleshooting guide not found.",
        )
    return build_guide_detail(database_session, guide)


@router.post(
    "/troubleshooting-guides",
    response_model=TroubleshootingGuideDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="安全検証済みトラブルシューティングガイドを登録する",
)
def create_troubleshooting_guide(
    payload: TroubleshootingGuideCreate,
    database_session: DatabaseSession,
    _admin_user: AdminUser,
) -> TroubleshootingGuideDetailResponse:
    """Persist one fully validated guide graph as an atomic transaction."""
    equipment = database_session.get(Equipment, payload.equipment_id)
    if equipment is None or not equipment.is_active:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Selected equipment is not active.",
        )

    guide = TroubleshootingGuide(
        id=uuid4(),
        equipment_id=payload.equipment_id,
        symptom=payload.symptom,
        start_step_id=None,
        display_order=payload.display_order,
        is_active=payload.is_active,
    )
    try:
        database_session.add(guide)
        database_session.flush()
        database_session.add_all(
            [
                TroubleshootingStep(
                    id=step.step_id,
                    guide_id=guide.id,
                    step_type=step.step_type,
                    prompt=step.prompt,
                    check_method=step.check_method,
                    caution_note=step.caution_note,
                )
                for step in payload.steps
            ]
        )
        database_session.flush()
        guide.start_step_id = payload.start_step_id
        database_session.add_all(
            [
                TroubleshootingBranch(
                    id=branch.branch_id,
                    guide_id=guide.id,
                    from_step_id=branch.from_step_id,
                    answer=branch.answer,
                    to_step_id=branch.to_step_id,
                )
                for branch in payload.branches
            ]
        )
        database_session.commit()
    except IntegrityError as error:
        database_session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Troubleshooting guide violates a storage constraint.",
        ) from error

    database_session.refresh(guide)
    return build_guide_detail(database_session, guide)

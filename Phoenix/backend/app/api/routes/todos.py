"""ToDo collection and item endpoints."""

from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import case, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.session import get_db_session
from app.models.equipment_master import Equipment
from app.models.todo import Todo
from app.schemas.todo import (
    TodoCreate,
    TodoDueSummaryResponse,
    TodoListResponse,
    TodoResponse,
    TodoUpdate,
)

router = APIRouter(tags=["todos"])
DatabaseSession = Annotated[Session, Depends(get_db_session)]
PageLimit = Annotated[int, Query(ge=1, le=100)]
PageOffset = Annotated[int, Query(ge=0)]
TargetDate = Annotated[date, Query()]


def get_todo_or_404(database_session: Session, todo_id: UUID) -> Todo:
    """Return one ToDo or a stable public not-found response."""
    todo = database_session.get(Todo, todo_id)
    if todo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ToDo not found.",
        )
    return todo


def validate_active_equipment(
    database_session: Session,
    equipment_id: UUID | None,
) -> None:
    """Reject new links to missing or inactive equipment."""
    if equipment_id is None:
        return
    equipment = database_session.get(Equipment, equipment_id)
    if equipment is None or not equipment.is_active:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Selected equipment is not active.",
        )


@router.get(
    "/todos",
    response_model=TodoListResponse,
    summary="ToDo一覧を取得する",
)
def list_todos(
    database_session: DatabaseSession,
    limit: PageLimit = 50,
    offset: PageOffset = 0,
) -> TodoListResponse:
    """Return a stable, paginated collection of ToDo items."""
    total = database_session.scalar(select(func.count(Todo.id))) or 0
    statement = (
        select(Todo)
        .order_by(
            Todo.is_archived.asc(),
            Todo.is_pinned.desc(),
            Todo.is_completed.asc(),
            case((Todo.due_date.is_(None), 1), else_=0).asc(),
            Todo.due_date.asc(),
            Todo.created_at.asc(),
            Todo.id.asc(),
        )
        .offset(offset)
        .limit(limit)
    )
    todos = database_session.scalars(statement).all()

    return TodoListResponse(
        items=[TodoResponse.model_validate(todo) for todo in todos],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/todos/due-summary",
    response_model=TodoDueSummaryResponse,
    summary="今日の保全予定を取得する",
)
def get_todo_due_summary(
    target_date: TargetDate,
    database_session: DatabaseSession,
) -> TodoDueSummaryResponse:
    """Return every active schedule due today or earlier, grouped by urgency."""
    priority_order = case(
        (Todo.priority == "high", 0),
        (Todo.priority == "medium", 1),
        else_=2,
    )
    statement = (
        select(Todo)
        .where(
            Todo.is_completed.is_(False),
            Todo.is_archived.is_(False),
            Todo.due_date.is_not(None),
            Todo.due_date <= target_date,
        )
        .order_by(
            Todo.due_date.asc(),
            priority_order.asc(),
            Todo.created_at.asc(),
            Todo.id.asc(),
        )
    )
    items = database_session.scalars(statement).all()
    overdue_items = [todo for todo in items if todo.due_date < target_date]
    today_items = [todo for todo in items if todo.due_date == target_date]

    return TodoDueSummaryResponse(
        target_date=target_date,
        today_items=[TodoResponse.model_validate(todo) for todo in today_items],
        overdue_items=[TodoResponse.model_validate(todo) for todo in overdue_items],
    )


@router.post(
    "/todos",
    response_model=TodoResponse,
    status_code=status.HTTP_201_CREATED,
    summary="ToDoを作成する",
)
def create_todo(
    payload: TodoCreate,
    database_session: DatabaseSession,
) -> TodoResponse:
    """Validate and persist one new ToDo item."""
    validate_active_equipment(database_session, payload.equipment_id)
    todo = Todo(
        title=payload.title,
        description=payload.description,
        due_date=payload.due_date,
        priority=payload.priority,
        category=payload.category,
        equipment_id=payload.equipment_id,
        is_pinned=payload.is_pinned,
        is_completed=payload.is_completed,
    )
    database_session.add(todo)
    try:
        database_session.commit()
    except IntegrityError as error:
        database_session.rollback()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="ToDo data violates a storage constraint.",
        ) from error

    database_session.refresh(todo)
    return TodoResponse.model_validate(todo)


@router.patch(
    "/todos/{todo_id}",
    response_model=TodoResponse,
    summary="ToDoを更新する",
)
def update_todo(
    todo_id: UUID,
    payload: TodoUpdate,
    database_session: DatabaseSession,
) -> TodoResponse:
    """Partially update one existing ToDo, including its completion state."""
    todo = get_todo_or_404(database_session, todo_id)
    update_values = payload.model_dump(exclude_unset=True)
    if (
        "equipment_id" in update_values
        and update_values["equipment_id"] != todo.equipment_id
    ):
        validate_active_equipment(database_session, update_values["equipment_id"])
    next_is_completed = update_values.get("is_completed", todo.is_completed)
    next_is_archived = update_values.get("is_archived", todo.is_archived)
    if next_is_archived and not next_is_completed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Only completed ToDos can be archived.",
        )

    for field_name, value in update_values.items():
        setattr(todo, field_name, value)

    try:
        database_session.commit()
    except IntegrityError as error:
        database_session.rollback()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="ToDo data violates a storage constraint.",
        ) from error

    database_session.refresh(todo)
    return TodoResponse.model_validate(todo)


@router.delete(
    "/todos/{todo_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="ToDoを削除する",
)
def delete_todo(
    todo_id: UUID,
    database_session: DatabaseSession,
) -> None:
    """Permanently delete one existing ToDo."""
    todo = get_todo_or_404(database_session, todo_id)
    database_session.delete(todo)
    database_session.commit()

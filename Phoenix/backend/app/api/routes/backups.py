"""Administrator-only local database backup endpoint."""

from fastapi import APIRouter, HTTPException, status

from app.api.dependencies import AdminUser
from app.core.config import get_backup_directory, get_database_url
from app.schemas.backup import (
    BackupCatalogResponse,
    BackupCreatedResponse,
    BackupListItem,
    RestoreScheduledResponse,
    RestoreScheduleRequest,
    RestoreStatusResponse,
)
from app.services.backup import (
    BackupError,
    BackupRevisionError,
    BackupUnavailableError,
    RestorePendingError,
    create_sqlite_backup,
    list_sqlite_backups,
    read_restore_status,
    schedule_sqlite_restore,
)

router = APIRouter(prefix="/backups", tags=["backups"])


@router.get(
    "",
    response_model=BackupCatalogResponse,
    summary="復元可能なローカルバックアップを確認する",
)
def list_backups(_admin_user: AdminUser) -> BackupCatalogResponse:
    """Return inspected backups and the safe restart restore state."""
    items = list_sqlite_backups(get_backup_directory())
    restore_status = read_restore_status(get_database_url())
    return BackupCatalogResponse(
        items=[BackupListItem.model_validate(item) for item in items],
        total=len(items),
        restore_status=RestoreStatusResponse.model_validate(restore_status),
    )


@router.post(
    "",
    response_model=BackupCreatedResponse,
    status_code=status.HTTP_201_CREATED,
    summary="検証済みSQLiteバックアップを作成する",
)
def create_backup(_admin_user: AdminUser) -> BackupCreatedResponse:
    """Create one verified local backup for an authenticated administrator."""
    try:
        backup = create_sqlite_backup(
            get_database_url(),
            get_backup_directory(),
        )
    except BackupUnavailableError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A file-backed SQLite database is not available.",
        ) from error
    except BackupError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The database backup could not be completed.",
        ) from error
    return BackupCreatedResponse.model_validate(backup)


@router.post(
    "/{filename}/restore",
    response_model=RestoreScheduledResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="次回起動時の安全なSQLite復元を予約する",
)
def schedule_restore(
    filename: str,
    payload: RestoreScheduleRequest,
    _admin_user: AdminUser,
) -> RestoreScheduledResponse:
    """Stage a verified backup without replacing the live database."""
    if payload.confirmation != filename:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="The confirmation must exactly match the backup filename.",
        )
    try:
        scheduled = schedule_sqlite_restore(
            get_database_url(),
            get_backup_directory(),
            filename,
        )
    except (BackupUnavailableError, BackupRevisionError) as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The selected backup cannot be restored safely.",
        ) from error
    except RestorePendingError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Another restore is already waiting for restart.",
        ) from error
    except BackupError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The restore could not be staged.",
        ) from error
    return RestoreScheduledResponse.model_validate(scheduled)

"""Add persistent archiving to completed ToDo items.

Revision ID: 20260812_0006
Revises: 20260809_0005
Create Date: 2026-08-12
"""

import sqlalchemy as sa

from alembic import op

revision: str = "20260812_0006"
down_revision: str | None = "20260809_0005"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    """Add an active default and keep archived rows after current rows."""
    with op.batch_alter_table("todos", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "is_archived",
                sa.Boolean(),
                server_default=sa.false(),
                nullable=False,
            )
        )
        batch_op.create_check_constraint(
            "todo_archive_requires_completion",
            "is_archived = 0 OR is_completed = 1",
        )
        batch_op.drop_index("ix_todos_is_pinned_is_completed_due_date")
        batch_op.create_index(
            "ix_todos_is_archived_is_pinned_is_completed_due_date",
            ["is_archived", "is_pinned", "is_completed", "due_date"],
            unique=False,
        )


def downgrade() -> None:
    """Remove archiving and restore the previous list-order index."""
    with op.batch_alter_table("todos", schema=None) as batch_op:
        batch_op.drop_index("ix_todos_is_archived_is_pinned_is_completed_due_date")
        batch_op.create_index(
            "ix_todos_is_pinned_is_completed_due_date",
            ["is_pinned", "is_completed", "due_date"],
            unique=False,
        )
        batch_op.drop_constraint(
            "todo_archive_requires_completion",
            type_="check",
        )
        batch_op.drop_column("is_archived")

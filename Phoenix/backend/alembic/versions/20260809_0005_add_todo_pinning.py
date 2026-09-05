"""Add persistent pinning to ToDo items.

Revision ID: 20260809_0005
Revises: 20260723_0004
Create Date: 2026-08-09
"""

import sqlalchemy as sa

from alembic import op

revision: str = "20260809_0005"
down_revision: str | None = "20260723_0004"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    """Add an unpinned default and prioritize pinned rows in list ordering."""
    with op.batch_alter_table("todos", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "is_pinned",
                sa.Boolean(),
                server_default=sa.false(),
                nullable=False,
            )
        )
        batch_op.drop_index("ix_todos_is_completed_due_date")
        batch_op.create_index(
            "ix_todos_is_pinned_is_completed_due_date",
            ["is_pinned", "is_completed", "due_date"],
            unique=False,
        )


def downgrade() -> None:
    """Remove ToDo pinning and restore the previous list-order index."""
    with op.batch_alter_table("todos", schema=None) as batch_op:
        batch_op.drop_index("ix_todos_is_pinned_is_completed_due_date")
        batch_op.create_index(
            "ix_todos_is_completed_due_date",
            ["is_completed", "due_date"],
            unique=False,
        )
        batch_op.drop_column("is_pinned")

"""Create the ToDo table.

Revision ID: 20260720_0002
Revises: 20260720_0001
Create Date: 2026-07-20
"""

import sqlalchemy as sa

from alembic import op

revision: str = "20260720_0002"
down_revision: str | None = "20260720_0001"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    """Create the ToDo table and its dashboard query index."""
    op.create_table(
        "todos",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column(
            "is_completed",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "length(trim(title)) BETWEEN 1 AND 200",
            name=op.f("ck_todos_todo_title_length"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_todos")),
    )
    op.create_index(
        "ix_todos_is_completed_due_date",
        "todos",
        ["is_completed", "due_date"],
        unique=False,
    )


def downgrade() -> None:
    """Remove the ToDo table."""
    op.drop_index("ix_todos_is_completed_due_date", table_name="todos")
    op.drop_table("todos")

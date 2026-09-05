"""Add a persisted priority to ToDo items.

Revision ID: 20260723_0003
Revises: 20260720_0002
Create Date: 2026-07-23
"""

import sqlalchemy as sa

from alembic import op

revision: str = "20260723_0003"
down_revision: str | None = "20260720_0002"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    """Add priority while preserving existing rows as medium priority."""
    with op.batch_alter_table("todos", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "priority",
                sa.String(length=6),
                server_default="medium",
                nullable=False,
            )
        )
        batch_op.create_check_constraint(
            op.f("ck_todos_todo_priority_value"),
            "priority IN ('high', 'medium', 'low')",
        )


def downgrade() -> None:
    """Remove the ToDo priority field."""
    with op.batch_alter_table("todos", schema=None) as batch_op:
        batch_op.drop_constraint(
            op.f("ck_todos_todo_priority_value"),
            type_="check",
        )
        batch_op.drop_column("priority")

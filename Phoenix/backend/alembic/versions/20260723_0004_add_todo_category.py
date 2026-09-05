"""Add an optional category to ToDo items.

Revision ID: 20260723_0004
Revises: 20260723_0003
Create Date: 2026-07-23
"""

import sqlalchemy as sa

from alembic import op

revision: str = "20260723_0004"
down_revision: str | None = "20260723_0003"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    """Add a validated category while preserving existing rows as uncategorized."""
    with op.batch_alter_table("todos", schema=None) as batch_op:
        batch_op.add_column(sa.Column("category", sa.String(length=30), nullable=True))
        batch_op.create_check_constraint(
            op.f("ck_todos_todo_category_length"),
            "category IS NULL OR length(trim(category)) BETWEEN 1 AND 30",
        )


def downgrade() -> None:
    """Remove the optional ToDo category field."""
    with op.batch_alter_table("todos", schema=None) as batch_op:
        batch_op.drop_constraint(
            op.f("ck_todos_todo_category_length"),
            type_="check",
        )
        batch_op.drop_column("category")

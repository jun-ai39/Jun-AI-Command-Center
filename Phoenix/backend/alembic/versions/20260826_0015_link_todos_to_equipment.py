"""Link maintenance schedules to equipment.

Revision ID: 20260826_0015
Revises: 20260825_0014
Create Date: 2026-08-26
"""

import sqlalchemy as sa

from alembic import op

revision: str = "20260826_0015"
down_revision: str | None = "20260825_0014"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    """Add an optional equipment link while preserving every existing ToDo."""
    with op.batch_alter_table("todos") as batch_op:
        batch_op.add_column(sa.Column("equipment_id", sa.Uuid(), nullable=True))
        batch_op.create_foreign_key(
            op.f("fk_todos_equipment_id_equipment"),
            "equipment",
            ["equipment_id"],
            ["equipment_id"],
            ondelete="SET NULL",
        )
        batch_op.create_index(
            "ix_todos_equipment_id_due_date",
            ["equipment_id", "due_date"],
            unique=False,
        )


def downgrade() -> None:
    """Remove only the optional equipment link and keep all ToDo rows."""
    with op.batch_alter_table("todos") as batch_op:
        batch_op.drop_index("ix_todos_equipment_id_due_date")
        batch_op.drop_constraint(
            op.f("fk_todos_equipment_id_equipment"),
            type_="foreignkey",
        )
        batch_op.drop_column("equipment_id")

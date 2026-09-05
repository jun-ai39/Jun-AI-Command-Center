"""Link work reports to department and equipment masters.

Revision ID: 20260820_0009
Revises: 20260820_0008
Create Date: 2026-08-20
"""

import sqlalchemy as sa

from alembic import op

revision: str = "20260820_0009"
down_revision: str | None = "20260820_0008"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    """Add nullable master references so existing reports remain readable."""
    with op.batch_alter_table("work_reports") as batch_op:
        batch_op.add_column(sa.Column("department_id", sa.Uuid(), nullable=True))
        batch_op.add_column(sa.Column("equipment_id", sa.Uuid(), nullable=True))
        batch_op.create_foreign_key(
            op.f("fk_work_reports_department_id_departments"),
            "departments",
            ["department_id"],
            ["id"],
            ondelete="RESTRICT",
        )
        batch_op.create_foreign_key(
            op.f("fk_work_reports_equipment_id_equipment"),
            "equipment",
            ["equipment_id"],
            ["equipment_id"],
            ondelete="RESTRICT",
        )
        batch_op.create_index(
            "ix_work_reports_equipment_id_work_date",
            ["equipment_id", "work_date"],
            unique=False,
        )


def downgrade() -> None:
    """Remove master references without deleting work report rows."""
    with op.batch_alter_table("work_reports") as batch_op:
        batch_op.drop_index("ix_work_reports_equipment_id_work_date")
        batch_op.drop_constraint(
            op.f("fk_work_reports_equipment_id_equipment"),
            type_="foreignkey",
        )
        batch_op.drop_constraint(
            op.f("fk_work_reports_department_id_departments"),
            type_="foreignkey",
        )
        batch_op.drop_column("equipment_id")
        batch_op.drop_column("department_id")

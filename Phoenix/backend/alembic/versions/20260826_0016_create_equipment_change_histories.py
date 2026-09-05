"""Create equipment improvement and specification change histories.

Revision ID: 20260826_0016
Revises: 20260826_0015
Create Date: 2026-08-26
"""

import sqlalchemy as sa

from alembic import op

revision: str = "20260826_0016"
down_revision: str | None = "20260826_0015"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    """Create the independent equipment change history table."""
    op.create_table(
        "equipment_change_histories",
        sa.Column("change_history_id", sa.Uuid(), nullable=False),
        sa.Column("equipment_id", sa.Uuid(), nullable=False),
        sa.Column("changed_on", sa.Date(), nullable=False),
        sa.Column("improvement_point", sa.String(length=200), nullable=False),
        sa.Column("change_details", sa.Text(), nullable=False),
        sa.Column("work_report_id", sa.Uuid(), nullable=True),
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
            "length(trim(improvement_point)) BETWEEN 1 AND 200",
            name=op.f(
                "ck_equipment_change_histories_"
                "equipment_change_improvement_point_length"
            ),
        ),
        sa.CheckConstraint(
            "length(trim(change_details)) BETWEEN 1 AND 2000",
            name=op.f("ck_equipment_change_histories_equipment_change_details_length"),
        ),
        sa.ForeignKeyConstraint(
            ["equipment_id"],
            ["equipment.equipment_id"],
            name=op.f("fk_equipment_change_histories_equipment_id_equipment"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["work_report_id"],
            ["work_reports.id"],
            name=op.f("fk_equipment_change_histories_work_report_id_work_reports"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint(
            "change_history_id",
            name=op.f("pk_equipment_change_histories"),
        ),
    )
    op.create_index(
        "ix_equipment_change_histories_equipment_date",
        "equipment_change_histories",
        ["equipment_id", "changed_on"],
        unique=False,
    )


def downgrade() -> None:
    """Remove only the change histories and preserve equipment and work reports."""
    op.drop_index(
        "ix_equipment_change_histories_equipment_date",
        table_name="equipment_change_histories",
    )
    op.drop_table("equipment_change_histories")

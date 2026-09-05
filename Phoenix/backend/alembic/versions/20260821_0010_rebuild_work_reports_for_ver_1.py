"""Rebuild work reports around the Phoenix Ver.1.0 seven fields.

Revision ID: 20260821_0010
Revises: 20260820_0009
Create Date: 2026-08-21
"""

import sqlalchemy as sa

from alembic import op

revision: str = "20260821_0010"
down_revision: str | None = "20260820_0009"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    """Add phenomenon and cause while retaining every former report field."""
    with op.batch_alter_table("work_reports") as batch_op:
        batch_op.add_column(sa.Column("phenomenon", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("cause", sa.Text(), nullable=True))
        batch_op.alter_column(
            "category",
            existing_type=sa.String(length=20),
            nullable=True,
        )
        batch_op.alter_column(
            "work_hours",
            existing_type=sa.Numeric(precision=5, scale=2),
            nullable=True,
        )
        batch_op.create_check_constraint(
            op.f("ck_work_reports_work_report_phenomenon_length"),
            "phenomenon IS NULL OR length(trim(phenomenon)) BETWEEN 1 AND 2000",
        )
        batch_op.create_check_constraint(
            op.f("ck_work_reports_work_report_cause_length"),
            "cause IS NULL OR length(trim(cause)) BETWEEN 1 AND 2000",
        )


def downgrade() -> None:
    """Restore the former required fields without deleting newer report rows."""
    op.execute("UPDATE work_reports SET category = 'other' WHERE category IS NULL")
    op.execute("UPDATE work_reports SET work_hours = 0.25 WHERE work_hours IS NULL")
    with op.batch_alter_table("work_reports") as batch_op:
        batch_op.drop_constraint(
            op.f("ck_work_reports_work_report_cause_length"),
            type_="check",
        )
        batch_op.drop_constraint(
            op.f("ck_work_reports_work_report_phenomenon_length"),
            type_="check",
        )
        batch_op.alter_column(
            "work_hours",
            existing_type=sa.Numeric(precision=5, scale=2),
            nullable=False,
        )
        batch_op.alter_column(
            "category",
            existing_type=sa.String(length=20),
            nullable=False,
        )
        batch_op.drop_column("cause")
        batch_op.drop_column("phenomenon")

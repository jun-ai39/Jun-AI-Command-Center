"""Create the work reports table.

Revision ID: 20260816_0007
Revises: 20260812_0006
Create Date: 2026-08-16
"""

import sqlalchemy as sa

from alembic import op

revision: str = "20260816_0007"
down_revision: str | None = "20260812_0006"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    """Create the work report table and its future history index."""
    op.create_table(
        "work_reports",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("work_date", sa.Date(), nullable=False),
        sa.Column("category", sa.String(length=20), nullable=False),
        sa.Column("work_hours", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column("work_content", sa.Text(), nullable=False),
        sa.Column("result", sa.String(length=20), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
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
            "category IN ('inspection', 'maintenance', 'trouble', "
            "'improvement', 'other')",
            name=op.f("ck_work_reports_work_report_category_value"),
        ),
        sa.CheckConstraint(
            "work_hours BETWEEN 0.25 AND 24",
            name=op.f("ck_work_reports_work_report_hours_range"),
        ),
        sa.CheckConstraint(
            "CAST(ROUND(work_hours * 100) AS INTEGER) % 25 = 0",
            name=op.f("ck_work_reports_work_report_hours_quarter"),
        ),
        sa.CheckConstraint(
            "length(trim(work_content)) BETWEEN 1 AND 2000",
            name=op.f("ck_work_reports_work_report_content_length"),
        ),
        sa.CheckConstraint(
            "result IN ('completed', 'continued', 'follow_up')",
            name=op.f("ck_work_reports_work_report_result_value"),
        ),
        sa.CheckConstraint(
            "notes IS NULL OR length(trim(notes)) BETWEEN 1 AND 2000",
            name=op.f("ck_work_reports_work_report_notes_length"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_work_reports")),
    )
    op.create_index(
        "ix_work_reports_work_date_created_at",
        "work_reports",
        ["work_date", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    """Remove the work report table."""
    op.drop_index(
        "ix_work_reports_work_date_created_at",
        table_name="work_reports",
    )
    op.drop_table("work_reports")

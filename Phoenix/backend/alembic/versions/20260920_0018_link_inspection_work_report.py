"""Link abnormal inspections to one work report without backfilling old reports."""

import sqlalchemy as sa

from alembic import op

revision = "20260920_0018"
down_revision = "20260828_0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # SQLite can add a nullable REFERENCES column without rebuilding referenced tables.
    if op.get_bind().dialect.name == "sqlite":
        op.execute(
            "ALTER TABLE work_reports ADD COLUMN source_inspection_id CHAR(32) "
            "REFERENCES inspection_records(id) ON DELETE RESTRICT"
        )
    else:
        op.add_column(
            "work_reports",
            sa.Column(
                "source_inspection_id",
                sa.Uuid(),
                sa.ForeignKey(
                    "inspection_records.id",
                    name="fk_work_reports_source_inspection",
                    ondelete="RESTRICT",
                ),
                nullable=True,
            ),
        )
    op.create_index(
        "uq_work_reports_source_inspection_id",
        "work_reports",
        ["source_inspection_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_work_reports_source_inspection_id", table_name="work_reports")
    op.drop_column("work_reports", "source_inspection_id")

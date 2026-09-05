"""Add concise guide details to inspection item masters.

Revision ID: 20260824_0013
Revises: 20260821_0012
Create Date: 2026-08-24
"""

import sqlalchemy as sa

from alembic import op

revision: str = "20260824_0013"
down_revision: str | None = "20260821_0012"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    """Add optional instructions without changing existing inspection items."""
    op.add_column(
        "inspection_template_items",
        sa.Column("check_method", sa.String(length=300), nullable=True),
    )
    op.add_column(
        "inspection_template_items",
        sa.Column("caution_note", sa.String(length=300), nullable=True),
    )
    op.execute("""
        CREATE TRIGGER inspection_template_items_guide_length_insert
        BEFORE INSERT ON inspection_template_items
        WHEN (NEW.check_method IS NOT NULL AND
              length(trim(NEW.check_method)) NOT BETWEEN 1 AND 300)
          OR (NEW.caution_note IS NOT NULL AND
              length(trim(NEW.caution_note)) NOT BETWEEN 1 AND 300)
        BEGIN
          SELECT RAISE(ABORT, 'inspection guide text length is invalid');
        END
        """)
    op.execute("""
        CREATE TRIGGER inspection_template_items_guide_length_update
        BEFORE UPDATE OF check_method, caution_note ON inspection_template_items
        WHEN (NEW.check_method IS NOT NULL AND
              length(trim(NEW.check_method)) NOT BETWEEN 1 AND 300)
          OR (NEW.caution_note IS NOT NULL AND
              length(trim(NEW.caution_note)) NOT BETWEEN 1 AND 300)
        BEGIN
          SELECT RAISE(ABORT, 'inspection guide text length is invalid');
        END
        """)


def downgrade() -> None:
    """Remove guide details while preserving the inspection item masters."""
    op.execute("DROP TRIGGER inspection_template_items_guide_length_update")
    op.execute("DROP TRIGGER inspection_template_items_guide_length_insert")
    op.drop_column("inspection_template_items", "caution_note")
    op.drop_column("inspection_template_items", "check_method")

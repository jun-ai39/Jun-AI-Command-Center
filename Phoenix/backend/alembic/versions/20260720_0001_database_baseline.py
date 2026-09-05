"""Establish the Phoenix database migration baseline.

Revision ID: 20260720_0001
Revises:
Create Date: 2026-07-20
"""

revision: str = "20260720_0001"
down_revision: str | None = None
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    """Mark an empty database as the Phoenix migration baseline."""
    pass


def downgrade() -> None:
    """Return the database to its unversioned state."""
    pass

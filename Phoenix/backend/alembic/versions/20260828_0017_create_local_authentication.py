"""Create local users and revocable login sessions.

Revision ID: 20260828_0017
Revises: 20260826_0016
Create Date: 2026-08-28
"""

import sqlalchemy as sa

from alembic import op

revision: str = "20260828_0017"
down_revision: str | None = "20260826_0016"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    """Create local identities before any existing business API is protected."""
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("username", sa.String(length=50), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column(
            "role",
            sa.String(length=16),
            server_default="user",
            nullable=False,
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            server_default="1",
            nullable=False,
        ),
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
            "length(username) BETWEEN 3 AND 50",
            name=op.f("ck_users_user_username_length"),
        ),
        sa.CheckConstraint(
            "username = lower(trim(username))",
            name=op.f("ck_users_user_username_normalized"),
        ),
        sa.CheckConstraint(
            "role IN ('admin', 'user')",
            name=op.f("ck_users_user_role_allowed"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.UniqueConstraint("username", name="uq_users_username"),
    )
    op.create_table(
        "user_sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "length(token_hash) = 64",
            name=op.f("ck_user_sessions_user_session_token_hash_length"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_user_sessions_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_user_sessions")),
        sa.UniqueConstraint("token_hash", name="uq_user_sessions_token_hash"),
    )
    op.create_index(
        "ix_user_sessions_user_expiry",
        "user_sessions",
        ["user_id", "expires_at"],
        unique=False,
    )


def downgrade() -> None:
    """Remove only local authentication data and preserve Phoenix work records."""
    op.drop_index("ix_user_sessions_user_expiry", table_name="user_sessions")
    op.drop_table("user_sessions")
    op.drop_table("users")

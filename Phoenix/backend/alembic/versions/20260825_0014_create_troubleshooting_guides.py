"""Create equipment troubleshooting guide graphs.

Revision ID: 20260825_0014
Revises: 20260824_0013
Create Date: 2026-08-25
"""

import sqlalchemy as sa

from alembic import op

revision: str = "20260825_0014"
down_revision: str | None = "20260824_0013"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    """Create guide, step, and branch tables for validated graph storage."""
    op.create_table(
        "troubleshooting_guides",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("equipment_id", sa.Uuid(), nullable=False),
        sa.Column("symptom", sa.String(length=200), nullable=False),
        sa.Column("start_step_id", sa.Uuid(), nullable=True),
        sa.Column(
            "display_order",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            server_default=sa.true(),
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
            "length(trim(symptom)) BETWEEN 1 AND 200",
            name=op.f("ck_troubleshooting_guides_troubleshooting_guide_symptom_length"),
        ),
        sa.CheckConstraint(
            "display_order BETWEEN 0 AND 9999",
            name=op.f(
                "ck_troubleshooting_guides_" "troubleshooting_guide_display_order_range"
            ),
        ),
        sa.ForeignKeyConstraint(
            ["equipment_id"],
            ["equipment.equipment_id"],
            name=op.f("fk_troubleshooting_guides_equipment_id_equipment"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["start_step_id"],
            ["troubleshooting_steps.id"],
            name=op.f("fk_troubleshooting_guides_start_step_id_troubleshooting_steps"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_troubleshooting_guides")),
    )
    op.create_index(
        "ix_troubleshooting_guides_equipment_active_order",
        "troubleshooting_guides",
        ["equipment_id", "is_active", "display_order", "symptom"],
        unique=False,
    )

    op.create_table(
        "troubleshooting_steps",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("guide_id", sa.Uuid(), nullable=False),
        sa.Column("step_type", sa.String(length=10), nullable=False),
        sa.Column("prompt", sa.String(length=500), nullable=False),
        sa.Column("check_method", sa.String(length=500), nullable=True),
        sa.Column("caution_note", sa.String(length=500), nullable=True),
        sa.CheckConstraint(
            "step_type IN ('question', 'complete', 'handoff')",
            name=op.f("ck_troubleshooting_steps_troubleshooting_step_type_value"),
        ),
        sa.CheckConstraint(
            "length(trim(prompt)) BETWEEN 1 AND 500",
            name=op.f("ck_troubleshooting_steps_troubleshooting_step_prompt_length"),
        ),
        sa.CheckConstraint(
            "check_method IS NULL OR " "length(trim(check_method)) BETWEEN 1 AND 500",
            name=op.f(
                "ck_troubleshooting_steps_" "troubleshooting_step_check_method_length"
            ),
        ),
        sa.CheckConstraint(
            "caution_note IS NULL OR " "length(trim(caution_note)) BETWEEN 1 AND 500",
            name=op.f(
                "ck_troubleshooting_steps_" "troubleshooting_step_caution_note_length"
            ),
        ),
        sa.ForeignKeyConstraint(
            ["guide_id"],
            ["troubleshooting_guides.id"],
            name=op.f("fk_troubleshooting_steps_guide_id_troubleshooting_guides"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_troubleshooting_steps")),
    )
    op.create_index(
        "ix_troubleshooting_steps_guide_type",
        "troubleshooting_steps",
        ["guide_id", "step_type"],
        unique=False,
    )

    op.create_table(
        "troubleshooting_branches",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("guide_id", sa.Uuid(), nullable=False),
        sa.Column("from_step_id", sa.Uuid(), nullable=False),
        sa.Column("answer", sa.String(length=10), nullable=False),
        sa.Column("to_step_id", sa.Uuid(), nullable=False),
        sa.CheckConstraint(
            "answer IN ('yes', 'no', 'unknown')",
            name=op.f(
                "ck_troubleshooting_branches_troubleshooting_branch_answer_value"
            ),
        ),
        sa.ForeignKeyConstraint(
            ["guide_id"],
            ["troubleshooting_guides.id"],
            name=op.f("fk_troubleshooting_branches_guide_id_troubleshooting_guides"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["from_step_id"],
            ["troubleshooting_steps.id"],
            name=op.f("fk_troubleshooting_branches_from_step_id_troubleshooting_steps"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["to_step_id"],
            ["troubleshooting_steps.id"],
            name=op.f("fk_troubleshooting_branches_to_step_id_troubleshooting_steps"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_troubleshooting_branches")),
        sa.UniqueConstraint(
            "from_step_id",
            "answer",
            name="uq_troubleshooting_branches_from_step_answer",
        ),
    )
    op.create_index(
        "ix_troubleshooting_branches_guide_from",
        "troubleshooting_branches",
        ["guide_id", "from_step_id"],
        unique=False,
    )


def downgrade() -> None:
    """Remove troubleshooting graphs while preserving equipment and records."""
    op.drop_index(
        "ix_troubleshooting_branches_guide_from",
        table_name="troubleshooting_branches",
    )
    op.drop_table("troubleshooting_branches")
    with op.batch_alter_table("troubleshooting_guides") as batch_op:
        batch_op.drop_constraint(
            "fk_troubleshooting_guides_start_step_id_troubleshooting_steps",
            type_="foreignkey",
        )
    op.drop_index(
        "ix_troubleshooting_steps_guide_type",
        table_name="troubleshooting_steps",
    )
    op.drop_table("troubleshooting_steps")
    op.drop_index(
        "ix_troubleshooting_guides_equipment_active_order",
        table_name="troubleshooting_guides",
    )
    op.drop_table("troubleshooting_guides")

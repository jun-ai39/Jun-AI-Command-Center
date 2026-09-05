"""Create equipment-specific inspection item masters.

Revision ID: 20260821_0011
Revises: 20260821_0010
Create Date: 2026-08-21
"""

import sqlalchemy as sa

from alembic import op

revision: str = "20260821_0011"
down_revision: str | None = "20260821_0010"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    """Create the structured equipment inspection item master table."""
    op.create_table(
        "inspection_template_items",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("equipment_id", sa.Uuid(), nullable=False),
        sa.Column("cycle", sa.String(length=10), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("input_type", sa.String(length=10), nullable=False),
        sa.Column("unit", sa.String(length=30), nullable=True),
        sa.Column("normal_min", sa.Numeric(precision=12, scale=3), nullable=True),
        sa.Column("normal_max", sa.Numeric(precision=12, scale=3), nullable=True),
        sa.Column("normal_state", sa.String(length=100), nullable=True),
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
            "cycle IN ('daily', 'weekly', 'monthly')",
            name=op.f(
                "ck_inspection_template_items_inspection_template_item_cycle_value"
            ),
        ),
        sa.CheckConstraint(
            "length(trim(name)) BETWEEN 1 AND 100",
            name=op.f(
                "ck_inspection_template_items_inspection_template_item_name_length"
            ),
        ),
        sa.CheckConstraint(
            "input_type IN ('number', 'status')",
            name=op.f(
                "ck_inspection_template_items_inspection_template_item_input_type_value"
            ),
        ),
        sa.CheckConstraint(
            "unit IS NULL OR length(trim(unit)) BETWEEN 1 AND 30",
            name=op.f(
                "ck_inspection_template_items_inspection_template_item_unit_length"
            ),
        ),
        sa.CheckConstraint(
            "normal_state IS NULL OR " "length(trim(normal_state)) BETWEEN 1 AND 100",
            name=op.f(
                "ck_inspection_template_items_inspection_template_item_normal_state_length"
            ),
        ),
        sa.CheckConstraint(
            "(input_type = 'number' AND normal_min IS NOT NULL AND "
            "normal_max IS NOT NULL AND normal_min <= normal_max AND "
            "normal_state IS NULL) OR "
            "(input_type = 'status' AND normal_min IS NULL AND "
            "normal_max IS NULL AND unit IS NULL AND normal_state IS NOT NULL)",
            name=op.f(
                "ck_inspection_template_items_inspection_template_item_normal_rule"
            ),
        ),
        sa.CheckConstraint(
            "display_order BETWEEN 0 AND 9999",
            name=op.f(
                "ck_inspection_template_items_inspection_template_item_display_order_range"
            ),
        ),
        sa.ForeignKeyConstraint(
            ["equipment_id"],
            ["equipment.equipment_id"],
            name=op.f("fk_inspection_template_items_equipment_id_equipment"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "id",
            name=op.f("pk_inspection_template_items"),
        ),
        sa.UniqueConstraint(
            "equipment_id",
            "cycle",
            "name",
            name="uq_inspection_template_items_equipment_cycle_name",
        ),
    )
    op.create_index(
        "ix_inspection_template_items_equipment_cycle_active_order",
        "inspection_template_items",
        ["equipment_id", "cycle", "is_active", "display_order", "name"],
        unique=False,
    )


def downgrade() -> None:
    """Remove only inspection item masters and preserve all earlier data."""
    op.drop_index(
        "ix_inspection_template_items_equipment_cycle_active_order",
        table_name="inspection_template_items",
    )
    op.drop_table("inspection_template_items")

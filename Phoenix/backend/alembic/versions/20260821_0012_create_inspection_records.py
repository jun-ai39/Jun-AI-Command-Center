"""Create structured equipment inspection records.

Revision ID: 20260821_0012
Revises: 20260821_0011
Create Date: 2026-08-21
"""

import sqlalchemy as sa

from alembic import op

revision: str = "20260821_0012"
down_revision: str | None = "20260821_0011"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    """Create inspection headers and immutable measured item snapshots."""
    op.create_table(
        "inspection_records",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("inspection_date", sa.Date(), nullable=False),
        sa.Column("equipment_id", sa.Uuid(), nullable=False),
        sa.Column("cycle", sa.String(length=10), nullable=False),
        sa.Column("period_key", sa.String(length=10), nullable=False),
        sa.Column("overall_judgment", sa.String(length=10), nullable=False),
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
            name=op.f("ck_inspection_records_inspection_record_cycle_value"),
        ),
        sa.CheckConstraint(
            "(cycle = 'daily' AND length(period_key) = 10) OR "
            "(cycle = 'weekly' AND length(period_key) = 8) OR "
            "(cycle = 'monthly' AND length(period_key) = 7)",
            name=op.f("ck_inspection_records_inspection_record_period_key_shape"),
        ),
        sa.CheckConstraint(
            "overall_judgment IN ('normal', 'abnormal')",
            name=op.f("ck_inspection_records_inspection_record_overall_judgment_value"),
        ),
        sa.ForeignKeyConstraint(
            ["equipment_id"],
            ["equipment.equipment_id"],
            name=op.f("fk_inspection_records_equipment_id_equipment"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_inspection_records")),
        sa.UniqueConstraint(
            "equipment_id",
            "cycle",
            "period_key",
            name="uq_inspection_records_equipment_cycle_period",
        ),
    )
    op.create_index(
        "ix_inspection_records_equipment_cycle_date",
        "inspection_records",
        ["equipment_id", "cycle", "inspection_date"],
        unique=False,
    )

    op.create_table(
        "inspection_record_items",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("inspection_record_id", sa.Uuid(), nullable=False),
        sa.Column("template_item_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("input_type", sa.String(length=10), nullable=False),
        sa.Column("number_value", sa.Numeric(precision=12, scale=3), nullable=True),
        sa.Column("status_value", sa.String(length=10), nullable=True),
        sa.Column("unit", sa.String(length=30), nullable=True),
        sa.Column("normal_min", sa.Numeric(precision=12, scale=3), nullable=True),
        sa.Column("normal_max", sa.Numeric(precision=12, scale=3), nullable=True),
        sa.Column("normal_state", sa.String(length=100), nullable=True),
        sa.Column("judgment", sa.String(length=10), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False),
        sa.CheckConstraint(
            "length(trim(name)) BETWEEN 1 AND 100",
            name=op.f("ck_inspection_record_items_inspection_record_item_name_length"),
        ),
        sa.CheckConstraint(
            "input_type IN ('number', 'status')",
            name=op.f(
                "ck_inspection_record_items_inspection_record_item_input_type_value"
            ),
        ),
        sa.CheckConstraint(
            "unit IS NULL OR length(trim(unit)) BETWEEN 1 AND 30",
            name=op.f("ck_inspection_record_items_inspection_record_item_unit_length"),
        ),
        sa.CheckConstraint(
            "normal_state IS NULL OR " "length(trim(normal_state)) BETWEEN 1 AND 100",
            name=op.f(
                "ck_inspection_record_items_inspection_record_item_normal_state_length"
            ),
        ),
        sa.CheckConstraint(
            "judgment IN ('normal', 'abnormal')",
            name=op.f(
                "ck_inspection_record_items_inspection_record_item_judgment_value"
            ),
        ),
        sa.CheckConstraint(
            "(input_type = 'number' AND number_value IS NOT NULL AND "
            "status_value IS NULL AND normal_min IS NOT NULL AND "
            "normal_max IS NOT NULL AND normal_min <= normal_max AND "
            "normal_state IS NULL) OR "
            "(input_type = 'status' AND number_value IS NULL AND "
            "status_value IN ('normal', 'abnormal') AND unit IS NULL AND "
            "normal_min IS NULL AND normal_max IS NULL AND "
            "normal_state IS NOT NULL)",
            name=op.f("ck_inspection_record_items_inspection_record_item_value_rule"),
        ),
        sa.CheckConstraint(
            "(input_type = 'number' AND "
            "((number_value BETWEEN normal_min AND normal_max AND "
            "judgment = 'normal') OR "
            "((number_value < normal_min OR number_value > normal_max) AND "
            "judgment = 'abnormal'))) OR "
            "(input_type = 'status' AND judgment = status_value)",
            name=op.f(
                "ck_inspection_record_items_inspection_record_item_judgment_rule"
            ),
        ),
        sa.CheckConstraint(
            "display_order BETWEEN 0 AND 9999",
            name=op.f(
                "ck_inspection_record_items_inspection_record_item_display_order_range"
            ),
        ),
        sa.ForeignKeyConstraint(
            ["inspection_record_id"],
            ["inspection_records.id"],
            name=op.f(
                "fk_inspection_record_items_inspection_record_id_inspection_records"
            ),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["template_item_id"],
            ["inspection_template_items.id"],
            name=op.f(
                "fk_inspection_record_items_template_item_id_inspection_template_items"
            ),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint(
            "id",
            name=op.f("pk_inspection_record_items"),
        ),
        sa.UniqueConstraint(
            "inspection_record_id",
            "template_item_id",
            name="uq_inspection_record_items_record_template",
        ),
    )
    op.create_index(
        "ix_inspection_record_items_record_order",
        "inspection_record_items",
        ["inspection_record_id", "display_order", "name"],
        unique=False,
    )


def downgrade() -> None:
    """Remove inspection records without changing template or earlier data."""
    op.drop_index(
        "ix_inspection_record_items_record_order",
        table_name="inspection_record_items",
    )
    op.drop_table("inspection_record_items")
    op.drop_index(
        "ix_inspection_records_equipment_cycle_date",
        table_name="inspection_records",
    )
    op.drop_table("inspection_records")

"""Create the equipment master tables.

Revision ID: 20260820_0008
Revises: 20260816_0007
Create Date: 2026-08-20
"""

from uuid import UUID

import sqlalchemy as sa

from alembic import op

revision: str = "20260820_0008"
down_revision: str | None = "20260816_0007"
branch_labels: str | None = None
depends_on: str | None = None

INITIAL_DEPARTMENTS: tuple[tuple[str, str, int], ...] = (
    ("10000000-0000-4000-8000-000000000001", "菓子パン", 10),
    ("10000000-0000-4000-8000-000000000002", "食パン", 20),
    ("10000000-0000-4000-8000-000000000003", "菓子", 30),
    ("10000000-0000-4000-8000-000000000004", "セントラル", 40),
    ("10000000-0000-4000-8000-000000000005", "物流", 50),
    ("10000000-0000-4000-8000-000000000006", "その他", 60),
)


def upgrade() -> None:
    """Create equipment masters and seed configurable initial departments."""
    op.create_table(
        "departments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
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
            "length(trim(name)) BETWEEN 1 AND 50",
            name=op.f("ck_departments_department_name_length"),
        ),
        sa.CheckConstraint(
            "display_order >= 0",
            name=op.f("ck_departments_department_display_order_nonnegative"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_departments")),
        sa.UniqueConstraint("name", name=op.f("uq_departments_name")),
    )
    op.create_index(
        "ix_departments_is_active_display_order_name",
        "departments",
        ["is_active", "display_order", "name"],
        unique=False,
    )

    op.create_table(
        "manufacturers",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
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
            "length(trim(name)) BETWEEN 1 AND 100",
            name=op.f("ck_manufacturers_manufacturer_name_length"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_manufacturers")),
        sa.UniqueConstraint("name", name=op.f("uq_manufacturers_name")),
    )
    op.create_index(
        "ix_manufacturers_is_active_name",
        "manufacturers",
        ["is_active", "name"],
        unique=False,
    )

    op.create_table(
        "equipment",
        sa.Column("equipment_id", sa.Uuid(), nullable=False),
        sa.Column("department_id", sa.Uuid(), nullable=False),
        sa.Column("manufacturer_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("equipment_number", sa.String(length=100), nullable=True),
        sa.Column("model_number", sa.String(length=100), nullable=True),
        sa.Column("photo_path", sa.String(length=500), nullable=True),
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
            "length(trim(name)) BETWEEN 1 AND 100",
            name=op.f("ck_equipment_equipment_name_length"),
        ),
        sa.CheckConstraint(
            "equipment_number IS NULL OR "
            "length(trim(equipment_number)) BETWEEN 1 AND 100",
            name=op.f("ck_equipment_equipment_number_length"),
        ),
        sa.CheckConstraint(
            "model_number IS NULL OR " "length(trim(model_number)) BETWEEN 1 AND 100",
            name=op.f("ck_equipment_equipment_model_number_length"),
        ),
        sa.CheckConstraint(
            "photo_path IS NULL OR length(trim(photo_path)) BETWEEN 1 AND 500",
            name=op.f("ck_equipment_equipment_photo_path_length"),
        ),
        sa.ForeignKeyConstraint(
            ["department_id"],
            ["departments.id"],
            name=op.f("fk_equipment_department_id_departments"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["manufacturer_id"],
            ["manufacturers.id"],
            name=op.f("fk_equipment_manufacturer_id_manufacturers"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("equipment_id", name=op.f("pk_equipment")),
    )
    op.create_index(
        "ix_equipment_department_id_manufacturer_id_name",
        "equipment",
        ["department_id", "manufacturer_id", "name"],
        unique=False,
    )
    op.create_index(
        "ix_equipment_is_active_name_model_number",
        "equipment",
        ["is_active", "name", "model_number"],
        unique=False,
    )

    department_table = sa.table(
        "departments",
        sa.column("id", sa.Uuid()),
        sa.column("name", sa.String()),
        sa.column("display_order", sa.Integer()),
        sa.column("is_active", sa.Boolean()),
    )
    op.bulk_insert(
        department_table,
        [
            {
                "id": UUID(identifier),
                "name": name,
                "display_order": display_order,
                "is_active": True,
            }
            for identifier, name, display_order in INITIAL_DEPARTMENTS
        ],
    )


def downgrade() -> None:
    """Remove equipment masters without affecting earlier Phoenix tables."""
    op.drop_index(
        "ix_equipment_is_active_name_model_number",
        table_name="equipment",
    )
    op.drop_index(
        "ix_equipment_department_id_manufacturer_id_name",
        table_name="equipment",
    )
    op.drop_table("equipment")
    op.drop_index(
        "ix_manufacturers_is_active_name",
        table_name="manufacturers",
    )
    op.drop_table("manufacturers")
    op.drop_index(
        "ix_departments_is_active_display_order_name",
        table_name="departments",
    )
    op.drop_table("departments")

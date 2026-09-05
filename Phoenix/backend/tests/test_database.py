"""Tests for the SQLAlchemy and Alembic database foundation."""

from pathlib import Path
from typing import Final

import pytest
from alembic.config import Config
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError

from alembic import command
from app.core.config import (
    DEFAULT_DATABASE_PATH,
    DEFAULT_DATABASE_URL,
    get_database_url,
)
from app.db.session import create_database_engine, create_session_factory

BACKEND_ROOT: Final[Path] = Path(__file__).resolve().parents[1]
HEAD_REVISION: Final[str] = "20260828_0017"


def sqlite_url(database_path: Path) -> str:
    """Build a SQLAlchemy SQLite URL for a temporary test database."""
    return f"sqlite:///{database_path.as_posix()}"


def test_default_database_uses_local_sqlite(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The zero-cost default should stay inside the private database folder."""
    monkeypatch.delenv("PHOENIX_DATABASE_URL", raising=False)

    assert get_database_url() == DEFAULT_DATABASE_URL
    assert DEFAULT_DATABASE_PATH.parent.name == "database"
    assert DEFAULT_DATABASE_PATH.suffix == ".sqlite3"


def test_sqlalchemy_session_executes_query(tmp_path: Path) -> None:
    """A session should connect to an isolated SQLite database."""
    database_engine = create_database_engine(
        sqlite_url(tmp_path / "session-test.sqlite3")
    )
    session_factory = create_session_factory(database_engine)

    try:
        with session_factory() as session:
            assert session.scalar(text("SELECT 1")) == 1
    finally:
        database_engine.dispose()


def test_sqlite_foreign_key_checks_are_enabled(tmp_path: Path) -> None:
    """Every SQLite connection should enforce future relationships."""
    database_engine = create_database_engine(
        sqlite_url(tmp_path / "foreign-key-test.sqlite3")
    )

    try:
        with database_engine.connect() as connection:
            assert connection.scalar(text("PRAGMA foreign_keys")) == 1
    finally:
        database_engine.dispose()


def test_alembic_upgrade_reaches_head(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A clean database should migrate reproducibly to the tracked head."""
    database_url = sqlite_url(tmp_path / "migration-test.sqlite3")
    monkeypatch.setenv("PHOENIX_DATABASE_URL", database_url)
    alembic_config = Config(str(BACKEND_ROOT / "alembic.ini"))

    command.upgrade(alembic_config, "head")

    database_engine = create_database_engine(database_url)
    try:
        database_inspector = inspect(database_engine)
        assert "alembic_version" in database_inspector.get_table_names()
        assert "todos" in database_inspector.get_table_names()
        assert "work_reports" in database_inspector.get_table_names()
        assert "departments" in database_inspector.get_table_names()
        assert "manufacturers" in database_inspector.get_table_names()
        assert "equipment" in database_inspector.get_table_names()
        assert "inspection_template_items" in database_inspector.get_table_names()
        assert "inspection_records" in database_inspector.get_table_names()
        assert "inspection_record_items" in database_inspector.get_table_names()
        assert "troubleshooting_guides" in database_inspector.get_table_names()
        assert "troubleshooting_steps" in database_inspector.get_table_names()
        assert "troubleshooting_branches" in database_inspector.get_table_names()
        assert "equipment_change_histories" in database_inspector.get_table_names()
        assert "users" in database_inspector.get_table_names()
        assert "user_sessions" in database_inspector.get_table_names()
        assert {
            column["name"] for column in database_inspector.get_columns("todos")
        } == {
            "id",
            "title",
            "description",
            "due_date",
            "priority",
            "category",
            "equipment_id",
            "is_pinned",
            "is_completed",
            "is_archived",
            "created_at",
            "updated_at",
        }
        assert {index["name"] for index in database_inspector.get_indexes("todos")} == {
            "ix_todos_equipment_id_due_date",
            "ix_todos_is_archived_is_pinned_is_completed_due_date",
        }
        assert {
            column["name"] for column in database_inspector.get_columns("work_reports")
        } == {
            "id",
            "work_date",
            "department_id",
            "equipment_id",
            "category",
            "work_hours",
            "phenomenon",
            "cause",
            "work_content",
            "result",
            "notes",
            "created_at",
            "updated_at",
        }
        assert {
            index["name"] for index in database_inspector.get_indexes("work_reports")
        } == {
            "ix_work_reports_equipment_id_work_date",
            "ix_work_reports_work_date_created_at",
        }
        assert {
            column["name"] for column in database_inspector.get_columns("departments")
        } == {
            "id",
            "name",
            "display_order",
            "is_active",
            "created_at",
            "updated_at",
        }
        assert {
            column["name"] for column in database_inspector.get_columns("manufacturers")
        } == {
            "id",
            "name",
            "is_active",
            "created_at",
            "updated_at",
        }
        assert {
            column["name"] for column in database_inspector.get_columns("equipment")
        } == {
            "equipment_id",
            "department_id",
            "manufacturer_id",
            "name",
            "equipment_number",
            "model_number",
            "photo_path",
            "is_active",
            "created_at",
            "updated_at",
        }
        assert {
            column["name"]
            for column in database_inspector.get_columns("inspection_template_items")
        } == {
            "id",
            "equipment_id",
            "cycle",
            "name",
            "input_type",
            "unit",
            "normal_min",
            "normal_max",
            "normal_state",
            "check_method",
            "caution_note",
            "display_order",
            "is_active",
            "created_at",
            "updated_at",
        }
        assert {
            index["name"]
            for index in database_inspector.get_indexes("inspection_template_items")
        } == {"ix_inspection_template_items_equipment_cycle_active_order"}
        assert {
            column["name"]
            for column in database_inspector.get_columns("inspection_records")
        } == {
            "id",
            "inspection_date",
            "equipment_id",
            "cycle",
            "period_key",
            "overall_judgment",
            "created_at",
            "updated_at",
        }
        assert {
            column["name"]
            for column in database_inspector.get_columns("inspection_record_items")
        } == {
            "id",
            "inspection_record_id",
            "template_item_id",
            "name",
            "input_type",
            "number_value",
            "status_value",
            "unit",
            "normal_min",
            "normal_max",
            "normal_state",
            "judgment",
            "display_order",
        }
        assert {
            index["name"]
            for index in database_inspector.get_indexes("inspection_records")
        } == {"ix_inspection_records_equipment_cycle_date"}
        assert {
            index["name"]
            for index in database_inspector.get_indexes("inspection_record_items")
        } == {"ix_inspection_record_items_record_order"}
        assert {
            column["name"]
            for column in database_inspector.get_columns("troubleshooting_guides")
        } == {
            "id",
            "equipment_id",
            "symptom",
            "start_step_id",
            "display_order",
            "is_active",
            "created_at",
            "updated_at",
        }
        assert {
            column["name"]
            for column in database_inspector.get_columns("troubleshooting_steps")
        } == {
            "id",
            "guide_id",
            "step_type",
            "prompt",
            "check_method",
            "caution_note",
        }
        assert {
            column["name"]
            for column in database_inspector.get_columns("troubleshooting_branches")
        } == {
            "id",
            "guide_id",
            "from_step_id",
            "answer",
            "to_step_id",
        }
        assert {
            index["name"]
            for index in database_inspector.get_indexes("troubleshooting_guides")
        } == {"ix_troubleshooting_guides_equipment_active_order"}
        assert {
            index["name"]
            for index in database_inspector.get_indexes("troubleshooting_steps")
        } == {"ix_troubleshooting_steps_guide_type"}
        assert {
            index["name"]
            for index in database_inspector.get_indexes("troubleshooting_branches")
        } == {"ix_troubleshooting_branches_guide_from"}
        assert {
            column["name"]
            for column in database_inspector.get_columns("equipment_change_histories")
        } == {
            "change_history_id",
            "equipment_id",
            "changed_on",
            "improvement_point",
            "change_details",
            "work_report_id",
            "created_at",
            "updated_at",
        }
        assert {
            index["name"]
            for index in database_inspector.get_indexes("equipment_change_histories")
        } == {"ix_equipment_change_histories_equipment_date"}
        assert {
            column["name"] for column in database_inspector.get_columns("users")
        } == {
            "id",
            "username",
            "password_hash",
            "role",
            "is_active",
            "created_at",
            "updated_at",
        }
        assert {
            column["name"] for column in database_inspector.get_columns("user_sessions")
        } == {
            "id",
            "user_id",
            "token_hash",
            "expires_at",
            "created_at",
        }
        assert {
            index["name"] for index in database_inspector.get_indexes("user_sessions")
        } == {"ix_user_sessions_user_expiry"}
        with database_engine.connect() as connection:
            initial_departments = connection.execute(
                text("SELECT name FROM departments ORDER BY display_order")
            ).scalars()
            assert list(initial_departments) == [
                "菓子パン",
                "食パン",
                "菓子",
                "セントラル",
                "物流",
                "その他",
            ]
            assert (
                connection.scalar(text("SELECT version_num FROM alembic_version"))
                == HEAD_REVISION
            )
    finally:
        database_engine.dispose()


def test_inspection_template_migration_can_downgrade_and_upgrade(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Inspection masters should round-trip without changing earlier tables."""
    database_url = sqlite_url(tmp_path / "inspection-template-migration.sqlite3")
    monkeypatch.setenv("PHOENIX_DATABASE_URL", database_url)
    alembic_config = Config(str(BACKEND_ROOT / "alembic.ini"))

    command.upgrade(alembic_config, "20260821_0011")
    upgraded_engine = create_database_engine(database_url)
    try:
        assert "inspection_template_items" in inspect(upgraded_engine).get_table_names()
    finally:
        upgraded_engine.dispose()

    command.downgrade(alembic_config, "-1")
    downgraded_engine = create_database_engine(database_url)
    try:
        downgraded_tables = inspect(downgraded_engine).get_table_names()
        assert "inspection_template_items" not in downgraded_tables
        assert "equipment" in downgraded_tables
        assert "work_reports" in downgraded_tables
    finally:
        downgraded_engine.dispose()

    command.upgrade(alembic_config, "head")
    restored_engine = create_database_engine(database_url)
    try:
        assert "inspection_template_items" in inspect(restored_engine).get_table_names()
    finally:
        restored_engine.dispose()


def test_inspection_record_migration_can_downgrade_and_upgrade(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Inspection records should round-trip without removing item masters."""
    database_url = sqlite_url(tmp_path / "inspection-record-migration.sqlite3")
    monkeypatch.setenv("PHOENIX_DATABASE_URL", database_url)
    alembic_config = Config(str(BACKEND_ROOT / "alembic.ini"))

    command.upgrade(alembic_config, "20260821_0012")
    upgraded_engine = create_database_engine(database_url)
    try:
        upgraded_tables = inspect(upgraded_engine).get_table_names()
        assert "inspection_records" in upgraded_tables
        assert "inspection_record_items" in upgraded_tables
    finally:
        upgraded_engine.dispose()

    command.downgrade(alembic_config, "-1")
    downgraded_engine = create_database_engine(database_url)
    try:
        downgraded_tables = inspect(downgraded_engine).get_table_names()
        assert "inspection_records" not in downgraded_tables
        assert "inspection_record_items" not in downgraded_tables
        assert "inspection_template_items" in downgraded_tables
    finally:
        downgraded_engine.dispose()

    command.upgrade(alembic_config, "head")
    restored_engine = create_database_engine(database_url)
    try:
        restored_tables = inspect(restored_engine).get_table_names()
        assert "inspection_records" in restored_tables
        assert "inspection_record_items" in restored_tables
    finally:
        restored_engine.dispose()


def test_inspection_guide_migration_preserves_existing_records(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Guide columns should round-trip without losing linked inspection data."""
    database_url = sqlite_url(tmp_path / "inspection-guide-migration.sqlite3")
    monkeypatch.setenv("PHOENIX_DATABASE_URL", database_url)
    alembic_config = Config(str(BACKEND_ROOT / "alembic.ini"))

    command.upgrade(alembic_config, "20260821_0012")
    existing_engine = create_database_engine(database_url)
    try:
        with existing_engine.begin() as connection:
            department_id = connection.scalar(
                text("SELECT id FROM departments LIMIT 1")
            )
            assert department_id is not None
            connection.execute(
                text("INSERT INTO manufacturers (id, name) " "VALUES (:id, :name)"),
                {"id": "20000000000040008000000000000001", "name": "架空メーカー"},
            )
            connection.execute(
                text(
                    "INSERT INTO equipment "
                    "(equipment_id, department_id, manufacturer_id, name) "
                    "VALUES (:id, :department_id, :manufacturer_id, :name)"
                ),
                {
                    "id": "30000000000040008000000000000001",
                    "department_id": department_id,
                    "manufacturer_id": "20000000000040008000000000000001",
                    "name": "架空包装機",
                },
            )
            connection.execute(
                text(
                    "INSERT INTO inspection_template_items "
                    "(id, equipment_id, cycle, name, input_type, unit, "
                    "normal_min, normal_max, normal_state) "
                    "VALUES (:id, :equipment_id, 'daily', :name, 'number', "
                    "'A', 10, 15, NULL)"
                ),
                {
                    "id": "40000000000040008000000000000001",
                    "equipment_id": "30000000000040008000000000000001",
                    "name": "モーター電流",
                },
            )
            connection.execute(
                text(
                    "INSERT INTO inspection_records "
                    "(id, inspection_date, equipment_id, cycle, period_key, "
                    "overall_judgment) VALUES (:id, '2026-08-24', "
                    ":equipment_id, 'daily', '2026-08-24', 'normal')"
                ),
                {
                    "id": "50000000000040008000000000000001",
                    "equipment_id": "30000000000040008000000000000001",
                },
            )
            connection.execute(
                text(
                    "INSERT INTO inspection_record_items "
                    "(id, inspection_record_id, template_item_id, name, "
                    "input_type, number_value, status_value, unit, normal_min, "
                    "normal_max, normal_state, judgment, display_order) "
                    "VALUES (:id, :record_id, :template_id, :name, 'number', "
                    "12.4, NULL, 'A', 10, 15, NULL, 'normal', 10)"
                ),
                {
                    "id": "60000000000040008000000000000001",
                    "record_id": "50000000000040008000000000000001",
                    "template_id": "40000000000040008000000000000001",
                    "name": "モーター電流",
                },
            )
    finally:
        existing_engine.dispose()

    command.upgrade(alembic_config, "head")
    upgraded_engine = create_database_engine(database_url)
    try:
        with upgraded_engine.connect() as connection:
            row = connection.execute(
                text(
                    "SELECT name, check_method, caution_note "
                    "FROM inspection_template_items"
                )
            ).one()
            assert tuple(row) == ("モーター電流", None, None)
            assert (
                connection.scalar(text("SELECT count(*) FROM inspection_records")) == 1
            )
            assert (
                connection.scalar(text("SELECT count(*) FROM inspection_record_items"))
                == 1
            )
        with upgraded_engine.begin() as connection:
            with pytest.raises(IntegrityError):
                connection.execute(
                    text("UPDATE inspection_template_items " "SET check_method = '   '")
                )
    finally:
        upgraded_engine.dispose()

    command.downgrade(alembic_config, "20260821_0012")
    downgraded_engine = create_database_engine(database_url)
    try:
        column_names = {
            column["name"]
            for column in inspect(downgraded_engine).get_columns(
                "inspection_template_items"
            )
        }
        assert "check_method" not in column_names
        assert "caution_note" not in column_names
        with downgraded_engine.connect() as connection:
            assert (
                connection.scalar(
                    text("SELECT count(*) FROM inspection_template_items")
                )
                == 1
            )
            assert (
                connection.scalar(text("SELECT count(*) FROM inspection_records")) == 1
            )
    finally:
        downgraded_engine.dispose()

    command.upgrade(alembic_config, "head")


def test_work_report_migration_can_downgrade_and_upgrade(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The work report table should be removable and reproducible in isolation."""
    database_url = sqlite_url(tmp_path / "work-report-migration.sqlite3")
    monkeypatch.setenv("PHOENIX_DATABASE_URL", database_url)
    alembic_config = Config(str(BACKEND_ROOT / "alembic.ini"))

    command.upgrade(alembic_config, "20260816_0007")
    upgraded_engine = create_database_engine(database_url)
    try:
        assert "work_reports" in inspect(upgraded_engine).get_table_names()
    finally:
        upgraded_engine.dispose()

    command.downgrade(alembic_config, "-1")
    downgraded_engine = create_database_engine(database_url)
    try:
        downgraded_tables = inspect(downgraded_engine).get_table_names()
        assert "work_reports" not in downgraded_tables
        assert "todos" in downgraded_tables
    finally:
        downgraded_engine.dispose()

    command.upgrade(alembic_config, "head")
    restored_engine = create_database_engine(database_url)
    try:
        assert "work_reports" in inspect(restored_engine).get_table_names()
    finally:
        restored_engine.dispose()


def test_troubleshooting_migration_can_downgrade_and_upgrade(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Troubleshooting graphs should round-trip without removing equipment."""
    database_url = sqlite_url(tmp_path / "troubleshooting-migration.sqlite3")
    monkeypatch.setenv("PHOENIX_DATABASE_URL", database_url)
    alembic_config = Config(str(BACKEND_ROOT / "alembic.ini"))

    command.upgrade(alembic_config, "20260825_0014")
    upgraded_engine = create_database_engine(database_url)
    try:
        upgraded_tables = inspect(upgraded_engine).get_table_names()
        assert "troubleshooting_guides" in upgraded_tables
        assert "troubleshooting_steps" in upgraded_tables
        assert "troubleshooting_branches" in upgraded_tables
        with upgraded_engine.begin() as connection:
            department_id = connection.scalar(
                text("SELECT id FROM departments LIMIT 1")
            )
            assert department_id is not None
            connection.execute(
                text("INSERT INTO manufacturers (id, name) VALUES (:id, :name)"),
                {
                    "id": "71000000000040008000000000000001",
                    "name": "架空トラブルガイドメーカー",
                },
            )
            connection.execute(
                text(
                    "INSERT INTO equipment "
                    "(equipment_id, department_id, manufacturer_id, name) "
                    "VALUES (:id, :department_id, :manufacturer_id, :name)"
                ),
                {
                    "id": "72000000000040008000000000000001",
                    "department_id": department_id,
                    "manufacturer_id": "71000000000040008000000000000001",
                    "name": "架空コンベアー",
                },
            )
            connection.execute(
                text(
                    "INSERT INTO troubleshooting_guides "
                    "(id, equipment_id, symptom, start_step_id) "
                    "VALUES (:id, :equipment_id, :symptom, NULL)"
                ),
                {
                    "id": "73000000000040008000000000000001",
                    "equipment_id": "72000000000040008000000000000001",
                    "symptom": "架空の症状",
                },
            )
            connection.execute(
                text(
                    "INSERT INTO troubleshooting_steps "
                    "(id, guide_id, step_type, prompt) "
                    "VALUES (:id, :guide_id, 'handoff', :prompt)"
                ),
                {
                    "id": "74000000000040008000000000000001",
                    "guide_id": "73000000000040008000000000000001",
                    "prompt": "経験者へ引き継ぐ",
                },
            )
            connection.execute(
                text(
                    "UPDATE troubleshooting_guides SET start_step_id = :step_id "
                    "WHERE id = :guide_id"
                ),
                {
                    "step_id": "74000000000040008000000000000001",
                    "guide_id": "73000000000040008000000000000001",
                },
            )
    finally:
        upgraded_engine.dispose()

    command.downgrade(alembic_config, "-1")
    downgraded_engine = create_database_engine(database_url)
    try:
        downgraded_tables = inspect(downgraded_engine).get_table_names()
        assert "troubleshooting_guides" not in downgraded_tables
        assert "troubleshooting_steps" not in downgraded_tables
        assert "troubleshooting_branches" not in downgraded_tables
        assert "equipment" in downgraded_tables
        assert "inspection_records" in downgraded_tables
        with downgraded_engine.connect() as connection:
            assert connection.scalar(text("SELECT count(*) FROM equipment")) == 1
    finally:
        downgraded_engine.dispose()

    command.upgrade(alembic_config, "head")
    restored_engine = create_database_engine(database_url)
    try:
        restored_tables = inspect(restored_engine).get_table_names()
        assert "troubleshooting_guides" in restored_tables
        assert "troubleshooting_steps" in restored_tables
        assert "troubleshooting_branches" in restored_tables
    finally:
        restored_engine.dispose()


def test_equipment_master_migration_can_downgrade_and_upgrade(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Equipment masters should be removable without earlier Phoenix tables."""
    database_url = sqlite_url(tmp_path / "equipment-master-migration.sqlite3")
    monkeypatch.setenv("PHOENIX_DATABASE_URL", database_url)
    alembic_config = Config(str(BACKEND_ROOT / "alembic.ini"))

    command.upgrade(alembic_config, "head")
    upgraded_engine = create_database_engine(database_url)
    try:
        upgraded_tables = inspect(upgraded_engine).get_table_names()
        assert "departments" in upgraded_tables
        assert "manufacturers" in upgraded_tables
        assert "equipment" in upgraded_tables
    finally:
        upgraded_engine.dispose()

    command.downgrade(alembic_config, "20260816_0007")
    downgraded_engine = create_database_engine(database_url)
    try:
        downgraded_tables = inspect(downgraded_engine).get_table_names()
        assert "departments" not in downgraded_tables
        assert "manufacturers" not in downgraded_tables
        assert "equipment" not in downgraded_tables
        assert "todos" in downgraded_tables
        assert "work_reports" in downgraded_tables
    finally:
        downgraded_engine.dispose()

    command.upgrade(alembic_config, "head")
    restored_engine = create_database_engine(database_url)
    try:
        restored_inspector = inspect(restored_engine)
        assert "equipment" in restored_inspector.get_table_names()
        with restored_engine.connect() as connection:
            assert connection.scalar(text("SELECT COUNT(*) FROM departments")) == 6
    finally:
        restored_engine.dispose()


def test_work_report_ver_1_migration_preserves_legacy_and_new_reports(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Seven-field migration should preserve old details and downgrade safely."""
    database_url = sqlite_url(tmp_path / "work-report-ver-1.sqlite3")
    monkeypatch.setenv("PHOENIX_DATABASE_URL", database_url)
    alembic_config = Config(str(BACKEND_ROOT / "alembic.ini"))
    command.upgrade(alembic_config, "20260820_0009")

    legacy_engine = create_database_engine(database_url)
    try:
        with legacy_engine.begin() as connection:
            connection.execute(
                text(
                    "INSERT INTO work_reports "
                    "(id, work_date, category, work_hours, work_content, "
                    "result, notes) "
                    "VALUES (:id, :work_date, :category, :work_hours, "
                    ":work_content, :result, :notes)"
                ),
                {
                    "id": "30000000000040008000000000000002",
                    "work_date": "2026-08-20",
                    "category": "trouble",
                    "work_hours": 2.0,
                    "work_content": "移行前の架空故障対応",
                    "result": "continued",
                    "notes": "架空部品の入荷待ち",
                },
            )
    finally:
        legacy_engine.dispose()

    command.upgrade(alembic_config, "20260821_0010")
    migrated_engine = create_database_engine(database_url)
    try:
        migrated_columns = {
            column["name"]: column
            for column in inspect(migrated_engine).get_columns("work_reports")
        }
        assert {"phenomenon", "cause"}.issubset(migrated_columns)
        assert migrated_columns["category"]["nullable"] is True
        assert migrated_columns["work_hours"]["nullable"] is True
        with migrated_engine.begin() as connection:
            legacy = connection.execute(
                text(
                    "SELECT category, work_hours, phenomenon, cause, notes "
                    "FROM work_reports WHERE id = :id"
                ),
                {"id": "30000000000040008000000000000002"},
            ).one()
            assert legacy.category == "trouble"
            assert legacy.work_hours == 2
            assert legacy.phenomenon is None
            assert legacy.cause is None
            assert legacy.notes == "架空部品の入荷待ち"
            connection.execute(
                text(
                    "INSERT INTO work_reports "
                    "(id, work_date, phenomenon, cause, work_content, result) "
                    "VALUES (:id, :work_date, :phenomenon, :cause, "
                    ":work_content, :result)"
                ),
                {
                    "id": "30000000000040008000000000000003",
                    "work_date": "2026-08-21",
                    "phenomenon": "架空設備から異音",
                    "cause": None,
                    "work_content": "安全な範囲で外観確認",
                    "result": "follow_up",
                },
            )
    finally:
        migrated_engine.dispose()

    command.downgrade(alembic_config, "-1")
    downgraded_engine = create_database_engine(database_url)
    try:
        downgraded_columns = {
            column["name"]: column
            for column in inspect(downgraded_engine).get_columns("work_reports")
        }
        assert {"phenomenon", "cause"}.isdisjoint(downgraded_columns)
        assert downgraded_columns["category"]["nullable"] is False
        assert downgraded_columns["work_hours"]["nullable"] is False
        with downgraded_engine.connect() as connection:
            restored = connection.execute(
                text("SELECT category, work_hours FROM work_reports " "WHERE id = :id"),
                {"id": "30000000000040008000000000000003"},
            ).one()
            assert restored.category == "other"
            assert restored.work_hours == 0.25
    finally:
        downgraded_engine.dispose()


def test_work_report_equipment_link_migration_preserves_existing_reports(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Legacy reports should survive with explicitly unassigned equipment IDs."""
    database_url = sqlite_url(tmp_path / "work-report-equipment-link.sqlite3")
    monkeypatch.setenv("PHOENIX_DATABASE_URL", database_url)
    alembic_config = Config(str(BACKEND_ROOT / "alembic.ini"))
    command.upgrade(alembic_config, "20260820_0008")

    legacy_engine = create_database_engine(database_url)
    try:
        with legacy_engine.begin() as connection:
            connection.execute(
                text(
                    "INSERT INTO work_reports "
                    "(id, work_date, category, work_hours, work_content, result) "
                    "VALUES (:id, :work_date, :category, :work_hours, "
                    ":work_content, :result)"
                ),
                {
                    "id": "30000000000040008000000000000001",
                    "work_date": "2026-08-19",
                    "category": "maintenance",
                    "work_hours": 1.5,
                    "work_content": "移行前の架空設備日報",
                    "result": "completed",
                },
            )
    finally:
        legacy_engine.dispose()

    command.upgrade(alembic_config, "20260820_0009")

    migrated_engine = create_database_engine(database_url)
    try:
        migrated_inspector = inspect(migrated_engine)
        assert {
            "department_id",
            "equipment_id",
        }.issubset(
            {
                column["name"]
                for column in migrated_inspector.get_columns("work_reports")
            }
        )
        with migrated_engine.connect() as connection:
            migrated = connection.execute(
                text(
                    "SELECT work_content, department_id, equipment_id "
                    "FROM work_reports"
                )
            ).one()
            assert migrated.work_content == "移行前の架空設備日報"
            assert migrated.department_id is None
            assert migrated.equipment_id is None
    finally:
        migrated_engine.dispose()

    command.downgrade(alembic_config, "-1")
    downgraded_engine = create_database_engine(database_url)
    try:
        downgraded_inspector = inspect(downgraded_engine)
        assert {
            column["name"]
            for column in downgraded_inspector.get_columns("work_reports")
        }.isdisjoint({"department_id", "equipment_id"})
        with downgraded_engine.connect() as connection:
            assert (
                connection.scalar(text("SELECT work_content FROM work_reports"))
                == "移行前の架空設備日報"
            )
    finally:
        downgraded_engine.dispose()


def test_todo_equipment_link_migration_preserves_existing_todos(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Existing schedules should survive adding and removing the optional link."""
    database_url = sqlite_url(tmp_path / "todo-equipment-migration.sqlite3")
    monkeypatch.setenv("PHOENIX_DATABASE_URL", database_url)
    alembic_config = Config(str(BACKEND_ROOT / "alembic.ini"))
    command.upgrade(alembic_config, "20260825_0014")

    database_engine = create_database_engine(database_url)
    try:
        with database_engine.begin() as connection:
            connection.execute(
                text(
                    "INSERT INTO todos (id, title, priority) "
                    "VALUES (:id, :title, :priority)"
                ),
                {
                    "id": "81000000000040008000000000000001",
                    "title": "設備連携前の保全予定",
                    "priority": "medium",
                },
            )
            department_id = connection.scalar(
                text("SELECT id FROM departments LIMIT 1")
            )
            assert department_id is not None
            connection.execute(
                text("INSERT INTO manufacturers (id, name) VALUES (:id, :name)"),
                {
                    "id": "82000000000040008000000000000001",
                    "name": "架空保全予定メーカー",
                },
            )
            connection.execute(
                text(
                    "INSERT INTO equipment "
                    "(equipment_id, department_id, manufacturer_id, name) "
                    "VALUES (:id, :department_id, :manufacturer_id, :name)"
                ),
                {
                    "id": "83000000000040008000000000000001",
                    "department_id": department_id,
                    "manufacturer_id": "82000000000040008000000000000001",
                    "name": "架空包装機",
                },
            )
    finally:
        database_engine.dispose()

    command.upgrade(alembic_config, "20260826_0015")
    upgraded_engine = create_database_engine(database_url)
    try:
        database_inspector = inspect(upgraded_engine)
        assert "equipment_id" in {
            column["name"] for column in database_inspector.get_columns("todos")
        }
        assert "ix_todos_equipment_id_due_date" in {
            index["name"] for index in database_inspector.get_indexes("todos")
        }
        with upgraded_engine.begin() as connection:
            migrated = connection.execute(
                text("SELECT title, equipment_id FROM todos")
            ).one()
            assert migrated.title == "設備連携前の保全予定"
            assert migrated.equipment_id is None
            connection.execute(
                text(
                    "UPDATE todos SET equipment_id = :equipment_id "
                    "WHERE id = :todo_id"
                ),
                {
                    "equipment_id": "83000000000040008000000000000001",
                    "todo_id": "81000000000040008000000000000001",
                },
            )
    finally:
        upgraded_engine.dispose()

    command.downgrade(alembic_config, "-1")
    downgraded_engine = create_database_engine(database_url)
    try:
        assert "equipment_id" not in {
            column["name"] for column in inspect(downgraded_engine).get_columns("todos")
        }
        with downgraded_engine.connect() as connection:
            assert connection.scalar(text("SELECT count(*) FROM todos")) == 1
            assert (
                connection.scalar(text("SELECT title FROM todos"))
                == "設備連携前の保全予定"
            )
    finally:
        downgraded_engine.dispose()

    command.upgrade(alembic_config, "head")
    restored_engine = create_database_engine(database_url)
    try:
        with restored_engine.connect() as connection:
            restored = connection.execute(
                text("SELECT title, equipment_id FROM todos")
            ).one()
            assert restored.title == "設備連携前の保全予定"
            assert restored.equipment_id is None
    finally:
        restored_engine.dispose()


def test_equipment_change_history_migration_preserves_existing_records(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Adding and removing change histories must preserve equipment and reports."""
    database_url = sqlite_url(tmp_path / "equipment-change-history.sqlite3")
    monkeypatch.setenv("PHOENIX_DATABASE_URL", database_url)
    alembic_config = Config(str(BACKEND_ROOT / "alembic.ini"))
    command.upgrade(alembic_config, "20260826_0015")

    database_engine = create_database_engine(database_url)
    try:
        with database_engine.begin() as connection:
            department_id = connection.scalar(
                text("SELECT id FROM departments LIMIT 1")
            )
            assert department_id is not None
            connection.execute(
                text("INSERT INTO manufacturers (id, name) VALUES (:id, :name)"),
                {
                    "id": "91000000000040008000000000000001",
                    "name": "架空変更履歴メーカー",
                },
            )
            connection.execute(
                text(
                    "INSERT INTO equipment "
                    "(equipment_id, department_id, manufacturer_id, name) "
                    "VALUES (:id, :department_id, :manufacturer_id, :name)"
                ),
                {
                    "id": "92000000000040008000000000000001",
                    "department_id": department_id,
                    "manufacturer_id": "91000000000040008000000000000001",
                    "name": "架空包装機",
                },
            )
            connection.execute(
                text(
                    "INSERT INTO work_reports "
                    "(id, work_date, department_id, equipment_id, "
                    "phenomenon, work_content, result) "
                    "VALUES (:id, :work_date, :department_id, :equipment_id, "
                    ":phenomenon, :work_content, :result)"
                ),
                {
                    "id": "93000000000040008000000000000001",
                    "work_date": "2026-08-26",
                    "department_id": department_id,
                    "equipment_id": "92000000000040008000000000000001",
                    "phenomenon": "架空ガイドの摩耗",
                    "work_content": "架空ガイド形状を変更",
                    "result": "completed",
                },
            )
    finally:
        database_engine.dispose()

    command.upgrade(alembic_config, "20260826_0016")
    upgraded_engine = create_database_engine(database_url)
    try:
        database_inspector = inspect(upgraded_engine)
        assert "equipment_change_histories" in database_inspector.get_table_names()
        with upgraded_engine.begin() as connection:
            connection.execute(
                text(
                    "INSERT INTO equipment_change_histories "
                    "(change_history_id, equipment_id, changed_on, "
                    "improvement_point, change_details, work_report_id) "
                    "VALUES (:id, :equipment_id, :changed_on, :point, "
                    ":details, :work_report_id)"
                ),
                {
                    "id": "94000000000040008000000000000001",
                    "equipment_id": "92000000000040008000000000000001",
                    "changed_on": "2026-08-26",
                    "point": "架空チェーンガイド",
                    "details": "直線形状からR付き形状へ変更",
                    "work_report_id": "93000000000040008000000000000001",
                },
            )
            assert (
                connection.scalar(
                    text("SELECT count(*) FROM equipment_change_histories")
                )
                == 1
            )
    finally:
        upgraded_engine.dispose()

    command.downgrade(alembic_config, "-1")
    downgraded_engine = create_database_engine(database_url)
    try:
        downgraded_tables = inspect(downgraded_engine).get_table_names()
        assert "equipment_change_histories" not in downgraded_tables
        with downgraded_engine.connect() as connection:
            assert connection.scalar(text("SELECT count(*) FROM equipment")) == 1
            assert connection.scalar(text("SELECT count(*) FROM work_reports")) == 1
            assert (
                connection.scalar(text("SELECT work_content FROM work_reports"))
                == "架空ガイド形状を変更"
            )
    finally:
        downgraded_engine.dispose()

    command.upgrade(alembic_config, "head")
    restored_engine = create_database_engine(database_url)
    try:
        restored_inspector = inspect(restored_engine)
        assert "equipment_change_histories" in restored_inspector.get_table_names()
        with restored_engine.connect() as connection:
            assert (
                connection.scalar(
                    text("SELECT count(*) FROM equipment_change_histories")
                )
                == 0
            )
            assert connection.scalar(text("SELECT count(*) FROM equipment")) == 1
            assert connection.scalar(text("SELECT count(*) FROM work_reports")) == 1
    finally:
        restored_engine.dispose()


def test_local_authentication_migration_preserves_existing_records(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Auth tables should round-trip without changing existing Phoenix records."""
    database_url = sqlite_url(tmp_path / "local-authentication.sqlite3")
    monkeypatch.setenv("PHOENIX_DATABASE_URL", database_url)
    alembic_config = Config(str(BACKEND_ROOT / "alembic.ini"))
    command.upgrade(alembic_config, "20260826_0016")

    existing_engine = create_database_engine(database_url)
    try:
        with existing_engine.begin() as connection:
            connection.execute(
                text("INSERT INTO todos (id, title) VALUES (:id, :title)"),
                {
                    "id": "a1000000000040008000000000000001",
                    "title": "認証追加前の架空保全予定",
                },
            )
    finally:
        existing_engine.dispose()

    command.upgrade(alembic_config, "head")
    upgraded_engine = create_database_engine(database_url)
    try:
        upgraded_inspector = inspect(upgraded_engine)
        assert "users" in upgraded_inspector.get_table_names()
        assert "user_sessions" in upgraded_inspector.get_table_names()
        with upgraded_engine.begin() as connection:
            connection.execute(
                text(
                    "INSERT INTO users "
                    "(id, username, password_hash, role) "
                    "VALUES (:id, :username, :password_hash, 'admin')"
                ),
                {
                    "id": "a2000000000040008000000000000001",
                    "username": "migration.admin",
                    "password_hash": "$argon2id$fictional-test-hash",
                },
            )
            connection.execute(
                text(
                    "INSERT INTO user_sessions "
                    "(id, user_id, token_hash, expires_at) "
                    "VALUES (:id, :user_id, :token_hash, :expires_at)"
                ),
                {
                    "id": "a3000000000040008000000000000001",
                    "user_id": "a2000000000040008000000000000001",
                    "token_hash": "a" * 64,
                    "expires_at": "2026-08-29 00:00:00",
                },
            )
            assert connection.scalar(text("SELECT count(*) FROM users")) == 1
            assert connection.scalar(text("SELECT count(*) FROM user_sessions")) == 1
            assert (
                connection.scalar(text("SELECT title FROM todos"))
                == "認証追加前の架空保全予定"
            )
    finally:
        upgraded_engine.dispose()

    command.downgrade(alembic_config, "-1")
    downgraded_engine = create_database_engine(database_url)
    try:
        downgraded_tables = inspect(downgraded_engine).get_table_names()
        assert "users" not in downgraded_tables
        assert "user_sessions" not in downgraded_tables
        assert "equipment_change_histories" in downgraded_tables
        with downgraded_engine.connect() as connection:
            assert (
                connection.scalar(text("SELECT title FROM todos"))
                == "認証追加前の架空保全予定"
            )
    finally:
        downgraded_engine.dispose()

    command.upgrade(alembic_config, "head")
    restored_engine = create_database_engine(database_url)
    try:
        restored_inspector = inspect(restored_engine)
        assert "users" in restored_inspector.get_table_names()
        assert "user_sessions" in restored_inspector.get_table_names()
        with restored_engine.connect() as connection:
            assert connection.scalar(text("SELECT count(*) FROM users")) == 0
            assert (
                connection.scalar(text("SELECT title FROM todos"))
                == "認証追加前の架空保全予定"
            )
    finally:
        restored_engine.dispose()


def test_priority_migration_preserves_existing_todos(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Existing rows should receive medium priority during the upgrade."""
    database_url = sqlite_url(tmp_path / "priority-migration.sqlite3")
    monkeypatch.setenv("PHOENIX_DATABASE_URL", database_url)
    alembic_config = Config(str(BACKEND_ROOT / "alembic.ini"))
    command.upgrade(alembic_config, "20260720_0002")

    database_engine = create_database_engine(database_url)
    try:
        with database_engine.begin() as connection:
            connection.execute(
                text("INSERT INTO todos (id, title) VALUES (:id, :title)"),
                {
                    "id": "00000000000000000000000000000001",
                    "title": "移行前のToDo",
                },
            )
    finally:
        database_engine.dispose()

    command.upgrade(alembic_config, "head")

    migrated_engine = create_database_engine(database_url)
    try:
        with migrated_engine.connect() as connection:
            migrated = connection.execute(
                text("SELECT title, priority FROM todos")
            ).one()
            assert migrated.title == "移行前のToDo"
            assert migrated.priority == "medium"
    finally:
        migrated_engine.dispose()


def test_category_migration_preserves_existing_todos(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Existing rows should remain available without an assigned category."""
    database_url = sqlite_url(tmp_path / "category-migration.sqlite3")
    monkeypatch.setenv("PHOENIX_DATABASE_URL", database_url)
    alembic_config = Config(str(BACKEND_ROOT / "alembic.ini"))
    command.upgrade(alembic_config, "20260723_0003")

    database_engine = create_database_engine(database_url)
    try:
        with database_engine.begin() as connection:
            connection.execute(
                text(
                    "INSERT INTO todos (id, title, priority) "
                    "VALUES (:id, :title, :priority)"
                ),
                {
                    "id": "00000000000000000000000000000001",
                    "title": "カテゴリ移行前のToDo",
                    "priority": "high",
                },
            )
    finally:
        database_engine.dispose()

    command.upgrade(alembic_config, "head")

    migrated_engine = create_database_engine(database_url)
    try:
        with migrated_engine.connect() as connection:
            migrated = connection.execute(
                text("SELECT title, priority, category FROM todos")
            ).one()
            assert migrated.title == "カテゴリ移行前のToDo"
            assert migrated.priority == "high"
            assert migrated.category is None
    finally:
        migrated_engine.dispose()


def test_pinning_migration_preserves_existing_todos(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Existing rows should remain available and start unpinned."""
    database_url = sqlite_url(tmp_path / "pinning-migration.sqlite3")
    monkeypatch.setenv("PHOENIX_DATABASE_URL", database_url)
    alembic_config = Config(str(BACKEND_ROOT / "alembic.ini"))
    command.upgrade(alembic_config, "20260723_0004")

    database_engine = create_database_engine(database_url)
    try:
        with database_engine.begin() as connection:
            connection.execute(
                text(
                    "INSERT INTO todos (id, title, priority) "
                    "VALUES (:id, :title, :priority)"
                ),
                {
                    "id": "00000000000000000000000000000001",
                    "title": "固定機能追加前のToDo",
                    "priority": "medium",
                },
            )
    finally:
        database_engine.dispose()

    command.upgrade(alembic_config, "head")

    migrated_engine = create_database_engine(database_url)
    try:
        with migrated_engine.connect() as connection:
            migrated = connection.execute(
                text("SELECT title, is_pinned FROM todos")
            ).one()
            assert migrated.title == "固定機能追加前のToDo"
            assert bool(migrated.is_pinned) is False
    finally:
        migrated_engine.dispose()


def test_archiving_migration_preserves_existing_todos(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Existing rows should remain available and start outside the archive."""
    database_url = sqlite_url(tmp_path / "archiving-migration.sqlite3")
    monkeypatch.setenv("PHOENIX_DATABASE_URL", database_url)
    alembic_config = Config(str(BACKEND_ROOT / "alembic.ini"))
    command.upgrade(alembic_config, "20260809_0005")

    database_engine = create_database_engine(database_url)
    try:
        with database_engine.begin() as connection:
            connection.execute(
                text(
                    "INSERT INTO todos (id, title, priority) "
                    "VALUES (:id, :title, :priority)"
                ),
                {
                    "id": "00000000000000000000000000000002",
                    "title": "アーカイブ機能追加前のToDo",
                    "priority": "medium",
                },
            )
    finally:
        database_engine.dispose()

    command.upgrade(alembic_config, "head")

    migrated_engine = create_database_engine(database_url)
    try:
        with migrated_engine.connect() as connection:
            migrated = connection.execute(
                text("SELECT title, is_archived FROM todos")
            ).one()
            assert migrated.title == "アーカイブ機能追加前のToDo"
            assert bool(migrated.is_archived) is False
    finally:
        migrated_engine.dispose()

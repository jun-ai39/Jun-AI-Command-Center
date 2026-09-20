"""Exercise migrations on an isolated DB while retaining existing records."""

import sqlite3
from pathlib import Path

from alembic.config import Config

from alembic import command


def test_handoff_upgrade_preserves_reports_and_can_roundtrip(tmp_path, monkeypatch):
    db = tmp_path / "handoff-migration.sqlite3"
    monkeypatch.setenv("PHOENIX_DATABASE_URL", f"sqlite:///{db}")
    config = Config(str(Path(__file__).parents[1] / "alembic.ini"))
    command.upgrade(config, "20260828_0017")
    with sqlite3.connect(db) as conn:
        conn.execute(
            "INSERT INTO work_reports (id, work_date, work_content, result) "
            "VALUES (?, ?, ?, ?)",
            ("1" * 32, "2026-09-01", "既存の記録", "completed"),
        )
    command.upgrade(config, "head")
    with sqlite3.connect(db) as conn:
        assert conn.execute(
            "SELECT work_content, source_inspection_id FROM work_reports"
        ).fetchall() == [("既存の記録", None)]
        assert conn.execute("PRAGMA foreign_key_check").fetchall() == []
        assert any(
            row[2] == "inspection_records" and row[3] == "source_inspection_id"
            for row in conn.execute("PRAGMA foreign_key_list(work_reports)")
        )
        assert any(
            row[1] == "uq_work_reports_source_inspection_id" and row[2] == 1
            for row in conn.execute("PRAGMA index_list(work_reports)")
        )
    command.downgrade(config, "-1")
    command.upgrade(config, "head")
    with sqlite3.connect(db) as conn:
        assert conn.execute("SELECT work_content FROM work_reports").fetchall() == [
            ("既存の記録",)
        ]
        assert (
            conn.execute("SELECT version_num FROM alembic_version").fetchone()[0]
            == "20260920_0018"
        )

"""Tests for the local PC launcher without starting real processes."""

import importlib.util
import sys
from pathlib import Path
from types import ModuleType

PHOENIX_ROOT = Path(__file__).resolve().parents[2]
LAUNCHER_PATH = PHOENIX_ROOT / "scripts" / "phoenix_local.py"


def load_launcher() -> ModuleType:
    """Load the standard-library launcher from the Phoenix scripts folder."""
    specification = importlib.util.spec_from_file_location(
        "phoenix_local_test_module",
        LAUNCHER_PATH,
    )
    assert specification is not None
    assert specification.loader is not None
    module = importlib.util.module_from_spec(specification)
    sys.modules[specification.name] = module
    specification.loader.exec_module(module)
    return module


def test_setup_uses_locked_tools_and_keeps_password_out_of_arguments() -> None:
    """First setup should prompt in the existing admin command, not shell history."""
    launcher = load_launcher()

    commands = launcher.build_setup_commands(PHOENIX_ROOT, "jun.admin")

    assert commands[0] == (["uv", "sync", "--dev"], PHOENIX_ROOT / "backend")
    assert commands[1] == (["npm", "ci"], PHOENIX_ROOT / "frontend")
    assert commands[2][0] == ["uv", "run", "alembic", "upgrade", "head"]
    assert commands[3][0][-2:] == ["--username", "jun.admin"]
    assert all(
        "password" not in argument.lower()
        for command, _ in commands
        for argument in command
    )


def test_startup_binds_both_servers_to_loopback_only() -> None:
    """The first trial must not listen on the factory LAN or public interfaces."""
    launcher = load_launcher()

    backend, frontend, preparations = launcher.build_startup_commands(PHOENIX_ROOT)

    assert backend[backend.index("--host") + 1] == "127.0.0.1"
    assert frontend[frontend.index("--host") + 1] == "127.0.0.1"
    assert "0.0.0.0" not in backend
    assert "0.0.0.0" not in frontend
    assert preparations == [
        (["uv", "run", "alembic", "upgrade", "head"], PHOENIX_ROOT / "backend"),
        (["npm", "run", "build"], PHOENIX_ROOT / "frontend"),
    ]


def test_command_resolution_wraps_fixed_windows_batch_arguments(monkeypatch) -> None:
    """Windows npm batch shims should use an explicit command processor."""
    launcher = load_launcher()

    def fake_which(command: str) -> str:
        if command == "cmd.exe":
            return "C:/Windows/System32/cmd.exe"
        return f"C:/tools/{command}.cmd"

    monkeypatch.setattr(launcher.shutil, "which", fake_which)

    assert launcher.resolve_command(["npm", "run", "build"]) == [
        "C:/Windows/System32/cmd.exe",
        "/d",
        "/s",
        "/c",
        "C:/tools/npm.cmd run build",
    ]


def test_runtime_state_is_private_and_stop_uses_a_request_file(tmp_path: Path) -> None:
    """Stopping must not use broad taskkill or terminate unrelated processes."""
    launcher = load_launcher()
    runtime = launcher.get_runtime_paths(tmp_path)

    assert runtime.directory == tmp_path / ".runtime"
    assert runtime.stop_request.name == "stop.request"
    assert runtime.state_file.parent == runtime.directory
    source = LAUNCHER_PATH.read_text(encoding="utf-8").lower()
    assert "taskkill" not in source
    assert "pkill" not in source
    assert "killall" not in source


def test_stale_runtime_is_removed_without_terminating_any_pid(tmp_path: Path) -> None:
    """A crashed supervisor should be recoverable without broad process killing."""
    launcher = load_launcher()
    runtime = launcher.get_runtime_paths(tmp_path)
    runtime.directory.mkdir()
    runtime.state_file.write_text(
        '{"supervisor_pid": -1}',
        encoding="utf-8",
    )

    assert launcher.clear_stale_runtime(runtime) is True
    assert not runtime.state_file.exists()


def test_windows_entrypoints_call_only_the_local_launcher() -> None:
    """Double-click wrappers should not embed credentials or destructive commands."""
    for filename in ("setup_phoenix.cmd", "start_phoenix.cmd", "stop_phoenix.cmd"):
        content = (PHOENIX_ROOT / filename).read_text(encoding="utf-8").lower()
        assert "scripts\\phoenix_local.py" in content
        assert "taskkill" not in content
        assert "password" not in content
        assert "set /p" not in content

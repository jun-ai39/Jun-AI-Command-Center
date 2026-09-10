"""Prepare, run, stop, and inspect Phoenix on one local Windows PC."""

from __future__ import annotations

import argparse
import ctypes
import json
import os
import shutil
import socket
import subprocess
import time
import urllib.error
import urllib.request
import webbrowser
from ctypes import wintypes
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Final

API_URL: Final[str] = "http://127.0.0.1:8000"
FRONTEND_URL: Final[str] = "http://127.0.0.1:5173"
STARTUP_TIMEOUT_SECONDS: Final[int] = 45
PHOENIX_PORTS: Final[tuple[int, int]] = (8000, 5173)
JOB_OBJECT_EXTENDED_LIMIT_INFORMATION: Final[int] = 9
JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE: Final[int] = 0x00002000


class _JobObjectBasicLimitInformation(ctypes.Structure):
    """Windows layout required to configure a process Job Object."""

    _fields_ = [
        ("PerProcessUserTimeLimit", wintypes.LARGE_INTEGER),
        ("PerJobUserTimeLimit", wintypes.LARGE_INTEGER),
        ("LimitFlags", wintypes.DWORD),
        ("MinimumWorkingSetSize", ctypes.c_size_t),
        ("MaximumWorkingSetSize", ctypes.c_size_t),
        ("ActiveProcessLimit", wintypes.DWORD),
        ("Affinity", ctypes.c_size_t),
        ("PriorityClass", wintypes.DWORD),
        ("SchedulingClass", wintypes.DWORD),
    ]


class _IoCounters(ctypes.Structure):
    """Windows I/O counters embedded in extended Job Object limits."""

    _fields_ = [
        ("ReadOperationCount", ctypes.c_uint64),
        ("WriteOperationCount", ctypes.c_uint64),
        ("OtherOperationCount", ctypes.c_uint64),
        ("ReadTransferCount", ctypes.c_uint64),
        ("WriteTransferCount", ctypes.c_uint64),
        ("OtherTransferCount", ctypes.c_uint64),
    ]


class _JobObjectExtendedLimitInformation(ctypes.Structure):
    """Windows extended limits used for kill-on-supervisor-close."""

    _fields_ = [
        ("BasicLimitInformation", _JobObjectBasicLimitInformation),
        ("IoInfo", _IoCounters),
        ("ProcessMemoryLimit", ctypes.c_size_t),
        ("JobMemoryLimit", ctypes.c_size_t),
        ("PeakProcessMemoryUsed", ctypes.c_size_t),
        ("PeakJobMemoryUsed", ctypes.c_size_t),
    ]


@dataclass(frozen=True)
class RuntimePaths:
    """Private local files used by the supervised runtime."""

    directory: Path
    state_file: Path
    stop_request: Path
    backend_log: Path
    frontend_log: Path


def get_phoenix_root() -> Path:
    """Return the Phoenix folder regardless of the current working directory."""
    return Path(__file__).resolve().parents[1]


def get_runtime_paths(phoenix_root: Path) -> RuntimePaths:
    """Build all runtime paths inside the Git-ignored private folder."""
    directory = phoenix_root / ".runtime"
    return RuntimePaths(
        directory=directory,
        state_file=directory / "phoenix-runtime.json",
        stop_request=directory / "stop.request",
        backend_log=directory / "backend.log",
        frontend_log=directory / "frontend.log",
    )


def build_setup_commands(
    phoenix_root: Path,
    username: str,
) -> list[tuple[list[str], Path]]:
    """Return deterministic first-run commands without using a shell."""
    backend = phoenix_root / "backend"
    frontend = phoenix_root / "frontend"
    return [
        (["uv", "sync", "--dev"], backend),
        (["npm", "ci"], frontend),
        (["uv", "run", "alembic", "upgrade", "head"], backend),
        (
            [
                "uv",
                "run",
                "python",
                "-m",
                "app.commands.create_admin",
                "--username",
                username,
            ],
            backend,
        ),
    ]


def build_startup_commands(
    phoenix_root: Path,
) -> tuple[list[str], list[str], list[tuple[list[str], Path]]]:
    """Return preparation plus supervised API and UI commands."""
    backend = phoenix_root / "backend"
    frontend = phoenix_root / "frontend"
    preparations = [
        (["uv", "run", "alembic", "upgrade", "head"], backend),
        (["npm", "run", "build"], frontend),
    ]
    backend_command = [
        "uv",
        "run",
        "fastapi",
        "run",
        "app/main.py",
        "--host",
        "127.0.0.1",
        "--port",
        "8000",
    ]
    frontend_command = [
        "npm",
        "run",
        "preview",
        "--",
        "--host",
        "127.0.0.1",
        "--port",
        "5173",
        "--strictPort",
    ]
    return backend_command, frontend_command, preparations


def require_local_tools() -> None:
    """Fail early with one clear message when setup tools are unavailable."""
    missing = [command for command in ("uv", "npm") if shutil.which(command) is None]
    if missing:
        names = "、".join(missing)
        raise RuntimeError(f"必要なコマンドが見つかりません: {names}")


def build_backend_environment() -> dict[str, str]:
    """Keep redirected Python logs UTF-8 without changing Windows globally."""
    environment = os.environ.copy()
    environment["PYTHONIOENCODING"] = "utf-8"
    return environment


def process_is_running(process_id: object) -> bool:
    """Check a recorded supervisor PID without sending a terminating signal."""
    if not isinstance(process_id, int) or process_id <= 0:
        return False
    if os.name == "nt":
        return windows_process_is_running(process_id)
    try:
        os.kill(process_id, 0)
    except (OSError, ValueError):
        return False
    return True


def windows_process_is_running(process_id: int) -> bool:
    """Inspect a Windows process handle without signalling or terminating it."""
    process_query_limited_information = 0x1000
    still_active = 259
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    handle = kernel32.OpenProcess(
        process_query_limited_information,
        False,
        process_id,
    )
    if not handle:
        return False
    try:
        exit_code = wintypes.DWORD()
        if not kernel32.GetExitCodeProcess(handle, ctypes.byref(exit_code)):
            return False
        return exit_code.value == still_active
    finally:
        kernel32.CloseHandle(handle)


def create_windows_process_guard() -> int | None:
    """Keep the supervised process tree inside a kill-on-close Windows Job."""
    if os.name != "nt":
        return None

    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel32.CreateJobObjectW.argtypes = [ctypes.c_void_p, wintypes.LPCWSTR]
    kernel32.CreateJobObjectW.restype = wintypes.HANDLE
    kernel32.SetInformationJobObject.argtypes = [
        wintypes.HANDLE,
        ctypes.c_int,
        ctypes.c_void_p,
        wintypes.DWORD,
    ]
    kernel32.SetInformationJobObject.restype = wintypes.BOOL
    kernel32.AssignProcessToJobObject.argtypes = [wintypes.HANDLE, wintypes.HANDLE]
    kernel32.AssignProcessToJobObject.restype = wintypes.BOOL
    kernel32.GetCurrentProcess.argtypes = []
    kernel32.GetCurrentProcess.restype = wintypes.HANDLE
    kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
    kernel32.CloseHandle.restype = wintypes.BOOL
    job_handle = kernel32.CreateJobObjectW(None, None)
    if not job_handle:
        raise RuntimeError(
            f"Windowsのプロセス監視を準備できませんでした: {ctypes.get_last_error()}"
        )

    limits = _JobObjectExtendedLimitInformation()
    limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
    configured = kernel32.SetInformationJobObject(
        job_handle,
        JOB_OBJECT_EXTENDED_LIMIT_INFORMATION,
        ctypes.byref(limits),
        ctypes.sizeof(limits),
    )
    if not configured:
        error_code = ctypes.get_last_error()
        kernel32.CloseHandle(job_handle)
        raise RuntimeError(f"Windowsのプロセス監視を設定できませんでした: {error_code}")

    assigned = kernel32.AssignProcessToJobObject(
        job_handle,
        kernel32.GetCurrentProcess(),
    )
    if not assigned:
        error_code = ctypes.get_last_error()
        kernel32.CloseHandle(job_handle)
        raise RuntimeError(f"Windowsのプロセス監視を開始できませんでした: {error_code}")
    return job_handle


def active_phoenix_ports() -> list[int]:
    """Return Phoenix loopback ports that currently accept TCP connections."""
    active: list[int] = []
    for port in PHOENIX_PORTS:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.25):
                active.append(port)
        except OSError:
            continue
    return active


def read_runtime_state(runtime: RuntimePaths) -> dict[str, object] | None:
    """Read one valid runtime-state object without exposing its contents."""
    try:
        state = json.loads(runtime.state_file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return state if isinstance(state, dict) else None


def clear_stale_runtime(runtime: RuntimePaths) -> bool:
    """Remove state only after every recorded process has stopped."""
    if not runtime.state_file.is_file():
        return True
    state = read_runtime_state(runtime)
    if state is None:
        return False
    recorded_processes = (
        state.get("supervisor_pid"),
        state.get("backend_pid"),
        state.get("frontend_pid"),
    )
    if any(process_is_running(process_id) for process_id in recorded_processes):
        return False
    runtime.stop_request.unlink(missing_ok=True)
    runtime.state_file.unlink(missing_ok=True)
    return True


def run_checked(command: list[str], working_directory: Path) -> None:
    """Run one explicit setup command and stop on failure."""
    completed = subprocess.run(
        resolve_command(command),
        cwd=working_directory,
        check=False,
    )
    if completed.returncode != 0:
        raise RuntimeError(f"コマンドが失敗しました: {command[0]}")


def resolve_command(command: list[str]) -> list[str]:
    """Resolve tools and run Windows batch shims through cmd.exe."""
    executable = shutil.which(command[0])
    if executable is None:
        raise RuntimeError(f"必要なコマンドが見つかりません: {command[0]}")

    resolved = [executable, *command[1:]]
    if Path(executable).suffix.lower() not in {".bat", ".cmd"}:
        return resolved

    command_processor = shutil.which("cmd.exe")
    if command_processor is None:
        raise RuntimeError("必要なコマンドが見つかりません: cmd.exe")
    return [command_processor, "/d", "/c", "call", *resolved]

def setup_local(phoenix_root: Path, username: str) -> int:
    """Install locked dependencies, migrate, and create the first administrator."""
    require_local_tools()
    for command, working_directory in build_setup_commands(phoenix_root, username):
        run_checked(command, working_directory)
    print("Phoenixの初回セットアップが完了しました。")
    return 0


def endpoint_is_ready(url: str) -> bool:
    """Check only the local loopback endpoint with a short timeout."""
    try:
        with urllib.request.urlopen(url, timeout=1) as response:  # noqa: S310
            return 200 <= response.status < 500
    except (OSError, urllib.error.URLError):
        return False


def wait_for_startup(
    backend_process: subprocess.Popen[bytes],
    frontend_process: subprocess.Popen[bytes],
) -> bool:
    """Wait until both local endpoints respond or either process exits."""
    deadline = time.monotonic() + STARTUP_TIMEOUT_SECONDS
    while time.monotonic() < deadline:
        if backend_process.poll() is not None or frontend_process.poll() is not None:
            return False
        if endpoint_is_ready(f"{API_URL}/health") and endpoint_is_ready(FRONTEND_URL):
            return True
        time.sleep(0.4)
    return False


def stop_owned_process(process: subprocess.Popen[bytes]) -> None:
    """Stop only a process handle created by this supervisor."""
    if process.poll() is not None:
        return
    process.terminate()
    try:
        process.wait(timeout=8)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=5)


def run_local(phoenix_root: Path, *, open_browser: bool = True) -> int:
    """Supervise Phoenix until Ctrl+C or the dedicated stop request is received."""
    require_local_tools()
    runtime = get_runtime_paths(phoenix_root)
    runtime.directory.mkdir(parents=True, exist_ok=True)
    if not clear_stale_runtime(runtime):
        print("Phoenixは起動中か、前回の状態ファイルが残っています。")
        print("先に stop_phoenix.cmd を実行してください。")
        return 1
    active_ports = active_phoenix_ports()
    if active_ports:
        ports = "、".join(str(port) for port in active_ports)
        print(f"Phoenixの使用ポートが既に使われています: {ports}")
        print("安全のため起動しません。残存プロセスを確認してください。")
        return 1
    runtime.stop_request.unlink(missing_ok=True)

    backend_command, frontend_command, preparations = build_startup_commands(
        phoenix_root
    )
    for command, working_directory in preparations:
        run_checked(command, working_directory)

    backend_log = runtime.backend_log.open("ab")
    frontend_log = runtime.frontend_log.open("ab")
    backend_process: subprocess.Popen[bytes] | None = None
    frontend_process: subprocess.Popen[bytes] | None = None
    try:
        # The raw handle intentionally remains open until this launcher exits.
        # Windows then closes the Job and terminates any surviving descendants.
        _process_guard = create_windows_process_guard()
        backend_process = subprocess.Popen(
            resolve_command(backend_command),
            cwd=phoenix_root / "backend",
            stdout=backend_log,
            stderr=subprocess.STDOUT,
            env=build_backend_environment(),
        )
        frontend_process = subprocess.Popen(
            resolve_command(frontend_command),
            cwd=phoenix_root / "frontend",
            stdout=frontend_log,
            stderr=subprocess.STDOUT,
        )
        runtime.state_file.write_text(
            json.dumps(
                {
                    "supervisor_pid": os.getpid(),
                    "backend_pid": backend_process.pid,
                    "frontend_pid": frontend_process.pid,
                    "started_at": datetime.now(tz=UTC).isoformat(),
                    "frontend_url": FRONTEND_URL,
                    "api_url": API_URL,
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )
        if not wait_for_startup(backend_process, frontend_process):
            print("Phoenixを起動できませんでした。.runtime内のログを確認してください。")
            return 1
        print(f"Phoenixを起動しました: {FRONTEND_URL}")
        print("終了は stop_phoenix.cmd を実行するか、この画面で Ctrl+C を押します。")
        if open_browser:
            webbrowser.open(FRONTEND_URL)
        while not runtime.stop_request.exists():
            if (
                backend_process.poll() is not None
                or frontend_process.poll() is not None
            ):
                print("Phoenixのプロセスが停止しました。ログを確認してください。")
                return 1
            time.sleep(0.5)
        print("Phoenixを停止しています…")
        return 0
    except KeyboardInterrupt:
        print("Phoenixを停止しています…")
        return 0
    finally:
        if frontend_process is not None:
            stop_owned_process(frontend_process)
        if backend_process is not None:
            stop_owned_process(backend_process)
        backend_log.close()
        frontend_log.close()
        runtime.stop_request.unlink(missing_ok=True)
        runtime.state_file.unlink(missing_ok=True)


def request_stop(phoenix_root: Path) -> int:
    """Ask the active supervisor to stop its own two child processes."""
    runtime = get_runtime_paths(phoenix_root)
    if not runtime.state_file.is_file():
        active_ports = active_phoenix_ports()
        if active_ports:
            ports = "、".join(str(port) for port in active_ports)
            print(f"Phoenixの管理情報がありませんが、使用ポートは起動中です: {ports}")
            print("安全のため自動停止しません。残存プロセスを確認してください。")
            return 1
        print("Phoenixは起動していません。")
        return 0

    state = read_runtime_state(runtime)
    if state is None:
        print("Phoenixの状態ファイルを確認できません。")
        return 1
    if not process_is_running(state.get("supervisor_pid")):
        child_processes = (
            state.get("backend_pid"),
            state.get("frontend_pid"),
        )
        if any(process_is_running(process_id) for process_id in child_processes):
            print("Phoenixの監視プロセスは停止していますが、子プロセスが残っています。")
            print("安全のため自動停止しません。残存プロセスを確認してください。")
            return 1
        if not clear_stale_runtime(runtime):
            print("Phoenixの状態情報を整理できませんでした。")
            return 1
        print("停止済みの状態情報を整理しました。")
        return 0

    runtime.stop_request.touch(exist_ok=True)
    deadline = time.monotonic() + 15
    while runtime.state_file.exists() and time.monotonic() < deadline:
        time.sleep(0.25)
    if runtime.state_file.exists():
        print("停止処理が継続中です。起動画面またはログを確認してください。")
        return 1
    print("Phoenixを停止しました。")
    return 0


def show_status(phoenix_root: Path) -> int:
    """Show the supervisor state without exposing database or credential data."""
    runtime = get_runtime_paths(phoenix_root)
    if not runtime.state_file.is_file():
        print("Phoenixは停止中です。")
        return 0
    try:
        state = json.loads(runtime.state_file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        print("Phoenixの状態ファイルを確認できません。")
        return 1
    print(f"Phoenixは起動中です: {state.get('frontend_url', FRONTEND_URL)}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    """Build the local-only command interface."""
    parser = argparse.ArgumentParser(description="Phoenix local PC operations")
    subparsers = parser.add_subparsers(dest="operation", required=True)
    setup_parser = subparsers.add_parser("setup", help="first local setup")
    setup_parser.add_argument("--username")
    run_parser = subparsers.add_parser("run", help="start and supervise Phoenix")
    run_parser.add_argument("--no-browser", action="store_true")
    subparsers.add_parser("stop", help="request a supervised stop")
    subparsers.add_parser("status", help="show local runtime status")
    return parser


def main() -> int:
    """Dispatch one local operation and keep failures understandable."""
    arguments = build_parser().parse_args()
    phoenix_root = get_phoenix_root()
    try:
        if arguments.operation == "setup":
            username = arguments.username or input("Phoenix administrator username: ")
            if not username.strip():
                raise RuntimeError("管理者名を入力してください。")
            return setup_local(phoenix_root, username.strip())
        if arguments.operation == "run":
            return run_local(phoenix_root, open_browser=not arguments.no_browser)
        if arguments.operation == "stop":
            return request_stop(phoenix_root)
        return show_status(phoenix_root)
    except RuntimeError as error:
        print(f"Phoenix操作を完了できませんでした: {error}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

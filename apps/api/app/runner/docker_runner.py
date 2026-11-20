from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from app.config import get_settings
from app.runner.sandbox import WORKER


def docker_available() -> bool:
    if os.getenv("DSA_RUNNER_BACKEND", "").lower() == "subprocess":
        return False
    if os.getenv("DSA_RUNNER_BACKEND", "").lower() == "docker":
        return shutil.which("docker") is not None
    # Auto: use docker only when explicitly preferred and present
    return os.getenv("DSA_USE_DOCKER", "").lower() in {"1", "true", "yes"} and shutil.which("docker") is not None


def run_in_docker(
    code: str,
    function_name: str,
    args: list[Any] | None = None,
    timeout_sec: float | None = None,
    max_steps: int | None = None,
) -> dict[str, Any]:
    """Docker-ready sandbox. Falls back is handled by the caller."""
    settings = get_settings()
    timeout = timeout_sec if timeout_sec is not None else settings.run_timeout_sec
    steps = max_steps if max_steps is not None else settings.run_max_steps
    image = os.getenv("DSA_DOCKER_IMAGE", "python:3.12-slim")

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        worker_path = tmp_path / "worker.py"
        worker_path.write_text(WORKER, encoding="utf-8")
        payload = {
            "code": code,
            "function_name": function_name,
            "args": args or [],
            "max_output_chars": settings.run_max_output_chars,
        }
        payload_path = tmp_path / "payload.json"
        payload_path.write_text(json.dumps(payload), encoding="utf-8")

        cmd = [
            "docker",
            "run",
            "--rm",
            "-i",
            "--network",
            "none",
            "--memory",
            "128m",
            "--cpus",
            "0.5",
            "--pids-limit",
            "64",
            "-v",
            f"{tmp_path}:/work:ro",
            "-w",
            "/work",
            image,
            "python",
            "worker.py",
            str(steps),
        ]
        try:
            proc = subprocess.run(
                cmd,
                input=payload_path.read_bytes(),
                capture_output=True,
                timeout=timeout + 1.0,
                check=False,
            )
        except FileNotFoundError:
            return {
                "ok": False,
                "result": None,
                "error": "Docker binary not found",
                "events": [],
                "stdout": "",
                "backend": "docker",
            }
        except subprocess.TimeoutExpired:
            return {
                "ok": False,
                "result": None,
                "error": "Execution timed out in Docker sandbox.",
                "events": [],
                "stdout": "",
                "backend": "docker",
            }

        if proc.returncode != 0 and not proc.stdout:
            err = proc.stderr.decode("utf-8", errors="replace")[:2000] or "Docker runner failed"
            return {"ok": False, "result": None, "error": err, "events": [], "stdout": "", "backend": "docker"}
        try:
            data = json.loads(proc.stdout.decode("utf-8"))
            data["backend"] = "docker"
            return data
        except json.JSONDecodeError:
            return {
                "ok": False,
                "result": None,
                "error": proc.stderr.decode("utf-8", errors="replace")[:2000] or "Invalid Docker runner output",
                "events": [],
                "stdout": "",
                "backend": "docker",
            }

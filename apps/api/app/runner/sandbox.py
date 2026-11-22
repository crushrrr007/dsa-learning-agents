from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import textwrap
from pathlib import Path
from typing import Any

from app.config import get_settings


WORKER = textwrap.dedent(
    r'''
import json
import sys
import traceback
import types

MAX_STEPS = int(sys.argv[1])
payload = json.loads(sys.stdin.read())
code = payload["code"]
fn_name = payload["function_name"]
args = payload.get("args", [])
max_output = int(payload.get("max_output_chars", 4000))

events = []
stdout_chunks = []

class Limit(Exception):
    pass

def safe_repr(value):
    try:
        if isinstance(value, (int, float, bool, str, type(None))):
            text = repr(value)
        elif isinstance(value, (list, tuple)):
            text = repr(list(value)[:40])
        elif isinstance(value, dict):
            items = list(value.items())[:20]
            text = repr({str(k): safe_repr(v) for k, v in items})
        elif hasattr(value, "val") and hasattr(value, "next"):
            # linked list node snapshot
            nodes = []
            seen = set()
            cur = value
            steps = 0
            while cur is not None and steps < 30:
                ident = id(cur)
                if ident in seen:
                    nodes.append({"val": getattr(cur, "val", None), "cycle": True})
                    break
                seen.add(ident)
                nodes.append({"val": getattr(cur, "val", None), "cycle": False})
                cur = getattr(cur, "next", None)
                steps += 1
            return {"__list_nodes__": nodes}
        else:
            text = object.__repr__(value)
        if len(text) > 120:
            text = text[:117] + "..."
        return text
    except Exception:
        return "<unreprable>"

def focus_from_locals(loc):
    focus = {}
    for key in (
        "left",
        "right",
        "mid",
        "i",
        "j",
        "slow",
        "fast",
        "write",
        "prev",
        "curr",
        "k",
        "window",
        "target",
        "src",
        "dst",
        "u",
        "v",
        "dist",
        "n",
        "r",
        "c",
    ):
        if key in loc:
            focus[key] = safe_repr(loc[key])
    for key in ("arr", "nums", "values", "s", "dp"):
        if key in loc:
            val = loc[key]
            if isinstance(val, str):
                focus["sequence"] = list(val)
            elif isinstance(val, list):
                focus["sequence"] = val[:40]
                if key == "dp":
                    focus["dp"] = val[:40]
            elif hasattr(val, "val"):
                focus["list_head"] = safe_repr(val)
    # Stack / queue / heap → sequence for linear canvas
    for key in ("stack", "queue", "heap"):
        if key in loc and "sequence" not in focus:
            val = loc[key]
            try:
                focus["sequence"] = list(val)[:40]
            except Exception:
                focus["sequence"] = safe_repr(val)
            break
    # 2D grid / matrix
    for grid_key in ("grid", "matrix"):
        if grid_key in loc and isinstance(loc[grid_key], list):
            rows = []
            for row in loc[grid_key][:40]:
                if isinstance(row, (list, tuple)):
                    rows.append(list(row)[:40])
                else:
                    rows.append(row)
            focus["grid"] = rows
            break
    # Binary tree node snapshot
    for key in ("root", "node"):
        if key in loc and hasattr(loc[key], "val"):
            focus["tree"] = _tree_snapshot(loc[key])
            break
    # Graph adjacency / edges
    if "g" in loc and isinstance(loc["g"], dict):
        focus["graph"] = {str(k): list(v)[:12] for k, v in list(loc["g"].items())[:20]}
    if "edges" in loc and isinstance(loc["edges"], list):
        focus["edges"] = loc["edges"][:30]
    for key in ("seen", "visited"):
        if key in loc:
            try:
                focus["seen"] = sorted(list(loc[key]))[:40]
            except Exception:
                focus["seen"] = safe_repr(loc[key])
            break
    # Also surface sequence from common alias names used in demos
    if "sequence" not in focus:
        for key, val in loc.items():
            if key in {"g", "seen", "visited", "q", "queue", "grid", "matrix", "stack", "heap"}:
                continue
            if isinstance(val, list) and val and all(isinstance(x, (int, float, str, bool, type(None))) for x in val[:8]):
                focus["sequence"] = val[:40]
                break
    return focus


def _tree_snapshot(root, limit=15):
    """Level-order values for canvas rendering."""
    if root is None:
        return []
    out = []
    q = [root]
    count = 0
    while q and count < limit:
        node = q.pop(0)
        if node is None:
            out.append(None)
            continue
        out.append(getattr(node, "val", None))
        q.append(getattr(node, "left", None))
        q.append(getattr(node, "right", None))
        count += 1
    while out and out[-1] is None:
        out.pop()
    return out

def tracer(frame, event, arg):
    if event not in ("line", "call", "return", "exception"):
        return tracer
    # Only trace student module frames
    if frame.f_globals.get("__name__") != "student_mod":
        return tracer
    if len(events) >= MAX_STEPS:
        raise Limit("trace step limit exceeded")
    loc = {
        k: safe_repr(v)
        for k, v in frame.f_locals.items()
        if not k.startswith("__") and k not in ("safe_repr", "focus_from_locals", "tracer")
    }
    events.append({
        "line": frame.f_lineno,
        "event": event,
        "locals": loc,
        "focus": focus_from_locals(frame.f_locals),
    })
    return tracer

student_mod = types.ModuleType("student_mod")
student_mod.__dict__["__builtins__"] = __builtins__

err = None
result = None
try:
    compiled = compile(code, "<student>", "exec")
    sys.settrace(tracer)
    exec(compiled, student_mod.__dict__)
    if fn_name not in student_mod.__dict__:
        raise RuntimeError(f"Function {fn_name} not defined")
    fn = student_mod.__dict__[fn_name]
    # Avoid mutating caller expectations: shallow-copy list args
    call_args = []
    for a in args:
        if isinstance(a, list):
            call_args.append(list(a))
        else:
            call_args.append(a)
    result = fn(*call_args)
except Limit as exc:
    err = str(exc)
except Exception:
    err = traceback.format_exc(limit=3)
finally:
    sys.settrace(None)

# JSON-serialize result
def encode(v):
    if isinstance(v, (int, float, str, bool)) or v is None:
        return v
    if isinstance(v, list):
        return [encode(x) for x in v[:100]]
    return safe_repr(v)

out = {
    "ok": err is None,
    "result": encode(result) if err is None else None,
    "error": err,
    "events": events,
    "stdout": "".join(stdout_chunks)[:max_output],
}
sys.stdout.write(json.dumps(out))
'''
)


def run_in_subprocess(
    code: str,
    function_name: str,
    args: list[Any] | None = None,
    timeout_sec: float | None = None,
    max_steps: int | None = None,
) -> dict[str, Any]:
    settings = get_settings()
    timeout = timeout_sec if timeout_sec is not None else settings.run_timeout_sec
    steps = max_steps if max_steps is not None else settings.run_max_steps

    with tempfile.TemporaryDirectory() as tmp:
        worker_path = Path(tmp) / "worker.py"
        worker_path.write_text(WORKER, encoding="utf-8")
        payload = {
            "code": code,
            "function_name": function_name,
            "args": args or [],
            "max_output_chars": settings.run_max_output_chars,
        }
        try:
            proc = subprocess.run(
                [sys.executable, str(worker_path), str(steps)],
                input=json.dumps(payload).encode("utf-8"),
                capture_output=True,
                timeout=timeout,
                check=False,
                env={
                    **os.environ,
                    "PYTHONDONTWRITEBYTECODE": "1",
                },
            )
        except subprocess.TimeoutExpired:
            return {
                "ok": False,
                "result": None,
                "error": "Execution timed out. Check for infinite loops.",
                "events": [],
                "stdout": "",
                "backend": "subprocess",
            }

        if proc.returncode != 0 and not proc.stdout:
            err = proc.stderr.decode("utf-8", errors="replace")[:2000] or "Runner failed"
            return {
                "ok": False,
                "result": None,
                "error": err,
                "events": [],
                "stdout": "",
                "backend": "subprocess",
            }

        try:
            data = json.loads(proc.stdout.decode("utf-8"))
            data["backend"] = "subprocess"
            return data
        except json.JSONDecodeError:
            return {
                "ok": False,
                "result": None,
                "error": proc.stderr.decode("utf-8", errors="replace")[:2000] or "Invalid runner output",
                "events": [],
                "stdout": "",
                "backend": "subprocess",
            }


def run_student_code(
    code: str,
    function_name: str,
    args: list[Any] | None = None,
    timeout_sec: float | None = None,
    max_steps: int | None = None,
) -> dict[str, Any]:
    """Run student/demo code. Prefers Docker when DSA_USE_DOCKER=1, else subprocess."""
    try:
        from app.runner.docker_runner import docker_available, run_in_docker

        if docker_available():
            return run_in_docker(code, function_name, args=args, timeout_sec=timeout_sec, max_steps=max_steps)
    except Exception:
        pass
    return run_in_subprocess(code, function_name, args=args, timeout_sec=timeout_sec, max_steps=max_steps)

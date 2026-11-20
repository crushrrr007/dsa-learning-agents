from __future__ import annotations

import re
from typing import Any


def focus_snapshots(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    snaps: list[dict[str, Any]] = []
    for ev in events:
        focus = ev.get("focus") or {}
        if focus:
            snaps.append(focus)
    return snaps


def flatten_focus_text(focus: dict[str, Any]) -> str:
    parts: list[str] = []
    for key, value in focus.items():
        parts.append(f"{key} {value}")
    return " ".join(parts).lower()


def extract_numbers(text: str) -> list[str]:
    return re.findall(r"-?\d+", text)


def answer_supported_by_trace(answer: str, events: list[dict[str, Any]], keys: list[str] | None = None) -> bool:
    """True when the student's answer reflects values that actually appear in the live trace."""
    if not events:
        return False
    snaps = focus_snapshots(events)
    if not snaps:
        return False
    norm = answer.strip().lower()
    blob = " ".join(flatten_focus_text(s) for s in snaps)
    # Direct substring against combined focus text
    compact = re.sub(r"[^a-z0-9]+", " ", norm)
    if compact and compact in re.sub(r"[^a-z0-9]+", " ", blob):
        return True

    nums = extract_numbers(norm)
    if not nums:
        # keyword answers like "false" / "right"
        for token in ("false", "true", "right", "left", "slow", "fast"):
            if token in norm and token in blob:
                return True
        return False

    # If pointer keys are specified, ensure those values show up paired in some snapshot
    keys = keys or ["left", "right", "i", "j", "slow", "fast", "write"]
    for snap in snaps:
        present = []
        for key in keys:
            if key in snap:
                present.extend(extract_numbers(str(snap[key])))
        if present and all(n in present for n in nums[:2]):
            return True
        # Also accept when all mentioned numbers appear somewhere in this focus
        focus_nums = extract_numbers(flatten_focus_text(snap))
        if nums and all(n in focus_nums for n in nums):
            return True
    return all(n in extract_numbers(blob) for n in nums)


def run_reference_trace(problem: dict[str, Any], normalize_args) -> dict[str, Any]:
    from app.runner.sandbox import run_student_code

    args = normalize_args(problem, None)
    return run_student_code(problem["reference_solution"], problem["function_name"], args=args)

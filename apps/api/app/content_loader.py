from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.config import get_settings


def _content_dir() -> Path:
    return get_settings().content_dir


def slugify_pattern(label: str) -> str:
    s = (label or "pattern").strip().lower()
    s = s.replace("/", " ")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-") or "pattern"


def clear_content_cache() -> None:
    load_roadmap.cache_clear()
    load_all_problems.cache_clear()
    load_topic_quiz.cache_clear()
    load_diagnostic.cache_clear()
    list_patterns.cache_clear()
    list_sheets.cache_clear()
    load_sheet.cache_clear()


@lru_cache
def load_roadmap() -> dict[str, Any]:
    path = _content_dir() / "topics" / "roadmap.json"
    return json.loads(path.read_text(encoding="utf-8"))


@lru_cache
def load_all_problems() -> dict[str, dict[str, Any]]:
    problems: dict[str, dict[str, Any]] = {}
    for path in sorted((_content_dir() / "problems").glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        label = data.get("pattern") or "General"
        data["pattern"] = label
        data["pattern_id"] = data.get("pattern_id") or slugify_pattern(label)
        problems[data["id"]] = data
    return problems


@lru_cache
def load_topic_quiz(topic: str) -> tuple[dict[str, Any], ...]:
    path = _content_dir() / "quizzes" / f"{topic}.json"
    if path.exists():
        return tuple(json.loads(path.read_text(encoding="utf-8")))
    return tuple()


def get_problem(problem_id: str) -> dict[str, Any]:
    problems = load_all_problems()
    if problem_id not in problems:
        raise KeyError(problem_id)
    return problems[problem_id]


def list_problems(topic: str | None = None, pattern: str | None = None) -> list[dict[str, Any]]:
    items = list(load_all_problems().values())
    if topic:
        items = [p for p in items if p["topic"] == topic]
    if pattern:
        pid = pattern if not pattern.startswith("pattern:") else pattern
        # accept pattern_id or display label
        items = [
            p
            for p in items
            if p.get("pattern_id") == pid or slugify_pattern(p.get("pattern", "")) == slugify_pattern(pid)
        ]
    return sorted(items, key=lambda p: (p["topic"], p["title"]))


@lru_cache
def list_patterns() -> tuple[dict[str, Any], ...]:
    by_id: dict[str, dict[str, Any]] = {}
    for p in load_all_problems().values():
        pid = p["pattern_id"]
        if pid not in by_id:
            by_id[pid] = {
                "id": pid,
                "title": p["pattern"],
                "topics": set(),
                "problem_ids": [],
            }
        by_id[pid]["topics"].add(p["topic"])
        by_id[pid]["problem_ids"].append(p["id"])
    out = []
    for pid, row in sorted(by_id.items(), key=lambda x: x[1]["title"].lower()):
        out.append(
            {
                "id": pid,
                "title": row["title"],
                "topics": sorted(row["topics"]),
                "problems_total": len(row["problem_ids"]),
                "problem_ids": row["problem_ids"],
            }
        )
    return tuple(out)


@lru_cache
def list_sheets() -> tuple[dict[str, Any], ...]:
    root = _content_dir() / "sheets"
    if not root.exists():
        return tuple()
    out: list[dict[str, Any]] = []
    for path in sorted(root.glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        out.append(
            {
                "id": data["id"],
                "title": data.get("title") or data["id"],
                "subtitle": data.get("subtitle") or "",
                "inspired_by": list(data.get("inspired_by") or []),
                "problems_total": len(data.get("problem_ids") or []),
            }
        )
    return tuple(out)


@lru_cache
def load_sheet(sheet_id: str) -> dict[str, Any]:
    path = _content_dir() / "sheets" / f"{sheet_id}.json"
    if not path.exists():
        raise KeyError(sheet_id)
    data = json.loads(path.read_text(encoding="utf-8"))
    problems = load_all_problems()
    items = []
    for pid in data.get("problem_ids") or []:
        p = problems.get(pid)
        if not p:
            continue
        items.append(
            {
                "id": p["id"],
                "title": p["title"],
                "topic": p["topic"],
                "difficulty": p["difficulty"],
                "pattern": p["pattern"],
                "pattern_id": p.get("pattern_id") or "",
            }
        )
    return {
        "id": data["id"],
        "title": data.get("title") or data["id"],
        "subtitle": data.get("subtitle") or "",
        "inspired_by": list(data.get("inspired_by") or []),
        "problems": items,
        "problems_total": len(items),
    }


def public_problem(problem: dict[str, Any]) -> dict[str, Any]:
    """Strip solutions and hidden tests before sending to the browser."""
    out: dict[str, Any] = {
        "id": problem["id"],
        "title": problem["title"],
        "topic": problem["topic"],
        "difficulty": problem["difficulty"],
        "pattern": problem["pattern"],
        "pattern_id": problem.get("pattern_id") or slugify_pattern(problem.get("pattern", "")),
        "statement": problem["statement"],
        "examples": problem["examples"],
        "constraints": problem["constraints"],
        "starter_code": problem["starter_code"],
        "function_name": problem["function_name"],
        "visual": problem["visual"],
        "predict_steps": [
            {"prompt": s["prompt"], "hint": s.get("hint", "")}
            for s in problem.get("predict_steps", [])
        ],
        "sources": list(problem.get("sources") or []),
        "variant": bool(problem.get("variant", False)),
        # Questions only — never expose expected_points / min_points.
        "viva": [{"question": str(item.get("question") or "")} for item in (problem.get("viva") or [])],
        # Safe preview seed for AlgoMaster-style canvas (demo input only — no solution).
        "demo_preview": _demo_preview(problem),
    }
    return out


def _demo_preview(problem: dict[str, Any]) -> list[Any] | None:
    """Turn demo_input into a linear sequence the canvas can show before first run."""
    demo = problem.get("demo_input")
    visual = (problem.get("visual") or "array").lower()
    if demo is None:
        return None
    if isinstance(demo, str):
        if visual in ("array", "window", "dp", "linkedlist"):
            return list(demo)
        return [demo]
    if isinstance(demo, list):
        # multi-arg demos: prefer first list/string arg as the sequence
        for item in demo:
            if isinstance(item, list):
                return item[:40]
            if isinstance(item, str) and visual in ("array", "window", "dp", "linkedlist"):
                return list(item)
        if demo and all(isinstance(x, (int, float, str, bool, type(None))) for x in demo[:8]):
            return demo[:40]
    if isinstance(demo, dict):
        for key in ("s", "nums", "arr", "values", "heights", "prices"):
            if key in demo:
                val = demo[key]
                if isinstance(val, str):
                    return list(val)
                if isinstance(val, list):
                    return val[:40]
    return None


def load_notes(topic: str) -> str:
    path = _content_dir() / "notes" / f"{topic}.md"
    if not path.exists():
        return f"# {topic}\n\nNotes coming soon."
    return path.read_text(encoding="utf-8")


def topic_quiz(topic: str) -> list[dict[str, Any]]:
    dedicated = list(load_topic_quiz(topic))
    if dedicated:
        return dedicated
    problems = list_problems(topic)
    if not problems:
        return []
    return list(problems[0].get("learn_quiz", []))


def public_quiz(topic: str) -> list[dict[str, Any]]:
    return [
        {"question": q["question"], "choices": q["choices"]}
        for q in topic_quiz(topic)
    ]


@lru_cache
def load_diagnostic(topic: str) -> dict[str, Any]:
    path = _content_dir() / "diagnostics" / f"{topic}.json"
    if not path.exists():
        return {
            "topic": topic,
            "title": f"{topic} — prerequisite check",
            "prerequisites": [],
            "questions": [],
        }
    return json.loads(path.read_text(encoding="utf-8"))


def public_diagnostic(topic: str) -> dict[str, Any]:
    data = load_diagnostic(topic)
    return {
        "topic": data.get("topic", topic),
        "title": data.get("title", topic),
        "prerequisites": data.get("prerequisites", []),
        "questions": [
            {
                "id": q["id"],
                "type": q.get("type", "mcq"),
                "prompt": q["prompt"],
                "choices": q.get("choices", []),
            }
            for q in data.get("questions", [])
        ],
    }

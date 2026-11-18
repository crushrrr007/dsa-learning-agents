from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.config import get_settings


def _content_dir() -> Path:
    return get_settings().content_dir


@lru_cache
def load_roadmap() -> dict[str, Any]:
    path = _content_dir() / "topics" / "roadmap.json"
    return json.loads(path.read_text(encoding="utf-8"))


@lru_cache
def load_all_problems() -> dict[str, dict[str, Any]]:
    problems: dict[str, dict[str, Any]] = {}
    for path in sorted((_content_dir() / "problems").glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        problems[data["id"]] = data
    return problems


def get_problem(problem_id: str) -> dict[str, Any]:
    problems = load_all_problems()
    if problem_id not in problems:
        raise KeyError(problem_id)
    return problems[problem_id]


def list_problems(topic: str | None = None) -> list[dict[str, Any]]:
    items = list(load_all_problems().values())
    if topic:
        items = [p for p in items if p["topic"] == topic]
    return sorted(items, key=lambda p: (p["topic"], p["title"]))


def public_problem(problem: dict[str, Any]) -> dict[str, Any]:
    """Strip solutions and hidden tests before sending to the browser."""
    return {
        "id": problem["id"],
        "title": problem["title"],
        "topic": problem["topic"],
        "difficulty": problem["difficulty"],
        "pattern": problem["pattern"],
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
    }


def load_notes(topic: str) -> str:
    path = _content_dir() / "notes" / f"{topic}.md"
    if not path.exists():
        return f"# {topic}\n\nNotes coming soon."
    return path.read_text(encoding="utf-8")


def topic_quiz(topic: str) -> list[dict[str, Any]]:
    problems = list_problems(topic)
    if not problems:
        return []
    quiz = problems[0].get("learn_quiz", [])
    # Do not leak answer_index to clients in raw form elsewhere; API will strip.
    return quiz


def public_quiz(topic: str) -> list[dict[str, Any]]:
    return [
        {"question": q["question"], "choices": q["choices"]}
        for q in topic_quiz(topic)
    ]

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.config import get_settings


def _content_dir() -> Path:
    return get_settings().content_dir


def clear_content_cache() -> None:
    load_roadmap.cache_clear()
    load_all_problems.cache_clear()
    load_topic_quiz.cache_clear()
    load_diagnostic.cache_clear()


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

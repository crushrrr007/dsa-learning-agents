"""Infer call args from problem content — no per-function name registries."""

from __future__ import annotations

import ast
from typing import Any


def problem_arity(problem: dict[str, Any]) -> int:
    """Number of positional args the student function expects.

    Taken from the first hidden test when present; otherwise 1.
    """
    tests = problem.get("hidden_tests") or []
    if tests:
        args = tests[0].get("args")
        if isinstance(args, list):
            return len(args)
    return 1


def normalize_demo_args(problem: dict[str, Any], args: list[Any] | None = None) -> list[Any]:
    """Resolve run args from an explicit list or the problem's demo_input."""
    if args is not None:
        return args
    demo = problem.get("demo_input")
    if isinstance(demo, dict):
        # JSON object key order matches call order in content files.
        return list(demo.values())
    return [demo]


def edge_case_args(problem: dict[str, Any], edge: Any) -> list[Any]:
    """Turn one edge_cases entry into positional args for the runner.

    Multi-arg problems store a full arg list per edge case.
    Single-arg problems store the bare argument (which may itself be a list).
    """
    if isinstance(edge, list) and problem_arity(problem) > 1:
        return edge
    return [edge]


def _split_top_level(text: str, sep: str = ",") -> list[str]:
    parts: list[str] = []
    depth = 0
    in_str: str | None = None
    buf: list[str] = []
    i = 0
    while i < len(text):
        ch = text[i]
        if in_str:
            buf.append(ch)
            if ch == "\\" and i + 1 < len(text):
                buf.append(text[i + 1])
                i += 2
                continue
            if ch == in_str:
                in_str = None
            i += 1
            continue
        if ch in "'\"":
            in_str = ch
            buf.append(ch)
        elif ch in "([{":
            depth += 1
            buf.append(ch)
        elif ch in ")]}":
            depth -= 1
            buf.append(ch)
        elif ch == sep and depth == 0:
            parts.append("".join(buf).strip())
            buf = []
        else:
            buf.append(ch)
        i += 1
    if buf:
        parts.append("".join(buf).strip())
    return [p for p in parts if p]


def _literal(text: str) -> Any:
    cleaned = text.strip()
    cleaned = cleaned.replace("null", "None").replace("true", "True").replace("false", "False")
    return ast.literal_eval(cleaned)


def parse_example_args(problem: dict[str, Any], example_input: str) -> list[Any]:
    """Parse a human-readable examples[].input into positional args."""
    text = example_input.strip()
    try:
        value = _literal(text)
        return [value]
    except (SyntaxError, ValueError):
        pass

    if "=" in text:
        pairs: dict[str, Any] = {}
        order: list[str] = []
        for part in _split_top_level(text):
            if "=" not in part:
                continue
            key, raw = part.split("=", 1)
            key = key.strip()
            pairs[key] = _literal(raw.strip())
            order.append(key)
        demo = problem.get("demo_input")
        if isinstance(demo, dict) and set(pairs) >= set(demo.keys()):
            return [pairs[k] for k in demo.keys()]
        return [pairs[k] for k in order]

    raise ValueError(f"Cannot parse example input: {example_input!r}")


def parse_example_expected(example_output: str) -> Any:
    text = example_output.strip()
    if " (" in text:
        text = text.split(" (", 1)[0].strip()
    return _literal(text)

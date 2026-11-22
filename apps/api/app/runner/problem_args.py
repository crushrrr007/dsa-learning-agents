"""Infer call args from problem content — no per-function name registries."""

from __future__ import annotations

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

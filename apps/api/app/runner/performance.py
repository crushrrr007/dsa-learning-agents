from __future__ import annotations

import time
from typing import Any, Callable

from app.runner.sandbox import run_student_code


def measure_scaling(
    code: str,
    function_name: str,
    make_args: Callable[[int], list[Any]],
    sizes: list[int] | None = None,
) -> list[dict[str, Any]]:
    sizes = sizes or [50, 100, 200]
    points: list[dict[str, Any]] = []
    for n in sizes:
        args = make_args(n)
        started = time.perf_counter()
        result = run_student_code(code, function_name, args=args, timeout_sec=1.5, max_steps=5000)
        elapsed = (time.perf_counter() - started) * 1000
        points.append(
            {
                "n": n,
                "ms": round(elapsed, 2),
                "ok": result.get("ok", False),
                "error": result.get("error"),
            }
        )
        if not result.get("ok"):
            break
    return points


def default_args_for_problem(problem: dict, n: int) -> list[Any]:
    fn = problem["function_name"]
    if fn in {"reverse_array", "move_zeros", "remove_duplicates", "reverse_list", "find_middle"}:
        return [list(range(n))]
    if fn == "is_palindrome":
        return ["a" * n]
    if fn == "two_sum_sorted":
        return [list(range(n)), n - 1]
    if fn == "max_sum_subarray":
        return [list(range(n)), max(1, n // 4)]
    if fn == "longest_unique":
        return [("abc" * (n // 3 + 1))[:n]]
    if fn == "has_cycle":
        return [list(range(n)), -1]
    if fn in {"max_depth", "invert_tree"}:
        return [list(range(1, max(2, n // 5) + 1))]
    if fn == "shortest_path":
        edges = [[i, i + 1] for i in range(max(1, n // 10) - 1)]
        return [max(1, n // 10), edges, 0, max(0, n // 10 - 1)]
    if fn == "count_components":
        return [max(1, n // 10), []]
    if fn == "climb_stairs":
        return [min(20, max(1, n // 10))]
    if fn == "rob":
        return [list(range(1, max(2, n // 10) + 1))]
    return [list(range(n))]

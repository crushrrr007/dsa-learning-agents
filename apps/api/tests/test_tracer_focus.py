"""Tracer focus captures for stack/queue/heap and 2D grids."""

from __future__ import annotations

from app.runner.sandbox import run_student_code


def test_stack_and_queue_land_in_sequence():
    code = """
def walk(n):
    stack = []
    for i in range(n):
        stack.append(i)
    queue = list(stack)
    return stack
"""
    raw = run_student_code(code, "walk", args=[3])
    assert raw["ok"] is True
    focuses = [e.get("focus") or {} for e in raw["events"]]
    assert any(f.get("sequence") == [0, 1, 2] or f.get("sequence") == [0, 1] for f in focuses)


def test_grid_and_visited_in_focus():
    code = """
def scan(grid):
    rows = len(grid)
    cols = len(grid[0]) if grid else 0
    visited = set()
    for r in range(rows):
        for c in range(cols):
            visited.add((r, c))
            _ = grid[r][c]
    return len(visited)
"""
    grid = [[1, 2], [3, 4]]
    raw = run_student_code(code, "scan", args=[grid])
    assert raw["ok"] is True
    assert raw["result"] == 4
    focuses = [e.get("focus") or {} for e in raw["events"]]
    assert any(f.get("grid") == grid for f in focuses)
    assert any(
        isinstance(f.get("seen"), list) and [0, 0] in f["seen"] or (0, 0) in (f.get("seen") or [])
        for f in focuses
    )


def test_heap_captures_as_sequence():
    code = """
import heapq
def push_all(vals):
    heap = []
    for v in vals:
        heapq.heappush(heap, v)
    return heap
"""
    raw = run_student_code(code, "push_all", args=[[3, 1, 2]])
    assert raw["ok"] is True
    focuses = [e.get("focus") or {} for e in raw["events"]]
    assert any(isinstance(f.get("sequence"), list) and len(f["sequence"]) >= 1 for f in focuses)

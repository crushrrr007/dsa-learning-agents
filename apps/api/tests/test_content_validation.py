"""Safety net: every content/problems/*.json is structurally sound and runnable."""

from __future__ import annotations

import ast
import json
import re
from pathlib import Path
from typing import Any

import pytest

from app.content_loader import clear_content_cache, public_problem
from app.runner.problem_args import edge_case_args, normalize_demo_args, problem_arity
from app.runner.sandbox import run_student_code

CONTENT_PROBLEMS = Path(__file__).resolve().parents[3] / "content" / "problems"

REQUIRED_FIELDS = (
    "id",
    "title",
    "topic",
    "difficulty",
    "pattern",
    "statement",
    "examples",
    "constraints",
    "starter_code",
    "function_name",
    "visual",
    "brute_force_code",
    "demo_input",
    "predict_steps",
    "hidden_tests",
    "edge_cases",
    "reference_solution",
    "viva",
)

ALLOWED_SOURCES = {"blind75", "neetcode150", "grind75"}
ALLOWED_VISUALS = {"array", "window", "linkedlist", "tree", "graph", "dp", "grid"}


def _problem_paths() -> list[Path]:
    return sorted(CONTENT_PROBLEMS.glob("*.json"))


def _load(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


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

    raise AssertionError(f"Cannot parse example input for {problem['id']}: {example_input!r}")


def parse_example_expected(example_output: str) -> Any:
    text = example_output.strip()
    # Allow trailing commentary: "2 (array starts with ...)"
    if " (" in text:
        text = text.split(" (", 1)[0].strip()
    try:
        return _literal(text)
    except (SyntaxError, ValueError):
        # bare identifiers already handled by True/False replace
        raise AssertionError(f"Cannot parse example output: {example_output!r}") from None


def _defines_function(code: str, name: str) -> bool:
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return False
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef) and node.name == name:
            return True
    return False


@pytest.fixture(scope="module", autouse=True)
def _clear_cache():
    clear_content_cache()
    yield
    clear_content_cache()


@pytest.mark.parametrize("path", _problem_paths(), ids=lambda p: p.stem)
def test_problem_content_file(path: Path):
    problem = _load(path)
    pid = problem.get("id", path.stem)

    missing = [f for f in REQUIRED_FIELDS if f not in problem]
    assert not missing, f"{pid}: missing fields {missing}"
    assert problem["id"] == path.stem
    assert problem["visual"] in ALLOWED_VISUALS, f"{pid}: bad visual {problem['visual']}"

    sources = problem.get("sources") or []
    assert isinstance(sources, list)
    for src in sources:
        assert src in ALLOWED_SOURCES, f"{pid}: unknown source {src}"
    if problem.get("variant"):
        assert sources, f"{pid}: variant=true requires sources"

    fn = problem["function_name"]
    assert _defines_function(problem["reference_solution"], fn), (
        f"{pid}: function_name {fn!r} not defined in reference_solution"
    )
    assert _defines_function(problem["brute_force_code"], fn), (
        f"{pid}: function_name {fn!r} not defined in brute_force_code"
    )

    tests = problem["hidden_tests"]
    assert len(tests) >= 5, f"{pid}: need >= 5 hidden_tests, got {len(tests)}"
    arity = problem_arity(problem)
    for i, case in enumerate(tests):
        assert "args" in case and "expected" in case
        assert isinstance(case["args"], list)
        assert len(case["args"]) == arity, f"{pid} hidden[{i}] arity mismatch"
        raw = run_student_code(problem["reference_solution"], fn, args=case["args"])
        assert raw["ok"], f"{pid} hidden[{i}] reference error: {raw.get('error')}"
        assert raw["result"] == case["expected"], (
            f"{pid} hidden[{i}]: got {raw['result']!r} expected {case['expected']!r}"
        )

    for i, edge in enumerate(problem["edge_cases"]):
        args = edge_case_args(problem, edge)
        assert len(args) == arity, f"{pid} edge[{i}] arity mismatch"
        raw = run_student_code(problem["reference_solution"], fn, args=args)
        assert raw["ok"], f"{pid} edge[{i}] reference error: {raw.get('error')}"

    # Brute force must match visible examples
    for i, ex in enumerate(problem["examples"]):
        args = parse_example_args(problem, ex["input"])
        expected = parse_example_expected(ex["output"])
        # Align arity: kwargs parser returns full list; literal may need wrap already done
        if len(args) != arity and arity == 1 and len(args) == 1:
            pass
        assert len(args) == arity or (arity == 1 and len(args) == 1), (
            f"{pid} example[{i}] arity: {args!r} vs {arity}"
        )
        if len(args) != arity and arity > 1:
            # retry via normalize from a synthetic demo object if needed
            raise AssertionError(f"{pid} example[{i}] could not align arity for {ex['input']!r}")
        raw = run_student_code(problem["brute_force_code"], fn, args=args)
        assert raw["ok"], f"{pid} example[{i}] brute error: {raw.get('error')}"
        assert raw["result"] == expected, (
            f"{pid} example[{i}] brute: got {raw['result']!r} expected {expected!r} "
            f"(args={args!r})"
        )

    viva = problem.get("viva")
    assert isinstance(viva, list), f"{pid}: viva must be a list"
    assert 2 <= len(viva) <= 3, f"{pid}: viva needs 2-3 items, got {len(viva)}"
    for vi, item in enumerate(viva):
        assert isinstance(item, dict), f"{pid} viva[{vi}] must be an object"
        assert isinstance(item.get("question"), str) and item["question"].strip(), (
            f"{pid} viva[{vi}]: question required"
        )
        points = item.get("expected_points")
        assert isinstance(points, list) and 3 <= len(points) <= 4, (
            f"{pid} viva[{vi}]: expected_points must have 3-4 items, got {len(points) if isinstance(points, list) else points}"
        )
        assert all(isinstance(p, str) and p.strip() for p in points), (
            f"{pid} viva[{vi}]: expected_points must be non-empty strings"
        )
        min_pts = item.get("min_points")
        assert isinstance(min_pts, int) and 1 <= min_pts <= len(points), (
            f"{pid} viva[{vi}]: min_points must be int in 1..len(expected_points)"
        )

    # public_problem must not leak solutions / hidden tests / viva rubric
    pub = public_problem(problem)
    blob = json.dumps(pub)
    assert "reference_solution" not in blob
    assert "hidden_tests" not in blob
    assert "brute_force_code" not in blob
    assert "edge_cases" not in blob
    assert "expected_points" not in blob
    assert "min_points" not in blob
    assert pub.get("sources", []) == list(problem.get("sources") or [])
    assert pub.get("variant", False) == bool(problem.get("variant", False))
    assert len(pub.get("viva") or []) == len(viva)
    for pub_item, raw_item in zip(pub["viva"], viva, strict=True):
        assert list(pub_item.keys()) == ["question"]
        assert pub_item["question"] == raw_item["question"]

    # demo_input normalizes to the declared arity
    demo_args = normalize_demo_args(problem)
    assert len(demo_args) == arity, f"{pid}: demo_input arity {len(demo_args)} != {arity}"

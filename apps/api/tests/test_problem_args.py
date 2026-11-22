"""Arity inference and multi-arg demo/test paths (no per-name registries)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.content_loader import clear_content_cache, get_problem
from app.main import app
from app.runner.problem_args import edge_case_args, normalize_demo_args, problem_arity


def test_arity_from_hidden_tests():
    assert problem_arity(get_problem("two-sum-sorted")) == 2
    assert problem_arity(get_problem("bfs-shortest-path")) == 4
    assert problem_arity(get_problem("valid-palindrome")) == 1
    assert problem_arity({"hidden_tests": []}) == 1


def test_normalize_and_edge_helpers_match_content():
    two = get_problem("two-sum-sorted")
    assert normalize_demo_args(two) == [[2, 7, 11, 15], 9]
    assert edge_case_args(two, [[1, 2], 3]) == [[1, 2], 3]

    one = get_problem("reverse-array")
    assert normalize_demo_args(one) == [one["demo_input"]]
    assert edge_case_args(one, [1, 2]) == [[1, 2]]

    three = {
        "demo_input": {"x": 1, "y": 2, "z": 3},
        "hidden_tests": [{"args": [1, 2, 3], "expected": 6}],
        "edge_cases": [[9, 8, 7]],
    }
    assert problem_arity(three) == 3
    assert normalize_demo_args(three) == [1, 2, 3]
    assert edge_case_args(three, [9, 8, 7]) == [9, 8, 7]


def test_two_and_three_arg_through_run_and_test(monkeypatch):
    clear_content_cache()
    two = get_problem("two-sum-sorted")
    three = {
        "id": "synth-triple-product",
        "title": "Triple product",
        "topic": "arrays",
        "difficulty": "easy",
        "pattern": "Arity test",
        "statement": "Return a*b*c",
        "examples": [],
        "constraints": [],
        "starter_code": "def triple(a, b, c):\n    return 0\n",
        "function_name": "triple",
        "visual": "array",
        "brute_force_code": "def triple(a, b, c):\n    return a * b * c\n",
        "demo_input": {"a": 2, "b": 3, "c": 4},
        "predict_steps": [],
        "hidden_tests": [
            {"args": [2, 3, 4], "expected": 24},
            {"args": [1, 1, 5], "expected": 5},
            {"args": [0, 9, 9], "expected": 0},
            {"args": [-1, 2, 3], "expected": -6},
            {"args": [10, 10, 10], "expected": 1000},
        ],
        "edge_cases": [[1, 2, 3], [2, 2, 2]],
        "reference_solution": "def triple(a, b, c):\n    return a * b * c\n",
    }

    real_get = get_problem

    def _get(pid: str):
        if pid == three["id"]:
            return three
        return real_get(pid)

    monkeypatch.setattr("app.routers.run.get_problem", _get)

    with TestClient(app) as client:
        # 2-arg: demo via /run (no args → demo_input)
        run2 = client.post(
            "/run",
            json={
                "session_id": "arity_2",
                "problem_id": "two-sum-sorted",
                "mode": "student",
                "code": two["reference_solution"],
            },
        )
        assert run2.status_code == 200
        body2 = run2.json()
        assert body2["ok"] is True
        assert body2["result"] == [0, 1]

        test2 = client.post(
            "/test",
            json={
                "session_id": "arity_2",
                "problem_id": "two-sum-sorted",
                "code": two["reference_solution"],
            },
        )
        assert test2.status_code == 200
        results2 = test2.json()["results"]
        assert any(r["index"] < 100 for r in results2)
        assert all(r["passed"] for r in results2)

        # 3-arg synthetic through same endpoints
        run3 = client.post(
            "/run",
            json={
                "session_id": "arity_3",
                "problem_id": three["id"],
                "mode": "student",
                "code": three["reference_solution"],
            },
        )
        assert run3.status_code == 200
        body3 = run3.json()
        assert body3["ok"] is True
        assert body3["result"] == 24

        test3 = client.post(
            "/test",
            json={
                "session_id": "arity_3",
                "problem_id": three["id"],
                "code": three["reference_solution"],
            },
        )
        assert test3.status_code == 200
        results3 = test3.json()["results"]
        assert len([r for r in results3 if r["index"] < 100]) == 5
        assert all(r["passed"] for r in results3)

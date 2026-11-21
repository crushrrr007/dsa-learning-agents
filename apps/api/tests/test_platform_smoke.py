"""Smoke tests for Pointer Lab API core paths."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.content_loader import clear_content_cache, get_problem
from app.main import app
from app.runner.sandbox import run_student_code


@pytest.fixture(scope="module")
def client():
    clear_content_cache()
    with TestClient(app) as c:
        yield c


def test_health(client: TestClient):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["ok"] is True


def test_roadmap_has_both_phases(client: TestClient):
    res = client.get("/topics/roadmap", params={"session_id": "test_smoke"})
    data = res.json()
    slugs = {t["slug"] for t in data["topics"]}
    assert {"arrays", "trees", "graphs", "dynamic-programming"} <= slugs
    assert len(data.get("phases", [])) == 2


def test_runner_palindrome_reference():
    problem = get_problem("valid-palindrome")
    raw = run_student_code(problem["reference_solution"], problem["function_name"], args=["racecar"])
    assert raw["ok"] is True
    assert raw["result"] is True
    assert len(raw["events"]) > 0


def test_runner_climb_stairs_and_tree():
    climb = get_problem("climb-stairs")
    raw = run_student_code(climb["reference_solution"], climb["function_name"], args=[5])
    assert raw["ok"] and raw["result"] == 8

    depth = get_problem("max-depth-binary-tree")
    raw2 = run_student_code(depth["reference_solution"], depth["function_name"], args=[[1, 2, 3, None, None, 4, 5]])
    assert raw2["ok"] and raw2["result"] == 3


def test_quiz_unlock_and_predict(client: TestClient):
    sid = "test_unlock"
    quiz = client.post("/topics/quiz", json={"session_id": sid, "topic": "two-pointers", "answers": [1, 1, 1]})
    assert quiz.status_code == 200
    assert quiz.json()["learn_completed"] is True

    problem = client.get("/problems/valid-palindrome", params={"session_id": sid})
    assert problem.status_code == 200
    assert problem.json()["stage"] >= 1

    pred = client.post(
        "/predict",
        json={
            "session_id": sid,
            "problem_id": "valid-palindrome",
            "step_index": 0,
            "answer": "left += 1, right -= 1",
        },
    )
    assert pred.status_code == 200
    assert pred.json()["correct"] is True


def test_topic_demo_trees(client: TestClient):
    res = client.post("/topics/trees/demo")
    assert res.status_code == 200
    data = res.json()
    assert data["ok"] is True
    assert data["result"] == 3
    assert len(data["events"]) > 0


def test_progress_reset(client: TestClient):
    sid = "test_reset_me"
    client.post("/topics/quiz", json={"session_id": sid, "topic": "arrays", "answers": [1, 1, 1]})
    before = client.get("/progress", params={"session_id": sid}).json()
    assert any(t["learn_completed"] for t in before["topics"] if t["slug"] == "arrays")
    reset = client.post("/progress/reset", json={"session_id": sid})
    assert reset.status_code == 200
    after = reset.json()["progress"]
    assert not any(t["learn_completed"] for t in after["topics"] if t["slug"] == "arrays")


def test_solutions_not_leaked(client: TestClient):
    res = client.get("/problems/climb-stairs", params={"session_id": "leakcheck"})
    data = res.json()
    blob = json.dumps(data)
    assert "reference_solution" not in blob
    assert "hidden_tests" not in blob


def test_content_files_exist():
    root = Path(__file__).resolve().parents[3] / "content"
    assert (root / "topics" / "roadmap.json").exists()
    assert len(list((root / "problems").glob("*.json"))) >= 16
    assert len(list((root / "quizzes").glob("*.json"))) == 7

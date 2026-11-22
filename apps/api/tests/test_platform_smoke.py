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


def test_roadmap_topics_flat(client: TestClient):
    res = client.get("/topics/roadmap", params={"session_id": "test_smoke"})
    data = res.json()
    slugs = {t["slug"] for t in data["topics"]}
    assert {"arrays", "trees", "graphs", "dynamic-programming"} <= slugs
    # Product UI no longer surfaces phases
    assert data.get("phases", []) == []


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


def test_agents_status_and_stage_routing(client: TestClient):
    status = client.get("/agents/status")
    assert status.status_code == 200
    body = status.json()
    assert {
        "concept_tutor",
        "demo_coach",
        "predict_coach",
        "code_mentor",
        "viva_agent",
        "diagnostic_agent",
        "plan_agent",
        "teach_agent",
    } <= set(body["agents"])
    assert body["llm"]["provider"] in {"mock", "groq", "openai"}

    expected = {
        0: "concept_tutor",
        1: "demo_coach",
        2: "predict_coach",
        3: "code_mentor",
        4: "viva_agent",
    }
    for stage, agent in expected.items():
        res = client.post(
            "/agents/chat",
            json={
                "session_id": "agent_route_test",
                "topic": "two-pointers",
                "stage": stage,
                "message": "What should I focus on next?",
            },
        )
        assert res.status_code == 200
        data = res.json()
        assert data["agent"] == agent
        assert data["reply"]
        assert data["llm_mode"] in {"mock", "groq", "openai"}

    forced = client.post(
        "/agents/chat",
        json={
            "session_id": "agent_route_test",
            "topic": "arrays",
            "stage": 1,
            "message": "Help me",
            "preferred_agent": "viva_agent",
        },
    )
    assert forced.status_code == 200
    assert forced.json()["agent"] == "viva_agent"


def test_soft_unlock_without_lesson(client: TestClient):
    """Problems are openable without completing topic quiz (soft plan)."""
    sid = "soft_unlock_session"
    res = client.get("/problems/valid-palindrome", params={"session_id": sid})
    assert res.status_code == 200
    assert res.json()["stage"] >= 1


def test_diagnostic_builds_soft_plan(client: TestClient):
    sid = "diag_plan_session"
    diag = client.get("/topics/two-pointers/diagnostic", params={"session_id": sid})
    assert diag.status_code == 200
    data = diag.json()
    assert len(data["questions"]) >= 3

    answers = {}
    for q in data["questions"]:
        # pick first choice / index 0 — weak path should still produce a plan
        answers[q["id"]] = 0 if q["type"] == "mcq" else q["choices"][0]

    built = client.post(
        "/topics/two-pointers/diagnostic",
        json={"session_id": sid, "answers": answers},
    )
    assert built.status_code == 200
    plan_body = built.json()
    assert plan_body["has_plan"] is True
    plan = plan_body["plan"]
    assert plan["next_problem_id"]
    assert plan.get("recommended") or plan.get("review_first")
    # Wrong MCQ answers (index 0) should yield at least one prereq micro-review
    assert isinstance(plan.get("micro_reviews"), list)
    assert len(plan["micro_reviews"]) >= 1
    assert plan["micro_reviews"][0].get("title")
    assert plan["micro_reviews"][0].get("blurb")

    fetched = client.get("/topics/two-pointers/plan", params={"session_id": sid})
    assert fetched.status_code == 200
    assert fetched.json()["has_plan"] is True

    overview = client.get("/topics/two-pointers/overview", params={"session_id": sid})
    assert overview.status_code == 200
    assert overview.json()["overview_markdown"]

    done = client.post(
        "/topics/two-pointers/overview/complete",
        json={"session_id": sid},
    )
    assert done.status_code == 200
    assert done.json()["overview_completed"] is True

    # Soft badges appear on problem list
    probs = client.get("/problems", params={"session_id": sid, "topic": "two-pointers"})
    assert probs.status_code == 200
    badges = [p.get("plan_badge") for p in probs.json() if p.get("plan_badge")]
    assert len(badges) >= 1


def test_content_diagnostics_exist():
    root = Path(__file__).resolve().parents[3] / "content"
    assert len(list((root / "diagnostics").glob("*.json"))) >= 7


def test_patterns_and_roadmap_graph(client: TestClient):
    pats = client.get("/problems/patterns")
    assert pats.status_code == 200
    data = pats.json()
    assert len(data) >= 5
    assert all("id" in p and "title" in p for p in data)

    filtered = client.get("/problems", params={"session_id": "pat", "pattern": "opposite-ends"})
    assert filtered.status_code == 200
    rows = filtered.json()
    assert len(rows) >= 1
    assert all(r.get("pattern_id") == "opposite-ends" for r in rows)

    graph = client.get("/topics/roadmap/graph", params={"session_id": "graph_smoke"})
    assert graph.status_code == 200
    body = graph.json()
    kinds = {n["kind"] for n in body["nodes"]}
    assert "topic" in kinds and "pattern" in kinds
    assert len(body["edges"]) >= 1


def test_kg_edges_after_diagnostic(client: TestClient):
    sid = "kg_diag_session"
    diag = client.get("/topics/two-pointers/diagnostic", params={"session_id": sid}).json()
    answers = {}
    for q in diag["questions"]:
        answers[q["id"]] = 0 if q["type"] == "mcq" else q["choices"][0]
    built = client.post("/topics/two-pointers/diagnostic", json={"session_id": sid, "answers": answers})
    assert built.status_code == 200
    graph = client.get("/topics/roadmap/graph", params={"session_id": sid}).json()
    # After diagnostic, graph should still load; recommended/weak styles may appear on edges/nodes
    assert graph["session_id"] == sid
    assert any(n["kind"] == "pattern" for n in graph["nodes"])
    signals = graph.get("signals") or {}
    assert "recommended_problems" in signals or "weak_skills" in signals

from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.content_loader import get_problem, list_problems
from app.main import app


@pytest.fixture
def client():
    with TestClient(app) as instance:
        yield instance


def test_catalog_is_read_only_and_browsing_does_not_resume(client):
    session = uuid4().hex
    params = {"session_id": session}
    catalog = client.get("/problems", params=params)
    assert catalog.status_code == 200
    assert len(catalog.json()) == len(list_problems())
    assert all(p["stage"] == 0 and not p["solved"] for p in catalog.json())
    filtered = client.get("/problems", params={**params, "topic": "two-pointers", "pattern": "opposite-ends"})
    assert filtered.status_code == 200
    assert filtered.json()
    assert all(p["topic"] == "two-pointers" and p["pattern_id"] == "opposite-ends" for p in filtered.json())
    assert client.get("/topics/arrays/learn", params=params).status_code == 200
    reset = client.post("/progress/reset", json=params).json()["deleted"]
    assert reset["progress_deleted"] == reset["topics_deleted"] == reset["attempts_deleted"] == 0

    detail = client.get("/problems/valid-palindrome", params=params)
    assert detail.status_code == 200 and detail.json()["stage"] == 1
    dashboard = client.get("/progress/dashboard", params=params).json()
    assert dashboard["action"]["kind"] == "lesson"
    assert dashboard["action"]["topic"] == "arrays"
    assert dashboard["problems_total"] == len(catalog.json())
    assert dashboard["problems_solved"] == dashboard["problems_mastered"] == 0
    palindrome = client.get("/problems", params={**params, "topic": "two-pointers"}).json()
    assert next(p for p in palindrome if p["id"] == "valid-palindrome")["stage"] == 0


def test_dashboard_prioritizes_resume_then_plan_and_tracks_solved(client, unlock_code):
    session = uuid4().hex
    params = {"session_id": session}
    diagnostic = client.post("/topics/two-pointers/diagnostic", json={**params, "answers": {}})
    assert diagnostic.status_code == 200
    recommendation = client.get("/progress/dashboard", params=params).json()["action"]
    assert recommendation["kind"] == "recommended"
    assert recommendation["problem_id"] == diagnostic.json()["plan"]["next_problem_id"]

    problem = get_problem("squares-of-sorted-array")
    unlock_code(client, session, problem)
    resume = client.get("/progress/dashboard", params=params).json()["action"]
    assert resume["kind"] == "resume" and resume["problem_id"] == problem["id"] and resume["stage"] == 3
    grade = client.post("/test", json={**params, "problem_id": problem["id"], "code": problem["reference_solution"]})
    assert grade.status_code == 200 and grade.json()["passed_all"]
    after = client.get("/progress/dashboard", params=params).json()
    assert after["action"]["stage"] == 4
    assert after["problems_solved"] == 1 and after["problems_mastered"] == 0

    other = client.get("/progress/dashboard", params={"session_id": uuid4().hex}).json()
    assert other["action"]["kind"] == "lesson" and other["problems_solved"] == 0

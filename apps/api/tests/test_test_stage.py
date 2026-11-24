"""Practice stages advance only when their prerequisites are complete."""

from __future__ import annotations

from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.content_loader import clear_content_cache, get_problem
from app.main import app


@pytest.fixture
def client():
    clear_content_cache()
    with TestClient(app) as instance:
        yield instance


def test_failing_submission_does_not_advance_stage(client, unlock_code):
    sid = uuid4().hex
    pid = "valid-palindrome"
    unlock_code(client, sid, get_problem(pid))

    # Wrong solution
    bad = client.post(
        "/test",
        json={
            "session_id": sid,
            "problem_id": pid,
            "code": "def is_palindrome(s):\n    return False\n",
        },
    )
    assert bad.status_code == 200
    body = bad.json()
    assert body["passed_all"] is False
    assert body["stage"] < 4
    assert body["viva"] == []

    # Hidden / edge results must not leak inputs or expected values
    hiddenish = [r for r in body["results"] if not r.get("visible")]
    assert hiddenish, "expected redacted hidden/edge results"
    for r in hiddenish:
        assert r["input"] is None
        assert r["expected"] is None
        assert r["got"] is None
        if not r["passed"]:
            assert r["error"] in {"Wrong answer", "Runtime error"}

    # Visible examples may show input/expected
    visible = [r for r in body["results"] if r.get("visible")]
    assert visible
    for r in visible:
        assert r["input"] is not None
        assert "expected" in r

    # Progress endpoint should still be below viva stage
    problem = client.get(f"/problems/{pid}", params={"session_id": sid})
    assert problem.status_code == 200
    assert problem.json()["stage"] < 4


def test_passing_submission_advances_stage(client, unlock_code):
    sid = uuid4().hex
    pid = "squares-of-sorted-array"
    problem = get_problem(pid)
    unlock_code(client, sid, problem)

    good = client.post(
        "/test",
        json={
            "session_id": sid,
            "problem_id": pid,
            "code": problem["reference_solution"],
        },
    )
    assert good.status_code == 200
    body = good.json()
    assert body["passed_all"] is True
    assert body["stage"] >= 4
    assert len(body["viva"]) >= 2

    # Still no hidden leakage on pass
    for r in body["results"]:
        if not r.get("visible"):
            assert r["input"] is None
            assert r["expected"] is None
            assert r["got"] is None

    detail = client.get(f"/problems/{pid}", params={"session_id": sid})
    assert detail.status_code == 200
    assert detail.json()["stage"] == 4
    assert detail.json()["last_code"] == problem["reference_solution"]
    assert detail.json()["viva"]
    assert len(body["results"]) == 12 and all(row["passed"] for row in body["results"])

    retest = client.post("/test", json={"session_id": sid, "problem_id": pid, "code": problem["starter_code"]})
    assert retest.status_code == 200
    assert retest.json()["stage"] == 3
    assert not retest.json()["viva"]
    assert client.post("/viva", json={"session_id": sid, "problem_id": pid, "answers": []}).status_code == 409


def test_prediction_progress_resumes_in_order(client):
    sid = uuid4().hex
    pid = "squares-of-sorted-array"
    payload = {"session_id": sid, "problem_id": pid}

    def predict(index, answer):
        return client.post("/predict", json={**payload, "step_index": index, "answer": answer})

    assert predict(0, "right").status_code == 409
    assert client.post("/test", json={**payload, "code": "def sorted_squares(nums): return []"}).status_code == 409
    assert client.post("/run", json={**payload, "mode": "brute"}).json()["stage"] == 2
    assert predict(1, "right").status_code == 409
    assert predict(0, "  ").status_code == 422
    assert predict(0, "right").json()["next_predict_index"] == 1
    assert client.get(f"/problems/{pid}", params={"session_id": sid}).json()["next_predict_index"] == 1
    final = predict(1, "right").json()
    assert final["stage"] == 3 and final["next_predict_index"] == 2


def test_visible_examples_count_towards_viva(client, unlock_code, monkeypatch):
    problem = get_problem("squares-of-sorted-array")
    sid = uuid4().hex
    unlock_code(client, sid, problem)
    example = {**problem["examples"][0], "output": "[]"}
    altered = {**problem, "examples": [example]}
    monkeypatch.setattr("app.routers.run.get_problem", lambda _: altered)
    result = client.post("/test", json={"session_id": sid, "problem_id": problem["id"], "code": problem["reference_solution"]})
    assert result.status_code == 200
    grade = result.json()
    assert not grade["passed_all"] and grade["stage"] == 3
    assert not grade["results"][0]["passed"]
    assert all(row["passed"] for row in grade["results"][1:])

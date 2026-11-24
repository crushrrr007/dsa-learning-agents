""" /test must advance to stage 4 only when every hidden + edge case passes. """

from __future__ import annotations

from fastapi.testclient import TestClient

from app.content_loader import clear_content_cache, get_problem
from app.main import app


def _client() -> TestClient:
    clear_content_cache()
    return TestClient(app)


def test_failing_submission_does_not_advance_stage():
    client = _client()
    sid = "stage_fail_1"
    pid = "valid-palindrome"
    # Unlock coding stage via /stage/see (stage 2); then force stage 3 via predict path length.
    see = client.post("/stage/see", params={"session_id": sid, "problem_id": pid})
    assert see.status_code == 200
    assert see.json()["stage"] >= 2

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


def test_passing_submission_advances_stage():
    client = _client()
    sid = "stage_pass_1"
    pid = "valid-palindrome"
    problem = get_problem(pid)

    see = client.post("/stage/see", params={"session_id": sid, "problem_id": pid})
    assert see.status_code == 200

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
    assert detail.json()["stage"] >= 4


def test_viva_rejected_before_tests_pass():
    client = _client()
    sid = "viva_gate_1"
    pid = "valid-palindrome"
    client.post("/stage/see", params={"session_id": sid, "problem_id": pid})

    blocked = client.post(
        "/viva",
        json={
            "session_id": sid,
            "problem_id": pid,
            "answers": [
                "Two pointers from opposite ends compare letters.",
                "Time is linear O(n) and space is constant.",
                "Skip non alphanumeric characters carefully.",
            ],
        },
    )
    assert blocked.status_code == 403


def test_viva_allowed_after_full_pass():
    client = _client()
    sid = "viva_gate_2"
    pid = "valid-palindrome"
    problem = get_problem(pid)
    client.post("/stage/see", params={"session_id": sid, "problem_id": pid})
    passed = client.post(
        "/test",
        json={"session_id": sid, "problem_id": pid, "code": problem["reference_solution"]},
    )
    assert passed.status_code == 200
    assert passed.json()["passed_all"] is True

    # Rubric-aligned answers (gate check — grading quality covered in test_viva_grade)
    viva = client.post(
        "/viva",
        json={
            "session_id": sid,
            "problem_id": pid,
            "answers": [
                "left and right each move inward at most n times; every character is compared a constant number of times; extra memory stays constant; a mismatch can reject without scanning the center",
                "those strings are vacuously palindromes; the pointers meet before any failing comparison; the correct answer is true; there is no pair of distinct positions to disagree",
                "a mismatch already proves the string is not a palindrome; matched ends shrink the unchecked middle; the invariant is that every pair outside the pointers already matches; skipping a match would leave an unchecked outer pair",
            ],
        },
    )
    assert viva.status_code == 200
    assert viva.json()["passed"] is True
    assert viva.json()["mastered"] is True

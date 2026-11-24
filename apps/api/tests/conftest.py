import pytest


@pytest.fixture
def unlock_code():
    def unlock(client, session_id, problem):
        payload = {"session_id": session_id, "problem_id": problem["id"]}
        demo = client.post("/run", json={**payload, "mode": "brute"})
        assert demo.status_code == 200, demo.text
        assert demo.json()["ok"] is True
        for index, step in enumerate(problem["predict_steps"]):
            result = client.post("/predict", json={**payload, "step_index": index, "answer": step["answer"]})
            assert result.status_code == 200, result.text
            assert result.json()["correct"] is True
    return unlock

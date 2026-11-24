from uuid import uuid4

from fastapi.testclient import TestClient

from app.content_loader import clear_content_cache
from app.main import app


def test_list_and_load_core_sheet():
    clear_content_cache()
    session_id = uuid4().hex
    with TestClient(app) as client:
        listed = client.get("/sheets")
        assert listed.status_code == 200
        assert "pointer-lab-core" in {sheet["id"] for sheet in listed.json()}

        detail = client.get("/sheets/pointer-lab-core", params={"session_id": session_id})
        assert detail.status_code == 200
        body = detail.json()
        assert body["problems_total"] >= 10
        assert len(body["problems"]) == body["problems_total"]
        assert body["mastered_count"] == 0
        assert all(row["stage"] == 0 and not row["solved"] for row in body["problems"])
        reset = client.post("/progress/reset", json={"session_id": session_id})
        assert reset.status_code == 200
        assert reset.json()["deleted"]["progress_deleted"] == 0

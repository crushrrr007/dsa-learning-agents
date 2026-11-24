from fastapi.testclient import TestClient

from app.content_loader import clear_content_cache
from app.main import app


def test_list_and_load_core_sheet():
    clear_content_cache()
    client = TestClient(app)
    listed = client.get("/sheets")
    assert listed.status_code == 200
    ids = {s["id"] for s in listed.json()}
    assert "pointer-lab-core" in ids

    detail = client.get("/sheets/pointer-lab-core", params={"session_id": "sheet_demo"})
    assert detail.status_code == 200
    body = detail.json()
    assert body["problems_total"] >= 10
    assert len(body["problems"]) == body["problems_total"]
    assert "mastered_count" in body

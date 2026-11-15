from fastapi.testclient import TestClient

from app.main import create_app

client = TestClient(create_app())


def test_health_reports_ok():
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json() == {"success": True, "data": {"status": "ok"}, "error": None}


def test_demo_catalog_returns_all_mock_videos_in_api_shape():
    res = client.get("/api/catalog", params={"source": "demo"})
    body = res.json()
    assert res.status_code == 200
    assert body["success"] is True
    assert body["error"] is None
    videos = body["data"]
    assert len(videos) == 38
    first = videos[0]
    assert first["id"] == "demo-0"
    assert set(first) == {
        "id", "title", "honestTitle", "channel", "channelSubscribers", "topic",
        "minutes", "views", "ageHours", "clickbait", "live", "newsCategory",
    }


def test_catalog_defaults_to_demo_source():
    assert len(client.get("/api/catalog").json()["data"]) == 38


def test_unknown_source_is_rejected_with_envelope():
    res = client.get("/api/catalog", params={"source": "tiktok"})
    assert res.status_code == 422
    body = res.json()
    assert body["success"] is False
    assert body["data"] is None
    assert "source" in body["error"]


def test_youtube_source_requires_sign_in():
    res = client.get("/api/catalog", params={"source": "youtube"})
    assert res.status_code == 401
    assert res.json() == {"success": False, "data": None, "error": "Sign in with Google to load your YouTube catalog."}

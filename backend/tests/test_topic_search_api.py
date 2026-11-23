"""Topic searches for a feed's topics outside subscriptions through `GET /api/catalog/topics` (ADR 0011), with a recorded YouTube."""

from datetime import timedelta
from pathlib import Path

import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.accounts.config import AuthConfig
from app.main import AuthSetup, create_app
from app.youtube.tables import TopicSearchCache
from tests.fake_google import GOOD_CODE, OTHER_CODE, FakeGoogle
from tests.fake_youtube import API_KEY, Failure, FakeYouTube
from tests.signed_in import Clock, sign_in

UNAVAILABLE = "YouTube couldn't be reached. Try again in a minute."


@pytest.fixture
def youtube() -> FakeYouTube:
    return FakeYouTube()


@pytest.fixture
def clock() -> Clock:
    return Clock()


def make_app(tmp_path: Path, youtube: FakeYouTube, clock: Clock, searches_per_day: int = 100):
    config = AuthConfig(
        google_client_id="client-id",
        google_client_secret="client-secret",
        session_secret="s" * 32,
        token_encryption_key=Fernet.generate_key().decode(),
        database_url=f"sqlite:///{tmp_path / 'test.db'}",
        app_url="http://testserver",
        youtube_api_key=API_KEY,
        topic_searches_per_day=searches_per_day,
    )
    return create_app(auth=AuthSetup(config, FakeGoogle(), clock, youtube.client()))


@pytest.fixture
def app(tmp_path: Path, youtube: FakeYouTube, clock: Clock):
    return make_app(tmp_path, youtube, clock)


def signed_in(app, code: str = GOOD_CODE) -> TestClient:
    client = TestClient(app)
    assert sign_in(client, code).status_code == 303
    return client


def search(client: TestClient, *topics: str):
    return client.get("/api/catalog/topics", params=[("topic", t) for t in topics])


def found(client: TestClient, *topics: str) -> dict:
    res = search(client, *topics)
    assert res.status_code == 200, res.json()
    return res.json()["data"]


def ids(client: TestClient, *topics: str) -> list[str]:
    return [v["id"] for v in found(client, *topics)["videos"]]


def cached_topics(app) -> set[str]:
    with Session(app.state.engine) as db:
        return {row.topic for row in db.exec(select(TopicSearchCache)).all()}


def test_a_thin_topic_pulls_in_search_results_as_that_topic(app):
    data = found(signed_in(app), "Chess")
    assert data["paused"] is False
    assert data["videos"][0] == {
        "id": "chess-opening", "title": "Five openings in five minutes", "honestTitle": "Five openings in five minutes",
        "channel": "Chess Corner", "channelSubscribers": 3200, "topic": "Chess", "minutes": 6, "views": 2100,
        "ageHours": 12, "clickbait": False, "live": False, "newsCategory": None,
    }
    # An upcoming stream can't be watched yet.
    assert [v["id"] for v in data["videos"]] == ["chess-opening", "chess-endgame", "rust-borrow"]
    assert {v["topic"] for v in data["videos"]} == {"Chess"}


def test_searches_ask_for_videos_with_the_server_key(app, youtube: FakeYouTube):
    found(signed_in(app), "Chess")
    [request] = [r for r in youtube.requests if r.url.path.endswith("/search")]
    assert request.url.params["q"] == "Chess"
    assert request.url.params["type"] == "video"
    assert request.url.params["key"] == API_KEY
    assert "Authorization" not in request.headers


def test_two_users_with_the_same_topic_cause_one_search(app, youtube: FakeYouTube):
    assert ids(signed_in(app), "Chess")
    second = found(signed_in(app, OTHER_CODE), "chess")
    assert youtube.calls("search") == 1
    # Each user's feed names the topic its own way; the videos carry that name.
    assert {v["topic"] for v in second["videos"]} == {"chess"}


def test_a_video_two_topics_find_comes_once_as_the_first_topic(app):
    videos = found(signed_in(app), "Chess", "Origami")["videos"]
    assert [v["id"] for v in videos].count("chess-endgame") == 1
    assert next(v for v in videos if v["id"] == "chess-endgame")["topic"] == "Chess"


def test_searches_stop_at_the_daily_budget_say_so_and_resume_tomorrow(tmp_path, youtube: FakeYouTube, clock: Clock):
    app = make_app(tmp_path, youtube, clock, searches_per_day=2)
    client = signed_in(app)
    assert found(client, "Chess", "Jazz")["paused"] is False
    paused = found(client, "Origami", "Chess")
    assert paused["paused"] is True
    # The cached topic still comes back; the new one waits.
    assert {v["topic"] for v in paused["videos"]} == {"Chess"}
    assert youtube.calls("search") == 2
    clock.moment += timedelta(days=1)
    assert found(client, "Origami")["paused"] is False
    assert youtube.calls("search", q="Origami") == 1


def test_a_stale_search_is_still_shown_while_the_budget_is_used_up(tmp_path, youtube: FakeYouTube, clock: Clock):
    app = make_app(tmp_path, youtube, clock, searches_per_day=2)
    client = signed_in(app)
    found(client, "Chess")
    clock.moment += timedelta(hours=7)
    assert found(client, "Jazz")["paused"] is False
    data = found(client, "Chess")
    assert data["paused"] is True
    assert "chess-opening" in [v["id"] for v in data["videos"]]


def test_one_user_cant_spend_the_whole_days_budget(app, youtube: FakeYouTube):
    from app.youtube.topic_search import SEARCHES_PER_USER_PER_DAY

    client = signed_in(app)
    topics = [f"Topic {n}" for n in range(SEARCHES_PER_USER_PER_DAY + 1)]
    results = [found(client, *topics[i : i + 5]) for i in range(0, len(topics), 5)]
    assert results[-1]["paused"] is True
    assert youtube.calls("search") == SEARCHES_PER_USER_PER_DAY
    assert found(signed_in(app, OTHER_CODE), "Jazz")["paused"] is False


def test_searches_are_refreshed_once_six_hours_have_passed(app, youtube: FakeYouTube, clock: Clock):
    client = signed_in(app)
    found(client, "Chess")
    clock.moment += timedelta(hours=5, minutes=59)
    found(client, "Chess")
    assert youtube.calls("search") == 1
    clock.moment += timedelta(minutes=2)
    assert found(client, "Chess")["videos"][0]["ageHours"] == 18
    assert youtube.calls("search") == 2


def test_searches_past_thirty_days_are_deleted(app, clock: Clock):
    client = signed_in(app)
    found(client, "Chess", "Jazz")
    assert cached_topics(app) == {"chess", "jazz"}
    clock.moment += timedelta(days=30, minutes=1)
    found(signed_in(app), "Origami")
    assert cached_topics(app) == {"origami"}


def test_a_cached_search_that_fails_validation_is_searched_again(app, youtube: FakeYouTube):
    client = signed_in(app)
    found(client, "Chess")
    with Session(app.state.engine) as db:
        row = db.get(TopicSearchCache, "chess")
        row.videos = '[{"id": 5}]'
        db.add(row)
        db.commit()
    assert "chess-opening" in ids(client, "Chess")
    assert youtube.calls("search") == 2


def test_youtubes_own_quota_refusal_reads_as_paused(app, youtube: FakeYouTube):
    client = signed_in(app)
    youtube.failure = Failure(status=403, reason="quotaExceeded")
    assert found(client, "Chess") == {"videos": [], "paused": True}


def test_a_search_youtube_never_answered_doesnt_use_up_the_budget(tmp_path, youtube: FakeYouTube, clock: Clock):
    client = signed_in(make_app(tmp_path, youtube, clock, searches_per_day=1))
    youtube.failure = Failure(unreachable=True)
    assert search(client, "Chess").status_code == 503
    youtube.failure = None
    assert found(client, "Chess")["paused"] is False


def test_youtube_failing_says_so(app, youtube: FakeYouTube):
    client = signed_in(app)
    youtube.failure = Failure()
    res = search(client, "Chess")
    assert res.status_code == 503
    assert res.json()["error"] == UNAVAILABLE


@pytest.mark.parametrize("topics", [(), tuple(f"T{n}" for n in range(6)), ("x" * 41,), ("  ",)])
def test_topics_are_checked(app, topics):
    res = search(signed_in(app), *topics)
    assert res.status_code == 422
    assert res.json()["error"] == "Search 1–5 topics of at most 40 characters."


def test_signed_out_visitors_get_the_sign_in_message(app):
    res = search(TestClient(app), "Chess")
    assert res.status_code == 401


def test_demo_mode_has_no_topic_searches(tmp_path):
    res = TestClient(create_app()).get("/api/catalog/topics", params={"topic": "Chess"})
    assert res.status_code == 401
    assert res.json()["error"] == "Sign in with Google to load your YouTube catalog."


def test_asking_too_often_in_a_day_is_refused(tmp_path, youtube: FakeYouTube, clock: Clock, monkeypatch):
    from app.youtube import topic_router

    monkeypatch.setattr(topic_router, "REQUESTS_PER_DAY", 2)
    client = signed_in(make_app(tmp_path, youtube, clock))
    found(client, "Chess")
    found(client, "Chess")
    res = search(client, "Chess")
    assert res.status_code == 429
    assert res.json()["error"] == "Topics were searched too often today. Try again tomorrow."

"""A signed-in user's real catalog through `GET /api/catalog?source=youtube`, with a fake Google and a recorded YouTube."""

from datetime import timedelta
from pathlib import Path

import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.accounts.config import AuthConfig
from app.main import AuthSetup, create_app
from app.youtube.tables import ChannelCache
from tests.fake_google import GOOD_CODE, OTHER_CODE, FakeGoogle
from tests.fake_youtube import API_KEY, Failure, FakeYouTube
from tests.signed_in import Clock, sign_in

ACCESS_EXPIRED = "Your YouTube access has expired. Sign out, then sign in with Google again."
UNAVAILABLE = "YouTube couldn't be reached. Try again in a minute."
QUOTA = "Yourfeed has used up today's YouTube allowance. Try again tomorrow."


@pytest.fixture
def google() -> FakeGoogle:
    return FakeGoogle()


@pytest.fixture
def youtube() -> FakeYouTube:
    return FakeYouTube()


@pytest.fixture
def clock() -> Clock:
    return Clock()


@pytest.fixture
def app(tmp_path: Path, google: FakeGoogle, youtube: FakeYouTube, clock: Clock):
    config = AuthConfig(
        google_client_id="client-id",
        google_client_secret="client-secret",
        session_secret="s" * 32,
        token_encryption_key=Fernet.generate_key().decode(),
        database_url=f"sqlite:///{tmp_path / 'test.db'}",
        app_url="http://testserver",
        youtube_api_key=API_KEY,
    )
    return create_app(auth=AuthSetup(config, google, clock, youtube.client()))


def signed_in(app, code: str = GOOD_CODE) -> TestClient:
    client = TestClient(app)
    assert sign_in(client, code).status_code == 303
    return client


def catalog(client: TestClient):
    return client.get("/api/catalog", params={"source": "youtube"})


def videos(client: TestClient) -> list[dict]:
    res = catalog(client)
    assert res.status_code == 200, res.json()
    return res.json()["data"]


def by_id(client: TestClient) -> dict[str, dict]:
    return {v["id"]: v for v in videos(client)}


def cached_channels(app) -> set[str]:
    with Session(app.state.engine) as db:
        return {row.channel_id for row in db.exec(select(ChannelCache)).all()}


def test_catalog_is_built_from_subscriptions_uploads_and_details_in_the_video_shape(app):
    client = signed_in(app)
    assert videos(client) == [
        {
            "id": "kitchen-live", "title": "Sunday soup, live", "honestTitle": "Sunday soup, live",
            "channel": "Lo-fi Kitchen", "channelSubscribers": 12500, "topic": "Food", "minutes": 1, "views": 310,
            "ageHours": 1, "clickbait": False, "live": True, "newsCategory": None,
        },
        {
            "id": "rust-borrow", "title": "The borrow checker, explained with Lego",
            "honestTitle": "The borrow checker, explained with Lego", "channel": "Rust Garage", "channelSubscribers": 48000,
            "topic": "Knowledge", "minutes": 13, "views": 15400, "ageHours": 3, "clickbait": False, "live": False,
            "newsCategory": None,
        },
        {
            "id": "rust-async", "title": "Async Rust without the tears", "honestTitle": "Async Rust without the tears",
            "channel": "Rust Garage", "channelSubscribers": 48000, "topic": "Technology", "minutes": 62, "views": 80210,
            "ageHours": 72, "clickbait": False, "live": False, "newsCategory": None,
        },
    ]


def test_topics_come_from_the_video_then_its_channel_preferring_the_specific_one(app):
    client = signed_in(app, OTHER_CODE)
    topics = {id_: v["topic"] for id_, v in by_id(client).items()}
    # Sport and Football: the specific one wins. Lifestyle and Food likewise.
    assert topics["pitch-derby"] == "Football"
    assert topics["kitchen-live"] == "Food"


def test_videos_youtube_hides_or_doesnt_have_yet_are_left_out_and_hidden_counts_read_as_zero(app):
    client = signed_in(app, OTHER_CODE)
    catalog_ = by_id(client)
    assert "kitchen-premiere" not in catalog_
    assert catalog_["pitch-derby"]["views"] == 0
    assert catalog_["pitch-derby"]["channelSubscribers"] == 0
    assert "rust-deleted" not in by_id(signed_in(app))


def test_uploads_use_the_server_key_and_subscriptions_the_users_token(app, youtube: FakeYouTube):
    videos(signed_in(app))
    subscription_requests = [r for r in youtube.requests if r.url.path.endswith("/subscriptions")]
    assert subscription_requests and all(r.headers["Authorization"] == "Bearer access-1" for r in subscription_requests)
    assert all("key" not in r.url.params for r in subscription_requests)
    others = [r for r in youtube.requests if r not in subscription_requests]
    assert others and all(r.url.params["key"] == API_KEY and "Authorization" not in r.headers for r in others)


def test_only_the_documented_data_api_is_called(app, youtube: FakeYouTube):
    videos(signed_in(app))
    videos(signed_in(app, OTHER_CODE))
    assert {(r.url.scheme, r.url.host) for r in youtube.requests} == {("https", "www.googleapis.com")}
    assert {r.url.path.rsplit("/", 1)[0] for r in youtube.requests} == {"/youtube/v3"}


def test_two_users_sharing_a_channel_cause_one_uploads_fetch(app, youtube: FakeYouTube):
    first, second = signed_in(app), signed_in(app, OTHER_CODE)
    videos(first)
    assert "kitchen-live" in by_id(second)
    assert youtube.calls("playlistItems", playlistId="UU_kitchen") == 1
    assert youtube.calls("playlistItems", playlistId="UU_pitch") == 1


def test_uploads_are_refreshed_once_six_hours_have_passed(app, youtube: FakeYouTube, clock: Clock):
    client = signed_in(app)
    videos(client)
    clock.moment += timedelta(hours=5, minutes=59)
    videos(client)
    assert youtube.calls("playlistItems", playlistId="UU_rust") == 1
    clock.moment += timedelta(minutes=2)
    assert by_id(client)["rust-borrow"]["ageHours"] == 9
    assert youtube.calls("playlistItems", playlistId="UU_rust") == 2


def test_cached_channels_past_thirty_days_are_deleted(app, clock: Clock):
    videos(signed_in(app, OTHER_CODE))
    assert cached_channels(app) == {"UC_kitchen", "UC_pitch", "UC_closed"}
    clock.moment += timedelta(days=30, minutes=1)
    videos(signed_in(app))
    assert cached_channels(app) == {"UC_rust", "UC_kitchen"}


def test_a_cache_row_that_fails_validation_is_fetched_again(app, youtube: FakeYouTube):
    client = signed_in(app)
    videos(client)
    with Session(app.state.engine) as db:
        row = db.get(ChannelCache, "UC_rust")
        row.videos = '[{"id": 5}]'
        db.add(row)
        db.commit()
    assert "rust-borrow" in by_id(client)
    assert youtube.calls("playlistItems", playlistId="UU_rust") == 2


def test_expired_google_access_asks_to_sign_in_again(app, google: FakeGoogle):
    client = signed_in(app)
    google.access_revoked = True
    res = catalog(client)
    assert res.status_code == 401
    assert res.json() == {"success": False, "data": None, "error": ACCESS_EXPIRED}


def test_youtube_refusing_the_users_token_asks_to_sign_in_again(app, youtube: FakeYouTube):
    client = signed_in(app)
    youtube.failure = Failure(status=401, reason="authError")
    assert catalog(client).json()["error"] == ACCESS_EXPIRED


@pytest.mark.parametrize("failure", [Failure(), Failure(unreachable=True), Failure(status=500, reason="internalError")])
def test_youtube_failing_says_so_and_a_retry_works(app, youtube: FakeYouTube, failure: Failure):
    client = signed_in(app)
    youtube.failure = failure
    res = catalog(client)
    assert res.status_code == 503
    assert res.json() == {"success": False, "data": None, "error": UNAVAILABLE}
    youtube.failure = None
    assert len(videos(client)) == 3


def test_a_used_up_quota_says_try_tomorrow(app, youtube: FakeYouTube):
    client = signed_in(app)
    youtube.failure = Failure(status=403, reason="quotaExceeded")
    res = catalog(client)
    assert res.status_code == 503
    assert res.json()["error"] == QUOTA


def test_a_channel_without_uploads_is_skipped(app, youtube: FakeYouTube, monkeypatch):
    from tests import fake_youtube

    monkeypatch.delitem(fake_youtube.RECORDED["playlistItems"], "UU_rust")
    assert [v["id"] for v in videos(signed_in(app))] == ["kitchen-live"]


def test_signed_out_visitors_get_the_sign_in_message(app):
    res = catalog(TestClient(app))
    assert res.status_code == 401
    assert res.json()["error"] == "Sign in with Google to load your YouTube catalog."


def test_the_demo_catalog_still_needs_no_sign_in(app):
    assert len(TestClient(app).get("/api/catalog").json()["data"]) == 38


def test_google_unreachable_for_a_token_reads_as_youtube_unavailable(app, google: FakeGoogle, monkeypatch):
    from app.accounts.google import GoogleError

    client = signed_in(app)

    def down(_: str) -> str:
        raise GoogleError("Couldn't reach Google: ConnectError")

    monkeypatch.setattr(google, "access_token", down)
    res = catalog(client)
    assert res.status_code == 503
    assert res.json()["error"] == UNAVAILABLE


def test_a_subscribed_channel_youtube_no_longer_has_is_remembered_as_empty(app, youtube: FakeYouTube):
    client = signed_in(app, OTHER_CODE)
    videos(client)
    videos(client)
    assert youtube.calls("channels") == 1
    assert "UC_closed" in cached_channels(app)

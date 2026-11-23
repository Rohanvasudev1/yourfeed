"""Real share and send (ADR 0013), through the API with a fake Google and a recorded YouTube.

Looking up videos outside your catalog lets share links work across catalogs; sending to a username lands in their inbox.
"""

from datetime import timedelta
from pathlib import Path

import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient

from app.accounts.config import AuthConfig
from app.main import AuthSetup, create_app
from tests.fake_google import GOOD_CODE, OTHER_CODE, FakeGoogle
from tests.fake_youtube import API_KEY, FakeYouTube
from app.sharing.router import LOOKUPS_PER_DAY, MISSES_PER_DAY
from tests.signed_in import Clock, csrf, sign_in

NO_ONE = "No one has that username."
SIGN_IN_FIRST = "Sign in with Google first."
SHARE = {"title": "Derby prep", "videos": ["pitch-derby", "rust-borrow"], "message": "Watch before Sunday", "notes": {"pitch-derby": "From 2:10"}}


@pytest.fixture
def youtube() -> FakeYouTube:
    return FakeYouTube()


@pytest.fixture
def clock() -> Clock:
    return Clock()


@pytest.fixture
def app(tmp_path: Path, youtube: FakeYouTube, clock: Clock):
    config = AuthConfig(
        google_client_id="client-id",
        google_client_secret="client-secret",
        session_secret="s" * 32,
        token_encryption_key=Fernet.generate_key().decode(),
        database_url=f"sqlite:///{tmp_path / 'test.db'}",
        app_url="http://testserver",
        youtube_api_key=API_KEY,
    )
    return create_app(auth=AuthSetup(config, FakeGoogle(), clock, youtube.client()))


def person(app, code: str, username: str | None) -> TestClient:
    client = TestClient(app)
    assert sign_in(client, code).status_code == 303
    if username:
        assert client.put("/api/account/username", json={"username": username}, headers=csrf(client)).status_code == 200
    return client


def lookup(client: TestClient, *ids: str):
    return client.get("/api/videos", params={"ids": ",".join(ids)})


def send(client: TestClient, to, share=SHARE, headers: dict[str, str] | None = None):
    return client.post("/api/shares", json={"to": to, "share": share}, headers=csrf(client) if headers is None else headers)


def inbox(client: TestClient, after: int = 0) -> list[dict]:
    res = client.get("/api/inbox", params={"after": after})
    assert res.status_code == 200, res.json()
    return res.json()["data"]


# --- Looking up videos outside your catalog ---


def test_a_video_outside_my_catalog_is_looked_up(app):
    me = person(app, GOOD_CODE, "you.here")
    res = lookup(me, "pitch-derby")
    assert res.status_code == 200
    [video] = res.json()["data"]
    assert video["id"] == "pitch-derby"
    assert video["title"] == "Derby day tactics"
    assert video["channel"] == "Pitch Side"
    assert video["topic"] == "Football"
    assert video["minutes"] == 1


def test_ids_youtube_does_not_know_are_left_out(app):
    me = person(app, GOOD_CODE, "you.here")
    assert [v["id"] for v in lookup(me, "nope", "pitch-derby").json()["data"]] == ["pitch-derby"]


def test_a_lookup_costs_one_videos_call(app, youtube: FakeYouTube):
    me = person(app, GOOD_CODE, "you.here")
    lookup(me, "pitch-derby", "rust-borrow", "kitchen-live")
    assert youtube.calls("videos") == 1


def test_looking_up_needs_a_session(app):
    res = lookup(TestClient(app), "pitch-derby")
    assert res.status_code == 401
    assert res.json()["error"] == SIGN_IN_FIRST


@pytest.mark.parametrize("ids", [[], [f"v{i}" for i in range(51)], ["has space"], ["x" * 101]])
def test_a_lookup_outside_the_limits_is_refused(app, ids):
    me = person(app, GOOD_CODE, "you.here")
    assert lookup(me, *ids).status_code == 422


# --- Sending to a username ---


def test_a_share_sent_to_a_username_lands_in_their_inbox(app):
    me = person(app, GOOD_CODE, "you.here")
    maya = person(app, OTHER_CODE, "maya.k")

    res = send(me, "@Maya.K")
    assert res.status_code == 200
    assert res.json()["data"] == {"to": "maya.k"}

    [item] = inbox(maya)
    assert item["from"] == "you.here"
    assert {k: item[k] for k in SHARE} == SHARE
    assert item["sentAt"] == "2026-11-23T00:00:00Z"
    assert inbox(me) == []


def test_an_unknown_username_is_refused(app):
    me = person(app, GOOD_CODE, "you.here")
    res = send(me, "nobody.here")
    assert res.status_code == 404
    assert res.json()["error"] == NO_ONE


def test_inbox_only_lists_what_came_after_the_cursor(app):
    me = person(app, GOOD_CODE, "you.here")
    maya = person(app, OTHER_CODE, "maya.k")
    send(me, "maya.k")
    send(me, "maya.k", {**SHARE, "title": "Second"})

    first, second = inbox(maya)
    assert second["id"] > first["id"]
    assert [i["title"] for i in inbox(maya, after=first["id"])] == ["Second"]
    assert inbox(maya, after=second["id"]) == []


def test_the_sender_shows_by_their_current_username(app):
    me = person(app, GOOD_CODE, "you.here")
    maya = person(app, OTHER_CODE, "maya.k")
    send(me, "maya.k")
    me.put("/api/account/username", json={"username": "renamed"}, headers=csrf(me))
    assert inbox(maya)[0]["from"] == "renamed"


def test_sending_needs_the_csrf_token(app):
    me = person(app, GOOD_CODE, "you.here")
    person(app, OTHER_CODE, "maya.k")
    assert send(me, "maya.k", headers={}).status_code == 403


def test_sending_needs_a_session(app):
    res = TestClient(app).post("/api/shares", json={"to": "maya.k", "share": SHARE})
    assert res.status_code == 401


def test_sending_needs_your_own_username_first(app):
    me = person(app, GOOD_CODE, None)
    person(app, OTHER_CODE, "maya.k")
    res = send(me, "maya.k")
    assert res.status_code == 409
    assert res.json()["error"] == "Choose a username before sending."


@pytest.mark.parametrize(
    "share",
    [
        {**SHARE, "title": " "},
        {**SHARE, "title": "x" * 61},
        {**SHARE, "videos": []},
        {**SHARE, "videos": ["a", "a"]},
        {**SHARE, "videos": [f"v{i}" for i in range(51)]},
        {**SHARE, "message": "m" * 281},
        {**SHARE, "notes": {"pitch-derby": "n" * 2001}},
        {**SHARE, "notes": {"elsewhere": "a note"}},
        {**SHARE, "extra": True},
    ],
)
def test_a_share_outside_the_limits_is_refused(app, share):
    me = person(app, GOOD_CODE, "you.here")
    maya = person(app, OTHER_CODE, "maya.k")
    assert send(me, "maya.k", share).status_code == 422
    assert inbox(maya) == []


def test_sends_are_capped_per_day(app, clock: Clock):
    me = person(app, GOOD_CODE, "you.here")
    person(app, OTHER_CODE, "maya.k")
    for _ in range(50):
        assert send(me, "maya.k").status_code == 200
    res = send(me, "maya.k")
    assert res.status_code == 429
    assert res.json()["error"] == "You've sent 50 feeds today. Try again tomorrow."
    clock.moment += timedelta(days=1)
    assert send(me, "maya.k").status_code == 200


def test_deleting_my_data_deletes_my_inbox(app):
    me = person(app, GOOD_CODE, "you.here")
    maya = person(app, OTHER_CODE, "maya.k")
    send(me, "maya.k")
    assert maya.delete("/api/account", headers=csrf(maya)).status_code == 200
    maya = person(app, OTHER_CODE, "maya.k")
    assert inbox(maya) == []


def test_lookups_are_capped_per_day(app, clock: Clock):
    me = person(app, GOOD_CODE, "you.here")
    for _ in range(LOOKUPS_PER_DAY):
        assert lookup(me, "pitch-derby").status_code == 200
    res = lookup(me, "pitch-derby")
    assert res.status_code == 429
    assert res.json()["error"] == "You've looked up a lot of videos today. Try again tomorrow."
    clock.moment += timedelta(days=1)
    assert lookup(me, "pitch-derby").status_code == 200


def test_guessing_usernames_is_capped_per_day(app, clock: Clock):
    me = person(app, GOOD_CODE, "you.here")
    person(app, OTHER_CODE, "maya.k")
    for i in range(MISSES_PER_DAY):
        assert send(me, f"nobody.{i}").status_code == 404
    res = send(me, "maya.k")
    assert res.status_code == 429
    assert res.json()["error"] == "Too many usernames weren't found today. Try again tomorrow."
    clock.moment += timedelta(days=1)
    assert send(me, "maya.k").status_code == 200


def test_the_send_cap_applies_before_the_username_is_checked(app):
    me = person(app, GOOD_CODE, "you.here")
    person(app, OTHER_CODE, "maya.k")
    for _ in range(50):
        send(me, "maya.k")
    assert send(me, "nobody.here").status_code == 429

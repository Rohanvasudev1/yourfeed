"""Real Blend between accounts (ADR 0013), through the API with two signed-in users and a fake Google.

A blend mixes the two people's recipe topics: the API carries topics, never anyone's catalog.
"""

from pathlib import Path

import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient

from app.accounts.config import AuthConfig
from app.blends.router import CHANGES_PER_DAY, INVITES_PER_DAY, READS_PER_DAY
from app.main import AuthSetup, create_app
from app.sharing.limits import MISSES_PER_DAY
from tests.fake_google import GOOD_CODE, OTHER_CODE, THIRD_CODE, FakeGoogle
from tests.signed_in import Clock, csrf, sign_in

NO_ONE = "No one has that username."
MINE = ["Football", "Rust"]
THEIRS = ["Cooking", "Football"]


@pytest.fixture
def app(tmp_path: Path):
    config = AuthConfig(
        google_client_id="client-id",
        google_client_secret="client-secret",
        session_secret="s" * 32,
        token_encryption_key=Fernet.generate_key().decode(),
        database_url=f"sqlite:///{tmp_path / 'test.db'}",
        app_url="http://testserver",
    )
    return create_app(auth=AuthSetup(config, FakeGoogle(), Clock()))


def person(app, code: str, username: str | None) -> TestClient:
    client = TestClient(app)
    assert sign_in(client, code).status_code == 303
    if username:
        assert client.put("/api/account/username", json={"username": username}, headers=csrf(client)).status_code == 200
    return client


@pytest.fixture
def me(app) -> TestClient:
    return person(app, GOOD_CODE, "you.here")


@pytest.fixture
def maya(app) -> TestClient:
    return person(app, OTHER_CODE, "maya.k")


def invite(client: TestClient, to: str, topics=MINE, headers: dict[str, str] | None = None):
    return client.post("/api/blends", json={"to": to, "topics": topics}, headers=csrf(client) if headers is None else headers)


def accept(client: TestClient, blend_id: int, topics=THEIRS):
    return client.post(f"/api/blends/{blend_id}/accept", json={"topics": topics}, headers=csrf(client))


def cancel(client: TestClient, blend_id: int):
    return client.post(f"/api/blends/{blend_id}/cancel", headers=csrf(client))


def blends(client: TestClient) -> list[dict]:
    res = client.get("/api/blends")
    assert res.status_code == 200, res.json()
    return res.json()["data"]


def invited(me: TestClient, to: str = "maya.k") -> int:
    res = invite(me, to)
    assert res.status_code == 200, res.json()
    return res.json()["data"]["id"]


# --- Inviting ---


def test_an_invite_waits_for_their_approval_and_shares_no_taste_yet(me, maya):
    res = invite(me, " @Maya.K ")
    assert res.status_code == 200
    sent = res.json()["data"]
    assert sent == {"id": sent["id"], "with": "maya.k", "role": "inviter", "status": "pending", "topics": []}

    assert blends(me) == [sent]
    assert blends(maya) == [{"id": sent["id"], "with": "you.here", "role": "invitee", "status": "pending", "topics": []}]


def test_inviting_an_unknown_username_says_no_one_has_it(me):
    for typed in ["nobody.here", "not a username!"]:
        res = invite(me, typed)
        assert res.status_code == 404
        assert res.json()["error"] == NO_ONE
    assert blends(me) == []


def test_inviting_needs_my_own_username_first(app, maya):
    nameless = person(app, GOOD_CODE, None)
    res = invite(nameless, "maya.k")
    assert res.status_code == 409
    assert res.json()["error"] == "Choose a username before inviting."


def test_i_cant_blend_with_myself(me):
    res = invite(me, "you.here")
    assert res.status_code == 422
    assert res.json()["error"] == "That's your own username."


def test_one_blend_at_a_time_with_the_same_person(me, maya):
    blend_id = invited(me)
    for client, to in [(me, "maya.k"), (maya, "you.here")]:
        res = invite(client, to)
        assert res.status_code == 409
        assert res.json()["error"].startswith("You already have a blend with @")
    assert [b["id"] for b in blends(me)] == [blend_id]


def test_after_a_cancel_they_can_be_invited_again(me, maya):
    assert cancel(me, invited(me)).status_code == 200
    assert invite(me, "maya.k").status_code == 200


def test_invites_carry_valid_recipe_topics_only(me, maya):
    for topics in [["x" * 61], [""], ["Rust", "Rust"], [f"Topic {i}" for i in range(51)], "Rust"]:
        assert invite(me, "maya.k", topics=topics).status_code == 422, topics
    assert blends(me) == []


def test_invites_need_the_csrf_token(me, maya):
    assert invite(me, "maya.k", headers={}).status_code == 403


def test_invites_are_capped_per_day(me, maya):
    for _ in range(INVITES_PER_DAY):
        assert cancel(me, invited(me)).status_code == 200
    res = invite(me, "maya.k")
    assert res.status_code == 429
    assert res.json()["error"] == f"You've sent {INVITES_PER_DAY} blend invites today. Try again tomorrow."


def test_unknown_usernames_are_capped_so_no_one_can_list_who_is_here(me, maya):
    for i in range(MISSES_PER_DAY):
        assert invite(me, f"nobody.{i}").status_code == 404
    res = invite(me, "maya.k")
    assert res.status_code == 429


def test_the_guessing_cap_is_shared_with_sending(me, maya):
    share = {"title": "Derby prep", "videos": ["pitch-derby"]}
    for i in range(MISSES_PER_DAY):
        assert me.post("/api/shares", json={"to": f"nobody.{i}", "share": share}, headers=csrf(me)).status_code == 404
    assert invite(me, "maya.k").status_code == 429


def test_reads_and_changes_are_capped_per_day(me, maya):
    for _ in range(READS_PER_DAY):
        me.get("/api/blends")
    assert me.get("/api/blends").status_code == 429
    for _ in range(CHANGES_PER_DAY):
        cancel(me, 9999)
    assert cancel(me, 9999).status_code == 429
    assert accept(me, 9999).status_code == 429


# --- Approving ---


def test_they_approve_in_their_own_account_and_each_gets_the_others_topics(me, maya):
    blend_id = invited(me)
    res = accept(maya, blend_id)
    assert res.status_code == 200
    assert res.json()["data"] == {"id": blend_id, "with": "you.here", "role": "invitee", "status": "accepted", "topics": MINE}

    assert blends(me) == [{"id": blend_id, "with": "maya.k", "role": "inviter", "status": "accepted", "topics": THEIRS}]
    assert blends(maya)[0]["topics"] == MINE


def test_a_blend_carries_topics_never_anyones_catalog(me, maya):
    blend_id = invited(me)
    accept(maya, blend_id)
    for client in [me, maya]:
        [blend] = blends(client)
        assert set(blend) == {"id", "with", "role", "status", "topics"}
        assert all(isinstance(t, str) for t in blend["topics"])


def test_only_the_invited_person_can_approve(app, me, maya):
    blend_id = invited(me)
    assert accept(me, blend_id).status_code == 404
    assert accept(maya, 9999).status_code == 404
    assert blends(maya)[0]["status"] == "pending"


def test_an_approved_or_cancelled_blend_cant_be_approved_again(me, maya):
    blend_id = invited(me)
    assert accept(maya, blend_id).status_code == 200
    assert accept(maya, blend_id).status_code == 404

    assert cancel(maya, blend_id).status_code == 200
    assert accept(maya, blend_id).status_code == 404


# --- Cancelling ---


def test_either_person_can_cancel_and_it_leaves_both_lists(me, maya):
    blend_id = invited(me)
    assert cancel(maya, blend_id).status_code == 200
    assert blends(me) == [] and blends(maya) == []

    accepted = invited(me)
    accept(maya, accepted)
    assert cancel(me, accepted).status_code == 200
    assert blends(me) == [] and blends(maya) == []


def test_no_one_else_sees_or_cancels_a_blend(app, me, maya):
    blend_id = invited(me)
    sam = person(app, THIRD_CODE, "sam.r")
    assert blends(sam) == []
    assert cancel(sam, blend_id).status_code == 404
    assert accept(sam, blend_id).status_code == 404
    assert blends(maya)[0]["status"] == "pending"


def test_cancelling_twice_finds_nothing_the_second_time(me, maya):
    blend_id = invited(me)
    assert cancel(me, blend_id).status_code == 200
    assert cancel(me, blend_id).status_code == 404


def test_blends_need_signing_in(app):
    anon = TestClient(app)
    assert anon.get("/api/blends").status_code == 401


def test_deleting_my_data_deletes_my_blends(me, maya):
    invited(me)
    assert maya.delete("/api/account", headers=csrf(maya)).status_code == 200
    assert blends(me) == []

"""Usernames (ADR 0013): chosen at first sign-in, checked and kept unique by the backend, through the API with a fake Google."""

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from tests.fake_google import OTHER_CODE
from tests.signed_in import client, clock, csrf, google, me, sign_in  # noqa: F401  (fixtures)

INVALID = "Usernames are 3–20 letters, numbers, dots or underscores"
TAKEN = "That username is taken. Try another."


def choose(client: TestClient, username, headers: dict[str, str] | None = None):
    return client.put("/api/account/username", json={"username": username}, headers=csrf(client) if headers is None else headers)


def test_a_new_user_has_no_username_yet(client: TestClient):
    sign_in(client)
    assert me(client)["username"] is None


def test_a_signed_out_visitor_has_no_username(client: TestClient):
    assert me(client)["username"] is None


def test_choosing_a_username_keeps_it(client: TestClient):
    sign_in(client)
    res = choose(client, "maya.k")
    assert res.status_code == 200
    assert res.json() == {"success": True, "data": {"username": "maya.k"}, "error": None}
    assert me(client)["username"] == "maya.k"


def test_a_typed_at_spaces_and_capitals_are_tidied(client: TestClient):
    sign_in(client)
    assert choose(client, "  @Maya_K ").json()["data"] == {"username": "maya_k"}


@pytest.mark.parametrize("username", ["", "ab", "a" * 21, "has space", "dash-name", "émile", "@", None, 42])
def test_an_invalid_username_is_refused(client: TestClient, username):
    sign_in(client)
    res = choose(client, username)
    assert res.status_code == 422
    assert res.json()["error"] == INVALID
    assert me(client)["username"] is None


def test_a_username_is_unique_across_users_in_any_case(client: TestClient):
    sign_in(client)
    choose(client, "maya.k")
    other = TestClient(client.app)
    sign_in(other, OTHER_CODE)

    res = choose(other, "MAYA.K")
    assert res.status_code == 409
    assert res.json()["error"] == TAKEN
    assert me(other)["username"] is None


def test_choosing_your_own_username_again_is_fine(client: TestClient):
    sign_in(client)
    choose(client, "maya.k")
    assert choose(client, "maya.k").status_code == 200


def test_changing_your_username_frees_the_old_one(client: TestClient):
    sign_in(client)
    choose(client, "maya.k")
    choose(client, "maya.kim")
    other = TestClient(client.app)
    sign_in(other, OTHER_CODE)
    assert choose(other, "maya.k").status_code == 200


def test_deleting_your_data_frees_your_username(client: TestClient):
    sign_in(client)
    choose(client, "maya.k")
    client.delete("/api/account", headers=csrf(client))
    other = TestClient(client.app)
    sign_in(other, OTHER_CODE)
    assert choose(other, "maya.k").status_code == 200


def test_choosing_needs_a_session(client: TestClient):
    res = choose(client, "maya.k", headers={})
    assert res.status_code == 401


def test_choosing_needs_the_csrf_token(client: TestClient):
    sign_in(client)
    res = choose(client, "maya.k", headers={})
    assert res.status_code == 403
    assert me(client)["username"] is None


def test_demo_only_server_says_signing_in_isnt_set_up():
    res = TestClient(create_app()).put("/api/account/username", json={"username": "maya.k"})
    assert res.status_code == 404

"""A signed-in user's app state behind GET/PUT /api/state (ADR 0012), through the API with a fake Google."""

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.user_state.document import MAX_DOCUMENT_BYTES
from tests.fake_google import OTHER_CODE
from tests.signed_in import client, clock, csrf, google, sign_in  # noqa: F401  (fixtures)

DOC = {"version": 4, "state": {"feeds": [{"name": "Everything"}], "currentFeed": "Everything"}}


def get_state(client: TestClient):
    return client.get("/api/state")


def put_state(client: TestClient, body, headers: dict[str, str] | None = None):
    return client.put("/api/state", json=body, headers=csrf(client) if headers is None else headers)


def test_a_new_user_has_no_saved_state(client: TestClient):
    sign_in(client)
    res = get_state(client)
    assert res.status_code == 200
    assert res.json() == {"success": True, "data": None, "error": None}


def test_saved_state_comes_back_as_saved(client: TestClient):
    sign_in(client)
    assert put_state(client, DOC).json()["success"] is True
    assert get_state(client).json()["data"] == DOC


def test_saving_again_replaces_the_document(client: TestClient):
    sign_in(client)
    put_state(client, DOC)
    newer = {"version": 5, "state": {"feeds": []}}
    put_state(client, newer)
    assert get_state(client).json()["data"] == newer


def test_another_user_never_sees_or_overwrites_your_state(client: TestClient):
    sign_in(client)
    put_state(client, DOC)
    other = TestClient(client.app)
    sign_in(other, OTHER_CODE)

    assert get_state(other).json()["data"] is None
    put_state(other, {"version": 4, "state": {"mine": True}})
    assert get_state(client).json()["data"] == DOC


INVALID_DOCUMENTS = [
    {"state": {}},
    {"version": 4},
    {"version": "4", "state": {}},
    {"version": True, "state": {}},
    {"version": 0, "state": {}},
    {"version": 4.5, "state": {}},
    {"version": 4, "state": []},
    {"version": 4, "state": "feeds"},
    {"version": 4, "state": {}, "extra": 1},
    [DOC],
    None,
]


@pytest.mark.parametrize("body", INVALID_DOCUMENTS)
def test_invalid_documents_are_rejected_and_change_nothing(client: TestClient, body):
    sign_in(client)
    put_state(client, DOC)
    res = put_state(client, body)
    assert res.status_code == 422
    assert res.json() == {"success": False, "data": None, "error": "That isn't a Yourfeed state document."}
    assert get_state(client).json()["data"] == DOC


def test_a_body_that_isnt_json_is_rejected(client: TestClient):
    sign_in(client)
    res = client.put("/api/state", content=b"{not json", headers={**csrf(client), "Content-Type": "application/json"})
    assert res.status_code == 422


def test_an_oversized_document_is_rejected(client: TestClient):
    sign_in(client)
    huge = {"version": 4, "state": {"notes": {"v": "x" * MAX_DOCUMENT_BYTES}}}
    res = put_state(client, huge)
    assert res.status_code == 413
    assert get_state(client).json()["data"] is None


def test_reading_state_needs_a_session(client: TestClient):
    res = get_state(client)
    assert res.status_code == 401
    assert res.json()["error"] == "Sign in with Google first."


def test_saving_state_needs_a_session(client: TestClient):
    assert put_state(client, DOC, headers={}).status_code == 401


def test_saving_state_needs_the_csrf_token(client: TestClient):
    sign_in(client)
    assert put_state(client, DOC, headers={}).status_code == 403
    assert put_state(client, DOC, headers={"X-CSRF-Token": "forged"}).status_code == 403
    assert get_state(client).json()["data"] is None


def test_state_survives_signing_out_and_back_in(client: TestClient):
    sign_in(client)
    put_state(client, DOC)
    client.post("/api/auth/logout", headers=csrf(client))
    assert get_state(client).status_code == 401
    sign_in(client)
    assert get_state(client).json()["data"] == DOC


def test_delete_my_data_deletes_the_state_too(client: TestClient):
    sign_in(client)
    put_state(client, DOC)
    client.delete("/api/account", headers=csrf(client))
    sign_in(client)
    assert get_state(client).json()["data"] is None


def test_without_sign_in_set_up_state_stays_in_the_browser():
    demo = TestClient(create_app())
    for res in (demo.get("/api/state"), demo.put("/api/state", json=DOC)):
        assert res.status_code == 404
        assert res.json()["error"] == "Signing in isn't set up on this server, so state stays in the browser."

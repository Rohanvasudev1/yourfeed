"""Sign in with Google, the session cookie, CSRF on writes, sign out and Delete my data, through the API with a fake Google."""

import base64
import hashlib
from datetime import UTC, datetime, timedelta
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.accounts.config import AuthConfig
from app.accounts.tables import User
from app.main import AuthSetup, create_app
from tests.fake_google import GOOD_CODE, NO_REFRESH_CODE, OTHER_CODE, FakeGoogle

APP_URL = "http://testserver"
KEY = Fernet.generate_key().decode()


@pytest.fixture
def google() -> FakeGoogle:
    return FakeGoogle()


class Clock:
    def __init__(self) -> None:
        self.moment = datetime(2026, 11, 23, tzinfo=UTC)

    def __call__(self) -> datetime:
        return self.moment


@pytest.fixture
def clock() -> Clock:
    return Clock()


@pytest.fixture
def client(tmp_path: Path, google: FakeGoogle, clock: Clock) -> TestClient:
    config = AuthConfig(
        google_client_id="client-id",
        google_client_secret="client-secret",
        session_secret="s" * 32,
        token_encryption_key=KEY,
        database_url=f"sqlite:///{tmp_path / 'test.db'}",
        app_url=APP_URL,
    )
    return TestClient(create_app(auth=AuthSetup(config, google, clock)))


def start_login(client: TestClient) -> dict[str, str]:
    res = client.get("/api/auth/login", follow_redirects=False)
    assert res.status_code == 303
    return {k: v[0] for k, v in parse_qs(urlsplit(res.headers["location"]).query).items()}


def sign_in(client: TestClient, code: str = GOOD_CODE):
    state = start_login(client)["state"]
    return client.get("/api/auth/callback", params={"code": code, "state": state}, follow_redirects=False)


def me(client: TestClient) -> dict:
    return client.get("/api/auth/me").json()["data"]


def csrf(client: TestClient) -> dict[str, str]:
    return {"X-CSRF-Token": me(client)["csrfToken"]}


def users(client: TestClient) -> list[User]:
    with Session(client.app.state.engine) as db:
        return list(db.exec(select(User)).all())


def test_signed_out_visitor_can_sign_in(client: TestClient):
    assert me(client) == {"signInAvailable": True, "signedIn": False, "csrfToken": None}


def test_callback_creates_a_user_and_sets_an_httponly_lax_session_cookie(client: TestClient):
    res = sign_in(client)

    assert res.status_code == 303
    assert res.headers["location"] == f"{APP_URL}/"
    cookie = next(c for c in res.headers.get_list("set-cookie") if c.startswith("yourfeed_session="))
    assert "HttpOnly" in cookie
    assert "SameSite=lax" in cookie
    assert [u.google_subject for u in users(client)] == ["google-sub-1"]
    body = me(client)
    assert body["signedIn"] is True
    assert len(body["csrfToken"]) >= 32


def test_login_uses_pkce_and_the_callback_redirect(client: TestClient, google: FakeGoogle):
    params = start_login(client)
    client.get("/api/auth/callback", params={"code": GOOD_CODE, "state": params["state"]}, follow_redirects=False)

    [exchange] = google.exchanges
    assert exchange.redirect_uri == f"{APP_URL}/api/auth/callback"
    digest = hashlib.sha256(exchange.code_verifier.encode()).digest()
    assert base64.urlsafe_b64encode(digest).rstrip(b"=").decode() == params["code_challenge"]


def test_refresh_tokens_are_stored_encrypted(client: TestClient):
    sign_in(client)

    [user] = users(client)
    assert "refresh-1" not in user.refresh_token
    assert Fernet(KEY.encode()).decrypt(user.refresh_token.encode()) == b"refresh-1"


def test_signing_in_again_keeps_one_user_and_the_token_when_google_sends_none(client: TestClient):
    sign_in(client)
    sign_in(client, NO_REFRESH_CODE)

    [user] = users(client)
    assert Fernet(KEY.encode()).decrypt(user.refresh_token.encode()) == b"refresh-1"


def test_callback_with_a_forged_state_signs_no_one_in(client: TestClient, google: FakeGoogle):
    start_login(client)
    res = client.get("/api/auth/callback", params={"code": GOOD_CODE, "state": "forged"}, follow_redirects=False)

    assert res.headers["location"] == f"{APP_URL}/?signin=failed"
    assert google.exchanges == []
    assert users(client) == []
    assert me(client)["signedIn"] is False


def test_callback_without_a_login_signs_no_one_in(client: TestClient):
    res = client.get("/api/auth/callback", params={"code": GOOD_CODE, "state": "anything"}, follow_redirects=False)
    assert res.headers["location"] == f"{APP_URL}/?signin=failed"
    assert users(client) == []


@pytest.mark.parametrize("params", [{"code": "refused"}, {"error": "access_denied"}])
def test_refused_or_cancelled_sign_in_redirects_with_failure(client: TestClient, params: dict[str, str]):
    state = start_login(client)["state"]
    res = client.get("/api/auth/callback", params={**params, "state": state}, follow_redirects=False)
    assert res.headers["location"] == f"{APP_URL}/?signin=failed"
    assert users(client) == []


def test_a_new_first_google_grant_without_a_refresh_token_signs_no_one_in(client: TestClient, google: FakeGoogle):
    res = sign_in(client, NO_REFRESH_CODE)
    assert res.headers["location"] == f"{APP_URL}/?signin=failed"
    assert users(client) == []


def test_a_login_state_works_once(client: TestClient):
    state = start_login(client)["state"]
    client.get("/api/auth/callback", params={"code": GOOD_CODE, "state": state}, follow_redirects=False)
    client.cookies.delete("yourfeed_session")
    res = client.get("/api/auth/callback", params={"code": GOOD_CODE, "state": state}, follow_redirects=False)
    assert res.headers["location"] == f"{APP_URL}/?signin=failed"


@pytest.mark.parametrize("method,path", [("POST", "/api/auth/logout"), ("DELETE", "/api/account")])
def test_writes_without_a_csrf_token_are_rejected(client: TestClient, method: str, path: str):
    sign_in(client)

    missing = client.request(method, path)
    wrong = client.request(method, path, headers={"X-CSRF-Token": "wrong"})

    assert missing.status_code == wrong.status_code == 403
    assert missing.json() == {"success": False, "data": None, "error": "This request is missing its security token. Reload and try again."}
    assert me(client)["signedIn"] is True
    assert len(users(client)) == 1


@pytest.mark.parametrize("method,path", [("POST", "/api/auth/logout"), ("DELETE", "/api/account")])
def test_writes_need_a_session(client: TestClient, method: str, path: str):
    res = client.request(method, path, headers={"X-CSRF-Token": "anything"})
    assert res.status_code == 401
    assert res.json()["error"] == "Sign in with Google first."


def test_sign_out_ends_the_session_but_keeps_the_account(client: TestClient):
    sign_in(client)
    old_cookie = client.cookies["yourfeed_session"]

    res = client.post("/api/auth/logout", headers=csrf(client))

    assert res.status_code == 200
    assert me(client)["signedIn"] is False
    client.cookies.set("yourfeed_session", old_cookie)
    assert me(client)["signedIn"] is False
    assert len(users(client)) == 1


def test_delete_my_data_removes_the_user_and_revokes_the_token(client: TestClient, google: FakeGoogle):
    sign_in(client)
    sign_in(client, OTHER_CODE)  # a second account in the same database stays

    res = client.request("DELETE", "/api/account", headers=csrf(client))

    assert res.json() == {"success": True, "data": {"revoked": True}, "error": None}
    assert google.revoked == ["refresh-2"]
    assert [u.google_subject for u in users(client)] == ["google-sub-1"]
    assert me(client)["signedIn"] is False


def test_delete_my_data_still_deletes_when_google_cant_revoke(client: TestClient, google: FakeGoogle):
    google.revoke_fails = True
    sign_in(client)

    res = client.request("DELETE", "/api/account", headers=csrf(client))

    assert res.json()["data"] == {"revoked": False}
    assert users(client) == []


def test_a_forged_session_cookie_is_signed_out(client: TestClient):
    client.cookies.set("yourfeed_session", "made-up")
    assert me(client)["signedIn"] is False


def test_a_session_lasts_30_days(client: TestClient, clock: Clock):
    sign_in(client)
    clock.moment += timedelta(days=29)
    assert me(client)["signedIn"] is True
    clock.moment += timedelta(days=1)
    assert me(client)["signedIn"] is False

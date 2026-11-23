"""The manual YouTube smoke script's checks, against a fake Google and the recorded YouTube. The script itself calls the real APIs, so it never runs in CI."""

from pathlib import Path

import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.accounts.config import AuthConfig
from app.accounts.keys import Keys
from app.accounts.store import AccountStore
from app.main import AuthSetup, create_app
from app.youtube.tables import ChannelCache
from scripts.youtube_smoke import main, run_smoke
from tests.fake_google import GOOD_CODE, FakeGoogle
from tests.fake_youtube import API_KEY, Failure, FakeYouTube
from tests.signed_in import Clock, csrf, sign_in

KEY = Fernet.generate_key().decode()
SESSION_SECRET = "s" * 32


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
        session_secret=SESSION_SECRET,
        token_encryption_key=KEY,
        database_url=f"sqlite:///{tmp_path / 'test.db'}",
        app_url="http://testserver",
        youtube_api_key=API_KEY,
    )
    return create_app(auth=AuthSetup(config, google, clock, youtube.client()))


def signed_in_as(app, username: str) -> None:
    client = TestClient(app)
    assert sign_in(client, GOOD_CODE).status_code == 303
    assert client.put("/api/account/username", json={"username": username}, headers=csrf(client)).status_code == 200


def smoke(app, google: FakeGoogle, youtube: FakeYouTube, clock: Clock, username: str = "maya"):
    store = AccountStore(app.state.engine, Keys(SESSION_SECRET, KEY), clock)
    return run_smoke(username, store, google, youtube.client(), clock)


def test_a_signed_in_account_passes_every_check(app, google, youtube, clock):
    signed_in_as(app, "maya")
    checks = smoke(app, google, youtube, clock)
    assert [c.ok for c in checks] == [True] * len(checks)
    assert [c.name for c in checks] == ["Account", "Google access token", "Subscriptions", "Catalog", "Topics", "Video lookup"]


def test_an_unknown_username_stops_at_the_first_check(app, google, youtube, clock):
    signed_in_as(app, "maya")
    checks = smoke(app, google, youtube, clock, username="nobody")
    assert [(c.name, c.ok) for c in checks] == [("Account", False)]
    assert "nobody" in checks[0].detail


def test_a_revoked_google_grant_fails_the_token_check(app, google, youtube, clock):
    signed_in_as(app, "maya")
    google.access_revoked = True
    checks = smoke(app, google, youtube, clock)
    assert [(c.name, c.ok) for c in checks] == [("Account", True), ("Google access token", False)]


def test_youtube_refusing_fails_with_its_safe_message(app, google, youtube, clock):
    signed_in_as(app, "maya")
    youtube.failure = Failure(status=403, reason="quotaExceeded")
    checks = smoke(app, google, youtube, clock)
    assert checks[-1].name == "Subscriptions"
    assert not checks[-1].ok
    assert "allowance" in checks[-1].detail


def test_the_smoke_run_never_writes_the_shared_channel_cache(app, google, youtube, clock):
    signed_in_as(app, "maya")
    smoke(app, google, youtube, clock)
    with Session(app.state.engine) as db:
        assert db.exec(select(ChannelCache)).all() == []


def test_the_script_refuses_to_run_without_sign_in_set_up(monkeypatch, capsys):
    for name in ("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "SESSION_SECRET", "TOKEN_ENCRYPTION_KEY", "YOUTUBE_API_KEY"):
        monkeypatch.delenv(name, raising=False)
    assert main(["--username", "maya"]) == 2
    assert "--env-file" in capsys.readouterr().err

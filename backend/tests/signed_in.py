"""A signed-in client against the real app: SQLite in a temp folder and a fake Google, shared by the API tests."""

from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient

from app.accounts.config import AuthConfig
from app.main import AuthSetup, create_app
from tests.fake_google import GOOD_CODE, FakeGoogle

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

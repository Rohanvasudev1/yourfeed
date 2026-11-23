"""Signed-in mode turns on only with every secret set; without any, the app is demo-only."""

import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient

from app.accounts.config import AuthConfig, AuthConfigError
from app.db import make_engine
from app.main import create_app

NOT_SET_UP = "Signing in isn't set up on this server."


def full_env(**changes: str) -> dict[str, str]:
    base = {
        "GOOGLE_CLIENT_ID": "id",
        "GOOGLE_CLIENT_SECRET": "secret",
        "SESSION_SECRET": "s" * 32,
        "TOKEN_ENCRYPTION_KEY": Fernet.generate_key().decode(),
    }
    return {**base, **changes}


def test_no_secrets_means_demo_only():
    assert AuthConfig.from_env({}) is None
    assert AuthConfig.from_env({"GOOGLE_CLIENT_ID": "", "DATABASE_URL": ""}) is None


def test_every_secret_set_enables_sign_in_with_local_defaults():
    config = AuthConfig.from_env(full_env())
    assert config is not None
    assert config.database_url.startswith("sqlite:///")
    assert config.app_url == "http://localhost:5173"


def test_database_and_app_url_come_from_the_environment():
    config = AuthConfig.from_env(full_env(DATABASE_URL="postgresql://db/x", APP_URL="https://yourfeed.example/"))
    assert config is not None
    assert config.database_url == "postgresql://db/x"
    assert config.app_url == "https://yourfeed.example"


def test_some_secrets_missing_stops_startup_naming_them():
    with pytest.raises(AuthConfigError, match="GOOGLE_CLIENT_SECRET, TOKEN_ENCRYPTION_KEY"):
        AuthConfig.from_env({"GOOGLE_CLIENT_ID": "id", "SESSION_SECRET": "s" * 32})


def test_a_short_session_secret_stops_startup():
    with pytest.raises(AuthConfigError, match="SESSION_SECRET"):
        AuthConfig.from_env(full_env(SESSION_SECRET="short"))


def test_a_malformed_encryption_key_stops_startup():
    with pytest.raises(AuthConfigError, match="TOKEN_ENCRYPTION_KEY"):
        AuthConfig.from_env(full_env(TOKEN_ENCRYPTION_KEY="not-a-key"))


def test_an_app_url_that_isnt_http_stops_startup():
    with pytest.raises(AuthConfigError, match="APP_URL"):
        AuthConfig.from_env(full_env(APP_URL="javascript:alert(1)"))


demo = TestClient(create_app())


def test_demo_only_app_says_sign_in_isnt_available():
    assert demo.get("/api/auth/me").json() == {
        "success": True,
        "data": {"signInAvailable": False, "signedIn": False, "csrfToken": None},
        "error": None,
    }


@pytest.mark.parametrize("method,path", [("GET", "/api/auth/login"), ("GET", "/api/auth/callback"), ("POST", "/api/auth/logout"), ("DELETE", "/api/account")])
def test_demo_only_app_refuses_account_routes(method: str, path: str):
    res = demo.request(method, path, follow_redirects=False)
    assert res.status_code == 404
    assert res.json() == {"success": False, "data": None, "error": NOT_SET_UP}


def test_demo_still_works_without_secrets():
    assert len(demo.get("/api/catalog").json()["data"]) == 38


@pytest.mark.parametrize("url", ["postgres://u:p@db.example/yf", "postgresql://u:p@db.example/yf", "postgresql+psycopg://u:p@db.example/yf"])
def test_hosted_postgres_urls_use_the_installed_driver(url: str):
    assert make_engine(url).url.drivername == "postgresql+psycopg"

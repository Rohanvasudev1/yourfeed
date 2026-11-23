"""Signed-in mode's settings, from the environment (ADR 0012). With none of the secrets set the app is demo-only."""

from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlsplit

from cryptography.fernet import Fernet

SECRETS = ("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "SESSION_SECRET", "TOKEN_ENCRYPTION_KEY")
MIN_SESSION_SECRET_LENGTH = 32
DEFAULT_APP_URL = "http://localhost:5173"
DEFAULT_DATABASE_URL = f"sqlite:///{Path(__file__).resolve().parents[2] / 'yourfeed.db'}"


class AuthConfigError(Exception):
    """Signed-in mode is half set up: the app refuses to start rather than run insecurely."""


@dataclass(frozen=True)
class AuthConfig:
    google_client_id: str
    google_client_secret: str
    session_secret: str
    token_encryption_key: str
    database_url: str
    # Where the frontend is served; Google redirects back to its /api/auth/callback.
    app_url: str

    @property
    def secure_cookies(self) -> bool:
        return self.app_url.startswith("https://")

    @property
    def redirect_uri(self) -> str:
        return f"{self.app_url}/api/auth/callback"

    @classmethod
    def from_env(cls, env: Mapping[str, str]) -> "AuthConfig | None":
        values = {name: env.get(name, "").strip() for name in SECRETS}
        if not any(values.values()):
            return None
        missing = [name for name, value in values.items() if not value]
        if missing:
            raise AuthConfigError(f"Signing in needs every one of {', '.join(SECRETS)}; missing: {', '.join(missing)}.")
        if len(values["SESSION_SECRET"]) < MIN_SESSION_SECRET_LENGTH:
            raise AuthConfigError(f"SESSION_SECRET must be at least {MIN_SESSION_SECRET_LENGTH} characters.")
        _check_fernet_key(values["TOKEN_ENCRYPTION_KEY"])
        return cls(
            google_client_id=values["GOOGLE_CLIENT_ID"],
            google_client_secret=values["GOOGLE_CLIENT_SECRET"],
            session_secret=values["SESSION_SECRET"],
            token_encryption_key=values["TOKEN_ENCRYPTION_KEY"],
            database_url=env.get("DATABASE_URL", "").strip() or DEFAULT_DATABASE_URL,
            app_url=_app_url(env.get("APP_URL", "").strip() or DEFAULT_APP_URL),
        )


def _check_fernet_key(key: str) -> None:
    try:
        Fernet(key.encode())
    except ValueError as exc:
        raise AuthConfigError("TOKEN_ENCRYPTION_KEY must be a Fernet key (see .env.example for how to make one).") from exc


def _app_url(url: str) -> str:
    parts = urlsplit(url)
    if parts.scheme not in ("http", "https") or not parts.netloc:
        raise AuthConfigError("APP_URL must be an http(s) address such as https://yourfeed.example.")
    return url.rstrip("/")

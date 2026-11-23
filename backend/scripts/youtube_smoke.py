"""Checks one real signed-in account end to end: its stored Google grant, a fresh access token, its subscriptions,
its catalog, topics and a video lookup, all against the real Google and YouTube APIs (ADR 0011).

For the owner after going live (or after signing in locally); it calls real APIs, so it never runs in CI or pytest.
Sign in on the app and pick a username first. Usage, from backend/:

    uv run --env-file .env.hosting python -m scripts.youtube_smoke --username maya

It reads the same variables as the backend (DATABASE_URL, the Google client, TOKEN_ENCRYPTION_KEY, YOUTUBE_API_KEY),
never prints a token or key, and only reads the database: channel uploads are cached in a throwaway SQLite file,
not the shared cache. It spends a few units of the day's YouTube quota and no search.list calls.
"""

import argparse
import os
import sys
import tempfile
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import NoReturn, TypeVar

from app.accounts.config import AuthConfig, AuthConfigError
from app.accounts.google import GoogleError, GoogleOAuth, HttpGoogleOAuth
from app.accounts.keys import Keys
from app.accounts.store import AccountStore, utc_now
from app.catalog import Video
from app.db import make_engine, migrate
from app.youtube.cache import ChannelCacheStore
from app.youtube.catalog import MAX_CHANNELS, YouTubeCatalog
from app.youtube.client import YouTubeClient, YouTubeError
from app.youtube.http import HttpYouTubeClient
from app.youtube.topics import FALLBACK_TOPIC

T = TypeVar("T")


@dataclass(frozen=True)
class Check:
    name: str
    ok: bool
    detail: str


class _Failed(Exception):
    pass


@dataclass
class _Run:
    checks: list[Check] = field(default_factory=list)

    def passed(self, name: str, detail: str) -> None:
        self.checks.append(Check(name, True, detail))

    def fail(self, name: str, detail: str) -> NoReturn:
        self.checks.append(Check(name, False, detail))
        raise _Failed

    def youtube(self, name: str, call: Callable[[], T]) -> T:
        try:
            return call()
        except YouTubeError as exc:
            self.fail(name, str(exc))


def run_smoke(
    username: str, store: AccountStore, google: GoogleOAuth, youtube: YouTubeClient, now: Callable[[], datetime] = utc_now
) -> list[Check]:
    """Each check in order, stopping at the first failure, since every later one needs what it found."""
    run = _Run()
    try:
        refresh_token = _stored_grant(run, store, username)
        access_token = _access_token(run, google, refresh_token)
        subscriptions = run.youtube("Subscriptions", lambda: youtube.subscriptions(access_token, MAX_CHANNELS))
        if not subscriptions:
            run.fail("Subscriptions", "The account subscribes to no channels.")
        run.passed("Subscriptions", f"{len(subscriptions)} channels")
        with tempfile.TemporaryDirectory() as folder:
            catalog = _throwaway_catalog(youtube, Path(folder), now)
            videos = run.youtube("Catalog", lambda: catalog.for_user(access_token))
            if not videos:
                run.fail("Catalog", "None of the subscribed channels has a watchable upload.")
            run.passed("Catalog", f"{len(videos)} videos")
            _topics(run, videos)
            first = videos[0].id
            found = run.youtube("Video lookup", lambda: catalog.lookup([first]))
            if [v.id for v in found] != [first]:
                run.fail("Video lookup", f"{first} wasn't found by id.")
            run.passed("Video lookup", f"found {first} by id")
    except _Failed:
        pass
    return run.checks


def _stored_grant(run: _Run, store: AccountStore, username: str) -> str:
    user_id = store.user_with_username(username)
    if user_id is None:
        run.fail("Account", f"No account is called @{username}: sign in on the app and pick that username first.")
    refresh_token = store.refresh_token_of(user_id)
    if refresh_token is None:
        run.fail("Account", "No usable Google grant is stored: check TOKEN_ENCRYPTION_KEY, then sign out and in again.")
    run.passed("Account", f"@{username} has a stored Google grant")
    return refresh_token


def _access_token(run: _Run, google: GoogleOAuth, refresh_token: str) -> str:
    try:
        token = google.access_token(refresh_token)
    except GoogleError as exc:
        run.fail("Google access token", f"Google refused the stored grant ({exc}): sign out and sign in again.")
    run.passed("Google access token", "refreshed")
    return token


def _topics(run: _Run, videos: Sequence[Video]) -> None:
    topics = sorted({v.topic for v in videos} - {FALLBACK_TOPIC})
    if not topics:
        run.fail("Topics", f"Every video's topic is {FALLBACK_TOPIC}.")
    run.passed("Topics", f"{len(topics)} topics, such as {', '.join(topics[:3])}")


def _throwaway_catalog(youtube: YouTubeClient, folder: Path, now: Callable[[], datetime]) -> YouTubeCatalog:
    engine = make_engine(f"sqlite:///{folder / 'smoke.db'}")
    migrate(engine)
    return YouTubeCatalog(youtube, ChannelCacheStore(engine), now)


def _args(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Check one real signed-in account against Google and YouTube.")
    parser.add_argument("--username", required=True, help="The account's Yourfeed username, without the @.")
    return parser.parse_args(argv)


def main(argv: Sequence[str]) -> int:
    username = _args(argv).username.strip().lstrip("@").lower()
    try:
        config = AuthConfig.from_env(os.environ)
    except AuthConfigError as exc:
        print(exc, file=sys.stderr)
        return 2
    if config is None:
        print("Sign in with Google isn't set up: pass the env file, e.g. --env-file .env.hosting.", file=sys.stderr)
        return 2
    store = AccountStore(make_engine(config.database_url), Keys(config.session_secret, config.token_encryption_key))
    google = HttpGoogleOAuth(config.google_client_id, config.google_client_secret)
    checks = run_smoke(username, store, google, HttpYouTubeClient(config.youtube_api_key))
    for c in checks:
        print(f"{'✓' if c.ok else '✗'} {c.name}: {c.detail}")
    passed = all(c.ok for c in checks)
    print("Smoke test passed." if passed else "Smoke test failed.")
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

"""`GET /api/catalog?source=youtube`: the session's user, their Google access token, then their catalog."""

import logging
from collections.abc import Callable

from fastapi import Request

from app.accounts.google import GoogleAccessRevoked, GoogleError, GoogleOAuth
from app.accounts.store import AccountStore, SignedIn
from app.catalog import SIGN_IN_FOR_CATALOG, SignInRequired, Video
from app.youtube.catalog import YouTubeCatalog
from app.youtube.client import ACCESS_EXPIRED, UNAVAILABLE, YouTubeAccessExpired, YouTubeError

log = logging.getLogger("yourfeed.youtube")

SignedInCatalog = Callable[[Request], tuple[Video, ...]]


def signed_in_catalog(
    session_of: Callable[[Request], SignedIn | None], store: AccountStore, google: GoogleOAuth, youtube: YouTubeCatalog
) -> SignedInCatalog:
    def load(request: Request) -> tuple[Video, ...]:
        session = session_of(request)
        if session is None:
            raise SignInRequired(SIGN_IN_FOR_CATALOG)
        refresh_token = store.refresh_token_of(session.user_id)
        if refresh_token is None:
            raise YouTubeAccessExpired(ACCESS_EXPIRED)
        try:
            access_token = google.access_token(refresh_token)
        except GoogleAccessRevoked as exc:
            raise YouTubeAccessExpired(ACCESS_EXPIRED) from exc
        except GoogleError as exc:
            log.warning("Couldn't get a YouTube access token: %s", exc)
            raise YouTubeError(UNAVAILABLE) from exc
        return youtube.for_user(access_token)

    return load

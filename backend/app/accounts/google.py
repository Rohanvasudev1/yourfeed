"""Google's OAuth endpoints behind one interface, so tests pass a fake and never reach the network."""

import logging
from dataclasses import dataclass, field
from typing import Protocol
from urllib.parse import urlencode

import httpx

log = logging.getLogger("yourfeed.accounts")

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
REVOKE_URL = "https://oauth2.googleapis.com/revoke"
# `openid` gives the stable Google subject; youtube.readonly is all Yourfeed reads (ADR 0005).
SCOPES = "openid https://www.googleapis.com/auth/youtube.readonly"
GOOGLE_TIMEOUT_S = 10.0


class GoogleError(Exception):
    """Google refused or couldn't be reached."""


@dataclass(frozen=True)
class GoogleGrant:
    """What a sign-in gives Yourfeed: who the user is, and a refresh token (Google sends one only with consent)."""

    subject: str
    refresh_token: str | None


class GoogleOAuth(Protocol):
    def authorization_url(self, *, redirect_uri: str, state: str, code_challenge: str) -> str: ...

    def exchange(self, *, code: str, redirect_uri: str, code_verifier: str) -> GoogleGrant: ...

    def revoke(self, refresh_token: str) -> None: ...


@dataclass(frozen=True)
class HttpGoogleOAuth:
    client_id: str
    client_secret: str
    http: httpx.Client = field(default_factory=lambda: httpx.Client(timeout=GOOGLE_TIMEOUT_S))

    def authorization_url(self, *, redirect_uri: str, state: str, code_challenge: str) -> str:
        query = {
            "client_id": self.client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": SCOPES,
            "state": state,
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
            # Offline access and consent make Google send a refresh token.
            "access_type": "offline",
            "prompt": "consent",
        }
        return f"{AUTH_URL}?{urlencode(query)}"

    def exchange(self, *, code: str, redirect_uri: str, code_verifier: str) -> GoogleGrant:
        tokens = self._post(
            TOKEN_URL,
            {
                "code": code,
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
                "code_verifier": code_verifier,
            },
        )
        access_token = tokens.get("access_token")
        if not isinstance(access_token, str):
            raise GoogleError("Google's token answer had no access token.")
        info = self._get_userinfo(access_token)
        subject = info.get("sub")
        if not isinstance(subject, str) or not subject:
            raise GoogleError("Google didn't say who signed in.")
        refresh = tokens.get("refresh_token")
        return GoogleGrant(subject=subject, refresh_token=refresh if isinstance(refresh, str) and refresh else None)

    def revoke(self, refresh_token: str) -> None:
        self._post(REVOKE_URL, {"token": refresh_token})

    def _post(self, url: str, form: dict[str, str]) -> dict:
        return self._send(lambda: self.http.post(url, data=form))

    def _get_userinfo(self, access_token: str) -> dict:
        return self._send(lambda: self.http.get(USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"}))

    @staticmethod
    def _send(call) -> dict:
        try:
            res = call()
        except httpx.HTTPError as exc:
            raise GoogleError(f"Couldn't reach Google: {exc.__class__.__name__}") from exc
        return _json_or_raise(res)


def _json_or_raise(res: httpx.Response) -> dict:
    if res.status_code >= 400:
        # Google's error bodies name the error; they never echo secrets back.
        log.warning("Google answered %s at %s: %s", res.status_code, res.url.path, res.text[:200])
        raise GoogleError(f"Google answered {res.status_code}.")
    try:
        body = res.json()
    except ValueError:
        body = {}
    return body if isinstance(body, dict) else {}

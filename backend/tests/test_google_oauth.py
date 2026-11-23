"""The real Google adapter, against a mock transport: what it sends and how it reads Google's answers."""

from urllib.parse import parse_qs, urlsplit

import httpx
import pytest

from app.accounts.google import GoogleError, GoogleGrant, HttpGoogleOAuth

REDIRECT = "http://localhost:5173/api/auth/callback"


def google_with(handler) -> tuple[HttpGoogleOAuth, list[httpx.Request]]:
    seen: list[httpx.Request] = []

    def record(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return handler(request)

    return HttpGoogleOAuth("cid", "csecret", httpx.Client(transport=httpx.MockTransport(record))), seen


def happy(request: httpx.Request) -> httpx.Response:
    if request.url.path == "/token":
        return httpx.Response(200, json={"access_token": "at", "refresh_token": "rt"})
    if request.url.path == "/v1/userinfo":
        return httpx.Response(200, json={"sub": "sub-9"})
    return httpx.Response(200, json={})


def form(request: httpx.Request) -> dict[str, str]:
    return {k: v[0] for k, v in parse_qs(request.content.decode()).items()}


def test_authorization_url_asks_for_read_only_youtube_offline_with_pkce():
    google, _ = google_with(happy)
    url = google.authorization_url(redirect_uri=REDIRECT, state="st", code_challenge="ch")
    query = {k: v[0] for k, v in parse_qs(urlsplit(url).query).items()}
    assert url.startswith("https://accounts.google.com/")
    assert query["scope"] == "openid https://www.googleapis.com/auth/youtube.readonly"
    assert query | {"scope": ""} == {
        "client_id": "cid", "redirect_uri": REDIRECT, "response_type": "code", "scope": "", "state": "st",
        "code_challenge": "ch", "code_challenge_method": "S256", "access_type": "offline", "prompt": "consent",
    }


def test_exchange_sends_the_code_and_verifier_and_reads_who_signed_in():
    google, seen = google_with(happy)
    grant = google.exchange(code="c", redirect_uri=REDIRECT, code_verifier="v")
    assert grant == GoogleGrant(subject="sub-9", refresh_token="rt")
    token, userinfo = seen
    assert form(token) == {"code": "c", "client_id": "cid", "client_secret": "csecret", "redirect_uri": REDIRECT,
                           "grant_type": "authorization_code", "code_verifier": "v"}
    assert userinfo.headers["authorization"] == "Bearer at"


def test_exchange_without_a_refresh_token_says_so():
    google, _ = google_with(lambda r: httpx.Response(200, json={"access_token": "at"} if r.url.path == "/token" else {"sub": "s"}))
    assert google.exchange(code="c", redirect_uri=REDIRECT, code_verifier="v").refresh_token is None


@pytest.mark.parametrize("handler", [
    lambda r: httpx.Response(400, json={"error": "invalid_grant"}),
    lambda r: httpx.Response(200, json={"no": "token"}),
    lambda r: httpx.Response(200, json={"access_token": "at"} if r.url.path == "/token" else {"sub": ""}),
    lambda r: httpx.Response(200, text="not json"),
])
def test_exchange_fails_on_anything_but_a_clear_answer(handler):
    google, _ = google_with(handler)
    with pytest.raises(GoogleError):
        google.exchange(code="c", redirect_uri=REDIRECT, code_verifier="v")


def test_unreachable_google_is_a_google_error():
    def down(_: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("down")

    google, _ = google_with(down)
    with pytest.raises(GoogleError, match="Couldn't reach Google"):
        google.revoke("rt")


def test_revoke_posts_the_token():
    google, seen = google_with(happy)
    google.revoke("rt")
    [request] = seen
    assert str(request.url) == "https://oauth2.googleapis.com/revoke"
    assert form(request) == {"token": "rt"}

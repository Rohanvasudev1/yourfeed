"""A recorded YouTube Data API: real answers' shapes from tests/fixtures/youtube.json, served over httpx's MockTransport.

The app's real `HttpYouTubeClient` talks to it, so tests never reach the network and the adapter's parsing is exercised too.
"""

import json
from dataclasses import dataclass, field
from pathlib import Path

import httpx

from app.youtube.http import HttpYouTubeClient

RECORDED = json.loads((Path(__file__).parent / "fixtures" / "youtube.json").read_text(encoding="utf-8"))
API_KEY = "server-api-key"


@dataclass(frozen=True)
class Failure:
    """What the next answers are instead of the recording: an HTTP status with a reason, or no answer at all."""

    status: int = 503
    reason: str = "backendError"
    unreachable: bool = False


@dataclass
class FakeYouTube:
    requests: list[httpx.Request] = field(default_factory=list)
    failure: Failure | None = None

    def client(self) -> HttpYouTubeClient:
        return HttpYouTubeClient(API_KEY, httpx.Client(transport=httpx.MockTransport(self._answer)))

    def calls(self, resource: str, **params: str) -> int:
        """How many requests went to a resource (`playlistItems`, `channels`…) with these query parameters."""
        return sum(
            1
            for r in self.requests
            if r.url.path.endswith(f"/{resource}") and all(r.url.params.get(k) == v for k, v in params.items())
        )

    def _answer(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if self.failure and self.failure.unreachable:
            raise httpx.ConnectError("YouTube is unreachable", request=request)
        if self.failure:
            return _error(self.failure.status, self.failure.reason)
        resource, params = request.url.path.rsplit("/", 1)[-1], request.url.params
        if resource == "subscriptions":
            return _subscriptions(request.headers.get("Authorization", ""), params.get("pageToken"))
        if resource == "playlistItems":
            page = RECORDED["playlistItems"].get(params["playlistId"])
            return httpx.Response(200, json=page) if page else _error(404, "playlistNotFound")
        if resource in ("channels", "videos"):
            items = [RECORDED[resource][i] for i in params["id"].split(",") if i in RECORDED[resource]]
            return httpx.Response(200, json={"items": items})
        return _error(404, "notFound")


def _subscriptions(authorization: str, page_token: str | None) -> httpx.Response:
    pages = RECORDED["subscriptions"].get(authorization.removeprefix("Bearer "))
    if pages is None:
        return _error(401, "authError")
    return httpx.Response(200, json=pages[1] if page_token == "page-2" else pages[0])


def _error(status: int, reason: str) -> httpx.Response:
    return httpx.Response(status, json={"error": {"code": status, "message": reason, "errors": [{"reason": reason}]}})

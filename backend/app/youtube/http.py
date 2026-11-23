"""The real YouTubeClient: the documented Data API v3 only (ADR 0011). Subscriptions use the user's token, the rest the server key."""

import logging
from collections.abc import Sequence
from dataclasses import dataclass, field

import httpx

from app.youtube import wire
from app.youtube.client import (
    ACCESS_EXPIRED,
    MAX_IDS_PER_CALL,
    QUOTA,
    UNAVAILABLE,
    Channel,
    VideoDetails,
    YouTubeAccessExpired,
    YouTubeError,
    YouTubeQuotaExceeded,
)

log = logging.getLogger("yourfeed.youtube")

API = "https://www.googleapis.com/youtube/v3"
YOUTUBE_TIMEOUT_S = 10.0
PAGE_SIZE = 50
QUOTA_REASONS = frozenset({"quotaExceeded", "dailyLimitExceeded", "rateLimitExceeded"})


@dataclass(frozen=True)
class HttpYouTubeClient:
    api_key: str
    http: httpx.Client = field(default_factory=lambda: httpx.Client(timeout=YOUTUBE_TIMEOUT_S))

    def subscriptions(self, access_token: str, limit: int) -> list[str]:
        ids: list[str] = []
        token: str | None = None
        while len(ids) < limit:
            params = {"part": "snippet", "mine": "true", "maxResults": str(PAGE_SIZE)} | ({"pageToken": token} if token else {})
            page = wire.subscription_page(self._get("subscriptions", params, access_token=access_token))
            ids.extend(page.channel_ids())
            token = page.next_page_token
            if not token:
                break
        return ids[:limit]

    def channels(self, ids: Sequence[str]) -> list[Channel]:
        body = self._get("channels", {"part": "snippet,contentDetails,statistics,topicDetails", "id": _ids(ids)})
        return wire.channels(body)

    def uploads(self, channel: Channel, limit: int) -> list[str]:
        if not channel.uploads_playlist:
            return []
        params = {"part": "contentDetails", "playlistId": channel.uploads_playlist, "maxResults": str(min(limit, PAGE_SIZE))}
        try:
            body = self._get("playlistItems", params)
        except _NotFound:
            # A channel that never uploaded has no uploads playlist to read.
            return []
        return wire.playlist_video_ids(body)[:limit]

    def videos(self, ids: Sequence[str]) -> list[VideoDetails]:
        return wire.videos(self._get("videos", {"part": "snippet,contentDetails,statistics,topicDetails", "id": _ids(ids)}))

    def search(self, topic: str) -> list[str]:
        raise NotImplementedError("Topic searches come with #64.")

    def _get(self, resource: str, params: dict[str, str], *, access_token: str | None = None) -> object:
        # The user's token or the server key, never both: API Data for one user isn't fetched with the shared key.
        headers = {"Authorization": f"Bearer {access_token}"} if access_token else {}
        query = params if access_token else params | {"key": self.api_key}
        try:
            res = self.http.get(f"{API}/{resource}", params=query, headers=headers)
        except httpx.HTTPError as exc:
            log.warning("Couldn't reach YouTube for %s: %s", resource, exc.__class__.__name__)
            raise YouTubeError(UNAVAILABLE) from exc
        if res.status_code >= 400:
            raise _refusal(res, resource, user=access_token is not None)
        try:
            return res.json()
        except ValueError as exc:
            log.warning("YouTube answered %s with something other than JSON", resource)
            raise YouTubeError(UNAVAILABLE) from exc


class _NotFound(YouTubeError):
    pass


def _ids(ids: Sequence[str]) -> str:
    if len(ids) > MAX_IDS_PER_CALL:
        raise ValueError(f"At most {MAX_IDS_PER_CALL} ids a call, got {len(ids)}.")
    return ",".join(ids)


def _reason(res: httpx.Response) -> str:
    try:
        return str(res.json()["error"]["errors"][0]["reason"])
    except (ValueError, KeyError, IndexError, TypeError):
        return ""


def _refusal(res: httpx.Response, resource: str, *, user: bool) -> YouTubeError:
    reason = _reason(res)
    # Error bodies name the reason; they never echo the key or token back.
    log.warning("YouTube answered %s for %s: %s", res.status_code, resource, reason or "no reason")
    if reason in QUOTA_REASONS:
        return YouTubeQuotaExceeded(QUOTA)
    if res.status_code == 404:
        return _NotFound(UNAVAILABLE)
    if user and res.status_code in (401, 403):
        return YouTubeAccessExpired(ACCESS_EXPIRED)
    return YouTubeError(UNAVAILABLE)

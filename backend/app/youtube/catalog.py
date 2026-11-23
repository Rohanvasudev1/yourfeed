"""A signed-in user's catalog: subscriptions → shared channel cache, refreshed from uploads and video details (ADR 0011)."""

import math
from collections.abc import Callable, Sequence
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import datetime

from app.catalog import Video
from app.youtube.cache import CachedVideo, ChannelCacheStore
from app.youtube.client import MAX_IDS_PER_CALL, Channel, VideoDetails, YouTubeClient
from app.youtube.topics import topic_of

MAX_CHANNELS = 200
UPLOADS_PER_CHANNEL = 10
FETCH_WORKERS = 8
SECONDS_PER_HOUR = 3600


def _chunks(items: Sequence[str], size: int = MAX_IDS_PER_CALL) -> list[Sequence[str]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


@dataclass(frozen=True)
class YouTubeCatalog:
    client: YouTubeClient
    cache: ChannelCacheStore
    now: Callable[[], datetime]

    def for_user(self, access_token: str) -> tuple[Video, ...]:
        """The newest uploads of the user's subscriptions, newest first, in the catalog's Video shape."""
        now = self.now()
        self.cache.delete_expired(now)
        channel_ids = list(dict.fromkeys(self.client.subscriptions(access_token, MAX_CHANNELS)))
        cached = self.cache.fresh(channel_ids, now)
        refreshed = self._fetch([c for c in channel_ids if c not in cached])
        self.cache.save(refreshed, now)
        uploads = {v.id: v for videos in (cached | refreshed).values() for v in videos}
        newest = sorted(uploads.values(), key=lambda v: v.published_at, reverse=True)
        return tuple(_video(v, now) for v in newest)

    def _fetch(self, channel_ids: Sequence[str]) -> dict[str, tuple[CachedVideo, ...]]:
        if not channel_ids:
            return {}
        channels = [c for chunk in _chunks(channel_ids) for c in self.client.channels(chunk)]
        with ThreadPoolExecutor(max_workers=FETCH_WORKERS) as pool:
            upload_ids = list(pool.map(lambda c: self.client.uploads(c, UPLOADS_PER_CHANNEL), channels))
        details = [d for chunk in _chunks([i for ids in upload_ids for i in ids]) for d in self.client.videos(chunk)]
        # A channel YouTube no longer returns (closed, say) is cached as empty, so it isn't asked for on every load.
        return {channel_id: () for channel_id in channel_ids} | {c.id: _watchable_uploads(c, details) for c in channels}


def _watchable_uploads(channel: Channel, details: Sequence[VideoDetails]) -> tuple[CachedVideo, ...]:
    """The channel's videos that can be watched now: an upcoming premiere or stream can't be yet."""
    return tuple(_cached(d, channel) for d in details if d.channel_id == channel.id and d.broadcast != "upcoming")


def _cached(details: VideoDetails, channel: Channel) -> CachedVideo:
    return CachedVideo(
        id=details.id,
        title=details.title,
        channel=channel.title,
        channel_subscribers=channel.subscribers,
        topic=topic_of(details.topic_urls, channel.topic_urls),
        minutes=max(1, math.ceil(details.seconds / 60)),
        views=details.views,
        live=details.broadcast == "live",
        published_at=details.published_at,
    )


def _video(v: CachedVideo, now: datetime) -> Video:
    # No AI tags for API Data (ADR 0011): never clickbait, and the honest title is the title itself.
    return Video(
        id=v.id,
        title=v.title,
        honest_title=v.title,
        channel=v.channel,
        channel_subscribers=v.channel_subscribers,
        topic=v.topic,
        minutes=v.minutes,
        views=v.views,
        age_hours=max(0, int((now - v.published_at).total_seconds() // SECONDS_PER_HOUR)),
        clickbait=False,
        live=v.live,
        news_category=None,
    )

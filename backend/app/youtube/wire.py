"""YouTube's JSON answers, validated: anything malformed is left out rather than trusted."""

import logging
from datetime import datetime, timedelta
from typing import TypeVar

from pydantic import BaseModel, ConfigDict, Field, ValidationError
from pydantic.alias_generators import to_camel

from app.youtube.client import Broadcast, Channel, VideoDetails

log = logging.getLogger("yourfeed.youtube")


class _Wire(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="ignore")


class _ResourceId(_Wire):
    channel_id: str | None = None


class _SubscriptionSnippet(_Wire):
    resource_id: _ResourceId


class _Subscription(_Wire):
    snippet: _SubscriptionSnippet


class SubscriptionPage(_Wire):
    items: list[_Subscription] = []
    next_page_token: str | None = None

    def channel_ids(self) -> list[str]:
        return [s.snippet.resource_id.channel_id for s in self.items if s.snippet.resource_id.channel_id]


class _Title(_Wire):
    title: str


class _Playlists(_Wire):
    uploads: str | None = None


class _ChannelContent(_Wire):
    related_playlists: _Playlists = _Playlists()


class _Statistics(_Wire):
    # YouTube leaves counts out when they're hidden; they read as 0.
    subscriber_count: int = 0
    view_count: int = 0


class _Topics(_Wire):
    topic_categories: list[str] = []


class _Channel(_Wire):
    id: str
    snippet: _Title
    content_details: _ChannelContent = _ChannelContent()
    statistics: _Statistics = _Statistics()
    topic_details: _Topics = _Topics()


class _PlaylistContent(_Wire):
    video_id: str


class _PlaylistItem(_Wire):
    content_details: _PlaylistContent


class _VideoSnippet(_Wire):
    published_at: datetime
    channel_id: str
    title: str
    live_broadcast_content: Broadcast = "none"


class _VideoContent(_Wire):
    duration: timedelta = timedelta(0)


class _Video(_Wire):
    id: str
    snippet: _VideoSnippet
    content_details: _VideoContent = _VideoContent()
    statistics: _Statistics = _Statistics()
    topic_details: _Topics = _Topics()


class _Page(BaseModel):
    items: list[dict] = Field(default_factory=list)


Item = TypeVar("Item", bound=_Wire)


def _items(body: object, model: type[Item]) -> list[Item]:
    try:
        raw = _Page.model_validate(body).items
    except ValidationError:
        log.warning("YouTube answered without an items list")
        return []
    parsed = []
    for item in raw:
        try:
            parsed.append(model.model_validate(item))
        except ValidationError as exc:
            log.warning("Left out a malformed %s from YouTube: %s", model.__name__, exc.errors()[0]["msg"])
    return parsed


def subscription_page(body: object) -> SubscriptionPage:
    try:
        return SubscriptionPage.model_validate(body)
    except ValidationError:
        log.warning("Left out a malformed subscriptions page from YouTube")
        return SubscriptionPage()


def channels(body: object) -> list[Channel]:
    return [
        Channel(
            id=c.id,
            title=c.snippet.title,
            subscribers=c.statistics.subscriber_count,
            uploads_playlist=c.content_details.related_playlists.uploads or None,
            topic_urls=tuple(c.topic_details.topic_categories),
        )
        for c in _items(body, _Channel)
    ]


def playlist_video_ids(body: object) -> list[str]:
    return [p.content_details.video_id for p in _items(body, _PlaylistItem)]


def videos(body: object) -> list[VideoDetails]:
    return [
        VideoDetails(
            id=v.id,
            title=v.snippet.title,
            channel_id=v.snippet.channel_id,
            seconds=int(v.content_details.duration.total_seconds()),
            views=v.statistics.view_count,
            published_at=v.snippet.published_at,
            broadcast=v.snippet.live_broadcast_content,
            topic_urls=tuple(v.topic_details.topic_categories),
        )
        for v in _items(body, _Video)
    ]

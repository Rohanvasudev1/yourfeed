"""What Yourfeed asks YouTube, behind one interface: `HttpYouTubeClient` in production, a recorded API in tests."""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Literal, Protocol

# videos.list and channels.list take at most 50 ids a call.
MAX_IDS_PER_CALL = 50

# What the app says when YouTube fails: safe to show.
UNAVAILABLE = "YouTube couldn't be reached. Try again in a minute."
ACCESS_EXPIRED = "Your YouTube access has expired. Sign out, then sign in with Google again."
QUOTA = "Yourfeed has used up today's YouTube allowance. Try again tomorrow."

# A video's liveBroadcastContent.
Broadcast = Literal["live", "upcoming", "none"]


class YouTubeError(Exception):
    """YouTube couldn't be reached or refused. The message is safe to show."""


class YouTubeAccessExpired(YouTubeError):
    """YouTube refused the user's token: they need to sign in again."""


class YouTubeQuotaExceeded(YouTubeError):
    """The project's daily quota is used up."""


@dataclass(frozen=True)
class Channel:
    id: str
    title: str
    subscribers: int
    uploads_playlist: str | None
    # YouTube's topicCategories: Wikipedia URLs.
    topic_urls: tuple[str, ...]


@dataclass(frozen=True)
class VideoDetails:
    id: str
    title: str
    channel_id: str
    seconds: int
    views: int
    published_at: datetime
    broadcast: Broadcast
    topic_urls: tuple[str, ...]


class YouTubeClient(Protocol):
    def subscriptions(self, access_token: str, limit: int) -> list[str]:
        """The ids of channels the token's user subscribes to, at most `limit`."""
        ...

    def channels(self, ids: Sequence[str]) -> list[Channel]:
        """At most MAX_IDS_PER_CALL ids; unknown ones are left out."""
        ...

    def uploads(self, channel: Channel, limit: int) -> list[str]:
        """The channel's newest upload ids, at most `limit`."""
        ...

    def videos(self, ids: Sequence[str]) -> list[VideoDetails]:
        """At most MAX_IDS_PER_CALL ids; private and deleted ones are left out."""
        ...

    def search(self, topic: str) -> list[str]:
        """Video ids for a topic outside subscriptions: not used yet (#64)."""
        ...

"""Topic searches for a feed's topics outside subscriptions (ADR 0011): cached per topic and shared across users,
refreshed at most every 6 hours, deleted past 30 days, and started only within the site's daily search budget."""

import logging
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import datetime

from pydantic import BaseModel, ValidationError
from sqlalchemy import Engine, update
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, delete, select

from app.catalog import Video
from app.youtube.cache import DELETE_AFTER, REFRESH_AFTER, VIDEOS, CachedVideo, aware
from app.youtube.catalog import as_video, watchable_videos
from app.youtube.client import YouTubeClient, YouTubeError, YouTubeQuotaExceeded
from app.youtube.tables import SearchBudget, TopicSearchCache

log = logging.getLogger("yourfeed.youtube")

# One search.list call brings at most this many videos; their details take one videos.list call.
SEARCH_RESULTS = 25
# So one user can't spend the whole site's day of searches.
SEARCHES_PER_USER_PER_DAY = 20


class TopicVideos(BaseModel):
    """What the topic searches found, each video as the topic that found it. `paused`: some topic waits for tomorrow's budget."""

    videos: list[Video]
    paused: bool


@dataclass(frozen=True)
class CachedSearch:
    fetched_at: datetime
    videos: tuple[CachedVideo, ...]


@dataclass(frozen=True)
class TopicSearchStore:
    engine: Engine

    def cached(self, keys: Sequence[str]) -> dict[str, CachedSearch]:
        """The cached searches of these topic keys, fresh or not; a row that fails validation counts as missing."""
        with Session(self.engine) as db:
            rows = db.exec(select(TopicSearchCache).where(TopicSearchCache.topic.in_(keys))).all()
        found = {}
        for row in rows:
            try:
                found[row.topic] = CachedSearch(aware(row.fetched_at), VIDEOS.validate_json(row.videos))
            except ValidationError:
                log.warning("The cached search for a topic failed validation; searching again")
        return found

    def save(self, key: str, videos: tuple[CachedVideo, ...], now: datetime) -> None:
        with Session(self.engine) as db:
            db.merge(TopicSearchCache(topic=key, fetched_at=now, videos=VIDEOS.dump_json(videos, by_alias=True).decode()))
            try:
                db.commit()
            except IntegrityError:
                # Another request searched this topic at the same moment; its copy is as good.
                log.info("A topic was searched by another request at the same time")

    def delete_expired(self, now: datetime) -> None:
        with Session(self.engine) as db:
            db.exec(delete(TopicSearchCache).where(TopicSearchCache.fetched_at < now - DELETE_AFTER))
            db.commit()

    def spend(self, now: datetime, per_day: int) -> bool:
        """Takes one search from the UTC day's budget; False once `per_day` are spent."""
        day = now.date()
        with Session(self.engine) as db:
            if db.get(SearchBudget, day) is None:
                db.exec(delete(SearchBudget).where(SearchBudget.day < day))
                db.add(SearchBudget(day=day, calls=0))
                try:
                    db.commit()
                except IntegrityError:
                    # Another request started the day's count first.
                    db.rollback()
            taken = db.execute(
                update(SearchBudget)
                .where(SearchBudget.day == day, SearchBudget.calls < per_day)
                .values(calls=SearchBudget.calls + 1)
            )
            db.commit()
            return taken.rowcount == 1

    def refund(self, now: datetime) -> None:
        """Gives back a search YouTube never answered, so a flaky network doesn't use up the day."""
        with Session(self.engine) as db:
            db.execute(
                update(SearchBudget)
                .where(SearchBudget.day == now.date(), SearchBudget.calls > 0)
                .values(calls=SearchBudget.calls - 1)
            )
            db.commit()


@dataclass(frozen=True)
class TopicSearches:
    client: YouTubeClient
    store: TopicSearchStore
    per_day: int
    now: Callable[[], datetime]

    def find(self, topics: Sequence[str], may_search: Callable[[], bool]) -> TopicVideos:
        """Videos for each topic, from the shared cache or a new search. `may_search` asks the user's own allowance."""
        now = self.now()
        self.store.delete_expired(now)
        by_key: dict[str, str] = {}
        for topic in topics:
            by_key.setdefault(topic.casefold(), topic)
        cached = self.store.cached(list(by_key))
        videos: dict[str, Video] = {}
        paused = False
        for key, topic in by_key.items():
            found, waits = self._search(key, topic, cached.get(key), now, may_search)
            paused = paused or waits
            for v in found:
                # Each feed names its topic its own way, and composition matches the name exactly.
                videos.setdefault(v.id, as_video(v, now).model_copy(update={"topic": topic}))
        return TopicVideos(videos=list(videos.values()), paused=paused)

    def _search(
        self, key: str, topic: str, row: CachedSearch | None, now: datetime, may_search: Callable[[], bool]
    ) -> tuple[tuple[CachedVideo, ...], bool]:
        """The topic's videos, and whether it waits for tomorrow; a stale search is shown while it waits."""
        if row and now - row.fetched_at < REFRESH_AFTER:
            return row.videos, False
        stale = row.videos if row else ()
        if not (may_search() and self.store.spend(now, self.per_day)):
            return stale, True
        try:
            ids = self.client.search(topic, SEARCH_RESULTS)
            found = tuple(watchable_videos(self.client, ids)) if ids else ()
        except YouTubeQuotaExceeded:
            log.warning("YouTube refused a topic search: the project's quota is used up")
            return stale, True
        except YouTubeError:
            self.store.refund(now)
            raise
        self.store.save(key, found, now)
        return found, False

"""The shared channel cache (ADR 0011): read if fresh, written after a refresh, and deleted past 30 days."""

import logging
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from pydantic import BaseModel, ConfigDict, TypeAdapter, ValidationError
from pydantic.alias_generators import to_camel
from sqlalchemy import Engine
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, delete, select

from app.youtube.tables import ChannelCache

log = logging.getLogger("yourfeed.youtube")

REFRESH_AFTER = timedelta(hours=6)
DELETE_AFTER = timedelta(days=30)


class CachedVideo(BaseModel):
    """A video as cached: everything the catalog's Video needs except its age, which depends on when it's read."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, frozen=True)

    id: str
    title: str
    channel: str
    channel_subscribers: int
    topic: str
    minutes: int
    views: int
    live: bool
    published_at: datetime


_VIDEOS = TypeAdapter(tuple[CachedVideo, ...])


@dataclass(frozen=True)
class ChannelCacheStore:
    engine: Engine

    def fresh(self, channel_ids: Sequence[str], now: datetime) -> dict[str, tuple[CachedVideo, ...]]:
        """The cached uploads of these channels fetched within REFRESH_AFTER; a row that fails validation counts as missing."""
        if not channel_ids:
            return {}
        with Session(self.engine) as db:
            rows = db.exec(select(ChannelCache).where(ChannelCache.channel_id.in_(channel_ids))).all()
        found = {}
        for row in rows:
            if now - _aware(row.fetched_at) >= REFRESH_AFTER:
                continue
            try:
                found[row.channel_id] = _VIDEOS.validate_json(row.videos)
            except ValidationError:
                log.warning("Channel %s's cached uploads failed validation; fetching them again", row.channel_id)
        return found

    def save(self, uploads: Mapping[str, tuple[CachedVideo, ...]], now: datetime) -> None:
        for channel_id, videos in uploads.items():
            row = ChannelCache(channel_id=channel_id, fetched_at=now, videos=_VIDEOS.dump_json(videos, by_alias=True).decode())
            with Session(self.engine) as db:
                db.merge(row)
                try:
                    db.commit()
                except IntegrityError:
                    # Another request cached this channel at the same moment; its copy is as good.
                    log.info("Channel %s was cached by another request at the same time", channel_id)

    def delete_expired(self, now: datetime) -> None:
        with Session(self.engine) as db:
            db.exec(delete(ChannelCache).where(ChannelCache.fetched_at < now - DELETE_AFTER))
            db.commit()


def _aware(moment: datetime) -> datetime:
    """SQLite hands datetimes back without their zone; they were stored as UTC."""
    return moment if moment.tzinfo else moment.replace(tzinfo=UTC)

"""The shared YouTube caches and the search budget. Alembic migrations in backend/migrations create them; keep the two in step."""

from datetime import date, datetime

from sqlalchemy import DateTime, Text
from sqlmodel import Field, SQLModel


class ChannelCache(SQLModel, table=True):
    """One channel's newest uploads with their details, shared by every user who subscribes (ADR 0011). No per-user data."""

    __tablename__ = "channel_cache"

    channel_id: str = Field(primary_key=True)
    fetched_at: datetime = Field(sa_type=DateTime(timezone=True), index=True)
    # A JSON list of CachedVideo, validated when read.
    videos: str = Field(sa_type=Text)


class TopicSearchCache(SQLModel, table=True):
    """One topic's search results with their details, shared by every user whose feed names it (ADR 0011). No per-user data."""

    __tablename__ = "topic_search_cache"

    # The topic, case-folded: "Chess" and "chess" share one search.
    topic: str = Field(primary_key=True)
    fetched_at: datetime = Field(sa_type=DateTime(timezone=True), index=True)
    # A JSON list of CachedVideo, validated when read.
    videos: str = Field(sa_type=Text)


class SearchBudget(SQLModel, table=True):
    """How many topic searches the site started on a UTC day: search.list allows 100 a day per project."""

    __tablename__ = "search_budget"

    day: date = Field(primary_key=True)
    calls: int = 0

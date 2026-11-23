"""The shared channel cache. Alembic migrations in backend/migrations create it; keep the two in step."""

from datetime import datetime

from sqlalchemy import DateTime, Text
from sqlmodel import Field, SQLModel


class ChannelCache(SQLModel, table=True):
    """One channel's newest uploads with their details, shared by every user who subscribes (ADR 0011). No per-user data."""

    __tablename__ = "channel_cache"

    channel_id: str = Field(primary_key=True)
    fetched_at: datetime = Field(sa_type=DateTime(timezone=True), index=True)
    # A JSON list of CachedVideo, validated when read.
    videos: str = Field(sa_type=Text)

"""The blends table. The Alembic migration 0006_blends creates it; keep the two in step."""

from datetime import datetime

from sqlalchemy import DateTime, Text
from sqlmodel import Field, SQLModel


class BlendRow(SQLModel, table=True):
    """One Blend invite between two users (ADR 0013): pending, then accepted or cancelled. Deleting either account deletes it.

    It holds each person's recipe topics, never anything from their catalog."""

    __tablename__ = "blends"

    id: int | None = Field(default=None, primary_key=True)
    inviter_id: int = Field(foreign_key="users.id", index=True, ondelete="CASCADE")
    invitee_id: int = Field(foreign_key="users.id", index=True, ondelete="CASCADE")
    status: str = Field(index=True)
    # JSON lists of topic names: the inviter's when they invite, the invitee's when they approve.
    inviter_topics: str = Field(sa_type=Text)
    invitee_topics: str = Field(default="[]", sa_type=Text)
    created_at: datetime = Field(sa_type=DateTime(timezone=True), index=True)

"""The inbox table. The Alembic migration 0005_inbox creates it; keep the two in step."""

from datetime import datetime

from sqlalchemy import DateTime, Text
from sqlmodel import Field, SQLModel


class InboxItem(SQLModel, table=True):
    """One feed a user sent to another by username (ADR 0013). Deleting either account deletes it."""

    __tablename__ = "inbox_items"

    id: int | None = Field(default=None, primary_key=True)
    recipient_id: int = Field(foreign_key="users.id", index=True, ondelete="CASCADE")
    sender_id: int = Field(foreign_key="users.id", index=True, ondelete="CASCADE")
    # The share as JSON: a SharedFeed, validated when it was sent and again when read.
    share: str = Field(sa_type=Text)
    sent_at: datetime = Field(sa_type=DateTime(timezone=True), index=True)

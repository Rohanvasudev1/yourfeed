"""The user state table. The Alembic migration 0002_user_state creates it; keep the two in step."""

from datetime import datetime

from sqlalchemy import DateTime, Text
from sqlmodel import Field, SQLModel


class UserState(SQLModel, table=True):
    """One signed-in user's whole app state: the document the frontend saves, as JSON text, and its schema version."""

    __tablename__ = "user_states"

    user_id: int = Field(primary_key=True, foreign_key="users.id", ondelete="CASCADE")
    version: int
    document: str = Field(sa_type=Text)
    updated_at: datetime = Field(sa_type=DateTime(timezone=True))

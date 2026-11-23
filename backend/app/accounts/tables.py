"""The accounts tables. Alembic migrations in backend/migrations create them; keep the two in step."""

from datetime import datetime

from sqlalchemy import DateTime
from sqlmodel import Field, SQLModel

WHEN = DateTime(timezone=True)


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: int | None = Field(default=None, primary_key=True)
    google_subject: str = Field(unique=True, index=True)
    # Fernet-encrypted with TOKEN_ENCRYPTION_KEY; never leaves the server.
    refresh_token: str
    created_at: datetime = Field(sa_type=WHEN)


class LoginSession(SQLModel, table=True):
    """One signed-in browser. Only a keyed hash of the cookie's token is stored."""

    __tablename__ = "sessions"

    token_hash: str = Field(primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True, ondelete="CASCADE")
    csrf_token: str
    created_at: datetime = Field(sa_type=WHEN)
    expires_at: datetime = Field(sa_type=WHEN)

"""Users and their sessions in the database."""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import Engine
from sqlmodel import Session, delete, select

from app.accounts.keys import Keys, new_token
from app.accounts.tables import LoginSession, User

SESSION_DAYS = 30
SESSION_TTL = timedelta(days=SESSION_DAYS)

Now = Callable[[], datetime]


def utc_now() -> datetime:
    return datetime.now(UTC)


@dataclass(frozen=True)
class SignedIn:
    user_id: int
    session_hash: str
    csrf_token: str


@dataclass(frozen=True)
class AccountStore:
    engine: Engine
    keys: Keys
    now: Now = utc_now

    def save_grant(self, subject: str, refresh_token: str | None) -> int | None:
        """Creates or updates the user Google named, returning their id; None when a new user came without a refresh token."""
        with Session(self.engine) as db:
            user = db.exec(select(User).where(User.google_subject == subject)).first()
            if user is None:
                if refresh_token is None:
                    return None
                user = User(google_subject=subject, refresh_token=self.keys.encrypt(refresh_token), created_at=self.now())
            elif refresh_token is not None:
                user.refresh_token = self.keys.encrypt(refresh_token)
            db.add(user)
            db.commit()
            db.refresh(user)
            return user.id

    def start_session(self, user_id: int) -> str:
        """A new session for the user; returns the cookie's token, which is never stored."""
        token = new_token()
        now = self.now()
        with Session(self.engine) as db:
            db.add(LoginSession(token_hash=self.keys.hash_session(token), user_id=user_id, csrf_token=new_token(), created_at=now, expires_at=now + SESSION_TTL))
            db.commit()
        return token

    def find_session(self, token: str | None) -> SignedIn | None:
        if not token:
            return None
        token_hash = self.keys.hash_session(token)
        with Session(self.engine) as db:
            row = db.get(LoginSession, token_hash)
            if row is None:
                return None
            if _aware(row.expires_at) <= self.now():
                db.delete(row)
                db.commit()
                return None
            return SignedIn(user_id=row.user_id, session_hash=row.token_hash, csrf_token=row.csrf_token)

    def end_session(self, session_hash: str) -> None:
        with Session(self.engine) as db:
            db.exec(delete(LoginSession).where(LoginSession.token_hash == session_hash))
            db.commit()

    def delete_user(self, user_id: int) -> str | None:
        """Deletes the user and every row stored for them; returns their refresh token so it can be revoked."""
        with Session(self.engine) as db:
            user = db.get(User, user_id)
            if user is None:
                return None
            refresh_token = self.keys.decrypt(user.refresh_token)
            db.exec(delete(LoginSession).where(LoginSession.user_id == user_id))
            db.delete(user)
            db.commit()
            return refresh_token


def _aware(moment: datetime) -> datetime:
    """SQLite hands datetimes back without their zone; they were stored as UTC."""
    return moment if moment.tzinfo else moment.replace(tzinfo=UTC)

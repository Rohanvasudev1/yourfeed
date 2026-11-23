"""The inbox table behind send and read: who sent what to whom, oldest first."""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import Engine, func
from sqlmodel import Session, select

from app.accounts.store import Now
from app.accounts.tables import User
from app.sharing.share import InboxEntry, SharedFeed
from app.sharing.tables import InboxItem

SEND_WINDOW = timedelta(days=1)


@dataclass(frozen=True)
class InboxStore:
    engine: Engine
    now: Now

    def recipient(self, username: str) -> int | None:
        """The user with `username` (already clean), if anyone has it."""
        with Session(self.engine) as db:
            return db.exec(select(User.id).where(User.username == username)).first()

    def sent_today(self, sender_id: int) -> int:
        since = self.now() - SEND_WINDOW
        with Session(self.engine) as db:
            query = select(func.count()).select_from(InboxItem).where(InboxItem.sender_id == sender_id, InboxItem.sent_at > since)
            return db.exec(query).one()

    def send(self, sender_id: int, recipient_id: int, share: SharedFeed) -> None:
        with Session(self.engine) as db:
            db.add(InboxItem(recipient_id=recipient_id, sender_id=sender_id, share=share.model_dump_json(), sent_at=self.now()))
            db.commit()

    def after(self, recipient_id: int, cursor: int, limit: int) -> list[InboxEntry]:
        """The user's inbox past `cursor` (the id of the last item they have), oldest first, at most `limit`."""
        query = (
            select(InboxItem, User.username)
            .join(User, User.id == InboxItem.sender_id)
            .where(InboxItem.recipient_id == recipient_id, InboxItem.id > cursor)
            .order_by(InboxItem.id)
            .limit(limit)
        )
        with Session(self.engine) as db:
            rows = db.exec(query).all()
        # Only a user with a username can send, so every sender has one.
        return [_entry(item, sender or "") for item, sender in rows]


def _entry(item: InboxItem, sender: str) -> InboxEntry:
    share = SharedFeed.model_validate_json(item.share)
    sent_at = item.sent_at if item.sent_at.tzinfo else item.sent_at.replace(tzinfo=UTC)
    return InboxEntry(**share.model_dump(), id=item.id, from_=sender, sent_at=sent_at)

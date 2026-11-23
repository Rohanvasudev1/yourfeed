"""The blends table behind invite, accept and cancel. Every query names the user, so no one reaches a blend they aren't in."""

import json
from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import Engine, func, or_, update
from sqlmodel import Session, select

from app.accounts.store import Now
from app.accounts.tables import User
from app.blends.blend import BlendView, Status
from app.blends.tables import BlendRow

INVITE_WINDOW = timedelta(days=1)
ACTIVE = (Status.PENDING, Status.ACCEPTED)


@dataclass(frozen=True)
class BlendStore:
    engine: Engine
    now: Now

    def invited_today(self, inviter_id: int) -> int:
        since = self.now() - INVITE_WINDOW
        query = select(func.count()).select_from(BlendRow).where(BlendRow.inviter_id == inviter_id, BlendRow.created_at > since)
        with Session(self.engine) as db:
            return db.exec(query).one()

    def between(self, a: int, b: int) -> bool:
        """Whether the two users have a pending or accepted blend, whoever invited whom."""
        pair = or_(
            (BlendRow.inviter_id == a) & (BlendRow.invitee_id == b),
            (BlendRow.inviter_id == b) & (BlendRow.invitee_id == a),
        )
        with Session(self.engine) as db:
            return db.exec(select(BlendRow.id).where(pair, BlendRow.status.in_(ACTIVE))).first() is not None

    def invite(self, inviter_id: int, invitee_id: int, topics: list[str]) -> int:
        row = BlendRow(
            inviter_id=inviter_id, invitee_id=invitee_id, status=Status.PENDING, inviter_topics=json.dumps(topics), created_at=self.now()
        )
        with Session(self.engine) as db:
            db.add(row)
            db.commit()
            db.refresh(row)
            assert row.id is not None
            return row.id

    def accept(self, invitee_id: int, blend_id: int, topics: list[str]) -> bool:
        """The invited user approves a pending invite with their topics; False when there's no such invite for them."""
        mine = (BlendRow.id == blend_id) & (BlendRow.invitee_id == invitee_id) & (BlendRow.status == Status.PENDING)
        return self._update(mine, status=Status.ACCEPTED, invitee_topics=json.dumps(topics))

    def cancel(self, user_id: int, blend_id: int) -> bool:
        """Either person ends a pending or accepted blend; False when there's no such blend for them."""
        party = or_(BlendRow.inviter_id == user_id, BlendRow.invitee_id == user_id)
        return self._update((BlendRow.id == blend_id) & party & BlendRow.status.in_(ACTIVE), status=Status.CANCELLED)

    def _update(self, where, **values) -> bool:
        """One conditional UPDATE, so an accept and a cancel racing can't both win; True when it changed a row."""
        with Session(self.engine) as db:
            changed = db.exec(update(BlendRow).where(where).values(**values)).rowcount
            db.commit()
            return changed == 1

    def of(self, user_id: int, blend_id: int | None = None) -> list[BlendView]:
        """The user's pending and accepted blends, newest first (or just `blend_id`)."""
        query = select(BlendRow).where(or_(BlendRow.inviter_id == user_id, BlendRow.invitee_id == user_id), BlendRow.status.in_(ACTIVE))
        if blend_id is not None:
            query = query.where(BlendRow.id == blend_id)
        with Session(self.engine) as db:
            rows = db.exec(query.order_by(BlendRow.id.desc())).all()
            others = {u.id: u.username for u in db.exec(select(User).where(User.id.in_(_others(rows, user_id)))).all()}
        # Someone without a username can't be invited, and can't invite: skip rather than show a nameless row.
        return [_view(row, user_id, name) for row in rows if (name := others.get(_other(row, user_id)))]


def _other(row: BlendRow, user_id: int) -> int:
    return row.invitee_id if row.inviter_id == user_id else row.inviter_id


def _others(rows: list[BlendRow], user_id: int) -> set[int]:
    return {_other(row, user_id) for row in rows}


def _view(row: BlendRow, user_id: int, other: str) -> BlendView:
    inviter = row.inviter_id == user_id
    accepted = row.status == Status.ACCEPTED
    # Nothing about either person's taste is shared until the invite is approved.
    theirs = json.loads(row.invitee_topics if inviter else row.inviter_topics) if accepted else []
    assert row.id is not None
    return BlendView(id=row.id, with_=other, role="inviter" if inviter else "invitee", status=row.status, topics=theirs)

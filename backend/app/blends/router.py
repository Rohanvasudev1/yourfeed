"""Real Blend between signed-in users (ADR 0013).

- `GET /api/blends` lists the user's pending and accepted blends, newest first.
- `POST /api/blends` invites a username with the user's recipe topics.
- `POST /api/blends/{id}/accept` approves an invite with the invited user's topics; `POST /api/blends/{id}/cancel` ends one, from either side.
Blends carry recipe topics only: each person's blend applies the mix to their own catalog.
"""

from typing import Annotated

from fastapi import APIRouter, Depends

from app.accounts.guards import Guards
from app.accounts.store import AccountStore, Now, SignedIn
from app.accounts.usernames import clean_username
from app.blends.blend import AcceptRequest, BlendView, Cancelled, InviteRequest
from app.blends.store import BlendStore
from app.envelope import Envelope, fail, ok
from app.sharing.limits import NO_ONE, TOO_MANY_MISSES, DailyLimit

NO_USERNAME = "Choose a username before inviting."
YOURSELF = "That's your own username."
NOT_FOUND = "That blend isn't there any more."
INVITES_PER_DAY = 20
TOO_MANY = f"You've sent {INVITES_PER_DAY} blend invites today. Try again tomorrow."
READS_PER_DAY = 2000
TOO_MANY_READS = "Blend was checked too often today. Try again tomorrow."
CHANGES_PER_DAY = 200
TOO_MANY_CHANGES = "You've changed a lot of blends today. Try again tomorrow."


def _already(username: str) -> str:
    return f"You already have a blend with @{username}."


def blends_router(guards: Guards, accounts: AccountStore, blends: BlendStore, misses: DailyLimit, now: Now) -> APIRouter:
    """`misses` counts usernames that weren't found, shared with Share so guessing has one cap."""
    router = APIRouter(prefix="/api/blends")
    reads, changes = DailyLimit(READS_PER_DAY, now), DailyLimit(CHANGES_PER_DAY, now)

    def one(user_id: int, blend_id: int):
        found = blends.of(user_id, blend_id)
        return ok(found[0]) if found else fail(404, NOT_FOUND)

    def spend(limit: DailyLimit, user_id: int) -> bool:
        """Counts one more for the user today; False once today's are used up."""
        if limit.reached(user_id):
            return False
        limit.count(user_id)
        return True

    @router.get("", response_model=Envelope[list[BlendView]], response_model_by_alias=True)
    def listed(session: Annotated[SignedIn, Depends(guards.reader)]):
        if not spend(reads, session.user_id):
            return fail(429, TOO_MANY_READS)
        return ok(blends.of(session.user_id))

    @router.post("", response_model=Envelope[BlendView], response_model_by_alias=True)
    def invite(request: InviteRequest, session: Annotated[SignedIn, Depends(guards.writer)]):
        me = session.user_id
        if accounts.username_of(me) is None:
            return fail(409, NO_USERNAME)
        if blends.invited_today(me) >= INVITES_PER_DAY:
            return fail(429, TOO_MANY)
        if misses.reached(me):
            return fail(429, TOO_MANY_MISSES)
        username = clean_username(request.to)
        other = accounts.user_with_username(username) if username else None
        if other is None:
            misses.count(me)
            return fail(404, NO_ONE)
        if other == me:
            return fail(422, YOURSELF)
        if blends.between(me, other):
            return fail(409, _already(username))
        return one(me, blends.invite(me, other, request.topics))

    @router.post("/{blend_id}/accept", response_model=Envelope[BlendView], response_model_by_alias=True)
    def accept(blend_id: int, request: AcceptRequest, session: Annotated[SignedIn, Depends(guards.writer)]):
        if not spend(changes, session.user_id):
            return fail(429, TOO_MANY_CHANGES)
        if not blends.accept(session.user_id, blend_id, request.topics):
            return fail(404, NOT_FOUND)
        return one(session.user_id, blend_id)

    @router.post("/{blend_id}/cancel", response_model=Envelope[Cancelled])
    def cancel(blend_id: int, session: Annotated[SignedIn, Depends(guards.writer)]):
        if not spend(changes, session.user_id):
            return fail(429, TOO_MANY_CHANGES)
        if not blends.cancel(session.user_id, blend_id):
            return fail(404, NOT_FOUND)
        return ok(Cancelled(id=blend_id))

    return router

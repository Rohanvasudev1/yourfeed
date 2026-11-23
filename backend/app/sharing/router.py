"""Real share and send between signed-in users (ADR 0013).

- `GET /api/videos?ids=…` looks up videos outside the user's catalog, so share links work across catalogs.
- `POST /api/shares` sends a feed to a username; `GET /api/inbox?after=N` lists what was sent to the user since item N.
The user always comes from the session: no route reads another user's inbox.
"""

import re
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.accounts.guards import Guards
from app.accounts.store import AccountStore, SignedIn
from app.accounts.usernames import clean_username
from app.catalog import Video
from app.envelope import Envelope, fail, ok
from app.sharing.share import VIDEOS_MAX, InboxEntry, SendRequest, Sent
from app.sharing.store import InboxStore
from app.youtube.catalog import YouTubeCatalog

NO_ONE = "No one has that username."
NO_USERNAME = "Choose a username before sending."
BAD_IDS = f"Look up 1–{VIDEOS_MAX} video ids at a time."
SENDS_PER_DAY = 50
TOO_MANY = f"You've sent {SENDS_PER_DAY} feeds today. Try again tomorrow."
INBOX_PAGE = 50

VIDEO_ID = re.compile(r"[A-Za-z0-9_-]{1,100}")


def _ids(ids: str) -> list[str] | None:
    parsed = ids.split(",") if ids else []
    if not 1 <= len(parsed) <= VIDEOS_MAX or not all(VIDEO_ID.fullmatch(i) for i in parsed):
        return None
    return parsed


def sharing_router(guards: Guards, accounts: AccountStore, inbox: InboxStore, youtube: YouTubeCatalog) -> APIRouter:
    router = APIRouter(prefix="/api")

    @router.get("/videos", response_model=Envelope[list[Video]], response_model_by_alias=True)
    def videos(_: Annotated[SignedIn, Depends(guards.reader)], ids: str = ""):
        parsed = _ids(ids)
        if parsed is None:
            return fail(422, BAD_IDS)
        return ok(list(youtube.lookup(parsed)))

    @router.post("/shares", response_model=Envelope[Sent])
    def send(request: SendRequest, session: Annotated[SignedIn, Depends(guards.writer)]):
        if accounts.username_of(session.user_id) is None:
            return fail(409, NO_USERNAME)
        username = clean_username(request.to)
        recipient = inbox.recipient(username) if username else None
        if recipient is None:
            return fail(404, NO_ONE)
        if inbox.sent_today(session.user_id) >= SENDS_PER_DAY:
            return fail(429, TOO_MANY)
        inbox.send(session.user_id, recipient, request.share)
        return ok(Sent(to=username))

    @router.get("/inbox", response_model=Envelope[list[InboxEntry]], response_model_by_alias=True)
    def read(session: Annotated[SignedIn, Depends(guards.reader)], after: Annotated[int, Query(ge=0)] = 0):
        return ok(inbox.after(session.user_id, after, INBOX_PAGE))

    return router

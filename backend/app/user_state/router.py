"""GET/PUT /api/state: the signed-in user's whole app state as one validated, versioned JSON document (ADR 0012).

The user always comes from the session; no route takes a user id, so no one can name another user's state.
"""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Request
from pydantic import ValidationError

from app.accounts.guards import Guards, Refusal
from app.accounts.store import SignedIn
from app.envelope import Envelope, fail, ok
from app.user_state.document import MAX_DOCUMENT_BYTES, StateDocument
from app.user_state.store import StateStore

TOO_LARGE = "Your saved state is too large to keep."
INVALID = "That isn't a Yourfeed state document."
NOT_SET_UP = "Signing in isn't set up on this server, so state stays in the browser."


async def _capped_body(request: Request) -> bytes:
    """The request body, read no further than the cap."""
    chunks: list[bytes] = []
    size = 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > MAX_DOCUMENT_BYTES:
            raise Refusal(413, TOO_LARGE)
        chunks.append(chunk)
    return b"".join(chunks)


async def _document(request: Request) -> StateDocument:
    body = await _capped_body(request)
    try:
        return StateDocument.model_validate_json(body)
    except ValidationError as exc:
        raise Refusal(422, INVALID) from exc


def state_router(guards: Guards, store: StateStore) -> APIRouter:
    router = APIRouter(prefix="/api")

    @router.get("/state", response_model=Envelope[dict[str, Any] | None])
    def load(session: Annotated[SignedIn, Depends(guards.reader)]):
        return ok(store.load(session.user_id))

    @router.put("/state", response_model=Envelope[dict[str, int]])
    def save(session: Annotated[SignedIn, Depends(guards.writer)], doc: Annotated[StateDocument, Depends(_document)]):
        store.save(session.user_id, doc)
        return ok({"version": doc.version})

    return router


def demo_only_state_router() -> APIRouter:
    router = APIRouter(prefix="/api")

    @router.api_route("/state", methods=["GET", "PUT"])
    def not_set_up():
        return fail(404, NOT_SET_UP)

    return router

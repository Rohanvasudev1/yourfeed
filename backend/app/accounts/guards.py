"""Who a request comes from: the session cookie, and on writes that session's CSRF token in X-CSRF-Token."""

import hmac
from collections.abc import Callable
from dataclasses import dataclass
from typing import Annotated

from fastapi import Header, Request

from app.accounts.store import AccountStore, SignedIn

SESSION_COOKIE = "yourfeed_session"
CSRF_HEADER = "X-CSRF-Token"
SIGN_IN_FIRST = "Sign in with Google first."
BAD_CSRF = "This request is missing its security token. Reload and try again."


class Refusal(Exception):
    """A request the API turns down; `install_refusals` answers it in the envelope."""

    def __init__(self, status: int, message: str):
        self.status, self.message = status, message


@dataclass(frozen=True)
class Guards:
    """FastAPI dependencies. `session_of` may find no one; `reader` and `writer` refuse a request without a session."""

    session_of: Callable[[Request], SignedIn | None]
    reader: Callable[..., SignedIn]
    writer: Callable[..., SignedIn]


def session_guards(store: AccountStore) -> Guards:
    def session_of(request: Request) -> SignedIn | None:
        return store.find_session(request.cookies.get(SESSION_COOKIE))

    def reader(request: Request) -> SignedIn:
        session = session_of(request)
        if session is None:
            raise Refusal(401, SIGN_IN_FIRST)
        return session

    def writer(request: Request, csrf: Annotated[str | None, Header(alias=CSRF_HEADER)] = None) -> SignedIn:
        """The signed-in session behind a write, which must carry that session's CSRF token."""
        session = reader(request)
        if not csrf or not hmac.compare_digest(csrf, session.csrf_token):
            raise Refusal(403, BAD_CSRF)
        return session

    return Guards(session_of, reader, writer)

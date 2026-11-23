"""The accounts API (ADR 0012): sign in with Google, who's signed in, sign out and Delete my data.

The session is an httpOnly SameSite=Lax cookie. Every write also needs the session's CSRF token in X-CSRF-Token,
which only `GET /api/auth/me` hands out, to the page itself.
"""

import hmac
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse, Response
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from app.accounts.config import AuthConfig
from app.accounts.google import GoogleError, GoogleOAuth
from app.accounts.guards import SESSION_COOKIE, Guards, Refusal
from app.accounts.keys import LOGIN_TTL_S, new_token, pkce_challenge
from app.accounts.store import SESSION_TTL, AccountStore, SignedIn
from app.envelope import Envelope, fail, ok

log = logging.getLogger("yourfeed.accounts")

LOGIN_COOKIE = "yourfeed_login"
LOGIN_COOKIE_PATH = "/api/auth"
NOT_SET_UP = "Signing in isn't set up on this server."
SIGN_IN_FAILED_PATH = "/?signin=failed"


class _Camel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, frozen=True)


class AccountStatus(_Camel):
    sign_in_available: bool
    signed_in: bool
    csrf_token: str | None


class DeleteResult(_Camel):
    """Whether Google confirmed it revoked Yourfeed's access. The data is deleted either way."""

    revoked: bool


SIGNED_OUT = AccountStatus(sign_in_available=True, signed_in=False, csrf_token=None)
DEMO_ONLY = AccountStatus(sign_in_available=False, signed_in=False, csrf_token=None)


def accounts_router(config: AuthConfig, google: GoogleOAuth, store: AccountStore, guards: Guards) -> APIRouter:
    router = APIRouter(prefix="/api")
    session_of, writer = guards.session_of, guards.writer

    def set_cookie(res: Response, name: str, value: str, *, max_age: int, path: str) -> None:
        res.set_cookie(name, value, max_age=max_age, path=path, httponly=True, samesite="lax", secure=config.secure_cookies)

    def failed() -> RedirectResponse:
        res = RedirectResponse(f"{config.app_url}{SIGN_IN_FAILED_PATH}", status_code=303)
        res.delete_cookie(LOGIN_COOKIE, path=LOGIN_COOKIE_PATH)
        return res

    @router.get("/auth/me", response_model=Envelope[AccountStatus], response_model_by_alias=True)
    def me(request: Request):
        session = session_of(request)
        if session is None:
            return ok(SIGNED_OUT)
        return ok(AccountStatus(sign_in_available=True, signed_in=True, csrf_token=session.csrf_token))

    @router.get("/auth/login")
    def login():
        state, verifier = new_token(), new_token()
        url = google.authorization_url(redirect_uri=config.redirect_uri, state=state, code_challenge=pkce_challenge(verifier))
        res = RedirectResponse(url, status_code=303)
        set_cookie(res, LOGIN_COOKIE, store.keys.sign_login(state, verifier), max_age=LOGIN_TTL_S, path=LOGIN_COOKIE_PATH)
        return res

    @router.get("/auth/callback")
    def callback(request: Request, code: str | None = None, state: str | None = None, error: str | None = None):
        login = store.keys.open_login(request.cookies.get(LOGIN_COOKIE, ""))
        if login is None or state is None or not hmac.compare_digest(state, login.state):
            log.warning("Sign-in callback with a missing or mismatched state")
            return failed()
        if error or not code:
            log.info("Google sign-in didn't finish: %s", error or "no code")
            return failed()
        try:
            grant = google.exchange(code=code, redirect_uri=config.redirect_uri, code_verifier=login.verifier)
        except GoogleError as exc:
            log.warning("Google sign-in failed: %s", exc)
            return failed()
        user_id = store.save_grant(grant.subject, grant.refresh_token)
        if user_id is None:
            log.warning("Google sent no refresh token for a new user")
            return failed()
        res = RedirectResponse(f"{config.app_url}/", status_code=303)
        res.delete_cookie(LOGIN_COOKIE, path=LOGIN_COOKIE_PATH)
        set_cookie(res, SESSION_COOKIE, store.start_session(user_id), max_age=int(SESSION_TTL.total_seconds()), path="/")
        return res

    @router.post("/auth/logout", response_model=Envelope[AccountStatus], response_model_by_alias=True)
    def logout(response: Response, session: Annotated[SignedIn, Depends(writer)]):
        store.end_session(session.session_hash)
        response.delete_cookie(SESSION_COOKIE, path="/")
        return ok(SIGNED_OUT)

    @router.delete("/account", response_model=Envelope[DeleteResult], response_model_by_alias=True)
    def delete_account(response: Response, session: Annotated[SignedIn, Depends(writer)]):
        # Revoke first: if deleting then fails, the token is already dead rather than orphaned.
        revoked = _revoke(google, store.refresh_token_of(session.user_id))
        store.delete_user(session.user_id)
        response.delete_cookie(SESSION_COOKIE, path="/")
        return ok(DeleteResult(revoked=revoked))

    return router


def _revoke(google: GoogleOAuth, refresh_token: str | None) -> bool:
    if refresh_token is None:
        return False
    try:
        google.revoke(refresh_token)
    except GoogleError as exc:
        log.error("Couldn't revoke a Google token before deleting its user: %s", exc)
        return False
    return True


def demo_only_router() -> APIRouter:
    """Without the secrets, the account routes say signing in isn't set up."""
    router = APIRouter(prefix="/api")

    @router.get("/auth/me", response_model=Envelope[AccountStatus], response_model_by_alias=True)
    def me():
        return ok(DEMO_ONLY)

    @router.api_route("/auth/login", methods=["GET"])
    @router.api_route("/auth/callback", methods=["GET"])
    @router.api_route("/auth/logout", methods=["POST"])
    @router.api_route("/account", methods=["DELETE"])
    def not_set_up():
        return fail(404, NOT_SET_UP)

    return router


def install_refusals(app) -> None:
    @app.exception_handler(Refusal)
    async def on_refusal(_: Request, exc: Refusal):
        return fail(exc.status, exc.message)

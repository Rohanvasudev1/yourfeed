import logging
import os
import time
from dataclasses import dataclass

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError

from app.accounts.config import AuthConfig
from app.accounts.google import GoogleOAuth, HttpGoogleOAuth
from app.accounts.guards import session_guards
from app.accounts.keys import Keys
from app.accounts.router import accounts_router, demo_only_router, install_refusals
from app.accounts.store import AccountStore, Now, utc_now
from app.assistant.limits import AiLimits, Clock, LimitConfig
from app.assistant.model import Assistant, Model
from app.assistant.provider import MODEL_TIMEOUT_S, ModelConfig, OpenAICompatibleModel
from app.assistant.router import assistant_router
from app.assistant.rules import KeywordRules
from app.assistant.selector import AssistantSelector
from app.catalog import SignInRequired, Source, Video, load_catalog
from app.db import make_engine, migrate
from app.envelope import Envelope, fail, ok
from app.user_state.router import demo_only_state_router, state_router
from app.user_state.store import StateStore

log = logging.getLogger("yourfeed")


@dataclass(frozen=True)
class AuthSetup:
    """Signed-in mode: its settings and Google's OAuth endpoints (a fake in tests)."""

    config: AuthConfig
    google: GoogleOAuth
    now: Now = utc_now


def _describe(exc: RequestValidationError) -> str:
    return "; ".join(f"{'.'.join(str(p) for p in e['loc'][1:])}: {e['msg']}" for e in exc.errors())


def create_app(
    assistant: Model | Assistant | None = None,
    *,
    limits: LimitConfig = LimitConfig(),
    timeout: float = MODEL_TIMEOUT_S,
    clock: Clock = time.time,
    auth: AuthSetup | None = None,
) -> FastAPI:
    """Builds the API. `assistant` is the model that answers Claude bar requests within the AI limits; without one, the keyword rules answer.
    Without `auth` the app is demo-only and the account routes say signing in isn't set up."""
    app = FastAPI(title="Yourfeed API")
    install_refusals(app)

    @app.exception_handler(RequestValidationError)
    async def on_invalid(_: Request, exc: RequestValidationError):
        return fail(422, _describe(exc))

    @app.exception_handler(SignInRequired)
    async def on_sign_in_required(_: Request, exc: SignInRequired):
        return fail(401, str(exc))

    @app.get("/api/health", response_model=Envelope[dict[str, str]])
    def health():
        return ok({"status": "ok"})

    @app.get("/api/catalog", response_model=Envelope[list[Video]], response_model_by_alias=True)
    def catalog(source: Source = Source.DEMO):
        return ok(list(load_catalog(source)))

    # The keyword rules may be passed as the assistant too: then no model is set up.
    model = assistant if assistant is not None and assistant.answered_by == "model" else None
    selector = AssistantSelector(model, KeywordRules(), AiLimits(limits, clock), timeout)
    app.include_router(assistant_router(selector))
    for router in _signed_in_routers(app, auth):
        app.include_router(router)
    return app


def _signed_in_routers(app: FastAPI, auth: AuthSetup | None):
    """The account and state routes; without `auth`, their demo-only stand-ins."""
    if auth is None:
        return [demo_only_router(), demo_only_state_router()]
    engine = make_engine(auth.config.database_url)
    migrate(engine)
    app.state.engine = engine
    store = AccountStore(engine, Keys(auth.config.session_secret, auth.config.token_encryption_key), auth.now)
    guards = session_guards(store)
    return [accounts_router(auth.config, auth.google, store, guards), state_router(guards, StateStore(engine, auth.now))]


def create_app_from_env() -> FastAPI:
    """The app as deployed: the model from AI_BASE_URL, AI_API_KEY and AI_MODEL, if any, and the AI limits from their variables."""
    config = ModelConfig.from_env(os.environ)
    model = OpenAICompatibleModel(config) if config else None
    if model:
        log.info("Claude bar answers by %s via %s", model.model_name, model.provider)
    config = AuthConfig.from_env(os.environ)
    auth = AuthSetup(config, HttpGoogleOAuth(config.google_client_id, config.google_client_secret)) if config else None
    log.info("Sign in with Google is %s", "on" if auth else "not set up: demo only")
    return create_app(model, limits=LimitConfig.from_env(os.environ), auth=auth)


app = create_app_from_env()

import logging
import os
import time

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError

from app.assistant.limits import AiLimits, Clock, LimitConfig
from app.assistant.model import Assistant, Model
from app.assistant.provider import MODEL_TIMEOUT_S, ModelConfig, OpenAICompatibleModel
from app.assistant.router import assistant_router
from app.assistant.rules import KeywordRules
from app.assistant.selector import AssistantSelector
from app.catalog import SignInRequired, Source, Video, load_catalog
from app.envelope import Envelope, fail, ok

log = logging.getLogger("yourfeed")


def _describe(exc: RequestValidationError) -> str:
    return "; ".join(f"{'.'.join(str(p) for p in e['loc'][1:])}: {e['msg']}" for e in exc.errors())


def create_app(
    assistant: Model | Assistant | None = None,
    *,
    limits: LimitConfig = LimitConfig(),
    timeout: float = MODEL_TIMEOUT_S,
    clock: Clock = time.time,
) -> FastAPI:
    """Builds the API. `assistant` is the model that answers Claude bar requests within the AI limits; without one, the keyword rules answer."""
    app = FastAPI(title="Yourfeed API")

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
    return app


def create_app_from_env() -> FastAPI:
    """The app as deployed: the model from AI_BASE_URL, AI_API_KEY and AI_MODEL, if any, and the AI limits from their variables."""
    config = ModelConfig.from_env(os.environ)
    model = OpenAICompatibleModel(config) if config else None
    if model:
        log.info("Claude bar answers by %s via %s", model.model_name, model.provider)
    return create_app(model, limits=LimitConfig.from_env(os.environ))


app = create_app_from_env()

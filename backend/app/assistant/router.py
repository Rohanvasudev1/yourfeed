"""The Claude bar's API: one request in, checked feed actions out, and which assistant is answering."""

from fastapi import APIRouter, Request
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from app.assistant.actions import FeedAction, check_actions
from app.assistant.model import AnsweredBy, AssistantRequest
from app.assistant.selector import AssistantSelector
from app.catalog import catalog_topics
from app.envelope import Envelope, ok

NOTHING_DONE = "I couldn't do that here. Try naming a topic, a video length or how long you have."
UNKNOWN_VISITOR = "unknown"


class _Camel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, frozen=True)


class AssistantResult(_Camel):
    actions: list[FeedAction]
    reply: str | None = None
    answered_by: AnsweredBy
    notice: str | None = None


class AssistantInfoBody(_Camel):
    """Which assistant answers, for the account menu and the provider notice. Never a key or a URL."""

    answered_by: AnsweredBy
    provider: str | None
    model: str | None


def assistant_router(selector: AssistantSelector) -> APIRouter:
    router = APIRouter(prefix="/api/assistant")

    @router.post("/request", response_model=Envelope[AssistantResult], response_model_by_alias=True)
    def handle_request(body: AssistantRequest, http: Request):
        visitor = http.client.host if http.client else UNKNOWN_VISITOR
        proposal, answered_by, notice = selector.handle(body.text, body.mode, body.context, visitor)
        actions = check_actions(proposal.actions, body.mode, body.context, catalog_topics())
        reply = proposal.reply if proposal.reply or actions else NOTHING_DONE
        return ok(AssistantResult(actions=actions, reply=reply, answered_by=answered_by, notice=notice))

    @router.get("/info", response_model=Envelope[AssistantInfoBody], response_model_by_alias=True)
    def info():
        answered_by, provider, model = selector.info()
        return ok(AssistantInfoBody(answered_by=answered_by, provider=provider, model=model))

    return router

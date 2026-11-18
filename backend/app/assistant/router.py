"""The Claude bar's API: one request in, checked feed actions out."""

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from app.assistant.actions import FeedAction, check_actions
from app.assistant.model import AnsweredBy, Assistant, AssistantRequest
from app.catalog import Source, load_catalog
from app.envelope import Envelope, ok

NOTHING_DONE = "I couldn't do that here. Try naming a topic, a video length or how long you have."


class AssistantResult(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, frozen=True)

    actions: list[FeedAction]
    reply: str | None = None
    answered_by: AnsweredBy
    notice: str | None = None


def catalog_topics() -> frozenset[str]:
    return frozenset(v.topic for v in load_catalog(Source.DEMO))


def assistant_router(assistant: Assistant) -> APIRouter:
    router = APIRouter(prefix="/api/assistant")

    @router.post("/request", response_model=Envelope[AssistantResult], response_model_by_alias=True)
    def handle_request(body: AssistantRequest):
        proposal = assistant.handle(body.text, body.mode, body.context)
        actions = check_actions(proposal.actions, body.mode, body.context, catalog_topics())
        reply = proposal.reply if proposal.reply or actions else NOTHING_DONE
        return ok(AssistantResult(actions=actions, reply=reply, answered_by=assistant.answered_by))

    return router

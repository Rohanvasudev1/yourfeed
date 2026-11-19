"""The assistant's API: Claude bar requests in, checked feed actions out; note questions in, short answers out; and which assistant answers."""

import re
from functools import cache

from fastapi import APIRouter, Request
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from app.assistant.actions import FeedAction, check_actions
from app.assistant.model import AnsweredBy, AnswerRequest, AssistantRequest
from app.assistant.selector import AssistantSelector
from app.catalog import Source, Video, catalog_topics, load_catalog
from app.envelope import Envelope, fail, ok

NOTHING_DONE = "I couldn't do that here. Try naming a topic, a video length or how long you have."
UNKNOWN_VIDEO = "That video isn't in the catalog."
UNKNOWN_VISITOR = "unknown"
LINE_BREAKS = re.compile(r"\s*\n\s*")


class _Camel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, frozen=True)


class AssistantResult(_Camel):
    actions: list[FeedAction]
    reply: str | None = None
    answered_by: AnsweredBy
    notice: str | None = None


class AnswerResult(_Camel):
    answer: str
    answered_by: AnsweredBy


class AssistantInfoBody(_Camel):
    """Which assistant answers, for the account menu and the provider notice. Never a key or a URL."""

    answered_by: AnsweredBy
    provider: str | None
    model: str | None


@cache
def catalog_by_id() -> dict[str, Video]:
    return {v.id: v for v in load_catalog(Source.DEMO)}


def _visitor(http: Request) -> str:
    return http.client.host if http.client else UNKNOWN_VISITOR


def assistant_router(selector: AssistantSelector) -> APIRouter:
    router = APIRouter(prefix="/api/assistant")

    @router.post("/request", response_model=Envelope[AssistantResult], response_model_by_alias=True)
    def handle_request(body: AssistantRequest, http: Request):
        proposal, answered_by, notice = selector.handle(body.text, body.mode, body.context, _visitor(http))
        actions = check_actions(proposal.actions, body.mode, body.context, catalog_topics())
        reply = proposal.reply if proposal.reply or actions else NOTHING_DONE
        return ok(AssistantResult(actions=actions, reply=reply, answered_by=answered_by, notice=notice))

    @router.post("/answer", response_model=Envelope[AnswerResult], response_model_by_alias=True)
    def answer_question(body: AnswerRequest, http: Request):
        video = catalog_by_id().get(body.video_id)
        if video is None:
            return fail(404, UNKNOWN_VIDEO)
        text, answered_by = selector.answer(body.question, video, _visitor(http))
        # An answer fills one ✱ line in the notes, so it never spans lines.
        return ok(AnswerResult(answer=LINE_BREAKS.sub(" ", text.strip()), answered_by=answered_by))

    @router.get("/info", response_model=Envelope[AssistantInfoBody], response_model_by_alias=True)
    def info():
        answered_by, provider, model = selector.info()
        return ok(AssistantInfoBody(answered_by=answered_by, provider=provider, model=model))

    return router

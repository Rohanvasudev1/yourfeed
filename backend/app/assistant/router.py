"""The assistant's API: Claude bar requests in, checked feed actions out; note questions in, short answers out."""

import re
from functools import cache

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from app.assistant.actions import FeedAction, check_actions
from app.assistant.model import AnsweredBy, AnswerRequest, Assistant, AssistantRequest
from app.catalog import Source, Video, load_catalog
from app.envelope import Envelope, fail, ok

NOTHING_DONE = "I couldn't do that here. Try naming a topic, a video length or how long you have."
UNKNOWN_VIDEO = "That video isn't in the catalog."
LINE_BREAKS = re.compile(r"\s*\n\s*")


class AssistantResult(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, frozen=True)

    actions: list[FeedAction]
    reply: str | None = None
    answered_by: AnsweredBy
    notice: str | None = None


class AnswerResult(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, frozen=True)

    answer: str
    answered_by: AnsweredBy


@cache
def catalog_by_id() -> dict[str, Video]:
    return {v.id: v for v in load_catalog(Source.DEMO)}


@cache
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

    @router.post("/answer", response_model=Envelope[AnswerResult], response_model_by_alias=True)
    def answer_question(body: AnswerRequest):
        video = catalog_by_id().get(body.video_id)
        if video is None:
            return fail(404, UNKNOWN_VIDEO)
        # An answer fills one ✱ line in the notes, so it never spans lines.
        answer = LINE_BREAKS.sub(" ", assistant.answer(body.question, video).strip())
        return ok(AnswerResult(answer=answer, answered_by=assistant.answered_by))

    return router

"""What the Claude bar sends, what an assistant answers, and the interface every assistant implements (ADR 0006)."""

from typing import Annotated, Literal, Protocol

from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from pydantic.alias_generators import to_camel

from app.catalog import Video

MAX_REQUEST_CHARS = 300
MAX_UP_NEXT = 20
MAX_EXPLORE = 8

BarMode = Literal["edit", "new"]
AnsweredBy = Literal["model", "rules"]
FeedKind = Literal["home", "subs", "top", "news", "claude", "blend", "shared", "topics"]

RequestText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_REQUEST_CHARS)]
MIN_QUESTION_CHARS = 3
QuestionText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=MIN_QUESTION_CHARS, max_length=MAX_REQUEST_CHARS)]
Minutes = tuple[int, int]


class _Frozen(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, frozen=True)


class ContextVideo(_Frozen):
    id: str
    title: str
    topic: str
    channel: str


class FeedContext(_Frozen):
    """The current feed as the frontend sees it: the only feed a request may change (ADR 0007)."""

    kind: FeedKind
    name: str
    topics: tuple[str, ...]
    channels: tuple[str, ...]
    muted: tuple[str, ...]
    length: Minutes
    session: Minutes
    pinned: tuple[str, ...]
    up_next: tuple[ContextVideo, ...] = Field(max_length=MAX_UP_NEXT)
    explore: tuple[ContextVideo, ...] = Field(default=(), max_length=MAX_EXPLORE)
    """Videos from topics the feed doesn't have, one per topic, for a question card to offer."""

    def first_video(self) -> ContextVideo | None:
        """The video at the top of Up next: the first pinned one, else the first composed one."""
        by_id = {v.id: v for v in self.up_next}
        pinned = [by_id[i] for i in self.pinned if i in by_id]
        return (pinned or list(self.up_next) or [None])[0]


class AssistantRequest(_Frozen):
    text: RequestText
    mode: BarMode
    context: FeedContext


class AnswerRequest(_Frozen):
    """A question from a video's notes (Ask in notes). The backend looks the video up itself."""

    video_id: str
    question: QuestionText


class Proposal(_Frozen):
    """What an assistant wants to do, before the backend checks it: raw actions, as a model would return them."""

    actions: tuple[dict, ...] = ()
    reply: str | None = None


class Assistant(Protocol):
    """Turns one Claude bar request into proposed feed actions and an optional reply, and answers questions in notes."""

    answered_by: AnsweredBy

    def handle(self, text: str, mode: BarMode, context: FeedContext) -> Proposal: ...

    def answer(self, question: str, video: Video) -> str:
        """At most two sentences about the video, from its catalog entry only, saying what it can't know."""
        ...


class Model(Assistant, Protocol):
    """An assistant backed by a real model, named for the account menu (never with its key or URL)."""

    model_name: str
    provider: str

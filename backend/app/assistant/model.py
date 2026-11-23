"""What the Claude bar sends, what an assistant answers, and the interface every assistant implements (ADR 0006)."""

from typing import Annotated, Literal, Protocol

from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from pydantic.alias_generators import to_camel

from app.catalog import Video

MAX_REQUEST_CHARS = 300
MAX_UP_NEXT = 15
MAX_FOLLOW_UPS = 3
MAX_SUMMARY_CHARS = 120
MAX_EXPLORE = 8
MAX_REASON_CHARS = 200

BarMode = Literal["edit", "new"]
AnsweredBy = Literal["model", "rules"]
FeedKind = Literal["home", "subs", "top", "news", "claude", "blend", "shared", "topics"]

RequestText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_REQUEST_CHARS)]
MIN_QUESTION_CHARS = 3
QuestionText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=MIN_QUESTION_CHARS, max_length=MAX_REQUEST_CHARS)]
ReasonText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_REASON_CHARS)]
SummaryText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_SUMMARY_CHARS)]
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
    first_reason: ReasonText | None = None
    """Why the top of Up next is there, in the words its card shows (ADR 0010), so the answer and the card agree."""

    def first_video(self) -> ContextVideo | None:
        """The video at the top of Up next: the first pinned one, else the first composed one."""
        by_id = {v.id: v for v in self.up_next}
        pinned = [by_id[i] for i in self.pinned if i in by_id]
        return (pinned or list(self.up_next) or [None])[0]

    def why_first(self) -> str:
        """One sentence on why the top of Up next is first, from facts the frontend sent, for the rules and the model alike."""
        top = self.first_video()
        if top is None:
            return "Up next is empty, so nothing is first yet."
        if self.first_reason:
            return f'"{top.title}" is first. {self.first_reason}.'
        if top.id in self.pinned:
            return f'"{top.title}" is first because you added it yourself.'
        reasons = {
            "home": f"is first because you've been watching {top.topic}.",
            "subs": f"is the newest upload from {top.channel}.",
            "top": "has the most views in this range.",
        }
        return f'"{top.title}" {reasons.get(self.kind, f"matches {top.topic} in this feed.")}'


class FollowUp(_Frozen):
    """One live line of the feed's recipe log: an earlier request and what it changed (ADR 0009)."""

    request: RequestText
    summary: SummaryText


FollowUps = tuple[FollowUp, ...]


class AssistantRequest(_Frozen):
    text: RequestText
    mode: BarMode
    context: FeedContext
    follow_ups: FollowUps = Field(default=(), max_length=MAX_FOLLOW_UPS)
    """The last live recipe log lines of the current feed, oldest first. Only a model reads them; the rules ignore them."""


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
    """An assistant backed by a real model, named for the account menu (never with its key or URL). It also reads follow-ups."""

    model_name: str
    provider: str

    def handle(self, text: str, mode: BarMode, context: FeedContext, follow_ups: FollowUps = ()) -> Proposal: ...

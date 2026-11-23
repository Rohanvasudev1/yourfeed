"""A scripted assistant for tests: answers every request and every question the same way, records what it was asked, and can fail or hang on cue."""

import threading

from app.assistant.model import AnsweredBy, BarMode, FeedContext, FollowUps, Proposal
from app.catalog import Video


class ScriptedAssistant:
    answered_by: AnsweredBy = "model"

    def __init__(
        self,
        actions: list[dict] | None = None,
        reply: str | None = None,
        answer: str = "A scripted answer.",
        *,
        error: Exception | None = None,
        hang_until: threading.Event | None = None,
        model_name: str = "scripted",
        provider: str = "tests",
    ) -> None:
        self._proposal = Proposal(actions=tuple(actions or ()), reply=reply)
        self._answer = answer
        self._error = error
        self._hang_until = hang_until
        self.model_name = model_name
        self.provider = provider
        self.calls: list[tuple[str, BarMode, FeedContext]] = []
        self.follow_ups: list[FollowUps] = []
        self.questions: list[tuple[str, Video]] = []

    def _cue(self) -> None:
        if self._hang_until is not None:
            self._hang_until.wait()
        if self._error is not None:
            raise self._error

    def handle(self, text: str, mode: BarMode, context: FeedContext, follow_ups: FollowUps = ()) -> Proposal:
        self.calls.append((text, mode, context))
        self.follow_ups.append(follow_ups)
        self._cue()
        return self._proposal

    def answer(self, question: str, video: Video) -> str:
        self.questions.append((question, video))
        self._cue()
        return self._answer

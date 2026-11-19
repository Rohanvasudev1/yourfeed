"""A scripted assistant for tests: answers every request the same way, records what it was asked, and can fail or hang on cue."""

import threading

from app.assistant.model import AnsweredBy, BarMode, FeedContext, Proposal


class ScriptedAssistant:
    answered_by: AnsweredBy = "model"

    def __init__(
        self,
        actions: list[dict] | None = None,
        reply: str | None = None,
        *,
        error: Exception | None = None,
        hang_until: threading.Event | None = None,
        model_name: str = "scripted",
        provider: str = "tests",
    ) -> None:
        self._proposal = Proposal(actions=tuple(actions or ()), reply=reply)
        self._error = error
        self._hang_until = hang_until
        self.model_name = model_name
        self.provider = provider
        self.calls: list[tuple[str, BarMode, FeedContext]] = []

    def handle(self, text: str, mode: BarMode, context: FeedContext) -> Proposal:
        self.calls.append((text, mode, context))
        if self._hang_until is not None:
            self._hang_until.wait()
        if self._error is not None:
            raise self._error
        return self._proposal

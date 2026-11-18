"""A scripted assistant for tests: answers every request the same way and records what it was asked."""

from app.assistant.model import AnsweredBy, BarMode, FeedContext, Proposal


class ScriptedAssistant:
    answered_by: AnsweredBy = "model"

    def __init__(self, actions: list[dict] | None = None, reply: str | None = None) -> None:
        self._proposal = Proposal(actions=tuple(actions or ()), reply=reply)
        self.calls: list[tuple[str, BarMode, FeedContext]] = []

    def handle(self, text: str, mode: BarMode, context: FeedContext) -> Proposal:
        self.calls.append((text, mode, context))
        return self._proposal

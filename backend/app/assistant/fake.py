"""A scripted assistant for tests: answers every request and every question the same way and records what it was asked."""

from app.assistant.model import AnsweredBy, BarMode, FeedContext, Proposal
from app.catalog import Video


class ScriptedAssistant:
    answered_by: AnsweredBy = "model"

    def __init__(self, actions: list[dict] | None = None, reply: str | None = None, answer: str = "A scripted answer.") -> None:
        self._proposal = Proposal(actions=tuple(actions or ()), reply=reply)
        self._answer = answer
        self.calls: list[tuple[str, BarMode, FeedContext]] = []
        self.questions: list[tuple[str, Video]] = []

    def handle(self, text: str, mode: BarMode, context: FeedContext) -> Proposal:
        self.calls.append((text, mode, context))
        return self._proposal

    def answer(self, question: str, video: Video) -> str:
        self.questions.append((question, video))
        return self._answer

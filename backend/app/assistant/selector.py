"""Picks who answers: the model when one is set up and allowed, else the keyword rules, so the demo never breaks (ADR 0006)."""

import logging
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout
from typing import NamedTuple, TypeVar

from app.assistant.limits import AiLimits
from app.assistant.model import AnsweredBy, Assistant, BarMode, FeedContext, Model, Proposal
from app.catalog import Video

log = logging.getLogger("yourfeed")

BUSY_NOTICE = "Using simple rules for now. AI is busy."
MODEL_WORKERS = 4

T = TypeVar("T")


class Answer(NamedTuple):
    proposal: Proposal
    answered_by: AnsweredBy
    notice: str | None = None


class NoteAnswer(NamedTuple):
    text: str
    answered_by: AnsweredBy


class AssistantInfo(NamedTuple):
    answered_by: AnsweredBy
    provider: str | None
    model: str | None


class AssistantSelector:
    def __init__(self, model: Model | None, rules: Assistant, limits: AiLimits, timeout: float) -> None:
        self._model = model
        self._rules = rules
        self._limits = limits
        self._timeout = timeout
        self._pool = ThreadPoolExecutor(max_workers=MODEL_WORKERS, thread_name_prefix="model") if model else None

    def info(self) -> AssistantInfo:
        if self._model is None:
            return AssistantInfo("rules", None, None)
        return AssistantInfo("model", self._model.provider, self._model.model_name)

    def _try_model(self, call: Callable[[Model], T], visitor: str) -> tuple[T | None, bool]:
        """The model's result, or None when the rules must answer; the flag says a set-up model couldn't (a limit, an error or a timeout)."""
        model, pool = self._model, self._pool
        if model is None or pool is None:
            return None, False
        if not self._limits.take(visitor):
            log.info("AI limit reached for a visitor or the site; the rules answer")
            return None, True
        future = pool.submit(call, model)
        try:
            return future.result(timeout=self._timeout), False
        except FutureTimeout:
            log.warning("%s took over %ss; the rules answer", model.provider, self._timeout)
        except Exception as exc:
            # The type only: httpx messages carry the request URL, which may hold credentials.
            log.warning("%s failed (%s); the rules answer", model.provider, type(exc).__name__)
        return None, True

    def handle(self, text: str, mode: BarMode, context: FeedContext, visitor: str) -> Answer:
        proposal, busy = self._try_model(lambda m: m.handle(text, mode, context), visitor)
        if proposal is not None:
            return Answer(proposal, "model")
        return Answer(self._rules.handle(text, mode, context), self._rules.answered_by, BUSY_NOTICE if busy else None)

    def answer(self, question: str, video: Video, visitor: str) -> NoteAnswer:
        text, _ = self._try_model(lambda m: m.answer(question, video), visitor)
        if text and text.strip():
            return NoteAnswer(text, "model")
        return NoteAnswer(self._rules.answer(question, video), self._rules.answered_by)

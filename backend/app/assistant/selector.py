"""Picks who answers a request: the model when one is set up and allowed, else the keyword rules, so the demo never breaks (ADR 0006)."""

import logging
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout
from typing import NamedTuple

from app.assistant.limits import AiLimits
from app.assistant.model import AnsweredBy, Assistant, BarMode, FeedContext, Model, Proposal

log = logging.getLogger("yourfeed")

BUSY_NOTICE = "Using simple rules for now. AI is busy."
MODEL_WORKERS = 4


class Answer(NamedTuple):
    proposal: Proposal
    answered_by: AnsweredBy
    notice: str | None = None


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

    def _rules_answer(self, text: str, mode: BarMode, context: FeedContext, notice: str | None) -> Answer:
        return Answer(self._rules.handle(text, mode, context), self._rules.answered_by, notice)

    def handle(self, text: str, mode: BarMode, context: FeedContext, visitor: str) -> Answer:
        if self._model is None or self._pool is None:
            return self._rules_answer(text, mode, context, None)
        if not self._limits.take(visitor):
            log.info("AI limit reached for a visitor or the site; the rules answer")
            return self._rules_answer(text, mode, context, BUSY_NOTICE)
        future = self._pool.submit(self._model.handle, text, mode, context)
        try:
            return Answer(future.result(timeout=self._timeout), self._model.answered_by)
        except FutureTimeout:
            log.warning("%s took over %ss; the rules answer", self._model.provider, self._timeout)
        except Exception:
            log.exception("%s failed; the rules answer", self._model.provider)
        return self._rules_answer(text, mode, context, BUSY_NOTICE)

"""Feed actions: the only changes an assistant can make, and the checks every one passes before it reaches the browser (ADR 0007)."""

import logging
from typing import Annotated, Literal, NamedTuple

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, ValidationError

from app.assistant.model import BarMode, FeedContext

log = logging.getLogger("yourfeed")


class Limits(NamedTuple):
    """The lowest and highest minutes a range allows, and one slider step (frontend/src/domain/range.ts)."""

    lowest: int
    highest: int
    step: int


LENGTH_LIMITS = Limits(lowest=1, highest=120, step=1)
SESSION_LIMITS = Limits(lowest=10, highest=240, step=10)


class _Action(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")


class SetTopics(_Action):
    type: Literal["set_topics"]
    add: tuple[str, ...] = ()
    remove: tuple[str, ...] = ()


class MuteTopic(_Action):
    type: Literal["mute_topic"]
    topic: str


class SetLengthRange(_Action):
    type: Literal["set_length_range"]
    min: int
    max: int


class SetSessionRange(_Action):
    type: Literal["set_session_range"]
    min: int
    max: int


class PinVideo(_Action):
    type: Literal["pin_video"]
    id: str


class AskUser(_Action):
    type: Literal["ask_user"]
    kind: Literal["chips", "videos", "feedback"]
    question: str = Field(min_length=1, max_length=200)
    items: tuple[str, ...] = Field(min_length=1, max_length=8)


class CreateFeed(_Action):
    type: Literal["create_feed"]
    name: str | None = Field(default=None, max_length=40)


FeedAction = Annotated[
    SetTopics | MuteTopic | SetLengthRange | SetSessionRange | PinVideo | AskUser | CreateFeed,
    Field(discriminator="type"),
]
_parse = TypeAdapter(FeedAction).validate_python


def _clamp(limits: Limits, a: int, b: int) -> tuple[int, int]:
    """Clamps to the limits, swaps a reversed range and keeps an empty one a step wide, as typing a range by hand does."""
    lowest, highest, step = limits
    lo, hi = sorted(max(lowest, min(highest, n)) for n in (a, b))
    if lo < hi:
        return lo, hi
    return (lo, hi + step) if hi + step <= highest else (lo - step, hi)


def _checked(action: FeedAction, mode: BarMode, context: FeedContext, topics: frozenset[str]) -> FeedAction | None:
    """The action as it may be applied (ranges clamped), or None when it breaks a rule."""
    shown = {v.id for v in (*context.up_next, *context.explore)}
    match action:
        case SetTopics(add=add, remove=remove):
            return action if (add or remove) and set(add) | set(remove) <= topics else None
        case MuteTopic(topic=topic):
            return action if topic in topics else None
        case SetLengthRange(min=lo, max=hi):
            lo, hi = _clamp(LENGTH_LIMITS, lo, hi)
            return action.model_copy(update={"min": lo, "max": hi})
        case SetSessionRange(min=lo, max=hi):
            lo, hi = _clamp(SESSION_LIMITS, lo, hi)
            return action.model_copy(update={"min": lo, "max": hi})
        case PinVideo(id=video):
            return action if video in shown else None
        case AskUser(kind="chips" | "feedback", items=items):
            return action if set(items) <= topics else None
        case AskUser(kind="videos", items=items):
            return action if set(items) <= shown else None
        case CreateFeed():
            return action if mode == "new" else None


def check_actions(raw: tuple[dict, ...], mode: BarMode, context: FeedContext, topics: frozenset[str]) -> list[FeedAction]:
    """Keeps the actions that parse and pass their checks; logs and drops the rest."""
    kept: list[FeedAction] = []
    for item in raw:
        try:
            action = _checked(_parse(item), mode, context, topics)
        except ValidationError as exc:
            log.warning("Dropped assistant action %r: %s", item, exc.errors(include_url=False))
            continue
        if action is None:
            log.warning("Dropped assistant action %r: breaks a feed action rule", item)
        else:
            kept.append(action)
    return kept

"""Video catalog: the videos a source offers one user. Composition happens in the frontend (ADR 0003)."""

import json
from enum import StrEnum
from functools import cache
from pathlib import Path

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

DEMO_CATALOG_PATH = Path(__file__).parent / "data" / "demo_catalog.json"


class Source(StrEnum):
    DEMO = "demo"
    YOUTUBE = "youtube"


class Video(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, frozen=True)

    id: str
    title: str
    honest_title: str
    channel: str
    channel_subscribers: int
    topic: str
    minutes: int
    views: int
    age_hours: int
    clickbait: bool
    live: bool
    news_category: str | None


class SignInRequired(Exception):
    """The source needs a signed-in user."""


@cache
def demo_catalog() -> tuple[Video, ...]:
    raw = json.loads(DEMO_CATALOG_PATH.read_text(encoding="utf-8"))
    return tuple(Video.model_validate(item) for item in raw)


def load_catalog(source: Source) -> tuple[Video, ...]:
    if source is Source.DEMO:
        return demo_catalog()
    raise SignInRequired("Sign in with Google to load your YouTube catalog.")


@cache
def catalog_topics() -> frozenset[str]:
    """Every topic the demo catalog's videos have: the only topics an assistant may add or mute."""
    return frozenset(v.topic for v in demo_catalog())

"""`GET /api/catalog/topics?topic=…`: videos for a feed's topics outside the user's subscriptions (ADR 0011).

The frontend asks for the topics its feeds name that have few videos in the catalog, and adds what comes back.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.accounts.guards import Guards
from app.accounts.store import Now, SignedIn
from app.catalog import SIGN_IN_FOR_CATALOG, SignInRequired
from app.envelope import Envelope, fail, ok
from app.sharing.limits import DailyLimit
from app.youtube.topic_search import (
    SEARCHES_PER_USER_PER_DAY,
    TopicSearches,
    TopicVideos,
)

TOPICS_MAX = 5
TOPIC_MAX_CHARS = 40
BAD_TOPICS = f"Search 1–{TOPICS_MAX} topics of at most {TOPIC_MAX_CHARS} characters."
# Cached answers cost no quota, but each request still reads the database.
REQUESTS_PER_DAY = 500
TOO_MANY_REQUESTS = "Topics were searched too often today. Try again tomorrow."
PATH = "/api/catalog/topics"


def _topics(raw: list[str]) -> list[str] | None:
    topics = [t.strip() for t in raw]
    if not 1 <= len(topics) <= TOPICS_MAX or not all(0 < len(t) <= TOPIC_MAX_CHARS for t in topics):
        return None
    return topics


def topic_search_router(guards: Guards, searches: TopicSearches, now: Now) -> APIRouter:
    router = APIRouter()
    requests, own_searches = DailyLimit(REQUESTS_PER_DAY, now), DailyLimit(SEARCHES_PER_USER_PER_DAY, now)

    @router.get(PATH, response_model=Envelope[TopicVideos], response_model_by_alias=True)
    def topic_videos(session: Annotated[SignedIn, Depends(guards.reader)], topic: Annotated[list[str] | None, Query()] = None):
        topics = _topics(topic or [])
        if topics is None:
            return fail(422, BAD_TOPICS)
        if not requests.take(session.user_id):
            return fail(429, TOO_MANY_REQUESTS)
        return ok(searches.find(topics, lambda: own_searches.take(session.user_id)))

    return router


def demo_topic_search_router() -> APIRouter:
    """Demo mode has no topic searches: the demo catalog is fixed."""
    router = APIRouter()

    @router.get(PATH)
    def topic_videos():
        raise SignInRequired(SIGN_IN_FOR_CATALOG)

    return router

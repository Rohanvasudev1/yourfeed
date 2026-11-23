"""The frontend's channel topic picker offers exactly the topics the catalog maps YouTube's categories to (ADR 0011)."""

import json
from pathlib import Path

from app.youtube.topics import READABLE_TOPICS

FRONTEND_LIST = Path(__file__).resolve().parents[2] / "frontend" / "src" / "domain" / "youtubeTopics.json"


def test_frontend_topic_list_matches_the_catalogs_topics():
    listed = json.loads(FRONTEND_LIST.read_text())
    assert len(listed) == len(set(listed))
    assert set(listed) == READABLE_TOPICS

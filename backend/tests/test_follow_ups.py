"""Follow-ups (ADR 0009): the last live recipe log lines a request carries, checked by the API, shown to the model and ignored by the rules."""

import json

import httpx
import pytest
from fastapi.testclient import TestClient

from app.assistant.fake import ScriptedAssistant
from app.assistant.provider import OpenAICompatibleModel
from app.catalog import Source, load_catalog
from app.main import create_app
from tests.assistant_helpers import request
from tests.test_model_provider import GROQ, FakeProvider

SHORTER = {"request": "shorter videos", "summary": "videos 1–15 min"}
COOKING = {"request": "add cooking", "summary": "added Cooking"}


def with_follow_ups(text: str, follow_ups: list[dict], **context_changes) -> dict:
    return {**request(text, **context_changes), "followUps": follow_ups}


def scripted() -> tuple[TestClient, ScriptedAssistant]:
    fake = ScriptedAssistant(reply="OK.")
    return TestClient(create_app(assistant=fake)), fake


def test_the_model_sees_the_follow_ups_oldest_first():
    client, fake = scripted()
    res = client.post("/api/assistant/request", json=with_follow_ups("no, shorter", [COOKING, SHORTER]))
    assert res.status_code == 200
    assert [(f.request, f.summary) for f in fake.follow_ups[-1]] == [("add cooking", "added Cooking"), ("shorter videos", "videos 1–15 min")]


def test_a_request_without_follow_ups_still_works():
    client, fake = scripted()
    assert client.post("/api/assistant/request", json=request("add cooking")).status_code == 200
    assert fake.follow_ups == [()]


@pytest.mark.parametrize(
    "follow_ups",
    [
        [COOKING, SHORTER, COOKING, SHORTER],
        [{"request": "x" * 301, "summary": "added Cooking"}],
        [{"request": "add cooking", "summary": "x" * 121}],
        [{"request": "", "summary": "added Cooking"}],
        [{"request": "add cooking"}],
    ],
)
def test_too_many_or_over_long_follow_ups_are_rejected(follow_ups):
    client, fake = scripted()
    res = client.post("/api/assistant/request", json=with_follow_ups("no, shorter", follow_ups))
    assert res.status_code == 422
    assert res.json()["success"] is False
    assert fake.calls == []


def test_the_rules_ignore_follow_ups():
    client = TestClient(create_app(assistant=None))
    alone = client.post("/api/assistant/request", json=request("add travel")).json()["data"]
    followed = client.post("/api/assistant/request", json=with_follow_ups("add travel", [COOKING, SHORTER])).json()["data"]
    assert followed == alone
    assert followed["actions"] == [{"type": "set_topics", "add": ["Travel"], "remove": []}]


def test_more_than_15_up_next_videos_are_rejected():
    client, _ = scripted()
    up_next = [{"id": f"demo-{i}", "title": "t", "topic": "AI", "channel": "c"} for i in range(16)]
    assert client.post("/api/assistant/request", json=request("add cooking", upNext=up_next)).status_code == 422
    assert client.post("/api/assistant/request", json=request("add cooking", upNext=up_next[:15])).status_code == 200


def test_the_provider_gets_the_follow_ups_in_the_users_message():
    provider = FakeProvider()
    client = TestClient(create_app(assistant=OpenAICompatibleModel(GROQ, http=httpx.Client(transport=httpx.MockTransport(provider)))))
    client.post("/api/assistant/request", json=with_follow_ups("no, shorter", [SHORTER]))
    user = json.loads(provider.requests[-1].content)["messages"][1]["content"]
    assert "shorter videos" in user and "videos 1–15 min" in user
    assert user.rstrip().endswith("Request: no, shorter")


def test_an_edit_request_with_15_videos_and_3_follow_ups_stays_near_1500_tokens():
    """Groq's free tier allows 8,000 tokens a minute; about 4 characters make a token, so ~1,500 tokens is ~6,000 characters."""
    provider = FakeProvider()
    client = TestClient(create_app(assistant=OpenAICompatibleModel(GROQ, http=httpx.Client(transport=httpx.MockTransport(provider)))))
    up_next = [{"id": v.id, "title": v.title, "topic": v.topic, "channel": v.channel} for v in load_catalog(Source.DEMO)[:15]]
    follow_ups = [
        {"request": "add some cooking videos for weeknights, nothing too fancy", "summary": "added Cooking"},
        {"request": "and keep them under fifteen minutes please", "summary": "videos 1–15 min"},
        {"request": "I only have about forty minutes tonight", "summary": "sessions 30–40 min"},
    ]
    client.post("/api/assistant/request", json=with_follow_ups("no, shorter", follow_ups, upNext=up_next))
    size = len(provider.requests[0].content)
    assert size < 6_000, size

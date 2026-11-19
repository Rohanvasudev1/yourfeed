"""The keyword rules, ported from the mockup's `agent` and `addFlow`, tested through the request endpoint."""

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from tests.assistant_helpers import request

client = TestClient(create_app())


def ask(text: str, **context_changes) -> dict:
    res = client.post("/api/assistant/request", json=request(text, **context_changes))
    assert res.status_code == 200, res.text
    body = res.json()["data"]
    assert body["answeredBy"] == "rules"
    return body


@pytest.mark.parametrize(
    ("text", "actions"),
    [
        ("add cooking", [{"type": "set_topics", "add": ["Cooking"], "remove": []}]),
        ("I want recipes and travel", [{"type": "set_topics", "add": ["Cooking", "Travel"], "remove": []}]),
        ("Some MCP please", [{"type": "set_topics", "add": ["MCP"], "remove": []}]),
        ("less economics", [{"type": "set_topics", "add": [], "remove": ["Economics"]}]),
        ("no more coding", [{"type": "set_topics", "add": [], "remove": ["Programming"]}]),
        ("no wrestling", [{"type": "mute_topic", "topic": "Wrestling"}]),
        ("hide the news", [{"type": "mute_topic", "topic": "News"}]),
        ("shorter videos", [{"type": "set_length_range", "min": 1, "max": 15}]),
        ("only quick ones", [{"type": "set_length_range", "min": 1, "max": 15}]),
        ("longer videos", [{"type": "set_length_range", "min": 20, "max": 120}]),
        ("some deep dives", [{"type": "set_length_range", "min": 20, "max": 120}]),
        ("I've got an hour", [{"type": "set_session_range", "min": 50, "max": 60}]),
        ("I have 2 hours", [{"type": "set_session_range", "min": 110, "max": 120}]),
        ("only 30 minutes today", [{"type": "set_session_range", "min": 20, "max": 30}]),
        ("half an hour", [{"type": "set_session_range", "min": 20, "max": 30}]),
        ("put the MCP one first", [{"type": "pin_video", "id": "demo-22"}]),
        ("put the graphs video first", [{"type": "pin_video", "id": "demo-1"}]),
        ("shorter videos first", [{"type": "set_length_range", "min": 1, "max": 15}]),
        ("add cooking to the top", [{"type": "set_topics", "add": ["Cooking"], "remove": []}]),
        ("add cooking to this tab", [{"type": "set_topics", "add": ["Cooking"], "remove": []}]),
        ("videos under 10 minutes about travel", [{"type": "set_topics", "add": ["Travel"], "remove": []}]),
    ],
)
def test_requests_become_feed_actions(text, actions):
    body = ask(text)
    assert body["actions"] == actions
    assert body.get("reply") is None


@pytest.mark.parametrize(
    ("text", "reply"),
    [
        ("add AI", "Already in this feed."),
        ("why is this first?", '"Build an AI agent with tool use, step by step" matches AI in this feed.'),
        ("turn on honest titles", "I can change this feed's topics, video length and session time. Filters, tabs and saved videos are yours to change."),
        ("delete this tab", "I can change this feed's topics, video length and session time. Filters, tabs and saved videos are yours to change."),
        ("save the first one", "I can change this feed's topics, video length and session time. Filters, tabs and saved videos are yours to change."),
        ("something to learn", "What do you want to learn about? Try naming one, like MCP or Product design."),
        ("asdfgh", "I couldn't match that to a topic. Try one like Cooking, Travel or Tennis."),
        ("put the knitting one first", "I couldn't match that to a topic. Try one like Cooking, Travel or Tennis."),
    ],
)
def test_requests_that_only_get_a_reply(text, reply):
    body = ask(text)
    assert body["actions"] == []
    assert body["reply"] == reply


def test_why_names_a_pinned_video_as_added_by_hand():
    body = ask("why is this first", pinned=["demo-22"])
    assert body["reply"] == '"Build an MCP server in 20 minutes" is first because you added it yourself.'


@pytest.mark.parametrize(
    ("kind", "reply"),
    [
        ("home", '"Build an AI agent with tool use, step by step" is first because you\'ve been watching AI.'),
        ("subs", '"Build an AI agent with tool use, step by step" is the newest upload from Agent Workshop.'),
        ("top", '"Build an AI agent with tool use, step by step" has the most views in this range.'),
    ],
)
def test_why_explains_built_in_feeds(kind, reply):
    assert ask("why is this first?", kind=kind)["reply"] == reply


def test_why_with_nothing_in_up_next_says_so():
    assert ask("why is this first?", upNext=[])["reply"] == "Up next is empty, so nothing is first yet."


@pytest.mark.parametrize("kind", ["home", "subs", "top", "news"])
def test_built_in_feeds_cannot_be_edited(kind):
    body = ask("add cooking", kind=kind)
    assert body["actions"] == []
    assert body["reply"] == "This tab builds itself, so I can't change it. Try one of your own feeds."


def test_from_claude_once_connected_is_edited_like_your_own_feeds():
    """The frontend sends From Claude in edit mode only once it's connected."""
    body = ask("add cooking", kind="claude", topics=["MCP", "AI"])
    assert body["actions"] == [{"type": "set_topics", "add": ["Cooking"], "remove": []}]


def test_new_mode_is_not_supported_yet():
    res = client.post("/api/assistant/request", json=request("add cooking", mode="new"))
    body = res.json()["data"]
    assert body["actions"] == []
    assert body["reply"] == "This tab builds itself, so I can't change it. Try one of your own feeds."


def test_less_of_a_topic_already_hidden_is_a_no_op():
    body = ask("no wrestling", muted=["Wrestling"])
    assert body["actions"] == []
    assert body["reply"] == "Already in this feed."

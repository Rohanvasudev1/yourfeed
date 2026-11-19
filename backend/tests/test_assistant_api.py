"""The Claude bar endpoint's contract, with a scripted assistant standing in for any model."""

import logging

import pytest
from fastapi.testclient import TestClient

from app.assistant.fake import ScriptedAssistant
from app.main import create_app
from tests.assistant_helpers import request


def client_answering(*actions: dict, reply: str | None = None) -> tuple[TestClient, ScriptedAssistant]:
    fake = ScriptedAssistant(actions=list(actions), reply=reply)
    return TestClient(create_app(assistant=fake)), fake


def post(client: TestClient, body: dict):
    return client.post("/api/assistant/request", json=body)


def test_returns_the_assistants_actions_and_reply_in_the_envelope():
    client, _ = client_answering({"type": "set_topics", "add": ["Cooking"], "remove": ["AI"]}, reply="Done.")
    res = post(client, request("add cooking"))
    assert res.status_code == 200
    assert res.json() == {
        "success": True,
        "data": {
            "actions": [{"type": "set_topics", "add": ["Cooking"], "remove": ["AI"]}],
            "reply": "Done.",
            "answeredBy": "model",
            "notice": None,
        },
        "error": None,
    }


def test_the_assistant_sees_the_request_mode_and_context():
    client, fake = client_answering()
    post(client, request("  add cooking  ", topics=["AI"]))
    [(text, mode, context)] = fake.calls
    assert text == "add cooking"
    assert mode == "edit"
    assert context.topics == ("AI",)
    assert [v.id for v in context.up_next] == ["demo-0", "demo-1", "demo-22"]


@pytest.mark.parametrize(
    "bad",
    [
        {"type": "set_topics", "add": ["Knitting"], "remove": []},
        {"type": "set_topics", "add": [], "remove": ["Knitting"]},
        {"type": "mute_topic", "topic": "Knitting"},
        {"type": "pin_video", "id": "demo-30"},
        {"type": "pin_video", "id": "no-such-video"},
        {"type": "ask_user", "kind": "chips", "question": "Which?", "items": ["Knitting"]},
        {"type": "ask_user", "kind": "videos", "question": "Which?", "items": ["demo-30"]},
        {"type": "create_feed", "name": "Cooking"},
        {"type": "set_topics", "add": [], "remove": []},
        {"type": "turn_on_filter", "filter": "honestTitles"},
        {"type": "set_length_range", "min": "short", "max": 10},
    ],
)
def test_invalid_actions_are_dropped_and_logged(bad, caplog):
    client, _ = client_answering(bad, {"type": "mute_topic", "topic": "News"})
    with caplog.at_level(logging.WARNING, logger="yourfeed"):
        body = post(client, request("anything")).json()["data"]
    assert body["actions"] == [{"type": "mute_topic", "topic": "News"}]
    assert "Dropped assistant action" in caplog.text


def test_valid_question_cards_pass_through():
    chips = {"type": "ask_user", "kind": "chips", "question": "Which sports?", "items": ["Tennis", "Cricket"]}
    videos = {"type": "ask_user", "kind": "videos", "question": "Pick some", "items": ["demo-0", "demo-22"]}
    client, _ = client_answering(chips, videos)
    assert post(client, request("sport")).json()["data"]["actions"] == [chips, videos]


def test_question_card_videos_may_come_from_the_explore_videos_but_nowhere_else():
    explore = [{"id": "demo-9", "title": "Derby day", "topic": "Premier League", "channel": "Match Room"}]
    shown = {"type": "ask_user", "kind": "videos", "question": "Pick some", "items": ["demo-9", "demo-0"]}
    unseen = {"type": "ask_user", "kind": "videos", "question": "Pick some", "items": ["demo-77"]}
    client, _ = client_answering(shown, unseen)
    assert post(client, request("anything", explore=explore)).json()["data"]["actions"] == [shown]


def test_feedback_cards_may_only_name_catalog_topics():
    good = {"type": "ask_user", "kind": "feedback", "question": "Look right?", "items": ["Tennis"]}
    bad = {"type": "ask_user", "kind": "feedback", "question": "Look right?", "items": ["Knitting"]}
    client, _ = client_answering(good, bad)
    assert post(client, request("anything")).json()["data"]["actions"] == [good]


def test_create_feed_is_kept_in_new_mode():
    client, _ = client_answering({"type": "create_feed", "name": "Cooking"})
    body = post(client, request("cooking", mode="new")).json()["data"]
    assert body["actions"] == [{"type": "create_feed", "name": "Cooking"}]


@pytest.mark.parametrize(
    ("sent", "kept"),
    [
        ({"type": "set_length_range", "min": 0, "max": 500}, {"type": "set_length_range", "min": 1, "max": 120}),
        ({"type": "set_length_range", "min": 40, "max": 10}, {"type": "set_length_range", "min": 10, "max": 40}),
        ({"type": "set_length_range", "min": 120, "max": 120}, {"type": "set_length_range", "min": 119, "max": 120}),
        ({"type": "set_session_range", "min": 5, "max": 999}, {"type": "set_session_range", "min": 10, "max": 240}),
        ({"type": "set_session_range", "min": 60, "max": 60}, {"type": "set_session_range", "min": 60, "max": 70}),
    ],
)
def test_ranges_are_clamped_as_by_hand(sent, kept):
    client, _ = client_answering(sent)
    assert post(client, request("anything")).json()["data"]["actions"] == [kept]


def test_a_request_whose_every_action_was_dropped_gets_a_reply():
    client, _ = client_answering({"type": "mute_topic", "topic": "Knitting"})
    body = post(client, request("hide knitting")).json()["data"]
    assert body["actions"] == []
    assert body["reply"] == "I couldn't do that here. Try naming a topic, a video length or how long you have."


@pytest.mark.parametrize("text", ["", "   ", "x" * 301])
def test_empty_or_too_long_requests_are_rejected(text):
    client, fake = client_answering()
    res = post(client, request(text))
    assert res.status_code == 422
    assert res.json()["success"] is False
    assert "text" in res.json()["error"]
    assert fake.calls == []


def test_a_300_character_request_is_accepted():
    client, _ = client_answering()
    assert post(client, request("x" * 300)).status_code == 200


def test_unknown_mode_is_rejected():
    client, _ = client_answering()
    assert post(client, request("add cooking", mode="chat")).status_code == 422


def test_more_than_20_up_next_videos_are_rejected():
    client, _ = client_answering()
    up_next = [{"id": f"demo-{i}", "title": "t", "topic": "AI", "channel": "c"} for i in range(21)]
    assert post(client, request("add cooking", upNext=up_next)).status_code == 422

"""The OpenAI-compatible model, through the API, with a fake provider standing in for Groq or Ollama. No test calls a real model."""

import json

import httpx
import pytest
from fastapi.testclient import TestClient

from app.assistant.provider import ModelConfig, OpenAICompatibleModel
from app.main import create_app
from tests.assistant_helpers import request

KEY = "gsk_test_not_a_real_key"
GROQ = ModelConfig(base_url="https://api.groq.com/openai/v1", api_key=KEY, model="openai/gpt-oss-20b")
OLLAMA = ModelConfig(base_url="http://localhost:11434/v1", api_key=None, model="qwen3:4b")
BUSY = "Using simple rules for now. AI is busy."


def tool_call(name: str, arguments: dict | str) -> dict:
    args = arguments if isinstance(arguments, str) else json.dumps(arguments)
    return {"id": f"call_{name}", "type": "function", "function": {"name": name, "arguments": args}}


def completion(content: str | None = None, *calls: dict) -> dict:
    message = {"role": "assistant", "content": content, **({"tool_calls": list(calls)} if calls else {})}
    return {"choices": [{"index": 0, "message": message, "finish_reason": "tool_calls" if calls else "stop"}]}


class FakeProvider:
    """Answers every chat completion with `answer` and keeps each request it got."""

    def __init__(self, answer: dict | None = None, status: int = 200) -> None:
        self.answer = answer if answer is not None else completion("OK.")
        self.status = status
        self.requests: list[httpx.Request] = []

    def __call__(self, req: httpx.Request) -> httpx.Response:
        self.requests.append(req)
        return httpx.Response(self.status, json=self.answer)

    def sent(self) -> dict:
        return json.loads(self.requests[-1].content)


def app_with(provider: FakeProvider, config: ModelConfig = GROQ) -> TestClient:
    http = httpx.Client(transport=httpx.MockTransport(provider))
    return TestClient(create_app(assistant=OpenAICompatibleModel(config, http=http)))


def ask(client: TestClient, text: str = "add cooking", mode: str = "edit") -> dict:
    res = client.post("/api/assistant/request", json=request(text, mode=mode))
    assert res.status_code == 200, res.text
    assert KEY not in res.text
    return res.json()["data"]


def tool(sent: dict, name: str) -> dict:
    return next(t["function"] for t in sent["tools"] if t["function"]["name"] == name)


def test_tool_calls_become_checked_feed_actions_and_the_text_a_reply():
    provider = FakeProvider(
        completion(
            "Added cooking and kept it short.",
            tool_call("set_topics", {"add": ["Cooking"], "remove": []}),
            tool_call("set_length_range", {"min": 1, "max": 15}),
        )
    )
    body = ask(app_with(provider))
    assert body == {
        "actions": [{"type": "set_topics", "add": ["Cooking"], "remove": []}, {"type": "set_length_range", "min": 1, "max": 15}],
        "reply": "Added cooking and kept it short.",
        "answeredBy": "model",
        "notice": None,
    }


def test_the_provider_gets_the_model_the_key_and_the_request_with_its_feed():
    provider = FakeProvider()
    ask(app_with(provider), "more tennis please")
    req = provider.requests[0]
    assert str(req.url) == "https://api.groq.com/openai/v1/chat/completions"
    assert req.headers["authorization"] == f"Bearer {KEY}"
    sent = provider.sent()
    assert sent["model"] == "openai/gpt-oss-20b"
    said = json.dumps(sent["messages"])
    assert "more tennis please" in said
    assert "Learn" in said and "demo-22" in said


def edit_fields(sent: dict) -> dict:
    return tool(sent, "edit_feed")["parameters"]["properties"]


def test_tools_offer_only_catalog_topics_and_the_videos_shown():
    provider = FakeProvider()
    ask(app_with(provider))
    sent = provider.sent()
    assert [t["function"]["name"] for t in sent["tools"]] == ["edit_feed", "ask_user"]
    fields = edit_fields(sent)
    assert "Cooking" in fields["add"]["items"]["enum"] and "Knitting" not in fields["add"]["items"]["enum"]
    assert fields["pin"]["enum"] == ["demo-0", "demo-1", "demo-22"]
    assert "name" not in fields


def test_every_change_in_a_request_comes_from_one_edit_feed_call():
    """gpt-oss-20b on Groq makes one tool call per answer, so one call carries every part of a request."""
    edit = {"add": ["Travel"], "remove": ["Careers"], "mute": ["News"], "length": {"min": 1, "max": 15}, "session": {"min": 50, "max": 60}, "pin": "demo-22"}
    provider = FakeProvider(completion("Done.", tool_call("edit_feed", edit)))
    assert ask(app_with(provider), "add travel and keep videos under 15 minutes")["actions"] == [
        {"type": "set_topics", "add": ["Travel"], "remove": ["Careers"]},
        {"type": "mute_topic", "topic": "News"},
        {"type": "set_length_range", "min": 1, "max": 15},
        {"type": "set_session_range", "min": 50, "max": 60},
        {"type": "pin_video", "id": "demo-22"},
    ]


@pytest.mark.parametrize("edit", [{}, {"length": {"min": 5}}, {"length": 15}, {"add": "Travel"}, {"pin": "demo-99"}])
def test_an_edit_feed_call_with_nothing_usable_changes_nothing(edit):
    provider = FakeProvider(completion("Done.", tool_call("edit_feed", edit)))
    assert ask(app_with(provider))["actions"] == []


def test_new_mode_names_the_feed_and_cant_remove_or_pin():
    provider = FakeProvider(completion(None, tool_call("edit_feed", {"name": "Cooking", "add": ["Cooking"], "length": {"min": 1, "max": 10}})))
    body = ask(app_with(provider), "a quick cooking feed", mode="new")
    assert body["actions"] == [
        {"type": "create_feed", "name": "Cooking"},
        {"type": "set_topics", "add": ["Cooking"], "remove": []},
        {"type": "set_length_range", "min": 1, "max": 10},
    ]
    fields = edit_fields(provider.sent())
    assert "name" in fields and "remove" not in fields and "pin" not in fields


def test_ollama_needs_no_key():
    provider = FakeProvider()
    ask(app_with(provider, OLLAMA))
    assert str(provider.requests[0].url) == "http://localhost:11434/v1/chat/completions"
    assert "authorization" not in provider.requests[0].headers
    assert provider.sent()["model"] == "qwen3:4b"


def test_tool_calls_with_broken_arguments_are_dropped():
    provider = FakeProvider(completion(None, tool_call("set_topics", "{not json"), tool_call("mute_topic", {"topic": "News"})))
    assert ask(app_with(provider))["actions"] == [{"type": "mute_topic", "topic": "News"}]


@pytest.mark.parametrize("status", [400, 401, 429, 500, 503])
def test_a_provider_error_falls_back_to_the_rules(status):
    body = ask(app_with(FakeProvider({"error": {"message": f"bad things {KEY}"}}, status=status)))
    assert body["answeredBy"] == "rules"
    assert body["actions"] == [{"type": "set_topics", "add": ["Cooking"], "remove": []}]
    assert body["notice"] == BUSY


@pytest.mark.parametrize("answer", [{}, {"choices": []}, {"choices": [{"message": "nope"}]}])
def test_an_answer_that_isnt_a_chat_completion_falls_back_to_the_rules(answer):
    assert ask(app_with(FakeProvider(answer)))["answeredBy"] == "rules"


def test_a_provider_that_cant_be_reached_falls_back_to_the_rules():
    def unreachable(req: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused", request=req)

    http = httpx.Client(transport=httpx.MockTransport(unreachable))
    client = TestClient(create_app(assistant=OpenAICompatibleModel(GROQ, http=http)))
    assert ask(client)["answeredBy"] == "rules"


def test_info_names_the_model_and_provider_but_never_the_key_or_base_url():
    res = app_with(FakeProvider()).get("/api/assistant/info")
    assert res.json()["data"] == {"answeredBy": "model", "provider": "Groq", "model": "gpt-oss-20b"}
    assert KEY not in res.text and "api.groq.com" not in res.text


def test_info_names_ollama():
    res = app_with(FakeProvider(), OLLAMA).get("/api/assistant/info")
    assert res.json()["data"] == {"answeredBy": "model", "provider": "Ollama", "model": "qwen3:4b"}


def test_info_names_another_provider_by_its_host_without_credentials_or_path():
    config = ModelConfig(base_url="https://user:secret@llm.example.com:8443/api/v1?token=abc", api_key=KEY, model="meta/llama-3.3")
    res = app_with(FakeProvider(), config).get("/api/assistant/info")
    assert res.json()["data"] == {"answeredBy": "model", "provider": "llm.example.com", "model": "llama-3.3"}
    assert "secret" not in res.text and "abc" not in res.text


@pytest.mark.parametrize(
    ("env", "expected"),
    [
        ({}, None),
        ({"AI_API_KEY": "  "}, None),
        ({"AI_API_KEY": KEY}, GROQ),
        ({"AI_API_KEY": KEY, "AI_MODEL": "llama-3.1-8b-instant"}, ModelConfig(GROQ.base_url, KEY, "llama-3.1-8b-instant")),
        ({"AI_BASE_URL": "http://localhost:11434/v1/", "AI_MODEL": "qwen3:4b"}, OLLAMA),
    ],
)
def test_the_model_is_set_up_by_three_environment_variables(env, expected):
    assert ModelConfig.from_env(env) == expected


def test_an_answer_that_isnt_json_falls_back_to_the_rules():
    def html(req: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text="<html>gateway</html>")

    http = httpx.Client(transport=httpx.MockTransport(html))
    client = TestClient(create_app(assistant=OpenAICompatibleModel(GROQ, http=http)))
    assert ask(client)["answeredBy"] == "rules"


def ask_note(client: TestClient, question: str = "Is this for beginners?") -> dict:
    res = client.post("/api/assistant/answer", json={"videoId": "demo-0", "question": question})
    assert res.status_code == 200, res.text
    assert KEY not in res.text
    return res.json()["data"]


def test_note_questions_are_answered_by_the_model_from_the_videos_details():
    provider = FakeProvider(completion("It walks through it step by step.\nNo transcript, though."))
    body = ask_note(app_with(provider))
    assert body == {"answer": "It walks through it step by step. No transcript, though.", "answeredBy": "model"}
    sent = provider.sent()
    said = json.dumps(sent["messages"])
    assert "Is this for beginners?" in said and "Build an AI agent with tool use" in said
    assert "tools" not in sent


@pytest.mark.parametrize("answer", [completion(None), {"choices": []}])
def test_an_empty_or_broken_note_answer_falls_back_to_the_rules(answer):
    assert ask_note(app_with(FakeProvider(answer)))["answeredBy"] == "rules"


def test_a_provider_error_on_a_note_question_falls_back_to_the_rules():
    assert ask_note(app_with(FakeProvider({}, status=500)))["answeredBy"] == "rules"


def test_question_cards_offer_catalog_topics_and_the_videos_sent():
    explore = [{"id": "demo-30", "title": "Knife skills", "topic": "Cooking", "channel": "Pen and Pocket"}]
    chips = {"type": "ask_user", "kind": "videos", "question": "Pick some", "items": ["demo-30"]}
    provider = FakeProvider(completion(None, tool_call("ask_user", {k: v for k, v in chips.items() if k != "type"})))
    client = app_with(provider)
    res = client.post("/api/assistant/request", json=request("something fun", explore=explore))
    assert res.json()["data"]["actions"] == [chips]
    items = tool(provider.sent(), "ask_user")["parameters"]["properties"]["items"]["items"]["enum"]
    assert "demo-30" in items and "Cooking" in items and "demo-22" in items


def feed_sent(sent: dict) -> dict:
    """The feed JSON in the user message the provider got."""
    user = sent["messages"][1]["content"]
    return json.loads(user.split("Feed: ", 1)[1].split("\nRequest: ", 1)[0])


def test_the_feed_sent_says_why_the_first_video_is_first_so_the_model_never_guesses():
    provider = FakeProvider()
    client = app_with(provider)
    client.post("/api/assistant/request", json=request("why is this first?"))
    assert feed_sent(provider.sent())["whyFirst"] == '"Build an AI agent with tool use, step by step" matches AI in this feed.'
    client.post("/api/assistant/request", json=request("why is this first?", pinned=["demo-22"]))
    assert feed_sent(provider.sent())["whyFirst"] == '"Build an MCP server in 20 minutes" is first because you added it yourself.'


def test_the_feed_sent_with_nothing_up_next_says_nothing_is_first():
    provider = FakeProvider()
    app_with(provider).post("/api/assistant/request", json=request("why is this first?", upNext=[]))
    assert feed_sent(provider.sent())["whyFirst"] == "Up next is empty, so nothing is first yet."


def test_topics_can_only_be_removed_if_the_feed_has_them():
    provider = FakeProvider()
    ask(app_with(provider))
    assert edit_fields(provider.sent())["remove"]["items"]["enum"] == ["AI", "Careers", "Economics", "Programming"]


def test_a_request_stays_small_enough_for_groqs_free_minute():
    """Each request counts against 8,000 tokens a minute on Groq's free tier; about 4 characters make a token."""
    provider = FakeProvider()
    ask(app_with(provider), "a feed for tennis", mode="new")
    assert len(provider.requests[0].content) < 3_600


@pytest.mark.parametrize(
    ("text", "edit", "expected"),
    [
        ("a feed for tennis", {"name": "Tennis"}, [{"type": "create_feed", "name": "Tennis"}, {"type": "set_topics", "add": ["Tennis"], "remove": []}]),
        (
            "something for live music and cricket",
            {"name": "Weekend"},
            [{"type": "create_feed", "name": "Weekend"}, {"type": "set_topics", "add": ["Cricket", "Live music"], "remove": []}],
        ),
        (
            "a feed for tennis",
            {"name": "Tennis", "add": ["Cricket"]},
            [{"type": "create_feed", "name": "Tennis"}, {"type": "set_topics", "add": ["Cricket"], "remove": []}],
        ),
        ("a feed for knitting", {"name": "Knitting"}, [{"type": "create_feed", "name": "Knitting"}]),
        ("a feed for tennis", {}, [{"type": "create_feed", "name": None}, {"type": "set_topics", "add": ["Tennis"], "remove": []}]),
    ],
)
def test_a_new_feed_without_topics_gets_the_catalog_topics_its_request_names(text, edit, expected):
    provider = FakeProvider(completion(None, tool_call("edit_feed", edit)))
    assert ask(app_with(provider), text, mode="new")["actions"] == expected


def test_a_topic_is_only_filled_in_for_a_new_feed():
    provider = FakeProvider(completion("Can't.", tool_call("edit_feed", {"name": "Tennis"})))
    assert ask(app_with(provider), "a feed for tennis")["actions"] == []

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


def test_tools_offer_only_catalog_topics_and_the_videos_shown():
    provider = FakeProvider()
    ask(app_with(provider))
    sent = provider.sent()
    topics = tool(sent, "set_topics")["parameters"]["properties"]["add"]["items"]["enum"]
    assert "Cooking" in topics and "Knitting" not in topics
    assert tool(sent, "pin_video")["parameters"]["properties"]["id"]["enum"] == ["demo-0", "demo-1", "demo-22"]
    assert "create_feed" not in {t["function"]["name"] for t in sent["tools"]}


def test_new_mode_also_offers_create_feed():
    provider = FakeProvider(completion(None, tool_call("create_feed", {"name": "Cooking"}), tool_call("set_topics", {"add": ["Cooking"], "remove": []})))
    body = ask(app_with(provider), "a cooking feed", mode="new")
    assert body["actions"] == [{"type": "create_feed", "name": "Cooking"}, {"type": "set_topics", "add": ["Cooking"], "remove": []}]


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

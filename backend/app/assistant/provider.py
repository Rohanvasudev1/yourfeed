"""The model: any OpenAI-compatible chat API (Groq, Ollama, OpenRouter), asked for feed actions through tool calling (ADRs 0004, 0006)."""

import json
import logging
from collections.abc import Mapping
from dataclasses import dataclass
from urllib.parse import urlsplit

import httpx
from pydantic import BaseModel, ValidationError

from app.assistant.actions import LENGTH_LIMITS, SESSION_LIMITS, Limits
from app.assistant.model import AnsweredBy, BarMode, FeedContext, Proposal
from app.catalog import catalog_topics

log = logging.getLogger("yourfeed")

GROQ_BASE_URL = "https://api.groq.com/openai/v1"
DEFAULT_MODEL = "openai/gpt-oss-20b"
MODEL_TIMEOUT_S = 15.0
OLLAMA_PORT = 11434
KNOWN_PROVIDERS = {"api.groq.com": "Groq", "openrouter.ai": "OpenRouter"}

SYSTEM_PROMPT = """You change one YouTube feed for the user by calling tools. Rules:
- Only use the tools. Topics must come from the tool's list; pin only the videos listed.
- Lengths are minutes per video; a session is the total minutes the user has for one sitting.
- Make every change the request asks for in one answer, then say what you did in one short sentence.
- If you can't do it with these tools (filters, tabs, saving or deleting videos), call no tool and say in one sentence what you can change instead: topics, muted topics, video length, session time and which video comes first.
- If the user asks why a video is first, answer in one sentence without calling a tool."""


class ProviderError(Exception):
    """The provider answered with an error or with something that isn't a chat completion."""


@dataclass(frozen=True)
class ModelConfig:
    base_url: str
    api_key: str | None
    model: str

    @classmethod
    def from_env(cls, env: Mapping[str, str]) -> "ModelConfig | None":
        """A model is set up by a key (Groq by default) or by a base URL alone (Ollama needs no key). Neither means rules only."""
        key = env.get("AI_API_KEY", "").strip() or None
        base_url = env.get("AI_BASE_URL", "").strip().rstrip("/")
        if not key and not base_url:
            return None
        return cls(base_url=base_url or GROQ_BASE_URL, api_key=key, model=env.get("AI_MODEL", "").strip() or DEFAULT_MODEL)

    @property
    def provider_name(self) -> str:
        """A name safe to show anyone: a known provider, or the bare host with no credentials, port or path."""
        url = urlsplit(self.base_url)
        host = url.hostname or "your provider"
        if url.port == OLLAMA_PORT or "ollama" in host:
            return "Ollama"
        return KNOWN_PROVIDERS.get(host, host)

    @property
    def model_name(self) -> str:
        return self.model.rsplit("/", 1)[-1]


class _Function(BaseModel):
    name: str
    arguments: str


class _ToolCall(BaseModel):
    function: _Function


class _Message(BaseModel):
    content: str | None = None
    tool_calls: list[_ToolCall] | None = None


class _Choice(BaseModel):
    message: _Message


class _Completion(BaseModel):
    choices: list[_Choice]


def _function(name: str, description: str, properties: dict, required: list[str]) -> dict:
    parameters = {"type": "object", "properties": properties, "required": required, "additionalProperties": False}
    return {"type": "function", "function": {"name": name, "description": description, "parameters": parameters}}


def _range(limits: Limits) -> dict:
    return {"type": "integer", "minimum": limits.lowest, "maximum": limits.highest}


def _tools(mode: BarMode, context: FeedContext, topics: frozenset[str]) -> list[dict]:
    """One tool per feed action the model may take. Schemas limit topics to the catalog and pins to the videos shown (ADR 0007)."""
    topic = {"type": "string", "enum": sorted(topics)}
    topic_list = {"type": "array", "items": topic}
    tools = [
        _function("set_topics", "Add topics to the feed and remove topics from it.", {"add": topic_list, "remove": topic_list}, ["add", "remove"]),
        _function("mute_topic", "Hide a topic from this feed.", {"topic": topic}, ["topic"]),
        _function("set_length_range", "Set the shortest and longest video, in minutes.", {"min": _range(LENGTH_LIMITS), "max": _range(LENGTH_LIMITS)}, ["min", "max"]),
        _function("set_session_range", "Set the least and most total minutes for one sitting.", {"min": _range(SESSION_LIMITS), "max": _range(SESSION_LIMITS)}, ["min", "max"]),
    ]
    if context.up_next:
        video = {"type": "string", "enum": [v.id for v in context.up_next]}
        tools.append(_function("pin_video", "Put one of the listed videos first in Up next.", {"id": video}, ["id"]))
    if mode == "new":
        name = {"type": "string", "maxLength": 40}
        tools.append(_function("create_feed", "Start a new feed; then add its topics with set_topics.", {"name": name}, []))
    return tools


def _user_message(text: str, mode: BarMode, context: FeedContext) -> str:
    feed = context.model_dump(by_alias=True, mode="json")
    task = "Start a new feed from this request." if mode == "new" else "Change this feed."
    return f"{task}\nFeed: {json.dumps(feed)}\nRequest: {text}"


def _action(call: _ToolCall) -> dict:
    """A tool call as a raw feed action; arguments that aren't a JSON object become an action the checks drop."""
    try:
        args = json.loads(call.function.arguments or "{}")
    except json.JSONDecodeError:
        return {"type": call.function.name, "arguments": call.function.arguments}
    return {**args, "type": call.function.name} if isinstance(args, dict) else {"type": call.function.name}


class OpenAICompatibleModel:
    answered_by: AnsweredBy = "model"

    def __init__(self, config: ModelConfig, http: httpx.Client | None = None) -> None:
        self._config = config
        self._http = http or httpx.Client(timeout=MODEL_TIMEOUT_S)
        self.model_name = config.model_name
        self.provider = config.provider_name

    def _post(self, body: dict) -> dict:
        headers = {"Authorization": f"Bearer {self._config.api_key}"} if self._config.api_key else {}
        res = self._http.post(f"{self._config.base_url}/chat/completions", json=body, headers=headers, timeout=MODEL_TIMEOUT_S)
        if res.is_error:
            raise ProviderError(f"{self.provider} answered {res.status_code} {res.reason_phrase}")
        try:
            return res.json()
        except ValueError as exc:
            raise ProviderError(f"{self.provider} answered with something that isn't JSON") from exc

    def handle(self, text: str, mode: BarMode, context: FeedContext) -> Proposal:
        body = {
            "model": self._config.model,
            "messages": [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": _user_message(text, mode, context)}],
            "tools": _tools(mode, context, catalog_topics()),
            "tool_choice": "auto",
            "temperature": 0.2,
        }
        try:
            message = _Completion.model_validate(self._post(body)).choices[0].message
        except (ValidationError, IndexError) as exc:
            raise ProviderError(f"{self.provider}'s answer isn't a chat completion") from exc
        reply = (message.content or "").strip() or None
        return Proposal(actions=tuple(_action(c) for c in message.tool_calls or ()), reply=reply)

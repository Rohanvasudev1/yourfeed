"""The model: any OpenAI-compatible chat API (Groq, Ollama, OpenRouter), asked for feed actions through tool calling (ADRs 0004, 0006)."""

import json
import logging
from collections.abc import Mapping
from dataclasses import dataclass
from urllib.parse import urlsplit

import httpx
from pydantic import BaseModel, ValidationError

from app.assistant.model import AnsweredBy, BarMode, FeedContext, FollowUps, Proposal
from app.assistant.tools import ToolCall, actions_from, tools
from app.catalog import Video, catalog_topics

log = logging.getLogger("yourfeed")

GROQ_BASE_URL = "https://api.groq.com/openai/v1"
DEFAULT_MODEL = "openai/gpt-oss-20b"
MODEL_TIMEOUT_S = 15.0
TEMPERATURE = 0.2
OLLAMA_PORT = 11434
KNOWN_PROVIDERS = {"api.groq.com": "Groq", "openrouter.ai": "OpenRouter"}

SYSTEM_PROMPT = """Change one YouTube feed with one edit_feed call holding every change asked for, then say what you did in one short sentence.
- "add travel and under 15 min" is one call with add and length. Keep the feed's topics unless asked to drop them.
- "no X" or "less X" for a topic the feed lacks: mute it. "Deep dives" is length 20-120.
- Can't do it (filters, tabs, saving videos)? Call no tool; say you can change topics, muted topics, video length, session time and which video is first.
- ask_user only when nothing is named: no topic, length or time ("something fun").
- "Why is this first?": call no tool; reply with the feed's whyFirst. Never invent a reason."""

NOTE_PROMPT = """You answer a question someone wrote in their notes about one YouTube video.
You only know the video's details below, never its transcript. Answer in at most two sentences.
If the details don't say, say what you can't know from them instead of guessing."""


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


def _earlier(follow_ups: FollowUps) -> str:
    """The follow-ups as one short line each, oldest first, or nothing when there are none."""
    lines = "".join(f"\n- {json.dumps(f.request, ensure_ascii=False)} -> {f.summary}" for f in follow_ups)
    return f"\nEarlier requests, already applied to the feed above. Change only what the new request asks, read against them (\"no, shorter\" means shorter than now):{lines}" if lines else ""


def _user_message(text: str, mode: BarMode, context: FeedContext, follow_ups: FollowUps = ()) -> str:
    """The feed, compact and with the reason its first video is first, so the model never has to guess one, then any follow-ups."""
    feed = {**context.model_dump(by_alias=True, mode="json", exclude_defaults=True), "whyFirst": context.why_first()}
    task = "Start a new feed from this request." if mode == "new" else "Change this feed."
    return f"{task}\nFeed: {json.dumps(feed, separators=(',', ':'))}{_earlier(follow_ups)}\nRequest: {text}"


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

    def _message(self, body: dict) -> _Message:
        try:
            return _Completion.model_validate(self._post(body)).choices[0].message
        except (ValidationError, IndexError) as exc:
            raise ProviderError(f"{self.provider}'s answer isn't a chat completion") from exc

    def handle(self, text: str, mode: BarMode, context: FeedContext, follow_ups: FollowUps = ()) -> Proposal:
        topics = catalog_topics()
        body = {
            "model": self._config.model,
            "messages": [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": _user_message(text, mode, context, follow_ups)}],
            "tools": tools(mode, context, topics),
            "tool_choice": "auto",
            "temperature": TEMPERATURE,
        }
        message = self._message(body)
        reply = (message.content or "").strip() or None
        calls = [ToolCall(c.function.name, c.function.arguments) for c in message.tool_calls or ()]
        return Proposal(actions=actions_from(calls, text, mode, topics), reply=reply)

    def answer(self, question: str, video: Video) -> str:
        details = video.model_dump(by_alias=True, mode="json")
        body = {
            "model": self._config.model,
            "messages": [{"role": "system", "content": NOTE_PROMPT}, {"role": "user", "content": f"Video: {json.dumps(details)}\nQuestion: {question}"}],
            "temperature": TEMPERATURE,
        }
        text = (self._message(body).content or "").strip()
        if not text:
            raise ProviderError(f"{self.provider} gave an empty answer")
        return text

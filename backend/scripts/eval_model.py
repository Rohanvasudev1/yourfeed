"""Runs a fixed set of Claude bar requests against the model set up in AI_BASE_URL, AI_API_KEY and AI_MODEL, and reports which ones did what was expected.

For comparing models by hand; it calls a real model, so it never runs in CI or pytest. Usage, from backend/:

    uv run --env-file .env python -m scripts.eval_model --delay 13
    AI_BASE_URL=http://localhost:11434/v1 AI_MODEL=qwen3:4b uv run python -m scripts.eval_model --delay 0

Groq's free tier allows a few thousand tokens a minute, so --delay spaces the requests out, and a request the rules
answered (the provider said 429 or timed out) is retried after --retry-wait seconds, so a run measures the model, not the rate limit.
"""

import argparse
import os
import re
import sys
import time
from collections.abc import Callable, Mapping
from types import MappingProxyType
from typing import Any, NamedTuple

import httpx
from fastapi.testclient import TestClient

from app.assistant.limits import LimitConfig
from app.assistant.provider import MODEL_TIMEOUT_S, ModelConfig, OpenAICompatibleModel
from app.main import create_app
from tests.assistant_helpers import request

Check = Callable[[list[dict], str | None], bool]
UNLIMITED = LimitConfig(per_minute=1_000, per_day=1_000, site_per_day=1_000)
DEFAULT_DELAY_S = 13.0
DEFAULT_RETRY_WAIT_S = 30.0
DEFAULT_RETRIES = 2
PIN_CLAIM = re.compile(r"\b(pinned|pin|you (added|put|chose|picked))\b", re.IGNORECASE)


class Case(NamedTuple):
    text: str
    mode: str
    check: Check
    context: Mapping[str, Any] = MappingProxyType({})


def adds(topic: str) -> Check:
    return lambda actions, _: any(a["type"] == "set_topics" and topic in a["add"] for a in actions)


def removes_or_mutes(topic: str) -> Check:
    return lambda actions, _: any(
        (a["type"] == "set_topics" and topic in a["remove"]) or (a["type"] == "mute_topic" and a["topic"] == topic) for a in actions
    )


def length(check: Callable[[int, int], bool]) -> Check:
    return lambda actions, _: any(a["type"] == "set_length_range" and check(a["min"], a["max"]) for a in actions)


def session_near(minutes: int) -> Check:
    return lambda actions, _: any(a["type"] == "set_session_range" and abs(a["max"] - minutes) <= 10 for a in actions)


def pins(video: str) -> Check:
    return lambda actions, _: [a for a in actions if a["type"] == "pin_video"] == [{"type": "pin_video", "id": video}]


def only_replies(actions: list[dict], reply: str | None) -> bool:
    return not actions and bool(reply)


def both(*checks: Check) -> Check:
    return lambda actions, reply: all(c(actions, reply) for c in checks)


def replies_without_a_pin_claim(actions: list[dict], reply: str | None) -> bool:
    return only_replies(actions, reply) and not PIN_CLAIM.search(reply or "")


def replies_with_a_pin_claim(actions: list[dict], reply: str | None) -> bool:
    return only_replies(actions, reply) and bool(PIN_CLAIM.search(reply or ""))


def creates_with(topic: str) -> Check:
    return lambda actions, reply: any(a["type"] == "create_feed" for a in actions) and adds(topic)(actions, reply)


CASES = (
    Case("add cooking", "edit", adds("Cooking")),
    Case("I want recipes and travel", "edit", both(adds("Cooking"), adds("Travel"))),
    Case("less economics", "edit", removes_or_mutes("Economics")),
    Case("no wrestling please", "edit", removes_or_mutes("Wrestling")),
    Case("shorter videos", "edit", length(lambda lo, hi: hi <= 20)),
    Case("some deep dives", "edit", length(lambda lo, hi: lo >= 15)),
    Case("I've got an hour", "edit", session_near(60)),
    Case("put the MCP one first", "edit", pins("demo-22")),
    Case("turn on honest titles", "edit", only_replies),
    Case("why is this video first?", "edit", replies_without_a_pin_claim),
    Case("why is this video first?", "edit", replies_with_a_pin_claim, {"pinned": ["demo-22"]}),
    Case("add travel and keep videos under 15 minutes", "edit", both(adds("Travel"), length(lambda lo, hi: hi <= 15))),
    Case("a feed for tennis", "new", creates_with("Tennis")),
)


class TokenMeter:
    """Adds up the tokens each chat completion reports, read from the provider's answers."""

    def __init__(self) -> None:
        self.calls: list[int] = []

    def __call__(self, res: httpx.Response) -> None:
        res.read()
        try:
            self.calls.append(int(res.json()["usage"]["total_tokens"]))
        except (ValueError, KeyError, TypeError):
            print(f"      no token usage in a {res.status_code} answer", file=sys.stderr)


def _ask(client: TestClient, case: Case, retries: int, retry_wait: float) -> dict:
    """The answer to one case, asked again after a wait while the rules answer (the provider was busy or rate limited)."""
    for attempt in range(retries + 1):
        body = client.post("/api/assistant/request", json=request(case.text, mode=case.mode, **case.context)).json()["data"]
        if body["answeredBy"] == "model" or attempt == retries:
            return body
        print(f"      rules answered {case.text!r}; waiting {retry_wait:.0f}s and asking again", file=sys.stderr)
        time.sleep(retry_wait)
    raise AssertionError("unreachable")


def _args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--delay", type=float, default=DEFAULT_DELAY_S, help="seconds between requests (default %(default)s)")
    parser.add_argument("--retries", type=int, default=DEFAULT_RETRIES, help="asks again when the rules answered (default %(default)s)")
    parser.add_argument("--retry-wait", type=float, default=DEFAULT_RETRY_WAIT_S, help="seconds before asking again (default %(default)s)")
    args = parser.parse_args(argv)
    if args.delay < 0 or args.retries < 0 or args.retry_wait < 0:
        parser.error("--delay, --retries and --retry-wait can't be negative")
    return args


def main(argv: list[str] | None = None) -> int:
    args = _args(argv)
    config = ModelConfig.from_env(os.environ)
    if config is None:
        print("No model set up: set AI_API_KEY (Groq) or AI_BASE_URL (Ollama) first.", file=sys.stderr)
        return 2
    meter = TokenMeter()
    model = OpenAICompatibleModel(config, http=httpx.Client(timeout=MODEL_TIMEOUT_S, event_hooks={"response": [meter]}))
    client = TestClient(create_app(model, limits=UNLIMITED))
    print(f"Evaluating {model.model_name} via {model.provider}\n")
    passed = 0
    for i, case in enumerate(CASES):
        if i:
            time.sleep(args.delay)
        body = _ask(client, case, args.retries, args.retry_wait)
        ok = body["answeredBy"] == "model" and case.check(body["actions"], body["reply"])
        passed += ok
        print(f"{'PASS' if ok else 'FAIL'}  {case.text!r} -> {body['answeredBy']}: {body['actions']} {body['reply'] or ''}")
    if meter.calls:
        print(f"\nTokens per model call: mean {sum(meter.calls) // len(meter.calls)}, max {max(meter.calls)}")
    print(f"\n{passed}/{len(CASES)} passed")
    return 0 if passed == len(CASES) else 1


if __name__ == "__main__":
    sys.exit(main())

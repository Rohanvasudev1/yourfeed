"""Runs a fixed set of Claude bar requests against the model set up in AI_BASE_URL, AI_API_KEY and AI_MODEL, and reports which ones did what was expected.

For comparing models by hand; it calls a real model, so it never runs in CI or pytest. Usage, from backend/:

    AI_API_KEY=... uv run python -m scripts.eval_model
    AI_BASE_URL=http://localhost:11434/v1 AI_MODEL=qwen3:4b uv run python -m scripts.eval_model
"""

import os
import sys
from collections.abc import Callable
from typing import NamedTuple

from fastapi.testclient import TestClient

from app.assistant.limits import LimitConfig
from app.assistant.provider import ModelConfig, OpenAICompatibleModel
from app.main import create_app
from tests.assistant_helpers import request

Check = Callable[[list[dict], str | None], bool]
UNLIMITED = LimitConfig(per_minute=1_000, per_day=1_000, site_per_day=1_000)


class Case(NamedTuple):
    text: str
    mode: str
    check: Check


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


def creates_with(topic: str) -> Check:
    return lambda actions, reply: any(a["type"] == "create_feed" for a in actions) and adds(topic)(actions, reply)


CASES = (
    Case("add cooking", "edit", adds("Cooking")),
    Case("I want recipes and travel", "edit", lambda a, r: adds("Cooking")(a, r) and adds("Travel")(a, r)),
    Case("less economics", "edit", removes_or_mutes("Economics")),
    Case("no wrestling please", "edit", removes_or_mutes("Wrestling")),
    Case("shorter videos", "edit", length(lambda lo, hi: hi <= 20)),
    Case("some deep dives", "edit", length(lambda lo, hi: lo >= 15)),
    Case("I've got an hour", "edit", session_near(60)),
    Case("put the MCP one first", "edit", pins("demo-22")),
    Case("turn on honest titles", "edit", only_replies),
    Case("why is this video first?", "edit", only_replies),
    Case("a feed for tennis", "new", creates_with("Tennis")),
)


def main() -> int:
    config = ModelConfig.from_env(os.environ)
    if config is None:
        print("No model set up: set AI_API_KEY (Groq) or AI_BASE_URL (Ollama) first.", file=sys.stderr)
        return 2
    model = OpenAICompatibleModel(config)
    client = TestClient(create_app(model, limits=UNLIMITED))
    print(f"Evaluating {model.model_name} via {model.provider}\n")
    passed = 0
    for case in CASES:
        body = client.post("/api/assistant/request", json=request(case.text, mode=case.mode)).json()["data"]
        ok = body["answeredBy"] == "model" and case.check(body["actions"], body["reply"])
        passed += ok
        print(f"{'PASS' if ok else 'FAIL'}  {case.text!r} -> {body['answeredBy']}: {body['actions']} {body['reply'] or ''}")
    print(f"\n{passed}/{len(CASES)} passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())

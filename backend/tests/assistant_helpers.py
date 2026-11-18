"""Builders for Claude bar requests, shared by the assistant API tests."""

from typing import Any

LEARN_UP_NEXT = [
    {"id": "demo-0", "title": "Build an AI agent with tool use, step by step", "topic": "AI", "channel": "Agent Workshop"},
    {"id": "demo-1", "title": "Graphs vs trees: when to use which", "topic": "Programming", "channel": "Data Structures Daily"},
    {"id": "demo-22", "title": "Build an MCP server in 20 minutes", "topic": "MCP", "channel": "Agent Workshop"},
]


def context(**changes: Any) -> dict[str, Any]:
    """The Learn feed from the demo seed, as the frontend sends it."""
    base: dict[str, Any] = {
        "kind": "topics",
        "name": "Learn",
        "topics": ["AI", "Programming", "Economics", "Careers"],
        "channels": [],
        "muted": [],
        "length": [10, 60],
        "session": [30, 90],
        "pinned": [],
        "upNext": LEARN_UP_NEXT,
    }
    return {**base, **changes}


def request(text: str, mode: str = "edit", **context_changes: Any) -> dict[str, Any]:
    return {"text": text, "mode": mode, "context": context(**context_changes)}

"""The tools a model is offered and how its tool calls become raw feed actions for the checks in actions.py (ADR 0007).

Small models such as gpt-oss-20b on Groq make one tool call per answer, so every change to the feed goes in one
edit_feed call whose fields each become a feed action. Schemas limit topics to the catalog and pins to the videos shown.
"""

import json
import re
from typing import NamedTuple

from app.assistant.actions import LENGTH_LIMITS, SESSION_LIMITS, Limits
from app.assistant.model import BarMode, FeedContext

MAX_FEED_NAME = 40
MAX_QUESTION = 200
MAX_CARD_ITEMS = 8
EDIT_FEED = "edit_feed"
EDIT_HELP = "Change the feed. Fill every field the request asks for, all in this one call; leave the rest out."
NEW_FEED_HELP = "Make the new feed. Fill every field the request asks for, all in this one call; leave the rest out."
LENGTH_HELP = "Minutes per video. Shorter or quick: 1-15. Under N: 1-N. Deep dives or long: 20-120."
SESSION_HELP = "Total minutes for one sitting; an hour is 50-60."
ASK_HELP = "Only when the request names no topic, length or time: chips offer topics, videos offer video ids, feedback asks if added topics fit."


class ToolCall(NamedTuple):
    name: str
    arguments: str


def _function(name: str, description: str, properties: dict, required: list[str]) -> dict:
    parameters = {"type": "object", "properties": properties, "required": required}
    return {"type": "function", "function": {"name": name, "description": description, "parameters": parameters}}


def _range(limits: Limits, description: str) -> dict:
    minutes = {"type": "integer", "minimum": limits.lowest, "maximum": limits.highest}
    return {"type": "object", "description": description, "properties": {"min": minutes, "max": minutes}, "required": ["min", "max"]}


def _strings(values: list[str]) -> dict:
    return {"type": "array", "items": {"type": "string", "enum": values}}


def _edit_feed(mode: BarMode, context: FeedContext, topics: frozenset[str]) -> dict:
    properties: dict[str, dict] = {}
    if mode == "new":
        properties["name"] = {"type": "string", "maxLength": MAX_FEED_NAME}
    properties["add"] = _strings(sorted(topics))
    if mode == "edit" and context.topics:
        properties["remove"] = _strings(sorted(context.topics))
    properties["mute"] = {**_strings(sorted(topics)), "description": "Topics to hide, even ones the feed doesn't have."}
    properties["length"] = _range(LENGTH_LIMITS, LENGTH_HELP)
    properties["session"] = _range(SESSION_LIMITS, SESSION_HELP)
    if mode == "edit" and context.up_next:
        properties["pin"] = {"type": "string", "enum": [v.id for v in context.up_next], "description": "Video to put first."}
    return _function(EDIT_FEED, NEW_FEED_HELP if mode == "new" else EDIT_HELP, properties, [])


def _ask_user(context: FeedContext, topics: frozenset[str]) -> dict:
    """A question card: chips and feedback name topics, videos name ids the frontend sent (Up next or explore)."""
    choices = sorted(topics) + [v.id for v in (*context.up_next, *context.explore)]
    properties = {
        "kind": {"type": "string", "enum": ["chips", "videos", "feedback"]},
        "question": {"type": "string", "maxLength": MAX_QUESTION},
        "items": {"type": "array", "items": {"type": "string", "enum": choices}, "minItems": 1, "maxItems": MAX_CARD_ITEMS},
    }
    return _function("ask_user", ASK_HELP, properties, ["kind", "question", "items"])


def tools(mode: BarMode, context: FeedContext, topics: frozenset[str]) -> list[dict]:
    return [_edit_feed(mode, context, topics), _ask_user(context, topics)]


def _arguments(call: ToolCall) -> dict | None:
    try:
        args = json.loads(call.arguments or "{}")
    except json.JSONDecodeError:
        return None
    return args if isinstance(args, dict) else None


def _named_topics(text: str, topics: frozenset[str]) -> list[str]:
    return sorted(t for t in topics if re.search(rf"\b{re.escape(t)}\b", text, re.IGNORECASE))


def _list(value: object) -> list:
    return list(value) if isinstance(value, list) else []


def _range_action(kind: str, value: object) -> list[dict]:
    return [{"type": kind, "min": value.get("min"), "max": value.get("max")}] if isinstance(value, dict) else []


def _edits(args: dict, text: str, mode: BarMode, topics: frozenset[str]) -> list[dict]:
    """One edit_feed call as feed actions. A new feed the model gave no topics gets the catalog topics its name or request names."""
    add, remove = _list(args.get("add")), _list(args.get("remove"))
    if mode == "new" and not add:
        add = _named_topics(f"{args.get('name') or ''} {text}", topics)
    actions = [{"type": "create_feed", **({"name": args["name"]} if args.get("name") else {})}] if mode == "new" else []
    if add or remove:
        actions.append({"type": "set_topics", "add": add, "remove": remove})
    actions += [{"type": "mute_topic", "topic": t} for t in _list(args.get("mute"))]
    actions += _range_action("set_length_range", args.get("length"))
    actions += _range_action("set_session_range", args.get("session"))
    if "pin" in args:
        actions.append({"type": "pin_video", "id": args["pin"]})
    return actions


def actions_from(calls: list[ToolCall], text: str, mode: BarMode, topics: frozenset[str]) -> tuple[dict, ...]:
    """Tool calls as raw feed actions for the checks: edit_feed becomes one action per field, any other call the action of its name."""
    actions: list[dict] = []
    for call in calls:
        args = _arguments(call)
        if args is None:
            actions.append({"type": call.name, "arguments": call.arguments})
        elif call.name == EDIT_FEED:
            actions += _edits(args, text, mode, topics)
        else:
            actions.append({**args, "type": call.name})
    return tuple(actions)

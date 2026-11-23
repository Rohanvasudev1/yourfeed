"""The keyword rules: the mockup's `agent` and `addFlow` (prototype/index.html), used when no model answers."""

import re
from collections.abc import Callable

from app.assistant.answers import answer_for
from app.assistant.model import AnsweredBy, BarMode, FeedContext, Proposal
from app.catalog import Video

TOPIC_RX: dict[str, re.Pattern[str]] = {
    name: re.compile(rx)
    for name, rx in {
        "News": r"\bnews\b|headline|current events|briefing",
        "AI": r"\bai\b|agent|machine learning|llm",
        "Programming": r"code|coding|program|software|dev|typescript",
        "Economics": r"econom|money|finance|crypto|invest",
        "Careers": r"career|job",
        "Premier League": r"football|soccer|premier",
        "Tennis": r"tennis",
        "Cricket": r"cricket",
        "Wrestling": r"wrestl|wwe",
        "Podcasts": r"podcast|interview|conversation",
        "Live music": r"music|song|live set|concert",
        "Vlogs": r"vlog|friends|challenge",
        "MCP": r"\bmcp\b",
        "Product design": r"product|design|ux",
        "Cooking": r"cook|food|recipe",
        "Travel": r"travel|trip|holiday",
    }.items()
}

BROAD: tuple[tuple[re.Pattern[str], str, tuple[str, ...]], ...] = (
    (re.compile(r"sport|game|match|athlet"), "Which sports?", ("Premier League", "Tennis", "Cricket", "Wrestling")),
    (re.compile(r"learn|study|smart|tech|nerd|brain"), "What do you want to learn about?", ("AI", "Programming", "MCP", "Product design", "Economics")),
    (re.compile(r"chill|relax|wind|calm|sleep|cosy|cozy"), "What helps you wind down?", ("Podcasts", "Live music", "Cooking", "Travel")),
    (re.compile(r"fun|laugh|funny|entertain|brain off"), "What kind of fun?", ("Vlogs", "Wrestling", "Live music", "Travel")),
)

WHY = re.compile(r"\bwhy\b")
CANT_DO = re.compile(r"\b(filters?|clickbait|honest|tabs?|save|saved|delete|folders?)\b")
LESS = re.compile(r"less|fewer|\bno |without|skip|remove|drop|hide")
PIN = re.compile(r"\b(first|pin|top)\b|up next")
SHORT = re.compile(r"short|quick")
LONG = re.compile(r"longer|deep dive")
HALF_HOUR = re.compile(r"half an hour")
AN_HOUR = re.compile(r"\ban hour\b")
SOME_TIME = re.compile(r"\b(?:got|have|only|for)\s+(?:about\s+)?(\d+)\s*(hours?|hrs?|minutes?|mins?)\b")
PIN_FILLER = frozenset({"first", "top", "next", "video", "videos", "one", "the", "put", "pin", "please", "that", "this", "with", "about"})

ALREADY = "Already in this feed."
CANT_DO_REPLY = "I can change this feed's topics, video length and session time. Filters, tabs and saved videos are yours to change."
BUILT_IN_REPLY = "This tab builds itself, so I can't change it. Try one of your own feeds."
PICK_VIDEOS = "Pick the ones you're feeling and I'll add more like them."
VIDEO_CHOICES = 4
NO_MATCH_REPLY = "I couldn't match that to a topic. Try one like Cooking, Travel or Tennis."
# Your own feeds, and From Claude, which the frontend only sends in edit mode once it's connected.
EDITABLE_KINDS = frozenset({"topics", "claude"})
SHORT_LENGTH = (1, 15)
LONG_LENGTH = (20, 120)
SESSION_SLACK = 10


def _reply(text: str) -> Proposal:
    return Proposal(reply=text)


def _act(*actions: dict) -> Proposal:
    return Proposal(actions=actions)


def _topics_in(text: str) -> list[str]:
    return [name for name, rx in TOPIC_RX.items() if rx.search(text)]


def _why(text: str, context: FeedContext) -> Proposal | None:
    if not WHY.search(text):
        return None
    return _reply(context.why_first())


def _less(text: str, context: FeedContext) -> Proposal | None:
    if not LESS.search(text):
        return None
    mentioned = _topics_in(text)
    in_feed = [t for t in context.topics if t in mentioned or re.search(rf"\b{re.escape(t.lower())}\b", text)]
    if in_feed:
        return _act({"type": "set_topics", "add": [], "remove": in_feed[:1]})
    if mentioned:
        return _reply(ALREADY) if mentioned[0] in context.muted else _act({"type": "mute_topic", "topic": mentioned[0]})
    return None


def _pin(text: str, context: FeedContext) -> Proposal | None:
    if not PIN.search(text):
        return None
    topics = _topics_in(text)
    words = {w for w in re.findall(r"[a-z0-9]{4,}", text) if w not in PIN_FILLER}
    found = next(
        (v for v in context.up_next if v.topic in topics or words & set(re.findall(r"[a-z0-9]+", v.title.lower()))),
        None,
    )
    return _act({"type": "pin_video", "id": found.id}) if found else None


def _length(text: str, _: FeedContext) -> Proposal | None:
    if SHORT.search(text):
        lo, hi = SHORT_LENGTH
    elif LONG.search(text):
        lo, hi = LONG_LENGTH
    else:
        return None
    return _act({"type": "set_length_range", "min": lo, "max": hi})


def _session_minutes(text: str) -> int | None:
    if HALF_HOUR.search(text):
        return 30
    if AN_HOUR.search(text):
        return 60
    if found := SOME_TIME.search(text):
        amount, unit = int(found.group(1)), found.group(2)
        return amount * 60 if unit.startswith("h") else amount
    return None


def _session(text: str, _: FeedContext) -> Proposal | None:
    minutes = _session_minutes(text)
    if minutes is None:
        return None
    return _act({"type": "set_session_range", "min": minutes - SESSION_SLACK, "max": minutes})


def _add(text: str, context: FeedContext) -> Proposal:
    hits = _topics_in(text)
    fresh = [t for t in hits if t not in context.topics]
    if fresh:
        return _act({"type": "set_topics", "add": fresh, "remove": []})
    if hits:
        return _reply(ALREADY)
    if CANT_DO.search(text):
        return _reply(CANT_DO_REPLY)
    for rx, question, options in BROAD:
        left = [o for o in options if o not in context.topics]
        if rx.search(text) and left:
            return _act({"type": "ask_user", "kind": "chips", "question": question, "items": left})
    return _offer_videos(context)


def _offer_videos(context: FeedContext) -> Proposal:
    """Shows videos from topics the feed doesn't have, so the visitor can show rather than tell."""
    seen = set(context.topics)
    picks: list[str] = []
    for video in context.explore:
        if video.topic not in seen and len(picks) < VIDEO_CHOICES:
            seen.add(video.topic)
            picks.append(video.id)
    if not picks:
        return _reply(NO_MATCH_REPLY)
    return _act({"type": "ask_user", "kind": "videos", "question": PICK_VIDEOS, "items": picks})


Rule = Callable[[str, FeedContext], Proposal | None]
EDIT_RULES: tuple[Rule, ...] = (_less, _length, _session, _pin)


def _or_list(items: list[str]) -> str:
    return items[0] if len(items) == 1 else f"{', '.join(items[:-1])} or {items[-1]}"


def _new_feed(text: str, context: FeedContext) -> Proposal:
    """
    New mode: the topics a request names go to a new, empty feed, never the one open. Question
    cards only edit the open feed, so without a topic the rules suggest some in a reply instead.
    """
    added = _add(text, context.model_copy(update={"topics": (), "muted": ()}))
    if any(a["type"] == "set_topics" for a in added.actions):
        return _act({"type": "create_feed"}, *added.actions)
    chips = next((a for a in added.actions if a["type"] == "ask_user" and a["kind"] == "chips"), None)
    if chips:
        return _reply(f"{chips['question']} Try naming one, like {_or_list(list(chips['items'][:3]))}.")
    return added if added.reply else _reply(NO_MATCH_REPLY)


class KeywordRules:
    answered_by: AnsweredBy = "rules"

    def handle(self, text: str, mode: BarMode, context: FeedContext) -> Proposal:
        lowered = text.lower()
        if answer := _why(lowered, context):
            return answer
        if mode == "new":
            return _new_feed(lowered, context)
        if context.kind not in EDITABLE_KINDS:
            return _reply(BUILT_IN_REPLY)
        for rule in EDIT_RULES:
            if answer := rule(lowered, context):
                return answer
        return _add(lowered, context)

    def answer(self, question: str, video: Video) -> str:
        return answer_for(video, question)

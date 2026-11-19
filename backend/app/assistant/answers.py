"""Ask in notes by keyword rules: the mockup's `answerFor`, `GLOSSARY` and `TOPIC_BG` (prototype/index.html).

The rules only know a video's catalog entry, so every answer they can't ground says so.
"""

import re

from app.catalog import Video

TOPIC_BACKGROUND: dict[str, str] = {
    "News": "News clips like this are short summaries. Check the upload time, because stories can change quickly after a video goes up.",
    "AI": "AI videos like this one usually build on a few ideas: a model predicts text, and an agent wraps that model in a loop so it can call tools and act on the results.",
    "Programming": "This is a programming video, so most of it is about trade-offs: what a structure or technique is good at, and what it costs in speed, memory or complexity.",
    "Economics": "Economics videos tend to follow the money: who borrows, who lends, and how prices and interest rates push people's choices.",
    "Careers": "Career videos usually give a framework for decisions rather than hard rules, so it helps to test each point against your own situation.",
    "Premier League": "This is English top-flight football. Twenty clubs play each other twice a season, three points for a win, and the bottom three are relegated.",
    "Tennis": "Tennis scoring goes points → games → sets. Men's Grand Slam finals are best of five sets, which is why 'five-set final' means it went the distance.",
    "Cricket": "T20 is the shortest professional format: each side bats for 20 overs of six balls, so finishes are fast and close.",
    "Wrestling": "Pro wrestling is scripted sports entertainment. The 'main event' is the final, headline match of a show.",
    "Podcasts": "Long-form interviews like this jump between topics, so the guest's earlier answers often explain later ones.",
    "Live music": "Live sessions are usually recorded in one take, so small differences from the studio versions are part of the point.",
    "Vlogs": "Vlogs are personal, edited diaries. Challenges and stunts are often staged or cut together for pacing.",
    "MCP": "MCP (Model Context Protocol) is an open standard that lets an AI app like Claude connect to outside tools and data through 'servers' that expose tools.",
    "Product design": "Product design videos look at how something should work for the people using it: research first, then layouts, then testing.",
    "Cooking": "Cooking videos move fast, so pause on the ingredient list and the heat level, since those matter most.",
    "Travel": "Travel videos compress days into minutes, so costs and timings are usually rough and seasonal.",
}

GLOSSARY: tuple[tuple[re.Pattern[str], str], ...] = tuple(
    (re.compile(rx), text)
    for rx, text in (
        (r"tool use|tool call", "Tool use means the model can ask the app to run a function (search, a calculator, an API) and then read the result before answering."),
        (r"\bagent", "An agent is an AI model running in a loop: it decides on a step, uses a tool, looks at the result, and repeats until the task is done."),
        (r"\bmcp\b|model context protocol", TOPIC_BACKGROUND["MCP"]),
        (r"neural net", "A neural network is layers of simple maths units. Training nudges millions of weights until its outputs match the examples it's shown."),
        (r"\bllm|language model", "A large language model predicts the next word, trained on huge amounts of text. That one skill turns out to cover writing, coding and reasoning."),
        (r"interest rate|central bank", "Central banks set a base interest rate. Raising it makes borrowing dearer, which cools spending and inflation; cutting it does the opposite."),
        (r"inflation", "Inflation is how fast prices rise overall. A little is normal; a lot erodes what savings can buy."),
        (r"crypto|\bfund\b", "A crypto fund pools investors' money into digital tokens. When one collapses it's usually from leverage, hidden losses or fraud."),
        (r"\bgraph", "A graph is points (nodes) joined by lines (edges), any of which can connect. A tree is a graph with no loops and a single root."),
        (r"\btree", "A tree is a hierarchy: one root, each item has one parent. That makes lookups and ordering easy."),
        (r"database|index", "A database stores data so it can be found fast. Indexes are sorted shortcuts, like the index at the back of a book."),
        (r"relegat", "Relegation: the bottom teams in a league drop down a division for the next season."),
        (r"derby", "A derby is a match between local or long-standing rivals."),
        (r"\bt20\b|\bovers?\b", TOPIC_BACKGROUND["Cricket"]),
        (r"\bsets?\b|tiebreak|deuce", TOPIC_BACKGROUND["Tennis"]),
        (r"serve", "The serve starts every point. Faster serves and better rackets have made it far more dominant over the last 20 years."),
        (r"amapiano", "Amapiano is a South African house style with log-drum basslines and jazzy piano."),
        (r"burnout", "Burnout is long-term exhaustion from sustained stress, usually work. It differs from tiredness in that rest alone doesn't fix it."),
    )
)

WHO = re.compile(r"\bwho\b|channel|creator|made this")
HOW_LONG = re.compile(r"how long|length|minutes|time left")
WHY_HERE = re.compile(r"why.*(here|feed|recommend)|recommend")
SUMMARY = re.compile(r"summar|about|tl;?dr|gist|point")
CANT_SEE = "I can only see the title, channel and topic, not what's said or shown in the video."


def short_count(n: int) -> str:
    """34000 → "34K", 2100000 → "2.1M", as the cards show subscriber counts."""
    for size, unit in ((1_000_000, "M"), (1_000, "K")):
        if n >= size:
            return f"{n / size:.1f}".removesuffix(".0") + unit
    return str(n)


def answer_for(video: Video, question: str) -> str:
    q = question.lower()
    background = TOPIC_BACKGROUND.get(video.topic, "")
    if WHO.search(q):
        return (
            f"It's from {video.channel}, a channel with {short_count(video.channel_subscribers)} subscribers. "
            f"I only know the channel's topic ({video.topic}), not who's on screen."
        )
    if HOW_LONG.search(q):
        return f"It's {video.minutes} minutes long. I can't see how far in you are."
    if WHY_HERE.search(q):
        return f"It's about {video.topic}, so it matched one of this feed's topics, your watch history or what's popular."
    if term := next((text for rx, text in GLOSSARY if rx.search(q)), None):
        return term
    if SUMMARY.search(q):
        return f"Going by the title, it's about this: {video.honest_title}. {background}".strip()
    return f"{background} {CANT_SEE}".strip()

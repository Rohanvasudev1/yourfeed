"""YouTube's topicCategories, as readable topic names (ADR 0011). A fixed list; anything else is ignored."""

from collections.abc import Iterable

FALLBACK_TOPIC = "Other"

# YouTube's broad parent topics: used only when no specific topic is given.
BROAD = {
    "Music": "Music",
    "Video_game_culture": "Gaming",
    "Sport": "Sports",
    "Entertainment": "Entertainment",
    "Lifestyle_(sociology)": "Lifestyle",
    "Society": "Society",
    "Knowledge": "Knowledge",
}

SPECIFIC = {
    "Christian_music": "Christian music",
    "Classical_music": "Classical music",
    "Country_music": "Country music",
    "Electronic_music": "Electronic music",
    "Hip_hop_music": "Hip hop",
    "Independent_music": "Indie music",
    "Jazz": "Jazz",
    "Music_of_Asia": "Asian music",
    "Music_of_Latin_America": "Latin music",
    "Pop_music": "Pop music",
    "Reggae": "Reggae",
    "Rhythm_and_blues": "R&B",
    "Rock_music": "Rock music",
    "Soul_music": "Soul music",
    "Action_game": "Action games",
    "Action-adventure_game": "Adventure games",
    "Casual_game": "Casual games",
    "Music_video_game": "Music games",
    "Puzzle_video_game": "Puzzle games",
    "Racing_video_game": "Racing games",
    "Role-playing_video_game": "Role-playing games",
    "Simulation_video_game": "Simulation games",
    "Sports_game": "Sports games",
    "Strategy_video_game": "Strategy games",
    "American_football": "American football",
    "Association_football": "Football",
    "Baseball": "Baseball",
    "Basketball": "Basketball",
    "Boxing": "Boxing",
    "Cricket": "Cricket",
    "Golf": "Golf",
    "Ice_hockey": "Ice hockey",
    "Mixed_martial_arts": "MMA",
    "Motorsport": "Motorsport",
    "Professional_wrestling": "Wrestling",
    "Tennis": "Tennis",
    "Volleyball": "Volleyball",
    "Humour": "Comedy",
    "Film": "Film",
    "Performing_arts": "Performing arts",
    "Television_program": "TV",
    "Fashion": "Fashion",
    "Physical_fitness": "Fitness",
    "Food": "Food",
    "Hobby": "Hobbies",
    "Pet": "Pets",
    "Physical_attractiveness": "Beauty",
    "Technology": "Technology",
    "Tourism": "Travel",
    "Vehicle": "Vehicles",
    "Business": "Business",
    "Health": "Health",
    "Military": "Military",
    "Politics": "Politics",
    "Religion": "Religion",
}

READABLE_TOPICS = frozenset(BROAD.values()) | frozenset(SPECIFIC.values()) | {FALLBACK_TOPIC}


def _keys(urls: Iterable[str]) -> list[str]:
    return [url.rsplit("/wiki/", 1)[-1] for url in urls]


def _best(urls: Iterable[str]) -> str | None:
    keys = _keys(urls)
    specific = next((SPECIFIC[k] for k in keys if k in SPECIFIC), None)
    return specific or next((BROAD[k] for k in keys if k in BROAD), None)


def topic_of(video_urls: Iterable[str], channel_urls: Iterable[str]) -> str:
    """The video's own topic, else its channel's, else Other."""
    return _best(video_urls) or _best(channel_urls) or FALLBACK_TOPIC

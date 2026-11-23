"""A shared feed as Send carries it: the same limits as share links (ADR 0008, the frontend's `domain/share.ts`)."""

import re
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator
from pydantic.alias_generators import to_camel

TITLE_MAX, VIDEOS_MAX, MESSAGE_MAX, NOTES_MAX = 60, 50, 280, 2000

# YouTube video ids, and the demo catalog's ("demo-12").
VIDEO_ID = re.compile(r"[A-Za-z0-9_-]{1,100}")
VideoId = Annotated[str, StringConstraints(pattern=f"^{VIDEO_ID.pattern}$")]


class SharedFeed(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    title: Annotated[str, StringConstraints(min_length=1, max_length=TITLE_MAX)]
    videos: list[VideoId] = Field(min_length=1, max_length=VIDEOS_MAX)
    message: str = Field(default="", max_length=MESSAGE_MAX)
    notes: dict[VideoId, Annotated[str, StringConstraints(min_length=1)]] = Field(default_factory=dict)

    @model_validator(mode="after")
    def _fits(self) -> "SharedFeed":
        if not self.title.strip():
            raise ValueError("the title is empty")
        if len(set(self.videos)) != len(self.videos):
            raise ValueError("a video is listed twice")
        if sum(len(n) for n in self.notes.values()) > NOTES_MAX:
            raise ValueError("notes are too long")
        if not set(self.notes) <= set(self.videos):
            raise ValueError("notes name a video that isn't shared")
        return self


class SendRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # Checked by the username rules in the route, so an invalid one gets the same answer as an unknown one.
    to: str = Field(max_length=100)
    share: SharedFeed


class Sent(BaseModel):
    to: str


class InboxEntry(SharedFeed):
    """One feed in the user's inbox, as the API answers it."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, frozen=True)

    id: int
    # The sender's username now, not when they sent it.
    from_: str = Field(alias="from")
    sent_at: datetime

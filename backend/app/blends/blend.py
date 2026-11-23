"""What the Blend API reads and answers: recipe topics and who the blend is with, never a catalog."""

from enum import StrEnum
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, StringConstraints

TOPIC_MAX, TOPICS_MAX = 60, 50

Topic = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=TOPIC_MAX)]


def _once_each(topics: list[str]) -> list[str]:
    if len(set(topics)) != len(topics):
        raise ValueError("a topic is listed twice")
    return topics


Topics = Annotated[list[Topic], Field(max_length=TOPICS_MAX), AfterValidator(_once_each)]


class Status(StrEnum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    CANCELLED = "cancelled"


class InviteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # Checked by the username rules in the route, so an invalid one gets the same answer as an unknown one.
    to: str = Field(max_length=100)
    topics: Topics


class AcceptRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    topics: Topics


class BlendView(BaseModel):
    """One of the user's blends as the API answers it: the other person's username now and, once accepted, their topics."""

    model_config = ConfigDict(populate_by_name=True, frozen=True)

    id: int
    with_: str = Field(alias="with")
    role: Literal["inviter", "invitee"]
    status: Literal["pending", "accepted"]
    topics: list[str]


class Cancelled(BaseModel):
    id: int

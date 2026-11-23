"""What a saved state document must look like on the way in. The frontend checks the full shape on load (ADR 0012);
here the envelope is checked strictly and the size capped, so a document can't be anything but a versioned JSON object."""

from typing import Any

from pydantic import BaseModel, ConfigDict, Field

MAX_DOCUMENT_BYTES = 1_000_000


class StateDocument(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, frozen=True)

    version: int = Field(ge=1)
    state: dict[str, Any]

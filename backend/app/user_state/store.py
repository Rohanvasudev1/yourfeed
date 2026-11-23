"""Each signed-in user's state document in the database. Every read and write names its user; there is no other way in."""

import json
from dataclasses import dataclass
from typing import Any

from sqlalchemy import Engine
from sqlmodel import Session

from app.accounts.store import Now, utc_now
from app.user_state.document import StateDocument
from app.user_state.tables import UserState


@dataclass(frozen=True)
class StateStore:
    engine: Engine
    now: Now = utc_now

    def load(self, user_id: int) -> dict[str, Any] | None:
        """The user's saved document, or None before their first save."""
        with Session(self.engine) as db:
            row = db.get(UserState, user_id)
            return None if row is None else json.loads(row.document)

    def save(self, user_id: int, doc: StateDocument) -> None:
        """Replaces the user's document with `doc`."""
        with Session(self.engine) as db:
            row = db.get(UserState, user_id) or UserState(user_id=user_id, version=doc.version, document="", updated_at=self.now())
            row.version, row.document, row.updated_at = doc.version, doc.model_dump_json(), self.now()
            db.add(row)
            db.commit()

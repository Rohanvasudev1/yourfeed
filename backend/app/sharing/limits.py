"""Per-user daily counts for sharing: YouTube lookups spend the site's shared API quota, and failed sends could list usernames.
Kept in memory in fixed day windows, so they reset on restart, like the AI limits."""

import threading
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime

from app.accounts.store import Now

NO_ONE = "No one has that username."
# Usernames that weren't found, across Share and Blend: one cap so no one can list who's on Yourfeed by guessing.
MISSES_PER_DAY = 20
TOO_MANY_MISSES = "Too many usernames weren't found today. Try again tomorrow."


@dataclass
class DailyLimit:
    """At most `per_day` counted events per user each UTC day."""

    per_day: int
    now: Now
    _day: int = -1
    _counts: Counter[int] = field(default_factory=Counter)
    _lock: threading.Lock = field(default_factory=threading.Lock)

    def _roll(self, moment: datetime) -> None:
        day = moment.toordinal()
        if day != self._day:
            self._day, self._counts = day, Counter()

    def reached(self, user_id: int) -> bool:
        with self._lock:
            self._roll(self.now())
            return self._counts[user_id] >= self.per_day

    def count(self, user_id: int) -> None:
        with self._lock:
            self._roll(self.now())
            self._counts[user_id] += 1

    def take(self, user_id: int) -> bool:
        """Counts one event if the user has any left today; whether it was counted."""
        with self._lock:
            self._roll(self.now())
            if self._counts[user_id] >= self.per_day:
                return False
            self._counts[user_id] += 1
            return True

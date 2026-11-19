"""AI limits: how many requests a visitor and the whole site may send to the model (ADR 0006). Kept in memory, so they reset on restart."""

import threading
import time
from collections import Counter
from collections.abc import Callable, Mapping
from dataclasses import dataclass

SECONDS_PER_MINUTE = 60
SECONDS_PER_DAY = 24 * 60 * 60

Clock = Callable[[], float]


def _env_count(env: Mapping[str, str], name: str, default: int) -> int:
    raw = env.get(name, "").strip()
    if not raw:
        return default
    try:
        count = int(raw)
    except ValueError:
        count = -1
    if count < 0:
        raise ValueError(f"{name} must be a whole number of requests, got {raw!r}")
    return count


@dataclass(frozen=True)
class LimitConfig:
    """Requests per visitor IP per minute and per day, and for the whole site per day. Keep the site cap below the provider's free quota."""

    per_minute: int = 10
    per_day: int = 100
    site_per_day: int = 200

    @classmethod
    def from_env(cls, env: Mapping[str, str]) -> "LimitConfig":
        default = cls()
        return cls(
            per_minute=_env_count(env, "AI_LIMIT_PER_MINUTE", default.per_minute),
            per_day=_env_count(env, "AI_LIMIT_PER_DAY", default.per_day),
            site_per_day=_env_count(env, "AI_LIMIT_SITE_PER_DAY", default.site_per_day),
        )


class AiLimits:
    """Counts model requests in fixed minute and day windows. Old windows are dropped as soon as a new one starts."""

    def __init__(self, config: LimitConfig, clock: Clock = time.time) -> None:
        self._config = config
        self._clock = clock
        self._lock = threading.Lock()
        self._minute = -1
        self._day = -1
        self._per_minute: Counter[str] = Counter()
        self._per_day: Counter[str] = Counter()
        self._site_today = 0

    def _roll(self, now: float) -> None:
        minute, day = int(now // SECONDS_PER_MINUTE), int(now // SECONDS_PER_DAY)
        if minute != self._minute:
            self._minute, self._per_minute = minute, Counter()
        if day != self._day:
            self._day, self._per_day, self._site_today = day, Counter(), 0

    def take(self, visitor: str) -> bool:
        """Counts one model request for `visitor` and returns True, or returns False without counting when a limit is reached."""
        with self._lock:
            self._roll(self._clock())
            over = (
                self._per_minute[visitor] >= self._config.per_minute
                or self._per_day[visitor] >= self._config.per_day
                or self._site_today >= self._config.site_per_day
            )
            if over:
                return False
            self._per_minute[visitor] += 1
            self._per_day[visitor] += 1
            self._site_today += 1
            return True

"""Username rules (ADR 0013), the same as the frontend's `domain/username.ts`: 3–20 letters, numbers, dots or underscores.

Usernames are kept lowercase, so uniqueness ignores case.
"""

import re

MIN_LENGTH, MAX_LENGTH = 3, 20
PATTERN = re.compile(rf"[a-z0-9_.]{{{MIN_LENGTH},{MAX_LENGTH}}}")
INVALID = f"Usernames are {MIN_LENGTH}–{MAX_LENGTH} letters, numbers, dots or underscores"
TAKEN = "That username is taken. Try another."


def clean_username(typed: object) -> str | None:
    """The username as stored: trimmed, without a leading "@", lowercase. None when it breaks the rules."""
    if not isinstance(typed, str):
        return None
    name = typed.strip().removeprefix("@").lower()
    return name if PATTERN.fullmatch(name) else None

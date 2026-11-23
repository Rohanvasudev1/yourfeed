"""Random tokens, keyed hashes, PKCE, the signed login cookie and refresh-token encryption."""

import base64
import hashlib
import hmac
import json
import secrets
import time
from dataclasses import dataclass

from cryptography.fernet import Fernet

TOKEN_BYTES = 32
LOGIN_TTL_S = 10 * 60


def new_token() -> str:
    return secrets.token_urlsafe(TOKEN_BYTES)


def pkce_challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode()).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode()


@dataclass(frozen=True)
class Keys:
    """Everything derived from SESSION_SECRET and TOKEN_ENCRYPTION_KEY."""

    session_secret: str
    token_encryption_key: str

    def hash_session(self, token: str) -> str:
        return hmac.new(self.session_secret.encode(), f"session:{token}".encode(), hashlib.sha256).hexdigest()

    def encrypt(self, refresh_token: str) -> str:
        return Fernet(self.token_encryption_key.encode()).encrypt(refresh_token.encode()).decode()

    def decrypt(self, stored: str) -> str:
        return Fernet(self.token_encryption_key.encode()).decrypt(stored.encode()).decode()

    def sign_login(self, state: str, verifier: str, now: float | None = None) -> str:
        payload = base64.urlsafe_b64encode(json.dumps({"s": state, "v": verifier, "t": int(now or time.time())}).encode()).decode()
        return f"{payload}.{self._mac(payload)}"

    def open_login(self, cookie: str, now: float | None = None) -> tuple[str, str] | None:
        """The (state, verifier) a login cookie carries, or None if it's forged, malformed or older than 10 minutes."""
        payload, _, mac = cookie.partition(".")
        if not hmac.compare_digest(mac, self._mac(payload)):
            return None
        try:
            data = json.loads(base64.urlsafe_b64decode(payload.encode()))
            state, verifier, issued = data["s"], data["v"], data["t"]
        except (ValueError, KeyError, TypeError):
            return None
        if not (isinstance(state, str) and isinstance(verifier, str) and isinstance(issued, int)):
            return None
        if (now or time.time()) - issued > LOGIN_TTL_S:
            return None
        return state, verifier

    def _mac(self, payload: str) -> str:
        return hmac.new(self.session_secret.encode(), f"login:{payload}".encode(), hashlib.sha256).hexdigest()

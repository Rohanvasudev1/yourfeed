"""A stand-in for Google's OAuth endpoints: the auth API tests never reach the network."""

from dataclasses import dataclass, field

from app.accounts.google import GoogleError, GoogleGrant

GOOD_CODE = "good-code"
OTHER_CODE = "other-code"
NO_REFRESH_CODE = "no-refresh-code"


@dataclass
class Exchange:
    code: str
    redirect_uri: str
    code_verifier: str


@dataclass
class FakeGoogle:
    """Accepts the codes above; records every exchange and every revoked token."""

    grants: dict[str, GoogleGrant] = field(
        default_factory=lambda: {
            GOOD_CODE: GoogleGrant(subject="google-sub-1", refresh_token="refresh-1"),
            OTHER_CODE: GoogleGrant(subject="google-sub-2", refresh_token="refresh-2"),
            NO_REFRESH_CODE: GoogleGrant(subject="google-sub-1", refresh_token=None),
        }
    )
    revoke_fails: bool = False
    exchanges: list[Exchange] = field(default_factory=list)
    revoked: list[str] = field(default_factory=list)

    def authorization_url(self, *, redirect_uri: str, state: str, code_challenge: str) -> str:
        return f"https://accounts.example/auth?redirect_uri={redirect_uri}&state={state}&code_challenge={code_challenge}"

    def exchange(self, *, code: str, redirect_uri: str, code_verifier: str) -> GoogleGrant:
        self.exchanges.append(Exchange(code, redirect_uri, code_verifier))
        grant = self.grants.get(code)
        if grant is None:
            raise GoogleError("Google refused the code.")
        return grant

    def revoke(self, refresh_token: str) -> None:
        if self.revoke_fails:
            raise GoogleError("Google couldn't be reached.")
        self.revoked.append(refresh_token)

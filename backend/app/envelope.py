"""Every API response uses the same envelope: {success, data, error}."""

from typing import Any, Generic, TypeVar

from fastapi.responses import JSONResponse
from pydantic import BaseModel

T = TypeVar("T")


class Envelope(BaseModel, Generic[T]):
    success: bool
    data: T | None = None
    error: str | None = None


def ok(data: T) -> Envelope[T]:
    return Envelope(success=True, data=data)


def fail(status_code: int, message: str) -> JSONResponse:
    body: dict[str, Any] = {"success": False, "data": None, "error": message}
    return JSONResponse(status_code=status_code, content=body)

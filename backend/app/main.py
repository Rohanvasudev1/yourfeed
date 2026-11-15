import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError

from app.catalog import SignInRequired, Source, Video, load_catalog
from app.envelope import Envelope, fail, ok

log = logging.getLogger("yourfeed")


def _describe(exc: RequestValidationError) -> str:
    return "; ".join(f"{'.'.join(str(p) for p in e['loc'][1:])}: {e['msg']}" for e in exc.errors())


def create_app() -> FastAPI:
    app = FastAPI(title="Yourfeed API")

    @app.exception_handler(RequestValidationError)
    async def on_invalid(_: Request, exc: RequestValidationError):
        return fail(422, _describe(exc))

    @app.exception_handler(SignInRequired)
    async def on_sign_in_required(_: Request, exc: SignInRequired):
        return fail(401, str(exc))

    @app.get("/api/health", response_model=Envelope[dict[str, str]])
    def health():
        return ok({"status": "ok"})

    @app.get("/api/catalog", response_model=Envelope[list[Video]], response_model_by_alias=True)
    def catalog(source: Source = Source.DEMO):
        return ok(list(load_catalog(source)))

    return app


app = create_app()

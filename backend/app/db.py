"""The database (ADR 0002): SQLite locally and in tests, Postgres when hosted. Alembic migrations own the schema."""

from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import Engine, event
from sqlmodel import create_engine

MIGRATIONS = Path(__file__).resolve().parent.parent / "migrations"


def make_engine(url: str) -> Engine:
    if not url.startswith("sqlite"):
        return create_engine(url, pool_pre_ping=True)
    engine = create_engine(url, connect_args={"check_same_thread": False})

    # SQLite enforces foreign keys (and their ON DELETE CASCADE) only when asked, per connection.
    @event.listens_for(engine, "connect")
    def _foreign_keys(dbapi_connection, _record):
        dbapi_connection.execute("PRAGMA foreign_keys=ON")

    return engine


def migrate(engine: Engine) -> None:
    """Brings the schema up to the newest migration."""
    config = Config()
    config.set_main_option("script_location", str(MIGRATIONS))
    with engine.begin() as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "head")

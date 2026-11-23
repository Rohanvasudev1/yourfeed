"""The Alembic migrations build exactly the tables the models declare, so a model change can't ship without its migration."""

from pathlib import Path

from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlmodel import SQLModel

import app.accounts.tables  # noqa: F401
from app.db import make_engine, migrate


def test_migrations_match_the_models(tmp_path: Path):
    engine = make_engine(f"sqlite:///{tmp_path / 'm.db'}")
    migrate(engine)
    with engine.connect() as connection:
        assert compare_metadata(MigrationContext.configure(connection), SQLModel.metadata) == []


def test_migrating_twice_changes_nothing(tmp_path: Path):
    engine = make_engine(f"sqlite:///{tmp_path / 'm.db'}")
    migrate(engine)
    migrate(engine)

"""Alembic's entry point. The app passes its own connection; the CLI builds one from DATABASE_URL."""

import os

from alembic import context
from sqlmodel import SQLModel

import app.accounts.tables  # noqa: F401  (registers the tables on SQLModel.metadata)
from app.accounts.config import DEFAULT_DATABASE_URL
from app.db import make_engine

target_metadata = SQLModel.metadata


def run_migrations() -> None:
    connection = context.config.attributes.get("connection")
    if connection is not None:
        _run(connection)
        return
    with make_engine(os.environ.get("DATABASE_URL") or DEFAULT_DATABASE_URL).begin() as own:
        _run(own)


def _run(connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata, render_as_batch=True)
    with context.begin_transaction():
        context.run_migrations()


run_migrations()

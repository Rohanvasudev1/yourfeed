"""topic searches

Revision ID: 0007_topic_searches
Revises: 0006_blends
Create Date: 2026-11-23
"""

import sqlalchemy as sa
from alembic import op

revision = "0007_topic_searches"
down_revision = "0006_blends"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "topic_search_cache",
        sa.Column("topic", sa.String(), primary_key=True),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("videos", sa.Text(), nullable=False),
    )
    op.create_index("ix_topic_search_cache_fetched_at", "topic_search_cache", ["fetched_at"])
    op.create_table(
        "search_budget",
        sa.Column("day", sa.Date(), primary_key=True),
        sa.Column("calls", sa.Integer(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("search_budget")
    op.drop_index("ix_topic_search_cache_fetched_at", table_name="topic_search_cache")
    op.drop_table("topic_search_cache")

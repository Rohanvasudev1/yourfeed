"""channel cache

Revision ID: 0003_channel_cache
Revises: 0002_user_state
Create Date: 2026-11-23
"""

import sqlalchemy as sa
from alembic import op

revision = "0003_channel_cache"
down_revision = "0002_user_state"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "channel_cache",
        sa.Column("channel_id", sa.String(), primary_key=True),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("videos", sa.Text(), nullable=False),
    )
    op.create_index("ix_channel_cache_fetched_at", "channel_cache", ["fetched_at"])


def downgrade() -> None:
    op.drop_index("ix_channel_cache_fetched_at", table_name="channel_cache")
    op.drop_table("channel_cache")

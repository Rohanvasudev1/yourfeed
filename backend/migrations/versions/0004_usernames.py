"""usernames

Revision ID: 0004_usernames
Revises: 0003_channel_cache
Create Date: 2026-11-23
"""

import sqlalchemy as sa
from alembic import op

revision = "0004_usernames"
down_revision = "0003_channel_cache"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.add_column(sa.Column("username", sa.String(length=20), nullable=True))
        batch.create_index("ix_users_username", ["username"], unique=True)


def downgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.drop_index("ix_users_username")
        batch.drop_column("username")

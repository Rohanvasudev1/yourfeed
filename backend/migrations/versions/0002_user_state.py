"""user state

Revision ID: 0002_user_state
Revises: 0001_users_and_sessions
Create Date: 2026-11-23
"""

import sqlalchemy as sa
from alembic import op

revision = "0002_user_state"
down_revision = "0001_users_and_sessions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_states",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("document", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("user_states")

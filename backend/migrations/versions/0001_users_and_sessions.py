"""users and sessions

Revision ID: 0001_users_and_sessions
Revises:
Create Date: 2026-11-23
"""

import sqlalchemy as sa
from alembic import op

revision = "0001_users_and_sessions"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("google_subject", sa.String(), nullable=False),
        sa.Column("refresh_token", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_users_google_subject", "users", ["google_subject"], unique=True)
    op.create_table(
        "sessions",
        sa.Column("token_hash", sa.String(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("csrf_token", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_sessions_user_id", "sessions", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_sessions_user_id", table_name="sessions")
    op.drop_table("sessions")
    op.drop_index("ix_users_google_subject", table_name="users")
    op.drop_table("users")

"""blends

Revision ID: 0006_blends
Revises: 0005_inbox
Create Date: 2026-11-23
"""

import sqlalchemy as sa
from alembic import op

revision = "0006_blends"
down_revision = "0005_inbox"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "blends",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("inviter_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("invitee_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("inviter_topics", sa.Text(), nullable=False),
        sa.Column("invitee_topics", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_blends_inviter_id", "blends", ["inviter_id"])
    op.create_index("ix_blends_invitee_id", "blends", ["invitee_id"])
    op.create_index("ix_blends_status", "blends", ["status"])
    op.create_index("ix_blends_created_at", "blends", ["created_at"])


def downgrade() -> None:
    op.drop_table("blends")

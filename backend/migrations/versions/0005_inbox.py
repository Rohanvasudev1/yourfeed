"""inbox

Revision ID: 0005_inbox
Revises: 0004_usernames
Create Date: 2026-11-23
"""

import sqlalchemy as sa
from alembic import op

revision = "0005_inbox"
down_revision = "0004_usernames"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "inbox_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("recipient_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sender_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("share", sa.Text(), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_inbox_items_recipient_id", "inbox_items", ["recipient_id"])
    op.create_index("ix_inbox_items_sender_id", "inbox_items", ["sender_id"])
    op.create_index("ix_inbox_items_sent_at", "inbox_items", ["sent_at"])


def downgrade() -> None:
    op.drop_table("inbox_items")

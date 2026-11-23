"""The checks the model eval script grades answers with. The script itself calls a real model, so only its checks run here."""

import pytest

from app.assistant.model import MAX_FOLLOW_UPS, MAX_UP_NEXT, AssistantRequest
from scripts.eval_model import CASES, _args, replies_with_a_pin_claim, replies_without_a_pin_claim
from tests.assistant_helpers import request


@pytest.mark.parametrize(
    ("reply", "claims"),
    [
        ("It was pinned to the top.", True),
        ("You added it yourself, so it's first.", True),
        ('"Build an AI agent" matches AI in this feed.', False),
        ("It's the newest upload from Agent Workshop.", False),
    ],
)
def test_a_why_first_answer_is_graded_on_whether_it_claims_a_pin(reply, claims):
    assert replies_with_a_pin_claim([], reply) is claims
    assert replies_without_a_pin_claim([], reply) is not claims


def test_a_why_first_answer_that_changes_the_feed_fails_both_ways():
    actions = [{"type": "pin_video", "id": "demo-0"}]
    assert not replies_with_a_pin_claim(actions, "Pinned it.")
    assert not replies_without_a_pin_claim(actions, "Done.")


def test_two_part_requests_need_both_parts():
    case = next(c for c in CASES if c.text.startswith("add travel and"))
    travel = {"type": "set_topics", "add": ["Travel"], "remove": []}
    assert not case.check([travel], None)
    assert case.check([travel, {"type": "set_length_range", "min": 1, "max": 15}], None)


def test_the_eval_is_paced_by_default_and_refuses_negative_waits():
    assert _args([]).delay > 0
    assert _args(["--delay", "0"]).delay == 0
    with pytest.raises(SystemExit):
        _args(["--delay", "-1"])


def test_follow_up_cases_send_valid_follow_ups_and_the_largest_case_comes_last():
    follow_up_cases = [c for c in CASES if c.follow_ups]
    assert len(follow_up_cases) >= 3
    largest = CASES[-1]
    assert len(largest.follow_ups) == MAX_FOLLOW_UPS
    assert len(largest.context["upNext"]) == MAX_UP_NEXT
    for case in follow_up_cases:
        AssistantRequest.model_validate({**request(case.text, mode=case.mode, **case.context), "followUps": [dict(f) for f in case.follow_ups]})


def test_a_follow_up_that_adds_must_keep_what_the_earlier_line_added():
    case = next(c for c in CASES if c.text == "and travel too")
    travel = {"type": "set_topics", "add": ["Travel"], "remove": []}
    assert case.check([travel], None)
    assert not case.check([{"type": "set_topics", "add": ["Travel"], "remove": ["Cooking"]}], None)

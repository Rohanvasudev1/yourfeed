"""Which assistant answers: the model when it can, the keyword rules when it can't (ADR 0006), through the API."""

import threading

import pytest
from fastapi.testclient import TestClient

from app.assistant.fake import ScriptedAssistant
from app.assistant.limits import LimitConfig
from app.main import create_app
from tests.assistant_helpers import request

COOKING = {"type": "set_topics", "add": ["Cooking"], "remove": []}
RULES_COOKING = [COOKING]
MODEL_TENNIS = {"type": "set_topics", "add": ["Tennis"], "remove": []}
BUSY = "Using simple rules for now. AI is busy."


class FakeClock:
    def __init__(self, now: float = 1_800_000_000.0) -> None:
        self.now = now

    def __call__(self) -> float:
        return self.now


def ask(client: TestClient, text: str = "add cooking") -> dict:
    res = client.post("/api/assistant/request", json=request(text))
    assert res.status_code == 200, res.text
    return res.json()["data"]


def visitor(app, ip: str) -> TestClient:
    return TestClient(app, client=(ip, 50000))


def test_with_no_model_set_up_the_rules_answer_without_a_notice():
    body = ask(TestClient(create_app()))
    assert body["answeredBy"] == "rules"
    assert body["actions"] == RULES_COOKING
    assert body["notice"] is None


def test_the_model_answers_when_it_is_set_up():
    body = ask(TestClient(create_app(assistant=ScriptedAssistant(actions=[MODEL_TENNIS]))))
    assert body["answeredBy"] == "model"
    assert body["actions"] == [MODEL_TENNIS]
    assert body["notice"] is None


def test_a_provider_error_falls_back_to_the_rules_with_the_notice():
    failing = ScriptedAssistant(error=RuntimeError("provider is down"))
    body = ask(TestClient(create_app(assistant=failing)))
    assert body == {"actions": RULES_COOKING, "reply": None, "answeredBy": "rules", "notice": BUSY}


def test_a_model_that_takes_too_long_falls_back_to_the_rules():
    release = threading.Event()
    hanging = ScriptedAssistant(actions=[MODEL_TENNIS], hang_until=release)
    try:
        body = ask(TestClient(create_app(assistant=hanging, timeout=0.05)))
    finally:
        release.set()
    assert body["answeredBy"] == "rules"
    assert body["actions"] == RULES_COOKING
    assert body["notice"] == BUSY


def test_a_visitor_past_the_per_minute_limit_gets_the_rules_until_the_minute_is_up():
    clock = FakeClock()
    app = create_app(assistant=ScriptedAssistant(actions=[MODEL_TENNIS]), limits=LimitConfig(per_minute=2, per_day=100, site_per_day=100), clock=clock)
    me = visitor(app, "10.0.0.1")
    assert [ask(me)["answeredBy"] for _ in range(3)] == ["model", "model", "rules"]
    assert ask(me)["notice"] == BUSY

    clock.now += 60
    assert ask(me) == {"actions": [MODEL_TENNIS], "reply": None, "answeredBy": "model", "notice": None}


def test_one_visitors_limit_doesnt_touch_another_visitor():
    app = create_app(assistant=ScriptedAssistant(actions=[MODEL_TENNIS]), limits=LimitConfig(per_minute=1, per_day=100, site_per_day=100))
    me, you = visitor(app, "10.0.0.1"), visitor(app, "10.0.0.2")
    ask(me)
    assert ask(me)["answeredBy"] == "rules"
    assert ask(you)["answeredBy"] == "model"


def test_a_visitor_past_the_daily_limit_gets_the_rules_until_the_next_day():
    clock = FakeClock()
    app = create_app(assistant=ScriptedAssistant(actions=[MODEL_TENNIS]), limits=LimitConfig(per_minute=100, per_day=3, site_per_day=100), clock=clock)
    me = visitor(app, "10.0.0.1")
    for _ in range(3):
        assert ask(me)["answeredBy"] == "model"
        clock.now += 61
    assert ask(me)["notice"] == BUSY

    clock.now += 24 * 60 * 60
    assert ask(me)["answeredBy"] == "model"


def test_the_site_wide_daily_cap_switches_everyone_to_the_rules():
    clock = FakeClock()
    app = create_app(assistant=ScriptedAssistant(actions=[MODEL_TENNIS]), limits=LimitConfig(per_minute=100, per_day=100, site_per_day=2), clock=clock)
    assert ask(visitor(app, "10.0.0.1"))["answeredBy"] == "model"
    assert ask(visitor(app, "10.0.0.2"))["answeredBy"] == "model"
    body = ask(visitor(app, "10.0.0.3"))
    assert body["answeredBy"] == "rules"
    assert body["notice"] == BUSY

    clock.now += 24 * 60 * 60
    assert ask(visitor(app, "10.0.0.3"))["answeredBy"] == "model"


def test_requests_answered_by_the_rules_past_a_limit_never_reach_the_model():
    fake = ScriptedAssistant(actions=[MODEL_TENNIS])
    me = visitor(create_app(assistant=fake, limits=LimitConfig(per_minute=1, per_day=100, site_per_day=100)), "10.0.0.1")
    ask(me)
    ask(me)
    assert len(fake.calls) == 1


def test_info_names_the_rules_when_no_model_is_set_up():
    res = TestClient(create_app()).get("/api/assistant/info")
    assert res.status_code == 200
    assert res.json()["data"] == {"answeredBy": "rules", "provider": None, "model": None}


def test_info_names_the_model_and_provider():
    fake = ScriptedAssistant(model_name="gpt-oss-20b", provider="Groq")
    res = TestClient(create_app(assistant=fake)).get("/api/assistant/info")
    assert res.json()["data"] == {"answeredBy": "model", "provider": "Groq", "model": "gpt-oss-20b"}


def test_limits_are_set_by_environment_variables():
    env = {"AI_LIMIT_PER_MINUTE": "5", "AI_LIMIT_PER_DAY": "50", "AI_LIMIT_SITE_PER_DAY": "400"}
    assert LimitConfig.from_env(env) == LimitConfig(per_minute=5, per_day=50, site_per_day=400)
    assert LimitConfig.from_env({}) == LimitConfig()


def test_a_limit_that_isnt_a_whole_number_stops_the_server_at_startup():
    with pytest.raises(ValueError, match="AI_LIMIT_PER_DAY"):
        LimitConfig.from_env({"AI_LIMIT_PER_DAY": "lots"})

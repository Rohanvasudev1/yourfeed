"""The Ask in notes endpoint: a video id and a question in, one short answer out."""

import pytest
from fastapi.testclient import TestClient

from app.assistant.fake import ScriptedAssistant
from app.assistant.rules import KeywordRules
from app.main import create_app

AGENT_VIDEO = "demo-0"  # "Build an AI agent with tool use, step by step", AI, Agent Workshop, 34 min, 34K subscribers


def ask(client: TestClient, question: str, video_id: str = AGENT_VIDEO):
    return client.post("/api/assistant/answer", json={"videoId": video_id, "question": question})


def answer_from_rules(question: str, video_id: str = AGENT_VIDEO) -> str:
    res = ask(TestClient(create_app(assistant=KeywordRules())), question, video_id)
    assert res.status_code == 200
    body = res.json()["data"]
    assert body["answeredBy"] == "rules"
    return body["answer"]


def test_returns_the_assistants_answer_in_the_envelope():
    fake = ScriptedAssistant(answer="An agent runs a model in a loop.")
    res = ask(TestClient(create_app(assistant=fake)), "What is an agent?")
    assert res.status_code == 200
    assert res.json() == {
        "success": True,
        "data": {"answer": "An agent runs a model in a loop.", "answeredBy": "model"},
        "error": None,
    }


def test_the_assistant_sees_the_trimmed_question_and_the_catalog_video():
    fake = ScriptedAssistant()
    ask(TestClient(create_app(assistant=fake)), "  What is an agent?  ")
    [(question, video)] = fake.questions
    assert question == "What is an agent?"
    assert (video.id, video.channel, video.minutes) == (AGENT_VIDEO, "Agent Workshop", 34)


def test_answers_are_one_line():
    fake = ScriptedAssistant(answer="First line.\n\n  Second line.")
    body = ask(TestClient(create_app(assistant=fake)), "What is this?").json()["data"]
    assert body["answer"] == "First line. Second line."


def test_an_unknown_video_is_not_found():
    fake = ScriptedAssistant()
    res = ask(TestClient(create_app(assistant=fake)), "What is this?", video_id="no-such-video")
    assert res.status_code == 404
    assert res.json() == {"success": False, "data": None, "error": "That video isn't in the catalog."}
    assert fake.questions == []


@pytest.mark.parametrize("question", ["", "  ", "a?", "x" * 300 + "?"])
def test_questions_outside_3_to_300_characters_are_rejected(question):
    fake = ScriptedAssistant()
    res = ask(TestClient(create_app(assistant=fake)), question)
    assert res.status_code == 422
    assert "question" in res.json()["error"]
    assert fake.questions == []


def test_a_300_character_question_is_accepted():
    assert ask(TestClient(create_app(assistant=ScriptedAssistant())), "x" * 299 + "?").status_code == 200


@pytest.mark.parametrize(
    ("question", "expected"),
    [
        ("Who made this?", "It's from Agent Workshop, a channel with 34K subscribers. I only know the channel's topic (AI), not who's on screen."),
        ("How long is it?", "It's 34 minutes long. I can't see how far in you are."),
        ("What is tool use?", "Tool use means the model can ask the app to run a function (search, a calculator, an API) and then read the result before answering."),
        ("What's an agent?", "An agent is an AI model running in a loop: it decides on a step, uses a tool, looks at the result, and repeats until the task is done."),
        ("What is MCP?", "MCP (Model Context Protocol) is an open standard that lets an AI app like Claude connect to outside tools and data through 'servers' that expose tools."),
    ],
)
def test_the_rules_answer_from_the_video_and_the_glossary(question, expected):
    assert answer_from_rules(question) == expected


def test_the_rules_summarise_from_the_honest_title():
    answer = answer_from_rules("What's the gist?", video_id="demo-3")
    assert answer.startswith("Going by the title, it's about this: A framework for planning the next five years of your career.")


def test_the_rules_say_what_they_cant_know_when_nothing_matches():
    answer = answer_from_rules("What happens at minute 12?")
    assert answer.endswith("I can only see the title, channel and topic, not what's said or shown in the video.")


def test_the_rules_explain_why_a_video_is_recommended():
    assert answer_from_rules("Why was this recommended?") == (
        "It's about AI, so it matched one of this feed's topics, your watch history or what's popular."
    )

"""The real YouTube adapter at its edges, against the recorded API: limits, batching and answers it can't trust."""

import httpx
import pytest

from app.youtube.client import Channel, YouTubeError
from app.youtube.http import HttpYouTubeClient
from tests.fake_youtube import FakeYouTube


def client_answering(body: object, status: int = 200) -> HttpYouTubeClient:
    respond = (lambda _: httpx.Response(status, json=body)) if not isinstance(body, str) else (lambda _: httpx.Response(status, text=body))
    return HttpYouTubeClient("key", httpx.Client(transport=httpx.MockTransport(respond)))


def test_subscriptions_stop_at_the_limit_without_reading_more_pages():
    youtube = FakeYouTube()
    assert youtube.client().subscriptions("access-1", 1) == ["UC_rust"]
    assert youtube.calls("subscriptions") == 1


def test_more_than_fifty_ids_in_one_call_is_refused_before_asking():
    with pytest.raises(ValueError):
        FakeYouTube().client().videos([f"v{i}" for i in range(51)])


def test_a_channel_without_an_uploads_playlist_asks_nothing():
    youtube = FakeYouTube()
    assert youtube.client().uploads(Channel("UC_x", "X", 0, None, ()), 10) == []
    assert youtube.requests == []


def test_an_answer_that_isnt_json_reads_as_unavailable():
    with pytest.raises(YouTubeError, match="couldn't be reached"):
        client_answering("<html>").videos(["a"])


@pytest.mark.parametrize("body", [{"items": "nope"}, [], {"items": [{"id": "a"}, 7]}])
def test_malformed_items_are_left_out(body):
    assert client_answering(body).videos(["a"]) == []
    assert client_answering(body).channels(["a"]) == []


def test_a_malformed_subscriptions_page_reads_as_none():
    assert client_answering({"items": 3}).subscriptions("t", 10) == []


def test_search_keeps_only_videos_and_reads_a_malformed_answer_as_none():
    body = {"items": [{"id": {"kind": "youtube#channel", "channelId": "UC_x"}}, {"id": {"kind": "youtube#video", "videoId": "v1"}}]}
    assert client_answering(body).search("Jazz", 10) == ["v1"]
    assert client_answering({"items": "nope"}).search("Jazz", 10) == []

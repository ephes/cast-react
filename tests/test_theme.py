import json
import re

import pytest
from cast import devdata
from cast.models import Audio, Blog, ChapterMark
from cast.models.theme import get_required_template_names, get_template_base_dir_choices
from django.apps import apps
from django.template.loader import get_template, render_to_string
from wagtail.models import Site

import cast_react

THEME = "react"


@pytest.fixture
def podcast(db):
    """A podcast that uses the React theme, with one episode that has audio, a chapter and a transcript."""
    site = Site.objects.get(is_default_site=True)
    user = devdata.create_user(name="mara")
    podcast = devdata.create_podcast(owner=user, site=site)
    podcast.template_base_dir = THEME
    podcast.description = "<p>About the <b>show</b></p>"
    podcast.save()
    audio = Audio(user=user, title="Test audio", mp3=devdata.create_mp3_file())
    audio.save(duration=False, cache_file_sizes=False)
    ChapterMark.objects.create(audio=audio, start="00:00:10", title="Second chapter")
    devdata.create_transcript(
        audio=audio,
        podlove={"transcripts": [{"start": "00:00:01.000", "start_ms": 1000, "end_ms": 3000, "text": "Hello."}]},
    )
    body = devdata.add_audio_to_body(body=devdata.create_python_body(), audio=audio)
    episode = devdata.create_episode(blog=podcast, body=json.dumps(body), podcast_audio=audio)
    return podcast, episode, audio


def configuration(html: str) -> dict[str, str]:
    tag = re.search(r'<script id="cast-react-configuration"[^>]*>', html, re.DOTALL)
    assert tag is not None, "configuration element missing"
    return dict(re.findall(r'data-([a-z-]+)="([^"]*)"', tag.group(0)))


def test_app_config():
    assert apps.get_app_config("cast_react").name == "cast_react"
    assert cast_react.__version__


def test_theme_is_discovered():
    assert THEME in dict(get_template_base_dir_choices())


@pytest.mark.parametrize("name", get_required_template_names())
def test_required_templates_exist(name):
    get_template(f"cast/{THEME}/{name}")


@pytest.mark.parametrize("name", ["400.html", "403.html", "403_csrf.html", "404.html", "500.html"])
def test_error_pages_render_without_context(name):
    html = render_to_string(f"cast/{THEME}/{name}")
    assert "<h1>" in html
    assert "cast-react-configuration" not in html


def test_blog_index_configures_the_app(client, podcast):
    blog, _episode, _audio = podcast
    response = client.get(blog.url)
    assert response.status_code == 200
    html = response.content.decode()
    assert response.templates[0].name == f"cast/{THEME}/blog_list_of_posts.html"
    data = configuration(html)
    assert data["route-name"] == "PostList"
    assert data["blog-url"] == blog.url
    assert data["blog-id"] == str(blog.pk)
    assert data["blog-title"] == blog.title
    assert data["wagtail-api-pages-url"] == "/cast/api/wagtail/pages/"
    assert data["api-facet-counts-url"].startswith("/cast/api/facet_counts/")
    assert data["csrf-token"]
    assert int(data["pagination-page-size"]) > 0
    assert '<div id="app"></div>' in html
    assert '<template id="cast-react-blog-description"><p>About the <b>show</b></p></template>' in html
    # The production bundle from the committed manifest.
    assert re.search(r'src="/static/cast_react/main-[\w-]+\.js"', html)
    assert re.search(r'href="/static/cast_react/main-[\w-]+\.css"', html)


def test_episode_page_configures_the_detail_route(client, podcast):
    _blog, episode, _audio = podcast
    response = client.get(episode.url)
    assert response.status_code == 200
    html = response.content.decode()
    data = configuration(html)
    assert data["route-name"] == "PostDetail"
    assert data["post-slug"] == episode.slug
    assert data["page-type"] == "cast.Episode"
    assert f"<title>{episode.title}</title>" in html
    assert 'rel="canonical"' in html
    assert 'property="og:audio"' in html


def api_item(client, blog: Blog, **params) -> dict:
    query = {
        "child_of": blog.pk,
        "type": "cast.Post",
        "use_post_filter": "true",
        "render_for_feed": "false",
        **params,
    }
    response = client.get("/cast/api/wagtail/pages/", query)
    assert response.status_code == 200, response.content
    items = response.json()["items"]
    assert len(items) == 1
    return items[0]


def player_payload(html: str, audio_pk: int) -> dict:
    script = re.search(rf'<script id="cast-player-data-{audio_pk}" type="application/json">(.*?)</script>', html, re.S)
    assert script is not None, "player payload missing"
    return json.loads(script.group(1))


def test_api_overview_html_carries_article_data_and_player_payload(client, podcast):
    blog, _episode, audio = podcast
    item = api_item(client, blog, fields="html_overview")
    html = item["html_overview"]
    assert 'class="cast-react-article-data"' in html
    assert "data-article-date-time=" in html
    payload = player_payload(html, audio.pk)
    assert payload["audioId"] == audio.pk
    assert payload["sources"]
    assert {"start": 10, "title": "Second chapter"} in payload["chapters"]
    assert payload["transcript"]["url"].endswith(
        f"/cast/api/audios/{audio.pk}/player-transcript/?post_id={item['id']}"
    )
    assert "only_in_detail" not in html


def test_api_detail_html_and_transcript_endpoint(client, podcast):
    blog, episode, audio = podcast
    item = api_item(client, blog, slug=episode.slug, fields="html_detail,comments,comments_are_enabled")
    assert "only_in_detail" in item["html_detail"]
    payload = player_payload(item["html_detail"], audio.pk)
    cues = client.get(payload["transcript"]["url"]).json()["cues"]
    assert [cue["text"] for cue in cues] == ["Hello."]


def test_feed_rendering_has_no_player_markup(client, podcast):
    blog, _episode, _audio = podcast
    # Without render_for_feed=false the API renders posts as it does for feeds.
    response = client.get(
        "/cast/api/wagtail/pages/",
        {"child_of": blog.pk, "type": "cast.Post", "fields": "html_overview"},
    )
    html = response.json()["items"][0]["html_overview"]
    assert "cast-player-data" not in html
    assert "cast-audio-player" not in html


def test_facet_counts_api_shape(client, podcast):
    blog, _episode, _audio = podcast
    response = client.get(blog.facet_counts_api_url)
    assert response.status_code == 200
    assert {"date_facets", "category_facets", "tag_facets"} <= set(response.json()["facet_counts"])

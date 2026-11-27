import json
import re
from html import unescape
from types import SimpleNamespace

import pytest
from cast import devdata
from cast.models import Audio, Blog, ChapterMark, Episode
from cast.models.theme import get_required_template_names, get_template_base_dir_choices
from django.apps import apps
from django.http import HttpResponse
from django.template import Context, engines
from django.template.loader import get_template, render_to_string
from django.urls import include, path, reverse
from wagtail.models import PageViewRestriction, Site

import cast_react
from cast_react.templatetags.cast_react_tags import cast_react_subscribe

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


def subscribe_json(html: str) -> dict:
    script = re.search(r'<script id="cast-react-subscribe" type="application/json">(.*?)</script>', html, re.DOTALL)
    assert script is not None, "subscription configuration missing"
    return json.loads(script[1])


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
    feed_page = reverse("cast:feed_detail", kwargs={"slug": blog.slug})
    assert data["feed-url"] == feed_page
    assert subscribe_json(html)["feedPageUrl"] == f"http://testserver{feed_page}"
    assert subscribe_json(html)["isPodcast"] is True
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
    assert subscribe_json(html)["isPodcast"] is True


@pytest.mark.parametrize("inherited", [False, True])
def test_restricted_podcast_hides_subscription_links(client, podcast, settings, inherited):
    blog, episode, _audio = podcast
    PageViewRestriction.objects.create(
        page=blog.get_parent() if inherited else blog, restriction_type=PageViewRestriction.LOGIN
    )
    settings.CAST_FOLLOW_LINKS = {
        "apple_podcasts": "https://podcasts.apple.com/us/podcast/demo/id1234",
        "mastodon": "https://social.example/@show",
    }
    client.force_login(blog.owner)

    for url in (blog.url, episode.url):
        response = client.get(url)
        assert response.status_code == 200
        html = response.content.decode()
        assert configuration(html)["feed-url"] == ""
        data = subscribe_json(html)
        assert data["feedPageUrl"] == data["podcastRssUrl"] == data["blogRssUrl"] == ""
        assert data["platformLinks"] == []
        assert data["followLinks"] == [{"label": "Mastodon", "url": "https://social.example/@show", "rel": "me"}]
        assert 'type="application/rss+xml"' not in html

    for name, kwargs in (
        ("feed_detail", {}),
        ("latest_entries_feed", {}),
        ("podcast_feed_rss", {"audio_format": "mp3"}),
    ):
        url = reverse(f"cast:{name}", kwargs={"slug": blog.slug, **kwargs})
        assert client.get(url).status_code == 404


def test_subscribe_tag_uses_the_specific_podcast_and_derives_apps(rf, podcast):
    blog, _, _ = podcast
    request = rf.get("/preview/?theme=react", secure=True)
    data = cast_react_subscribe(
        Context(
            {
                "blog": Blog.objects.get(pk=blog.pk),
                "request": request,
                "follow_links": {
                    "spotify": "javascript:alert(1)",
                    "youtube": "//untrusted.example/youtube",
                    "mastodon": "https://social.example/@show",
                    "github": "https://[bad",
                    "bluesky": "/bad path",
                    "linkedin": "mailto:placeholder@example.org",
                    "email": "mailto:host@example.org",
                },
                "apple_podcasts_url": "https://podcasts.apple.com/us/podcast/demo/id1234?i=5678",
                "spotify_url": "/listen/",
            }
        )
    )
    assert data["isPodcast"] is True
    feed_page = reverse("cast:feed_detail", kwargs={"slug": blog.slug})
    assert data["feedPageUrl"] == f"https://testserver{feed_page}?theme=react"
    rss = reverse("cast:podcast_feed_rss", kwargs={"slug": blog.slug, "audio_format": "mp3"})
    assert data["podcastRssUrl"] == f"https://testserver{rss}"
    assert {link["id"]: link["url"] for link in data["platformLinks"]} == {
        "apple_podcasts": "https://podcasts.apple.com/us/podcast/demo/id1234?i=5678",
        "overcast": "https://overcast.fm/itunes1234",
        "pocket_casts": "https://pca.st/itunes/1234",
        "spotify": "https://testserver/listen/",
        "castro": "https://castro.fm/itunes/1234",
    }
    assert data["followLinks"] == [
        {"label": "Mastodon", "url": "https://social.example/@show", "rel": "me"},
        {"label": "E-mail", "url": "mailto:host@example.org", "rel": ""},
    ]


@pytest.mark.parametrize("path", ["/show?target=/id1234", "/show/notid1234", "/show/id1234-extra"])
def test_subscribe_tag_requires_an_apple_id_path_segment(path):
    data = cast_react_subscribe(
        Context(
            {
                "blog": SimpleNamespace(is_podcast=True),
                "follow_links": {"apple_podcasts": f"https://podcasts.apple.com{path}"},
            }
        )
    )
    assert [link["id"] for link in data["platformLinks"]] == ["apple_podcasts"]


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


def test_api_post_body_renders_overview_and_detail_in_the_right_fields(client, podcast):
    blog, episode, _audio = podcast
    item = api_item(client, blog, slug=episode.slug, fields="html_overview,html_detail")
    overview, detail = item["html_overview"], item["html_detail"]
    for html in (overview, detail):
        assert '<section class="block-overview">' in html
        assert "in_all heading" in html
    assert '<section class="block-detail">' not in overview
    assert "only_in_detail heading" not in overview
    assert '<section class="block-detail">' in detail
    assert "only_in_detail heading" in detail


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


def test_episode_audio_without_audio_block_still_has_a_player(client, podcast):
    blog, episode, audio = podcast
    episode.body = json.dumps(devdata.create_python_body())
    episode.save()
    item = api_item(client, blog, slug=episode.slug, type="cast.Episode", fields="html_detail")
    assert player_payload(item["html_detail"], audio.pk)["audioId"] == audio.pk


def test_theme_parameter_selects_this_theme_for_api_html(client, podcast):
    blog, _episode, _audio = podcast
    blog.template_base_dir = "plain"
    blog.save()
    assert "cast-react-article-data" not in api_item(client, blog, fields="html_overview")["html_overview"]
    assert "cast-react-article-data" in api_item(client, blog, fields="html_overview", theme=THEME)["html_overview"]


def test_preview_renders_the_draft_into_the_page(client, podcast):
    _blog, episode, _audio = podcast
    episode.title = "Unsaved title"
    response = episode.make_preview_request()
    response.render()
    html = response.content.decode()
    preview = re.search(r'<template id="cast-react-preview" data-title="Unsaved title">(.*?)</template>', html, re.S)
    assert preview is not None
    assert "only_in_detail" in preview.group(1)
    # The published page carries no draft.
    assert "cast-react-preview" not in client.get(episode.url).content.decode()


def unsaved_draft(blog, owner, *, podcast_audio=None, body=None):
    # As Wagtail's "preview on create" does: an unsaved page placed below its parent.
    draft = Episode(
        title="Brand new",
        slug="brand-new",
        owner=owner,
        podcast_audio=podcast_audio,
        body=json.dumps(body or devdata.create_python_body()),
    )
    draft.depth = blog.depth + 1
    draft.path = blog.get_last_child()._inc_path()
    response = draft.make_preview_request()
    response.render()
    preview = re.search(
        r'<template id="cast-react-preview" data-title="Brand new">(.*?)</template>', response.content.decode(), re.S
    )
    assert preview is not None
    return preview.group(1)


def test_preview_of_a_never_saved_episode_has_its_episode_player(podcast):
    blog, episode, audio = podcast
    html = unsaved_draft(blog, episode.owner, podcast_audio=audio)
    assert f'id="cast-player-data-{audio.pk}"' in html
    assert "data-no-transcripts" in html


def test_preview_of_a_never_saved_post_has_its_audio_block_player(podcast):
    blog, episode, audio = podcast
    body = devdata.add_audio_to_body(body=devdata.create_python_body(), audio=audio)
    html = unsaved_draft(blog, episode.owner, body=body)
    assert f'id="cast-player-data-{audio.pk}"' in html
    assert "data-no-transcripts" in html


def test_preview_of_a_saved_episode_keeps_transcripts(podcast):
    _blog, episode, _audio = podcast
    saved = episode.make_preview_request()
    saved.render()
    assert "data-no-transcripts" not in saved.content.decode()


def test_api_limit_reaches_the_app(client, podcast, settings):
    blog, _episode, _audio = podcast
    assert configuration(client.get(blog.url).content.decode())["api-limit-max"] == "20"
    settings.WAGTAILAPI_LIMIT_MAX = 5
    assert configuration(client.get(blog.url).content.decode())["api-limit-max"] == "5"
    settings.WAGTAILAPI_LIMIT_MAX = None
    assert configuration(client.get(blog.url).content.decode())["api-limit-max"] == ""


def test_facet_counts_api_shape(client, podcast):
    blog, _episode, _audio = podcast
    response = client.get(blog.facet_counts_api_url)
    assert response.status_code == 200
    assert {"date_facets", "category_facets", "tag_facets"} <= set(response.json()["facet_counts"])


def test_example_media_view_answers_range_requests(rf, podcast):
    from django.http import Http404

    from example.media import serve_media

    _blog, _episode, audio = podcast

    def get(range_header=None, path=audio.mp3.name):
        headers = {"Range": range_header} if range_header else {}
        return serve_media(rf.get("/media/" + path, headers=headers), path)

    whole = get()
    assert whole.status_code == 200
    assert whole["Accept-Ranges"] == "bytes"
    content = b"".join(whole.streaming_content)
    part = get("bytes=2-5")
    assert part.status_code == 206
    assert b"".join(part.streaming_content) == content[2:6]
    assert part["Content-Range"] == f"bytes 2-5/{len(content)}"
    assert b"".join(get("bytes=-3").streaming_content) == content[-3:]
    assert get(f"bytes={len(content)}-").status_code == 416
    with pytest.raises(Http404):
        get(path="../settings.py")


def rendered_page(response) -> str:
    assert response.status_code == 200
    html = response.content.decode()
    assert 'class="cr-header"' in html
    assert 'class="cr-main cr-prose cr-page-content"' in html
    assert re.search(
        r'<div class="cr-header__controls">\s*<nav class="cr-header__nav"[^>]*>'
        r'.*?</nav>\s*<div class="cr-header__actions">.*?<button[^>]*data-appearance',
        html,
        re.DOTALL,
    )
    assert re.search(r'src="/static/cast_react/page-[\w-]+\.js"', html)
    assert re.search(r'href="/static/cast_react/[\w-]+\.css"', html)
    assert 'id="app"' not in html
    assert "cast-react-configuration" not in html
    assert "cast_react/main-" not in html
    return html


def test_feed_detail_uses_the_page_layout(client, podcast, settings):
    blog, _episode, _audio = podcast
    blog.email = "host@example.org"
    blog.save()
    settings.CAST_FOLLOW_LINKS = {
        "apple_podcasts": "https://podcasts.apple.com/us/podcast/demo/id1234",
        "spotify": "https://example.org/listen",
        "youtube": "https://www.youtube.com/@show",
        "mastodon": "https://social.example/@show",
        "linkedin": "https://www.linkedin.com/in/show/",
        "github": "https://github.com/show",
        "bluesky": "https://bsky.app/profile/show.example",
    }
    url = reverse("cast:feed_detail", kwargs={"slug": blog.slug})
    response = client.get(url)
    html = rendered_page(response)
    assert response.templates[0].name == "cast/react/feed_detail.html"
    assert f"<title>Subscribe – {blog.title}</title>" in html
    assert "<h1>Subscribe</h1>" in html
    assert "<p>About the <b>show</b></p>" in html
    assert f'class="cr-header__title" href="{blog.url}"' in html
    assert f'class="cr-button cr-header__subscribe" href="http://testserver{url}" aria-current="page"' in html
    assert "Listen in your podcast app" in html
    assert 'href="https://example.org/listen"' in html
    assert 'href="https://castro.fm/itunes/1234"' in html
    assert "Use the feed in any other app" in html
    assert "MP3 (recommended)" in html
    assert '<h3 class="cr-feed-other-heading">Other formats</h3>' in html
    assert "Blog feeds" in html
    assert html.count("data-copy-feed hidden") == 10
    for name in ["latest_entries_feed", "latest_entries_atom_feed"]:
        feed = reverse(f"cast:{name}", kwargs={"slug": blog.slug})
        assert f'href="{feed}"' in html
    for audio_format in ["mp3", "m4a", "oga", "opus"]:
        for kind in ["rss", "atom"]:
            feed = reverse(f"cast:podcast_feed_{kind}", kwargs={"slug": blog.slug, "audio_format": audio_format})
            assert f'href="{feed}"' in html
            assert f'value="http://testserver{feed}"' in html
    assert re.search(r'aria-label="MP3 RSS feed URL"\s+value="http://testserver[^"]+" data-feed-copy-url>', html)

    footer = re.search(r'<nav class="cr-footer__links"[^>]*>(.*?)</nav>', html, re.DOTALL)
    assert footer is not None
    assert f'<a href="http://testserver{url}">Subscribe</a>' in footer[1]
    assert '<a href="https://social.example/@show" rel="me">Mastodon</a>' in footer[1]
    assert '<a href="mailto:host@example.org">E-mail</a>' in footer[1]
    for key in ("linkedin", "github", "bluesky"):
        assert f'href="{settings.CAST_FOLLOW_LINKS[key]}"' in footer[1]
    assert 'href="https://example.org/listen"' not in footer[1]


def test_feed_page_keeps_the_podlove_override(podcast, rf):
    blog, _, _ = podcast
    template = engines["django"].from_string(
        '{% extends "cast/react/feed_detail.html" %}'
        '{% block podlove_subscribe_button %}<button type="button">Podlove subscribe</button>{% endblock %}'
    )
    html = template.render({"blog": blog, "is_podcast": True}, rf.get("/"))
    assert '<button type="button">Podlove subscribe</button>' in html


def test_written_blog_has_feeds_without_podcast_apps(client, db):
    blog = devdata.create_blog(site=Site.objects.get(is_default_site=True))
    blog.template_base_dir = THEME
    blog.description = "<p>A collection of articles.</p>"
    blog.save()

    listing = client.get(blog.url)
    assert listing.status_code == 200
    data = subscribe_json(listing.content.decode())
    assert data["isPodcast"] is False
    assert data["platformLinks"] == []
    assert data["podcastRssUrl"] == ""

    feed_page = reverse("cast:feed_detail", kwargs={"slug": blog.slug})
    html = rendered_page(client.get(feed_page))
    assert f"<title>Feeds – {blog.title}</title>" in html
    assert "<h1>Feeds</h1>" in html
    assert "<p>A collection of articles.</p>" in html
    assert f'class="cr-button cr-header__subscribe" href="http://testserver{feed_page}" aria-current="page"' in html
    assert "A feed reader collects new posts" in html
    assert "MP3" not in html
    assert "Listen in your podcast app" not in html
    assert html.count("data-copy-feed hidden") == 2
    assert re.search(r'aria-label="Blog RSS feed URL"\s+value="http://testserver[^"]+" data-feed-copy-url>', html)
    for name in ["latest_entries_feed", "latest_entries_atom_feed"]:
        feed = reverse(f"cast:{name}", kwargs={"slug": blog.slug})
        assert f'href="{feed}"' in html


def test_server_footer_theme_select_has_a_label_and_returns_to_the_page(client, podcast):
    blog, _episode, _audio = podcast
    url = reverse("cast:feed_detail", kwargs={"slug": blog.slug})
    response = client.get(url, {"theme": THEME, "template_base_dir": THEME, "keep": ["a", "b"]})
    html = rendered_page(response)
    footer = re.search(r'<footer class="cr-footer">(.*?)</footer>', html, re.DOTALL)
    assert footer is not None
    select_id = re.search(r'<select id="([^"]+)" name="template_base_dir" required>', footer[1])
    assert select_id is not None
    assert f'<label for="{select_id[1]}">Site theme</label>' in footer[1]
    assert f'<option value="{THEME}" selected>' in footer[1]
    assert '<noscript><button class="cr-button" type="submit">Apply theme</button></noscript>' in footer[1]

    next_field = re.search(r'<input type="hidden" name="next" value="([^"]+)">', footer[1])
    assert next_field is not None
    next_url = unescape(next_field[1])
    assert next_url == f"{url}?keep=a&keep=b"
    other_theme = next(slug for slug, _name in get_template_base_dir_choices() if slug != THEME)
    response = client.post(reverse("cast:select-theme"), {"template_base_dir": other_theme, "next": next_url})
    assert response.status_code == 302
    assert response["Location"] == next_url
    assert client.session["template_base_dir"] == other_theme


@pytest.mark.parametrize("with_episode", [True, False])
def test_transcript_uses_the_page_layout(client, podcast, with_episode):
    blog, episode, _audio = podcast
    if with_episode:
        url = episode.get_transcript_url()
    else:
        url = reverse("cast:html-transcript-no-post", args=[episode.transcript.pk])
    response = client.get(url, {"theme": THEME})
    html = rendered_page(response)
    assert response.templates[0].name == "cast/react/transcript.html"
    assert 'class="cr-transcript-page__segment"' in html
    assert '<span class="cr-transcript-page__time">00:00:01.000</span>' in html
    assert "<p>Hello.</p>" in html
    if with_episode:
        assert f"<title>Transcript: {episode.title}</title>" in html
        assert f'class="cr-header__title" href="{blog.url}"' in html
        assert f'<a href="{episode.url}">Back to episode</a>' in html
        assert re.search(r'<time datetime="\d{4}-\d{2}-\d{2}T[^"]+">', html)
    else:
        assert "<title>Transcript</title>" in html
        assert 'class="cr-header__title" href="/">Start page</a>' in html
        assert "Back to episode" not in html


@pytest.mark.urls(__name__)
@pytest.mark.parametrize("namespace", ["cast", "podcast"])
def test_theme_chooser_uses_the_page_layout(client, db, namespace):
    url = reverse(f"{namespace}:select-theme")
    assert client.post(url, {"template_base_dir": THEME, "next": "/"}).status_code == 302
    response = client.get(url)
    html = rendered_page(response)
    assert "<title>Select Theme</title>" in html
    assert 'class="cr-header__title" href="/">Start page</a>' in html
    assert 'class="cast-select-theme"' in html
    assert 'class="cr-footer"' in html
    assert 'class="cr-theme-select"' not in html
    assert f'data-current-theme="{THEME}"' in html
    assert f'name="template_base_dir" value="{THEME}"' in html
    assert 'class="btn btn-primary"' in html

    partial = client.get(url, HTTP_HX_REQUEST="true")
    assert partial.status_code == 200
    assert partial.templates[0].name == "cast/react/select_theme.html"
    assert 'aria-current="true"' in partial.content.decode()
    assert '<span class="cr-current-theme">Current theme</span>' in partial.content.decode()


def about(request):
    template = engines["django"].from_string(
        '{% extends "cast/react/base.html" %}'
        "{% block title %}About us{% endblock %}"
        "{% block css %}<style>/* site styles */</style>{% endblock %}"
        "{% block javascript %}{{ block.super }}<script>/* site script */</script>{% endblock %}"
        "{% block content %}<h1>About us</h1><p>Our site.</p>{% endblock %}"
    )
    return HttpResponse(template.render({"root_nav_links": [("/contact/", "Contact")]}, request))


urlpatterns = [
    path("about/", about),
    path("cast/", include("cast.urls", namespace="cast")),
    path("podcast/", include("cast.urls", namespace="podcast")),
]


@pytest.mark.urls(__name__)
@pytest.mark.parametrize(("saved_theme", "selected_theme"), [("plain", "plain"), ("removed-theme", "")])
def test_fixed_react_page_footer_uses_the_saved_theme(client, db, saved_theme, selected_theme):
    session = client.session
    session["template_base_dir"] = saved_theme
    session.save()

    html = rendered_page(client.get("/about/"))
    select = re.search(r'<select[^>]+name="template_base_dir"[^>]*>(.*?)</select>', html, re.DOTALL)
    assert select is not None
    options = re.findall(r'<option value="([^"]*)"([^>]*)>', select[1])
    assert [value for value, attrs in options if "selected" in attrs] == [selected_theme]
    if not selected_theme:
        assert options[0] == ("", " selected disabled")
        assert '<option value="" selected disabled>Choose…</option>' in select[1]
    else:
        assert all(value for value, _ in options)


def test_server_footer_defaults_to_react_without_theme_context(rf, db):
    html = render_to_string(
        "cast/react/_page_footer.html",
        {"template_base_dir": ""},
        request=rf.get("/about/"),
    )
    assert f'<option value="{THEME}" selected>' in html


@pytest.mark.urls(__name__)
def test_site_page_content_block_renders_without_a_blog(client, db):
    Site.objects.filter(is_default_site=True).update(site_name="Our site")
    html = rendered_page(client.get("/about/", SCRIPT_NAME="/subsite"))
    assert "<title>About us</title>" in html
    assert "<h1>About us</h1><p>Our site.</p>" in html
    assert 'class="cr-header__title" href="/subsite/">Our site</a>' in html
    assert re.search(r'<nav class="cr-header__nav"[^>]*>\s*<a href="/contact/">Contact</a>\s*</nav>', html)
    assert "<style>/* site styles */</style>" in html
    assert "<script>/* site script */</script>" in html


def test_site_page_keeps_theme_assets_when_overriding_css_and_javascript():
    template = engines["django"].from_string(
        '{% extends "cast/react/base.html" %}'
        "{% block css %}<style>/* site styles */</style>{% endblock %}"
        "{% block javascript %}<script>/* site script */</script>{% endblock %}"
    )
    html = rendered_page(HttpResponse(template.render()))
    assert "<style>/* site styles */</style>" in html
    assert "<script>/* site script */</script>" in html

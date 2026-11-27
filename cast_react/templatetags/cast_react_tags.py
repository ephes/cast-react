import re
from urllib.parse import urlsplit

from cast import appsettings
from django import template
from django.conf import settings
from django.http import HttpRequest
from django.urls import NoReverseMatch, reverse
from django.utils.encoding import escape_uri_path
from django.utils.translation import gettext

try:
    from cast.follow_links import get_follow_links
except ModuleNotFoundError as exc:
    if exc.name != "cast.follow_links":
        raise
    get_follow_links = None

register = template.Library()

PLATFORMS = (
    ("apple_podcasts", "Apple Podcasts", "podcast"),
    ("overcast", "Overcast", "headphones"),
    ("pocket_casts", "Pocket Casts", "headphones"),
    ("spotify", "Spotify", "music"),
    ("youtube", "YouTube", "video"),
    ("castro", "Castro", "headphones"),
)
FOLLOW_LINKS = (
    ("mastodon", "Mastodon", "me"),
    ("linkedin", "LinkedIn", ""),
    ("github", "GitHub", ""),
    ("bluesky", "Bluesky", ""),
    ("email", "E-mail", ""),
)


def safe_link(value, request, *, allow_mailto=False):
    if (
        not isinstance(value, str)
        or "\\" in value
        or any(char.isspace() or ord(char) < 32 or char == "\x7f" for char in value)
    ):
        return ""
    try:
        url = urlsplit(value)
        if url.scheme in {"https", "http"} and url.hostname:
            _ = url.port  # Validate the port if one was provided.
            return value
        if allow_mailto and url.scheme == "mailto" and url.path:
            return value
        if value.startswith("/") and not value.startswith("//"):
            return request.build_absolute_uri(value) if request else value
    except ValueError:
        pass
    return ""


def feed_url(name, slug, **kwargs):
    try:
        return reverse(f"cast:{name}", kwargs={"slug": slug, **kwargs})
    except NoReverseMatch:
        # Older django-cast releases may not have the feed detail route.
        return ""


@register.simple_tag(takes_context=True)
def cast_react_subscribe(context):
    blog = context.get("blog")
    # A post can carry the base Blog page instead of its Podcast subtype.
    blog = getattr(blog, "specific", blog)
    request = context.get("request")
    slug = getattr(blog, "slug", "")
    is_podcast = bool(getattr(blog, "is_podcast", False))
    get_view_restrictions = getattr(blog, "get_view_restrictions", None)
    feeds_available = get_view_restrictions is None or not get_view_restrictions().exists()
    follow_links = context.get("follow_links")
    if follow_links is None:
        if get_follow_links:
            try:
                follow_links = get_follow_links(blog)
            except NoReverseMatch:
                follow_links = get_follow_links(None)
        else:
            follow_links = getattr(appsettings, "CAST_FOLLOW_LINKS", {})

    feed_page = blog_rss = podcast_rss = ""
    if feeds_available:
        feed_page = safe_link(follow_links.get("feed_detail"), None) or (feed_url("feed_detail", slug) if slug else "")
        blog_rss = (
            safe_link(context.get("blog_feed_url"), request)
            or safe_link(follow_links.get("rss"), request)
            or (safe_link(feed_url("latest_entries_feed", slug), request) if slug else "")
        )
        if slug and is_podcast:
            podcast_rss = feed_url("podcast_feed_rss", slug, audio_format="mp3")
    if (
        feed_page.startswith("/")
        and request
        and (request.GET.get("template_base_dir") or request.GET.get("theme")) == "react"
    ):
        url = urlsplit(feed_page)
        query = f"{url.query}&theme=react" if url.query else "theme=react"
        feed_page = url._replace(query=query).geturl()

    platform_urls = {}
    if feeds_available and is_podcast:
        platform_urls = {
            key: safe_link(follow_links.get(key), request) or safe_link(context.get(f"{key}_url"), request)
            for key in ("apple_podcasts", "spotify", "youtube")
        }
        apple_path = urlsplit(platform_urls["apple_podcasts"]).path
        if match := re.search(r"/id([0-9]+)(?:/|$)", apple_path):
            apple_id = match[1]
            platform_urls.update(
                overcast=f"https://overcast.fm/itunes{apple_id}",
                pocket_casts=f"https://pca.st/itunes/{apple_id}",
                castro=f"https://castro.fm/itunes/{apple_id}",
            )

    return {
        "feedPageUrl": safe_link(feed_page, request),
        "legacyFeedUrl": feed_page or blog_rss,
        "isPodcast": is_podcast,
        "podcastRssUrl": safe_link(podcast_rss, request),
        "blogRssUrl": blog_rss,
        "platformLinks": [
            {"id": key, "label": label, "icon": icon, "url": platform_urls[key]}
            for key, label, icon in PLATFORMS
            if platform_urls.get(key)
        ],
        "followLinks": [
            {"label": gettext("E-mail") if key == "email" else label, "url": url, "rel": rel}
            for key, label, rel in FOLLOW_LINKS
            if (url := safe_link(follow_links.get(key), request, allow_mailto=key == "email"))
        ],
    }


@register.simple_tag(takes_context=True)
def cast_react_absolute_link(context, value):
    return safe_link(value, context.get("request"))


@register.simple_tag
def cast_react_api_limit_max() -> str:
    """Largest `limit` the Wagtail pages API accepts, or "" when it has no cap.

    Wagtail reads WAGTAILAPI_LIMIT_MAX with a default of 20; None or 0 lift the cap.
    """
    limit_max = getattr(settings, "WAGTAILAPI_LIMIT_MAX", 20)
    if not limit_max:
        return ""
    return str(int(limit_max))


@register.simple_tag
def cast_react_selected_theme(
    choices: list[tuple[str, str]], current_theme: str | None, saved_theme: str | None
) -> str:
    theme = current_theme or saved_theme or "react"
    return theme if any(slug == theme for slug, _ in choices) else ""


@register.simple_tag(takes_context=True)
def cast_react_is_theme_chooser(context: template.Context) -> bool:
    # django-cast's context processor also provides theme_form on ordinary pages.
    return context.template_name == "cast/select_theme_page.html" and bool(context.get("theme_form"))


@register.simple_tag
def cast_react_theme_return_path(request: HttpRequest) -> str:
    """Keep the current page and its query parameters when leaving a theme preview."""
    params = request.GET.copy()
    params.pop("theme", None)
    params.pop("template_base_dir", None)
    path = escape_uri_path(request.path)
    return f"{path}?{params.urlencode()}" if params else path

from django import template
from django.conf import settings
from django.http import HttpRequest
from django.utils.encoding import escape_uri_path

register = template.Library()


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

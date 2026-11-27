from django import template
from django.conf import settings

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

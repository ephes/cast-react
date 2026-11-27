from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from wagtail import urls as wagtail_urls
from wagtail.admin import urls as wagtailadmin_urls
from wagtail.documents import urls as wagtaildocs_urls

from example.media import serve_media

urlpatterns = [
    path("admin/", admin.site.urls),
    path("cast/", include("cast.urls", namespace="cast")),
    path("show/comments/", include("cast.comments.urls")),
    path("cms/", include(wagtailadmin_urls)),
    path("documents/", include(wagtaildocs_urls)),
    path("", include(wagtail_urls)),
]

if settings.DEBUG:
    media_prefix = settings.MEDIA_URL.strip("/")
    urlpatterns = [re_path(rf"^{media_prefix}/(?P<path>.+)$", serve_media), *urlpatterns]

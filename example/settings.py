"""Settings for the local cast-react example site (development only)."""

import os
from pathlib import Path

import cast
from cast import CAST_APPS, CAST_MIDDLEWARE

BASE_DIR = Path(__file__).resolve().parent
REPO_ROOT = BASE_DIR.parent

DEBUG = True
SECRET_KEY = "cast-react-example-not-a-secret"  # development only
ALLOWED_HOSTS = ["localhost", "127.0.0.1", "testserver"]

SITE_ID = 1
USE_TZ = True
TIME_ZONE = "Europe/Berlin"
LANGUAGE_CODE = "en-us"

INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.sites",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.admin",
    *CAST_APPS,  # already contains django_vite
    "cast_react.apps.CastReactConfig",
    "example.demo",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    *CAST_MIDDLEWARE,
]

ROOT_URLCONF = "example.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
                "cast.context_processors.site_template_base_dir",
            ],
        },
    },
]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": os.environ.get("CAST_REACT_EXAMPLE_DB", BASE_DIR / "db.sqlite3"),
    }
}

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = Path(os.environ.get("CAST_REACT_EXAMPLE_MEDIA", BASE_DIR / "media"))

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

WAGTAIL_SITE_NAME = "cast-react example"
WAGTAILADMIN_BASE_URL = "http://localhost:8000"

CRISPY_TEMPLATE_PACK = "bootstrap4"
CRISPY_ALLOWED_TEMPLATE_PACKS = "bootstrap4"

COMMENTS_APP = "cast.comments"
CAST_COMMENTS_EXCLUDE_FIELDS = ("email", "url", "title")
CAST_COMMENTS_ENABLED = True

# Optional: the name shown for the theme in django-cast's theme chooser.
CAST_CUSTOM_THEMES = [("react", "React")]

# Fictional destinations for the demo podcast.
CAST_FOLLOW_LINKS = {
    "apple_podcasts": "https://podcasts.apple.com/us/podcast/ground-loop-demo/id1234567890",
    "spotify": "https://open.spotify.com/show/0000000000000000000000",
    "youtube": "https://www.youtube.com/@ground-loop-demo",
    "mastodon": "https://mastodon.example/@groundloop",
    "linkedin": "https://www.linkedin.com/company/ground-loop-demo/",
}

# django-vite: CAST_REACT_VITE_DEV_MODE=1 uses the Vite dev server (`just js-dev`),
# otherwise the committed production bundle in cast_react/static/cast_react/.
_vite_dev_mode = os.environ.get("CAST_REACT_VITE_DEV_MODE", "0") == "1"
DJANGO_VITE = {
    # django-cast's own bundle, used by the built-in themes and the plain transcript page.
    "cast": {
        "dev_mode": False,
        "static_url_prefix": "cast/vite",
        "manifest_path": Path(cast.__file__).resolve().parent / "static" / "cast" / "vite" / "manifest.json",
    },
    "cast_react": {
        "dev_mode": _vite_dev_mode,
        "dev_server_port": 5173,
        "static_url_prefix": "" if _vite_dev_mode else "cast_react/",
        "manifest_path": REPO_ROOT / "cast_react" / "static" / "cast_react" / "manifest.json",
    },
}

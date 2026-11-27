"""Test settings: the example site with an in-memory database and throwaway media."""

import tempfile

from example.settings import *  # noqa: F403

DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}
MEDIA_ROOT = tempfile.mkdtemp(prefix="cast-react-test-media-")
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

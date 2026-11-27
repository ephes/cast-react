"""Serve media for the example site with HTTP Range support.

Browsers can only seek in an audio file (chapters, transcript lines, `?t=`
links) when the server answers Range requests. Django's development media view
does not, so the example site uses this one. Development only: in production
the web server or object storage serves media.
"""

import mimetypes
import re
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404, HttpRequest, HttpResponse
from django.utils._os import safe_join

RANGE = re.compile(r"^bytes=(\d*)-(\d*)$")


def serve_media(request: HttpRequest, path: str) -> HttpResponse | FileResponse:
    try:
        file_path = Path(safe_join(str(settings.MEDIA_ROOT), path))
    except ValueError as error:
        raise Http404("Not found") from error
    if not file_path.is_file():
        raise Http404("Not found")
    size = file_path.stat().st_size
    content_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
    match = RANGE.match(request.headers.get("Range", ""))
    if not match or not (match.group(1) or match.group(2)):
        response = FileResponse(file_path.open("rb"), content_type=content_type)
        response["Accept-Ranges"] = "bytes"
        return response
    if match.group(1):
        start = int(match.group(1))
        end = min(int(match.group(2)), size - 1) if match.group(2) else size - 1
    else:  # "bytes=-500": the last 500 bytes
        start = max(0, size - int(match.group(2)))
        end = size - 1
    if start >= size or start > end:
        response = HttpResponse(status=416)
        response["Content-Range"] = f"bytes */{size}"
        return response
    with file_path.open("rb") as file:
        file.seek(start)
        response = HttpResponse(file.read(end - start + 1), status=206, content_type=content_type)
    response["Content-Range"] = f"bytes {start}-{end}/{size}"
    response["Accept-Ranges"] = "bytes"
    return response

"""Serve media for the example site with HTTP Range support.

Browsers can only seek in an audio file (chapters, transcript lines, `?t=`
links) when the server answers Range requests. Django's development media view
does not, so the example site uses this one. Development only: in production
the web server or object storage serves media.
"""

import mimetypes
import re
from collections.abc import Iterator
from pathlib import Path

from django.conf import settings
from django.core.exceptions import SuspiciousFileOperation
from django.http import FileResponse, Http404, HttpRequest, HttpResponse, StreamingHttpResponse
from django.utils._os import safe_join

RANGE = re.compile(r"^bytes=(\d*)-(\d*)$")


CHUNK_BYTES = 64 * 1024


def read_range(file_path: Path, start: int, end: int) -> Iterator[bytes]:
    remaining = end - start + 1
    with file_path.open("rb") as file:
        file.seek(start)
        while remaining > 0:
            chunk = file.read(min(CHUNK_BYTES, remaining))
            if not chunk:
                return
            remaining -= len(chunk)
            yield chunk


def serve_media(request: HttpRequest, path: str) -> HttpResponse | FileResponse | StreamingHttpResponse:
    try:
        file_path = Path(safe_join(str(settings.MEDIA_ROOT), path))
    except (ValueError, SuspiciousFileOperation) as error:
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
    response = StreamingHttpResponse(read_range(file_path, start, end), status=206, content_type=content_type)
    response["Content-Length"] = str(end - start + 1)
    response["Content-Range"] = f"bytes {start}-{end}/{size}"
    response["Accept-Ranges"] = "bytes"
    return response

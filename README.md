# React Theme for Django-Cast

`cast-react` is a theme for [`django-cast`](https://github.com/ephes/django-cast)
whose pages are a small React application. Django serves a page shell and the
django-cast API; React renders the post list and the posts in the browser.
It is the React counterpart of [`cast-vue`](https://github.com/ephes/cast-vue).

What you get:

- Post list with search, category, tag and month filters, a date range, sort
  order and paging. Filters live in the address (`?search=…&tag_facets=…`).
- Post and episode pages with comments (including replies) and a lightbox for
  galleries.
- An audio player made for this theme: the seek bar is divided into chapters,
  with a chapter list, a transcript you can search and that follows playback,
  playback speed, resume, and links that start at a given time (`?t=754`).
  An episode keeps playing in a mini player while you move through the site.
- Light and dark appearance, from phone to large desktop, without a CSS
  framework, UI kit or web font.

## Installation

### 1. Install the theme

```shell
pip install cast-react
```

`cast-react` needs `django-cast` 0.2.59 or newer (it uses django-cast's player
payload and transcript endpoint).

### 2. Add entries to INSTALLED_APPS

Add `django_vite` (already part of `CAST_APPS`) and
`cast_react.apps.CastReactConfig` to `INSTALLED_APPS`, and tell django-vite
where the theme's bundle is:

```python
from pathlib import Path

import cast_react

INSTALLED_APPS = [
    ...
    "django_vite",
    "cast_react.apps.CastReactConfig",
    ...
]

DJANGO_VITE = {
    ...
    "cast_react": {
        "dev_mode": False,  # True only while running the Vite dev server
        "static_url_prefix": "cast_react/",  # really important for production!
        "manifest_path": Path(cast_react.__file__).parent / "static" / "cast_react" / "manifest.json",
    },
}

# Optional: the name shown in django-cast's theme chooser (default: "react").
CAST_CUSTOM_THEMES = [("react", "React")]
```

The built bundle ships inside the package, so `collectstatic` picks it up and
no Node.js is needed on the server.

### 3. Set the theme in Wagtail admin

Set the theme to `react` in the Wagtail admin, for the complete site
(`Settings > Template base directory`) or for one blog or podcast.

### End

That's it. The blog index and its posts are now rendered by the React theme.

## How it plugs into django-cast

The theme is a set of templates in `cast_react/templates/cast/react/`, which
is how django-cast discovers themes.

- `base.html` loads the bundle through django-vite and passes the blog's
  settings to the app as `data-` attributes of one element
  (`#cast-react-configuration`): blog URL and id, page size, the API URLs and
  the CSRF token. `blog_list_of_posts.html`, `post.html` and `episode.html`
  add the route (`PostList` or `PostDetail`), the post slug and the page type,
  and set title, description, canonical URL and social meta tags on the server.
- `post_body.html` is what the pages API returns as `html_overview` and
  `html_detail`. The app shows that HTML and reads date and author from the
  `data-` attributes the template adds.
- `audio.html` renders django-cast's player payload (sources, chapters, lazy
  transcript URL) with the `cast_custom_player` tag. The app reads the JSON and
  shows its own player; django-cast's player script is not loaded. This works
  with either value of `CAST_AUDIO_PLAYER`.
- `gallery.html` renders plain links to the large pictures, which the app
  opens in a lightbox.
- The error pages (`400.html` … `500.html`) are plain HTML without JavaScript.

API endpoints used: the Wagtail pages API (`cast:api:wagtail:pages:listing`,
with `use_post_filter=true` and `render_for_feed=false`), facet counts
(`cast:api:facet-counts-detail`), the player transcript
(`cast:api:audio_player_transcript`), the theme list and update endpoints, and
the comment post URL (`comments-post-comment-ajax`).

### Known limits

- Posts are rendered in the browser. Without JavaScript the page shows the
  blog title and a link to the feed; search engines that do not run
  JavaScript see title, description and social meta tags only.
- Addresses directly below the blog (`<blog>/<slug>/`) are treated as posts.
- The transcript page (`transcript.html`) and the feed page
  (`feed_detail.html`) fall back to django-cast's plain templates.
- django-cast's styleguide (`/cast/styleguide/`) has no React version.
- The interface texts are English only.

## Development

You need Python 3.11+, [uv](https://docs.astral.sh/uv/), Node.js 22+ and
[just](https://just.systems/). `ffmpeg` is needed once to render the example
audio.

```shell
just install        # Python and JavaScript dependencies
just example-seed   # example database with a synthetic podcast
just js-build       # build the bundle
just example-run    # http://localhost:8000/ground-loop/
```

django-vite reads the manifest when Django starts, so restart `example-run`
after `just js-build`.

### Vite development server

For hot reloading run the Vite dev server and start the example site in dev
mode, in two terminals:

```shell
just js-dev
CAST_REACT_VITE_DEV_MODE=1 just example-run
```

### Tests and checks

```shell
just check          # everything below
just lint           # ruff
just js-typecheck   # tsc
just js-test        # vitest
just test           # pytest
```

### Build

```shell
just js-build
```

This writes `main-*.js`, `main-*.css` and `manifest.json` to
`cast_react/static/cast_react/`. Commit those files with the source change, so
that the package and `collectstatic` contain the current bundle.

### Dependencies

Runtime: `react` and `react-dom`, nothing else. Routing (two routes), data
fetching, the player, the lightbox and the styles are written for this theme,
because each of them is smaller than the library it would replace.
Development: Vite with the official React plugin, TypeScript, Vitest and
jsdom. Install with `npm install --ignore-scripts`; no dependency needs an
install script.

### Source layout

```text
cast_react/templates/cast/react/     Django templates (the theme contract)
cast_react/static/src/js/cast_react/ React app (TypeScript)
  player/                            audio store, player, chapters, transcript, mini player
  components/                        pages, filters, comments, lightbox, header
cast_react/static/src/css/cast_react/ styles
cast_react/static/src/tests/         Vitest tests
cast_react/static/cast_react/        built bundle (committed)
example/                             example site and `seed_demo` command
tests/                               pytest tests of the templates and the API contract
```

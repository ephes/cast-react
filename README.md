# React Theme for Django-Cast

`cast-react` is a theme for [`django-cast`](https://github.com/ephes/django-cast)
with a small React application for the post list and posts. Django serves the
page shell and the django-cast API, and renders the feed and transcript pages.
It is the React counterpart of [`cast-vue`](https://github.com/ephes/cast-vue).

What you get:

- Post list with search, category, tag and month filters, a date range, sort
  order and paging. Filters live in the address (`?search=…&tag_facets=…`).
  Categories and tags show the 10 most common choices, plus the selected or
  focused choice. **All N tags** or **All N categories** opens a compact
  alphabetical index with post counts beneath those choices. Type in the
  index field to find a name regardless of case, accents or Greek sigma form.
  Press Escape in the field to clear it. If selecting a choice removes the
  index, focus moves to that choice in the top row. The month menu lists post
  counts by Gregorian year, newest first, with localized month names.
  **Custom date range** folds away the From and Until fields and opens when
  a range is set.
- Each list row shows the post's overview with a **Read more** link. Post and
  episode pages show the overview and detail, with comments (including replies)
  and a lightbox for galleries.
- Podcasts have a **Subscribe** link in the header and listening links on the
  post list and on episodes. The subscribe page has podcast apps, a copyable
  MP3 RSS URL, alternative audio formats, and RSS and Atom feeds for written
  posts. Written blogs use **Feeds** and can show the same footer follow links.
- An audio player made for this theme: the seek bar is divided into chapters,
  with a chapter list, a transcript you can search and that follows playback,
  playback speed, resume, and links that start at a given time (`?t=754`).
  An episode keeps playing in a mini player while you move through the site.
- Light and dark appearance, from phone to large desktop, without a CSS
  framework, UI kit or web font.
- The **Site theme** menu in the footer switches between installed themes on
  both React and Django-rendered pages when more than one theme is available.
  On Django-rendered pages it reflects the active theme choice, including on
  pages that always use the React layout. The full theme chooser has its own
  list of themes.
- The Month, Order, and Site theme menus open on solid surfaces that match the
  reader's appearance setting in browsers that support customizable selects.
  Older browsers use their built-in menus.

## Installation

### 1. Install the theme

`cast-react` is not on PyPI yet. Install a tagged version from GitHub:

```shell
pip install "cast-react @ git+https://github.com/ephes/cast-react.git@v0.0.9"
```

`cast-react` needs `django-cast` 0.2.62 or newer (it uses django-cast's player
payload, transcript endpoint and social meta include).

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

## Subscription and follow links

Use django-cast's `CAST_FOLLOW_LINKS` to set `apple_podcasts`, `spotify`, and
`youtube` for podcast apps, and `mastodon`, `linkedin`, `github`, `bluesky`,
and `email` for footer links. Set `email` to a `mailto:` URL or use the blog's
contact email. Mastodon links include `rel="me"`. An Apple Podcasts URL
whose path contains `/id<digits>` also supplies links for Overcast, Pocket
Casts, and Castro. Django-Cast supplies the feed URLs. To add a Podlove
subscribe button, override the `podlove_subscribe_button` block in
`cast/react/feed_detail.html`.

## How it plugs into django-cast

The theme is a set of templates in `cast_react/templates/cast/react/`, which
is how django-cast discovers themes.

- `base.html` loads the bundle through django-vite and passes the blog's
  settings to the app as `data-` attributes of one element
  (`#cast-react-configuration`): blog URL and id, page size, the API cap
  (`WAGTAILAPI_LIMIT_MAX`), the API URLs and the CSRF token. `blog_list_of_posts.html`, `post.html` and `episode.html`
  add the route (`PostList` or `PostDetail`), the post slug and the page type,
  and set title, description, canonical URL and social meta tags on the server.
  The `cast-react-subscribe` JSON script supplies feed, podcast app, and follow
  links. For the React header and footer, a non-empty `data-feed-url` in the
  `reactjs-data` block takes precedence over the JSON feed page URL.
- `post_body.html` is what the pages API returns as `html_overview` and
  `html_detail`. The app shows that HTML and reads date and author from the
  `data-` attributes the template adds.
- `audio.html` renders django-cast's player payload (sources, chapters, lazy
  transcript URL) with the `cast_custom_player` tag. The app reads the JSON and
  shows its own player; django-cast's player script is not loaded. This works
  with either value of `CAST_AUDIO_PLAYER`.
- `gallery.html` renders plain links to the large pictures, which the app
  opens in a lightbox.
- `page.html` provides the header, prose layout and a small `page.ts` Vite
  entry for Django-rendered pages. It shares styles and the saved appearance
  choice with the app. On phones, header links in custom `<ul>` lists scroll
  horizontally in a single row. `feed_detail.html` shows listening services and copyable feed links,
  `transcript.html` renders the full transcript, and `select_theme.html`
  renders the theme chooser partial for htmx.
- A page that extends `cast/react/base.html` without a `blog` in its context
  (django-cast's theme chooser, an imprint or an account page) uses this
  layout with its `{% block content %}`. The `title` block takes plain text,
  and `css` and `javascript` can add site assets. The theme's Vite entry
  loads independently of those blocks.
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
- The list asks the API for one page of posts at a time. Wagtail's API
  refuses more than `WAGTAILAPI_LIMIT_MAX` posts per request (20 unless you
  change it), so when django-cast's page size is larger, the theme shows
  `WAGTAILAPI_LIMIT_MAX` posts per page instead. With `WAGTAILAPI_LIMIT_MAX`
  set to `None` or `0` Wagtail has no cap, and the theme uses django-cast's
  full page size.
- A post preview in the Wagtail admin shows the draft's body and player, but
  no comments. For an episode that has never been saved, the player has no
  transcript yet.
- Addresses directly below the blog (`<blog>/<slug>/`) are treated as posts.
- django-cast's styleguide (`/cast/styleguide/`) has no React version.
- The page layout does not display Django messages (for
  example "Password changed"). Keep another theme as the site default if
  account pages extend the site theme.
- The interface texts are English only.

## Development

You need Python 3.11+, [uv](https://docs.astral.sh/uv/), Node.js (22.22.2+,
24.15+ or 26+, as required by the test tooling) and
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

The demo includes about 110 tags, three categories and over six years of
monthly archive posts. The recent podcast episodes include transcripts.

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

This writes the `main` and `page` entries, shared assets and `manifest.json`
to `cast_react/static/cast_react/`. Commit those files with the source change,
so that the package and `collectstatic` contain the current bundle.

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

# Changelog

## Unreleased

## 0.0.3

- Pages that extend the theme's base without a blog (django-cast's theme
  chooser page, a site's own pages such as an imprint or account pages) render
  as a plain page with their `content` block instead of failing.
- The `title` block of `cast/react/base.html` now holds only the title text,
  inside `<title>`, as in django-cast's other themes. A template that
  overrides it with its own `<title>` element must drop that element.

## 0.0.2

- The list follows the site's `WAGTAILAPI_LIMIT_MAX`: with a cap below
  django-cast's page size it shows fewer posts per page instead of failing to
  load, and without a cap it shows the full page size.
- A Wagtail preview of an episode that has never been saved shows its player
  (without transcript, which needs a saved post).
- Installation from a git tag documented; the package is not on PyPI.

## 0.0.1

First version of the React theme for django-cast.

- Single-page post list and post page on top of the django-cast API, with
  client-side navigation and crossfades where the browser supports view
  transitions.
- Search, category, tag and month filters, a date range and the sort order,
  all kept in the address so a filtered list can be shared.
- A small audio player written for this theme: chapters on the seek bar,
  chapter list, transcript with search and follow-along, playback speed,
  resume, links that start at a given time, and a mini player that keeps an
  episode playing while you browse.
- Comments with replies, gallery lightbox, light and dark appearance, theme
  chooser.
- Post previews in the Wagtail admin show the draft.
- Needs django-cast 0.2.62 or newer.

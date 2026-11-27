# Changelog

## 0.0.4

- Categories and tags are ordered by post count and show the 12 most common
  choices to start. The expansion toggle appears only when it can reveal more
  choices. If filtering removes a focused toggle, focus returns to search.
  Selected filters stay visible, and clearing a filter keeps focus on its
  button. Months are grouped newest first by Gregorian year, with
  localized month names and a fallback for invalid page languages.
- The filter sidebar scrolls with the page. Month, date range and sort fields
  share the same styling in light and dark mode.
- Feed and transcript pages, the theme chooser and other Django-rendered
  pages use the React theme's header, styles and saved appearance choice.
  The theme assets stay loaded when a page overrides `css` or `javascript`.
- The example podcast includes a multi-year archive with about 40 tags for
  trying the filters.

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

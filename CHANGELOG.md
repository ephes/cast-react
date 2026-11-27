# Changelog

## 0.0.7

- Dropdown arrows match the field text in light and dark mode and stay on the
  right with space reserved for them in either text direction. List boxes and
  multi-selects keep their native appearance.
- The Site theme menu lines up with the header and sits below the site name on
  phones. It shows the active theme choice on Django-rendered pages and is
  hidden on the full theme chooser.
- Search, filters, pagination and theme chooser buttons have more room on narrow screens.

## 0.0.6

- Every list row has a Read more link to the full post.
- List rows discard detail blocks if the API includes them in the overview.

## 0.0.5

- Tags and categories show the 10 most-used choices and open a searchable
  alphabetical index with counts when there are more. Search equates Greek
  sigma forms, and focus follows the selected choice when the index disappears.
- Custom date ranges fold away below the month menu.
- List rows skip the side thumbnail when the teaser already has an image,
  including an image inside a picture element.
- Phone headers keep appearance and feed controls beside the title and put
  navigation links, including custom navigation lists, on one scrolling line below.
- Custom header navigation supports nested links. Printouts of React pages
  hide the feed and appearance controls.
- Feed, transcript, theme chooser and other server pages use a wider,
  centered content column.
- The demo archive spans over six years and has about 110 tags.

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

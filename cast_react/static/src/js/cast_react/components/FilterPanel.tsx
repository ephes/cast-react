// Search and filters of the post list. Every change becomes a new address
// (`?search=…&tag_facets=…`), so a filtered list can be bookmarked and shared.

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { FormEvent, RefCallback } from "react";
import { FILTER_KEYS, type Facet, type FacetCounts, type FilterKey, type Filters } from "../types";
import { FilterIcon, SearchIcon } from "./icons";

const SEARCH_DELAY_MS = 400;
const FACET_LIMIT = 12;
const MONTH_SLUG = /^\d{4}-(?:0[1-9]|1[0-2])$/;

function includeSelected(items: Facet[], selected: string): Facet[] {
  if (selected && !items.some((facet) => facet.slug === selected)) {
    return [...items, { slug: selected, name: selected, count: 0 }];
  }
  return items;
}

function FacetGroup({
  title,
  noun,
  facets,
  selected,
  onSelect,
  toggleRef,
}: {
  title: string;
  noun: string;
  facets: Facet[] | undefined;
  selected: string;
  onSelect: (slug: string) => void;
  toggleRef: RefCallback<HTMLButtonElement>;
}) {
  const headingId = useId();
  const listId = useId();
  const [expanded, setExpanded] = useState(false);
  const [focused, setFocused] = useState<Facet | null>(null);
  const ranked = [...(facets ?? [])].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const selectedItems = includeSelected(ranked, selected);
  // Keep the focused button mounted if clearing a filter hides it or drops it from the counts.
  const items = focused && !selectedItems.some((facet) => facet.slug === focused.slug)
    ? [...selectedItems, { ...focused, count: 0 }]
    : selectedItems;
  if (!items.length) {
    return null;
  }
  const collapsed = items.filter(
    (facet, index) => index < FACET_LIMIT || facet.slug === selected || facet.slug === focused?.slug,
  );

  return (
    <div className="cr-facets">
      <h3 id={headingId}>{title}</h3>
      <ul id={listId} aria-labelledby={headingId}>
        {(expanded ? items : collapsed).map((facet) => {
          const active = facet.slug === selected;
          return (
            <li key={facet.slug}>
              <button
                type="button"
                className="cr-facet"
                aria-pressed={active}
                onFocus={() => setFocused(facet)}
                onBlur={() => setFocused(null)}
                onClick={() => onSelect(facet.slug)}
              >
                <span>{facet.name}</span>
                <span className="cr-facet__count" aria-label={`${facet.count} posts`}>
                  {facet.count}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {collapsed.length < items.length && (
        <button
          ref={toggleRef}
          type="button"
          className="cr-button cr-button--quiet cr-facets__toggle"
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Show fewer" : `Show all ${ranked.length} ${noun}`}
        </button>
      )}
    </div>
  );
}

function monthFormatter(): Intl.DateTimeFormat {
  const locale = document.documentElement.lang.split("@", 1)[0].trim().replaceAll("_", "-");
  const options: Intl.DateTimeFormatOptions = {
    month: "long",
    year: "numeric",
    calendar: "gregory",
    timeZone: "UTC",
  };
  try {
    return new Intl.DateTimeFormat(locale || navigator.language, options);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return new Intl.DateTimeFormat(undefined, options);
  }
}

function MonthSelect({
  facets,
  selected,
  onSelect,
}: {
  facets: Facet[] | undefined;
  selected: string;
  onSelect: (slug: string) => void;
}) {
  const id = useId();
  const format = monthFormatter();
  const months = includeSelected(facets ?? [], selected).filter((facet) => MONTH_SLUG.test(facet.slug));
  months.sort((a, b) => b.slug.localeCompare(a.slug));
  const byYear = new Map<string, Facet[]>();
  for (const month of months) {
    const year = month.slug.slice(0, 4);
    const group = byYear.get(year);
    if (group) {
      group.push(month);
    } else {
      byYear.set(year, [month]);
    }
  }

  return (
    <label className="cr-field" htmlFor={id}>
      <span>Month</span>
      <select id={id} value={selected} onChange={(event) => onSelect(event.target.value)}>
        <option value="">Any month</option>
        {selected && !MONTH_SLUG.test(selected) && <option value={selected}>{selected}</option>}
        {Array.from(byYear, ([year, group]) => (
          <optgroup key={year} label={year}>
            {group.map(({ slug, count }) => (
              <option key={slug} value={slug}>
                {format.format(new Date(`${slug}-01T00:00:00Z`))} ({count})
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

export function FilterPanel({
  filters,
  facetCounts,
  onChange,
}: {
  filters: Filters;
  facetCounts: FacetCounts | null;
  // `typing` is true for changes made while the reader types in the search field.
  onChange: (filters: Filters, typing: boolean) => void;
}) {
  const [search, setSearch] = useState(filters.search ?? "");
  const [open, setOpen] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const facetToggleRef = useCallback<RefCallback<HTMLButtonElement>>((button) => {
    if (!button) return;
    return () => {
      // A results update can remove the toggle or the entire group while it has focus.
      if (button.ownerDocument.activeElement === button) {
        searchInput.current?.focus();
      }
    };
  }, []);
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef({ filters, onChange });
  latest.current = { filters, onChange };
  // The address follows a change only after the new posts arrived. Until then
  // further changes build on the pending one instead of on the old address.
  const pending = useRef<Filters | null>(null);
  const filtersInAddress = JSON.stringify(filters);
  useEffect(() => {
    pending.current = null;
  }, [filtersInAddress]);
  useEffect(() => {
    // Back and forward abandon a change that was still waiting for its posts.
    const forget = () => {
      pending.current = null;
      window.clearTimeout(timer.current);
      setSearch(latest.current.filters.search ?? "");
    };
    window.addEventListener("popstate", forget);
    return () => window.removeEventListener("popstate", forget);
  }, []);
  const id = useId();

  // Follow the address when it changes from outside (back button, "Clear filters").
  const searchInAddress = filters.search ?? "";
  useEffect(() => {
    // Not while the field already says the same: that would eat a space typed between two words.
    setSearch((typed) => (typed.trim() === searchInAddress ? typed : searchInAddress));
  }, [searchInAddress]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const set = (key: FilterKey, value: string, typing = false) => {
    const next: Filters = { ...(pending.current ?? latest.current.filters) };
    if (value) {
      next[key] = value;
    } else {
      delete next[key];
    }
    pending.current = next;
    latest.current.onChange(next, typing);
  };

  // Choosing the selected value of a group again removes it. "Selected" includes
  // a choice that is still on its way into the address.
  const toggle = (key: FilterKey, slug: string) => {
    const current = (pending.current ?? latest.current.filters)[key] ?? "";
    set(key, current === slug ? "" : slug);
  };

  const typeSearch = (value: string) => {
    setSearch(value);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => set("search", value.trim(), true), SEARCH_DELAY_MS);
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    window.clearTimeout(timer.current);
    set("search", search.trim());
  };

  const activeCount = FILTER_KEYS.filter((key) => key !== "search" && filters[key]).length;

  return (
    <aside className="cr-filters" aria-label="Search and filters">
      <form role="search" className="cr-filters__search" onSubmit={submitSearch}>
        <label className="cr-search" htmlFor={`${id}-search`}>
          <SearchIcon size={18} />
          <span className="cr-visually-hidden">Search posts</span>
          <input
            ref={searchInput}
            id={`${id}-search`}
            type="search"
            value={search}
            placeholder="Search posts"
            onChange={(event) => typeSearch(event.target.value)}
          />
        </label>
      </form>
      <button
        type="button"
        className="cr-button cr-filters__toggle"
        aria-expanded={open}
        aria-controls={`${id}-more`}
        onClick={() => setOpen(!open)}
      >
        <FilterIcon size={18} />
        {activeCount > 0 ? `Filters (${activeCount})` : "Filters"}
      </button>
      <div id={`${id}-more`} className="cr-filters__more" data-open={open || undefined}>
        <FacetGroup
          title="Categories"
          noun="categories"
          facets={facetCounts?.category_facets}
          selected={filters.category_facets ?? ""}
          onSelect={(slug) => toggle("category_facets", slug)}
          toggleRef={facetToggleRef}
        />
        <FacetGroup
          title="Tags"
          noun="tags"
          facets={facetCounts?.tag_facets}
          selected={filters.tag_facets ?? ""}
          onSelect={(slug) => toggle("tag_facets", slug)}
          toggleRef={facetToggleRef}
        />
        <MonthSelect
          facets={facetCounts?.date_facets}
          selected={filters.date_facets ?? ""}
          onSelect={(slug) => set("date_facets", slug)}
        />
        <fieldset className="cr-filters__dates">
          <legend>Published</legend>
          <label className="cr-field" htmlFor={`${id}-after`}>
            <span>From</span>
            <input
              id={`${id}-after`}
              type="date"
              value={filters.date_after ?? ""}
              max={filters.date_before || undefined}
              onChange={(event) => set("date_after", event.target.value)}
            />
          </label>
          <label className="cr-field" htmlFor={`${id}-before`}>
            <span>Until</span>
            <input
              id={`${id}-before`}
              type="date"
              value={filters.date_before ?? ""}
              min={filters.date_after || undefined}
              onChange={(event) => set("date_before", event.target.value)}
            />
          </label>
        </fieldset>
        <label className="cr-field" htmlFor={`${id}-order`}>
          <span>Order</span>
          <select id={`${id}-order`} value={filters.o ?? ""} onChange={(event) => set("o", event.target.value)}>
            <option value="">Newest first</option>
            <option value="visible_date">Oldest first</option>
          </select>
        </label>
      </div>
    </aside>
  );
}

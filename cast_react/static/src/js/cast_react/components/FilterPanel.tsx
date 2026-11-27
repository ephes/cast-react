// Search and filters of the post list. Every change becomes a new address
// (`?search=…&tag_facets=…`), so a filtered list can be bookmarked and shared.

import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { FILTER_KEYS, type Facet, type FacetCounts, type FilterKey, type Filters } from "../types";
import { FilterIcon, SearchIcon } from "./icons";

const SEARCH_DELAY_MS = 400;

function monthName(slug: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(slug);
  if (!match) {
    return slug;
  }
  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(date);
}

function FacetGroup({
  title,
  facets,
  selected,
  label = (facet) => facet.name,
  onSelect,
}: {
  title: string;
  facets: Facet[] | undefined;
  selected: string;
  label?: (facet: Facet) => string;
  onSelect: (slug: string) => void;
}) {
  const headingId = useId();
  // Keep a selected value visible even when the current result no longer lists it.
  const items = [...(facets ?? [])];
  if (selected && !items.some((facet) => facet.slug === selected)) {
    items.unshift({ slug: selected, name: selected, count: 0 });
  }
  if (items.length === 0) {
    return null;
  }
  return (
    <div className="cr-facets">
      <h3 id={headingId}>{title}</h3>
      <ul aria-labelledby={headingId}>
        {items.map((facet) => {
          const active = facet.slug === selected;
          return (
            <li key={facet.slug}>
              <button
                type="button"
                className="cr-facet"
                aria-pressed={active}
                onClick={() => onSelect(active ? "" : facet.slug)}
              >
                <span>{label(facet)}</span>
                <span className="cr-facet__count" aria-label={`${facet.count} posts`}>
                  {facet.count}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
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
          facets={facetCounts?.category_facets}
          selected={filters.category_facets ?? ""}
          onSelect={(slug) => set("category_facets", slug)}
        />
        <FacetGroup
          title="Tags"
          facets={facetCounts?.tag_facets}
          selected={filters.tag_facets ?? ""}
          onSelect={(slug) => set("tag_facets", slug)}
        />
        <FacetGroup
          title="Months"
          facets={facetCounts?.date_facets}
          selected={filters.date_facets ?? ""}
          label={(facet) => monthName(facet.slug)}
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

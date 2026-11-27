// Search and filters of the post list. Every change becomes a new address
// (`?search=…&tag_facets=…`), so a filtered list can be bookmarked and shared.

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { FormEvent, RefCallback } from "react";
import { FILTER_KEYS, type Facet, type FacetCounts, type FilterKey, type Filters } from "../types";
import { FilterIcon, SearchIcon } from "./icons";

const SEARCH_DELAY_MS = 400;
const FACET_LIMIT = 10;
const MONTH_SLUG = /^\d{4}-(?:0[1-9]|1[0-2])$/;

function pageLocale(): string {
  return document.documentElement.lang.split("@", 1)[0].trim().replaceAll("_", "-") || navigator.language;
}

function facetCollator(): Intl.Collator {
  const options = { sensitivity: "base" } as const;
  try {
    return new Intl.Collator(pageLocale(), options);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return new Intl.Collator(undefined, options);
  }
}

function searchableName(name: string): string {
  return name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replaceAll("ς", "σ");
}

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
  onFocusLost,
}: {
  title: string;
  noun: string;
  facets: Facet[] | undefined;
  selected: string;
  onSelect: (slug: string) => void;
  onFocusLost: () => void;
}) {
  const headingId = useId();
  const listId = useId();
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState<{ facet: Facet; inIndex: boolean } | null>(null);
  const topStrip = useRef<HTMLUListElement>(null);
  const removedControl = useRef<HTMLElement>(null);
  const rememberFocus = useCallback<RefCallback<HTMLElement>>((element) => {
    if (!element) return;
    removedControl.current = null;
    return () => {
      const active = element.ownerDocument.activeElement;
      if (active instanceof HTMLElement && element.contains(active)) removedControl.current = active;
    };
  }, []);
  const ranked = [...(facets ?? [])].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const canExpand = ranked.length > FACET_LIMIT;
  useLayoutEffect(() => {
    if (canExpand) return;
    setFocused((current) => current?.inIndex ? null : current);
    const control = removedControl.current;
    removedControl.current = null;
    if (!control) return;
    // Wait until the new strip is mounted before moving focus from the removed index.
    const slug = control.dataset.facetSlug;
    const pill = slug && Array.from(topStrip.current?.querySelectorAll("button") ?? [])
      .find((button) => button.dataset.facetSlug === slug);
    if (pill) pill.focus();
    else onFocusLost();
  }, [canExpand, onFocusLost]);
  const items = includeSelected(ranked, selected);
  // Keep a focused choice mounted if filtering drops it from the counts.
  const focusedFacet = focused && !items.some((facet) => facet.slug === focused.facet.slug)
    ? { ...focused.facet, count: 0 }
    : null;
  const strip = items.filter(
    (facet, index) => index < FACET_LIMIT || facet.slug === selected
      || (!focused?.inIndex && facet.slug === focused?.facet.slug),
  );
  if (focusedFacet && !focused?.inIndex) strip.push(focusedFacet);
  if (!strip.length) {
    return null;
  }
  const needle = searchableName(query.trim());
  const alphabetically = expanded && canExpand ? facetCollator().compare : null;
  const matches = alphabetically
    ? [...items, ...(focusedFacet && focused?.inIndex ? [focusedFacet] : [])]
        .filter((facet) => searchableName(facet.name).includes(needle)
          || (focused?.inIndex && facet.slug === focused.facet.slug))
        .sort((a, b) => alphabetically(a.name, b.name))
    : [];

  const renderFacet = (facet: Facet, inIndex: boolean) => (
    <li key={facet.slug}>
      <button
        type="button"
        className={inIndex ? "cr-facet-index__item" : "cr-facet"}
        data-facet-slug={facet.slug}
        aria-pressed={facet.slug === selected}
        onFocus={() => setFocused({ facet, inIndex })}
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

  return (
    <div className="cr-facets">
      <h3 id={headingId}>{title}</h3>
      <ul className="cr-facets__top" ref={topStrip} aria-labelledby={headingId}>
        {strip.map((facet) => renderFacet(facet, false))}
      </ul>
      {canExpand && (
        <>
          <button
            ref={rememberFocus}
            type="button"
            className="cr-button cr-button--quiet cr-facets__toggle"
            aria-expanded={expanded}
            aria-controls={listId}
            onClick={(event) => {
              if (expanded) {
                event.currentTarget.focus();
                setQuery("");
              }
              setExpanded(!expanded);
            }}
          >
            {expanded ? "Hide list" : `All ${ranked.length} ${noun}`}
          </button>
          <div id={listId} className="cr-facet-index" ref={rememberFocus} hidden={!expanded}>
            {expanded && (
              <>
                <label className="cr-field">
                  <span>Filter {noun}</span>
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape" && query) {
                        event.preventDefault();
                        setQuery("");
                      }
                    }}
                  />
                </label>
                {matches.length ? (
                  <ul className="cr-facet-index__items" aria-label={`All ${noun}`}>
                    {matches.map((facet) => renderFacet(facet, true))}
                  </ul>
                ) : (
                  <p className="cr-facet-index__empty" role="status">
                    No {noun === "tags" ? "tag" : "category"} matches
                  </p>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function monthFormatter(): Intl.DateTimeFormat {
  const options: Intl.DateTimeFormatOptions = {
    month: "long",
    year: "numeric",
    calendar: "gregory",
    timeZone: "UTC",
  };
  try {
    return new Intl.DateTimeFormat(pageLocale(), options);
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
  const dateRange = useRef<HTMLDetailsElement>(null);
  const { date_after, date_before } = filters;
  useLayoutEffect(() => {
    if (dateRange.current && (date_after || date_before)) dateRange.current.open = true;
  }, [date_after, date_before]);
  const focusSearch = useCallback(() => {
    searchInput.current?.focus();
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
          onFocusLost={focusSearch}
        />
        <FacetGroup
          title="Tags"
          noun="tags"
          facets={facetCounts?.tag_facets}
          selected={filters.tag_facets ?? ""}
          onSelect={(slug) => toggle("tag_facets", slug)}
          onFocusLost={focusSearch}
        />
        <MonthSelect
          facets={facetCounts?.date_facets}
          selected={filters.date_facets ?? ""}
          onSelect={(slug) => set("date_facets", slug)}
        />
        <details className="cr-filters__range" ref={dateRange}>
          <summary>Custom date range</summary>
          <fieldset className="cr-filters__dates">
            <legend>Published</legend>
            <label className="cr-field" htmlFor={`${id}-after`}>
              <span>From</span>
              <input
                id={`${id}-after`}
                type="date"
                value={date_after ?? ""}
                max={date_before || undefined}
                onChange={(event) => set("date_after", event.target.value)}
              />
            </label>
            <label className="cr-field" htmlFor={`${id}-before`}>
              <span>Until</span>
              <input
                id={`${id}-before`}
                type="date"
                value={date_before ?? ""}
                min={date_after || undefined}
                onChange={(event) => set("date_before", event.target.value)}
              />
            </label>
          </fieldset>
        </details>
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

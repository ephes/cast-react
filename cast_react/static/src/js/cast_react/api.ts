// Fetching JSON from the django-cast API, with a small in-memory cache so that
// going back to a list or a post already seen does not hit the network again.

import { useEffect, useRef, useState } from "react";
import type { Config } from "./config";
import { FILTER_KEYS, type Filters } from "./types";

interface CacheEntry {
  promise: Promise<unknown>;
  value?: unknown;
  settled: boolean;
}

const cache = new Map<string, CacheEntry>();

export function clearJsonCache(): void {
  cache.clear();
}

export function invalidateJson(url: string): void {
  cache.delete(url);
}

// The cached answer for `url`, if a request for it has already finished.
export function peekJson<T>(url: string): T | undefined {
  const entry = cache.get(url);
  return entry?.settled ? (entry.value as T) : undefined;
}

export function fetchJson<T>(url: string, options: { fresh?: boolean } = {}): Promise<T> {
  const cached = cache.get(url);
  if (cached && !options.fresh) {
    return cached.promise as Promise<T>;
  }
  const promise = fetch(url, { headers: { Accept: "application/json" }, credentials: "same-origin" }).then(
    (response) => {
      if (!response.ok) {
        throw new Error(`The server answered with status ${response.status}.`);
      }
      return response.json() as Promise<T>;
    },
  );
  const entry: CacheEntry = { promise, settled: false };
  cache.set(url, entry);
  promise.then(
    (value) => {
      entry.value = value;
      entry.settled = true;
    },
    () => {
      // A failed request must not stay cached: the next attempt should try again.
      if (cache.get(url) === entry) {
        cache.delete(url);
      }
    },
  );
  return promise;
}

export interface Resource<T> {
  // The newest answer. While another url is loading this is still the previous
  // one, so a list stays on screen while the next page is fetched.
  data: T | null;
  // The url `data` belongs to.
  dataUrl: string | null;
  error: Error | null;
  loading: boolean;
  // Fetch the current url again, keeping `data` until the new answer is there.
  reload: () => void;
}

export function useJson<T>(url: string | null): Resource<T> {
  const [, rerender] = useState(0);
  const [failure, setFailure] = useState<{ url: string; error: Error } | null>(null);
  const [reloading, setReloading] = useState(0);
  const latest = useRef<{ url: string; data: T } | null>(null);

  // Cached answers are used in the same render, without a loading state in
  // between: view transitions capture the finished page.
  const cached = url === null ? undefined : peekJson<T>(url);
  if (url !== null && cached !== undefined) {
    latest.current = { url, data: cached };
  }

  useEffect(() => {
    if (url === null || peekJson(url) !== undefined) {
      return;
    }
    let cancelled = false;
    fetchJson<T>(url).then(
      () => {
        if (!cancelled) {
          setFailure(null);
          rerender((count) => count + 1);
        }
      },
      (error: unknown) => {
        if (!cancelled) {
          setFailure({ url, error: error instanceof Error ? error : new Error(String(error)) });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [url, reloading]);

  const error = failure !== null && failure.url === url ? failure.error : null;
  return {
    data: latest.current?.data ?? null,
    dataUrl: latest.current?.url ?? null,
    error,
    loading: url !== null && cached === undefined && error === null,
    reload: () => {
      if (url !== null) {
        invalidateJson(url);
        setFailure(null);
        setReloading((count) => count + 1);
      }
    },
  };
}

function apiUrl(path: string): URL {
  return new URL(path, window.location.origin);
}

function applyFilters(url: URL, filters: Filters): void {
  for (const key of FILTER_KEYS) {
    const value = filters[key];
    if (value && key !== "o") {
      url.searchParams.set(key, value);
    }
  }
}

export function postListUrl(config: Config, filters: Filters, page: number): string {
  const url = apiUrl(config.pagesApiUrl);
  url.searchParams.set("child_of", String(config.blogId));
  url.searchParams.set("type", "cast.Post");
  url.searchParams.set("fields", "html_overview,visible_date,cover_image_poster_url");
  url.searchParams.set("limit", String(config.pageSize));
  url.searchParams.set("offset", String((Math.max(1, page) - 1) * config.pageSize));
  url.searchParams.set("order", filters.o === "visible_date" ? "visible_date" : "-visible_date");
  url.searchParams.set("use_post_filter", "true");
  // Without this the API renders posts as it does for feeds, which leaves out the player data.
  url.searchParams.set("render_for_feed", "false");
  applyFilters(url, filters);
  return url.toString();
}

export function facetCountsUrl(config: Config, filters: Filters): string {
  const url = apiUrl(config.facetCountsApiUrl);
  applyFilters(url, filters);
  return url.toString();
}

export function postDetailUrl(config: Config, slug: string, pageType: string): string {
  const url = apiUrl(config.pagesApiUrl);
  url.searchParams.set("child_of", String(config.blogId));
  url.searchParams.set("type", pageType || "cast.Post");
  url.searchParams.set("slug", slug);
  url.searchParams.set(
    "fields",
    "html_detail,visible_date,cover_image_poster_url,comments,comments_security_data,comments_are_enabled",
  );
  url.searchParams.set("render_for_feed", "false");
  return url.toString();
}

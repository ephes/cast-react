// A two-route router (post list, post detail) on top of the History API.
// It is small enough that a routing library would cost more than it saves.

import { useSyncExternalStore } from "react";
import { FILTER_KEYS, type Filters } from "./types";

export type Route =
  | { name: "PostList"; filters: Filters; page: number }
  | { name: "PostDetail"; slug: string }
  | { name: "Elsewhere" };

const listeners = new Set<() => void>();
const scrollPositions = new Map<string, number>();
let entryKey = "initial";
let entryCounter = 0;
let pendingScroll: number | null = null;

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function currentHref(): string {
  return window.location.pathname + window.location.search;
}

export function useHref(): string {
  return useSyncExternalStore(subscribe, currentHref);
}

export function parseRoute(href: string, blogUrl: string): Route {
  const url = new URL(href, window.location.origin);
  if (url.origin !== window.location.origin || !url.pathname.startsWith(blogUrl)) {
    return { name: "Elsewhere" };
  }
  const rest = url.pathname.slice(blogUrl.length);
  if (rest === "") {
    const filters: Filters = {};
    for (const key of FILTER_KEYS) {
      const value = url.searchParams.get(key);
      if (value) {
        filters[key] = value;
      }
    }
    const page = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
    return { name: "PostList", filters, page: Number.isNaN(page) || page < 1 ? 1 : page };
  }
  const match = /^([^/]+)\/?$/.exec(rest);
  if (match) {
    try {
      return { name: "PostDetail", slug: decodeURIComponent(match[1]) };
    } catch {
      // Not a valid percent-encoded slug.
    }
  }
  return { name: "Elsewhere" };
}

export function listHref(blogUrl: string, filters: Filters, page = 1): string {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = filters[key];
    if (value) {
      params.set(key, value);
    }
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  const query = params.toString();
  return query ? `${blogUrl}?${query}` : blogUrl;
}

export function detailHref(blogUrl: string, slug: string): string {
  return `${blogUrl}${encodeURIComponent(slug)}/`;
}

export function navigate(href: string, options: { replace?: boolean; keepScroll?: boolean } = {}): void {
  if (href === currentHref() && !options.replace) {
    return;
  }
  if (options.replace) {
    window.history.replaceState({ key: entryKey }, "", href);
  } else {
    scrollPositions.set(entryKey, window.scrollY);
    entryCounter += 1;
    entryKey = `entry-${Date.now()}-${entryCounter}`;
    window.history.pushState({ key: entryKey }, "", href);
    pendingScroll = options.keepScroll ? null : 0;
  }
  emit();
}

// Pages call this once their content is on screen: new pages start at the top,
// going back returns to where the reader was.
export function settleScroll(): void {
  if (pendingScroll !== null) {
    window.scrollTo(0, pendingScroll);
    pendingScroll = null;
  }
}

// True for plain left clicks that should become client-side navigations.
export function isPlainClick(event: {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
}): boolean {
  return (
    event.button === 0 &&
    !event.defaultPrevented &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

let started = false;

export function startRouter(): void {
  if (started) {
    return;
  }
  started = true;
  const state = window.history.state as { key?: string } | null;
  if (state?.key) {
    entryKey = state.key;
  } else {
    window.history.replaceState({ key: entryKey }, "", currentHref());
  }
  if ("scrollRestoration" in window.history) {
    window.history.scrollRestoration = "manual";
  }
  window.addEventListener("popstate", (event) => {
    scrollPositions.set(entryKey, window.scrollY);
    entryKey = (event.state as { key?: string } | null)?.key ?? "initial";
    pendingScroll = scrollPositions.get(entryKey) ?? 0;
    emit();
  });
}

// Client-side links. A link can name the API requests its target page needs;
// they are started on click and the page change waits briefly for them, so the
// crossfade goes to the finished page instead of to a loading state.

import type { AnchorHTMLAttributes, MouseEvent } from "react";
import { fetchJson } from "./api";
import { isPlainClick, navigate } from "./router";
import { withViewTransition } from "./viewTransitions";

const PREFETCH_WAIT_MS = 500;
let navigationCounter = 0;

export function go(href: string, prefetch: string[] = [], options: { replace?: boolean; keepScroll?: boolean } = {}) {
  navigationCounter += 1;
  const ticket = navigationCounter;
  const change = () => {
    // A newer navigation started while this one waited for its data.
    if (ticket === navigationCounter) {
      document.documentElement.classList.remove("cr-navigating");
      withViewTransition(() => navigate(href, options));
    }
  };
  if (prefetch.length === 0) {
    change();
    return;
  }
  document.documentElement.classList.add("cr-navigating");
  const ready = Promise.all(prefetch.map((url) => fetchJson(url).catch(() => undefined)));
  const timeout = new Promise((resolve) => window.setTimeout(resolve, PREFETCH_WAIT_MS));
  void Promise.race([ready, timeout]).then(change);
}

// Going back or forward while a link still waits for its data abandons that link.
window.addEventListener("popstate", () => {
  navigationCounter += 1;
  document.documentElement.classList.remove("cr-navigating");
});

interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  prefetch?: string[];
  keepScroll?: boolean;
}

export function Link({ href, prefetch, keepScroll, onClick, children, ...rest }: LinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (isPlainClick(event)) {
      event.preventDefault();
      go(href, prefetch, { keepScroll });
    }
  };
  return (
    <a href={href} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}

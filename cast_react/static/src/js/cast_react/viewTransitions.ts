// Crossfade between pages where the browser supports the View Transitions API.
// Readers who prefer reduced motion, and browsers without the API, get the
// change immediately.

import { flushSync } from "react-dom";

type StartViewTransition = (update: () => void) => { finished: Promise<void> };

export function withViewTransition(update: () => void): void {
  const start = (document as unknown as { startViewTransition?: StartViewTransition }).startViewTransition;
  const reducedMotion =
    typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (typeof start !== "function" || reducedMotion) {
    update();
    return;
  }
  // flushSync makes React apply the change inside the callback, so the browser
  // captures the new state as soon as the callback returns.
  const transition = start.call(document, () => flushSync(update));
  transition.finished.catch(() => undefined);
}

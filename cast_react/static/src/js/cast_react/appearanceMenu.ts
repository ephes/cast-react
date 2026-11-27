import { COLOR_SCHEMES, storeColorScheme, subscribeColorScheme } from "./colorScheme";

let closeOpenMenu: (() => void) | undefined;

// React and Django render the same controls and leave focus and selection to this controller.
export function initAppearanceMenu(root: HTMLElement): () => void {
  const trigger = root.querySelector<HTMLButtonElement>("[data-appearance-trigger]")!;
  const menu = root.querySelector<HTMLElement>('[role="menu"]')!;
  const items = COLOR_SCHEMES.map((scheme) => menu.querySelector<HTMLButtonElement>(`[data-scheme-choice="${scheme}"]`)!);
  const icons = trigger.querySelectorAll<HTMLElement>("[data-scheme-icon]");
  const listeners = new AbortController();
  const { signal } = listeners;
  let checked = 0;

  const unsubscribe = subscribeColorScheme((scheme) => {
    checked = COLOR_SCHEMES.indexOf(scheme);
    const label = items[checked].dataset.appearanceLabel!;
    trigger.title = label;
    trigger.setAttribute("aria-label", label);
    items.forEach((item, index) => item.setAttribute("aria-checked", String(index === checked)));
    for (const icon of icons) {
      icon.hidden = icon.dataset.schemeIcon !== scheme;
    }
  });

  function close(restoreFocus = false): void {
    if (closeOpenMenu === close) {
      closeOpenMenu = undefined;
    }
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    if (restoreFocus) {
      trigger.focus();
    }
  }

  function open(index: number): void {
    if (closeOpenMenu !== close) {
      closeOpenMenu?.();
      closeOpenMenu = close;
    }
    menu.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    items[index].focus();
  }

  // Native buttons send click for both Enter and Space.
  trigger.addEventListener("click", () => {
    if (menu.hidden) {
      open(checked);
    } else {
      close(true);
    }
  }, { signal });

  trigger.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      open(event.key === "ArrowDown" ? 0 : items.length - 1);
    }
  }, { signal });

  items.forEach((item, index) => {
    item.addEventListener("click", () => {
      storeColorScheme(COLOR_SCHEMES[index]);
      close(true);
    }, { signal });
  });

  root.addEventListener("keydown", (event) => {
    if (menu.hidden) {
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === "Tab") {
      // Continue the browser's tab order from the trigger in either direction.
      close(true);
    }
  }, { signal });

  menu.addEventListener("keydown", (event) => {
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    let next: number;
    switch (event.key) {
      case "ArrowDown":
        next = (index + 1) % items.length;
        break;
      case "ArrowUp":
        next = (index - 1 + items.length) % items.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = items.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    items[next].focus();
  }, { signal });

  function closeOutside(event: Event): void {
    if (!menu.hidden && event.target instanceof Node && !root.contains(event.target)) {
      close();
    }
  }
  document.addEventListener("click", closeOutside, { capture: true, signal });
  document.addEventListener("focusin", closeOutside, { signal });
  trigger.hidden = false;

  return () => {
    listeners.abort();
    unsubscribe();
    close();
    trigger.hidden = true;
  };
}

import "vite/modulepreload-polyfill";
import "../../css/cast_react/shared.css";

import { applyColorScheme, nextColorScheme, readColorScheme, SCHEME_LABELS, storeColorScheme } from "./colorScheme";

const appearance = document.querySelector<HTMLButtonElement>("[data-appearance]");
let scheme = readColorScheme();
applyColorScheme(scheme);

if (appearance) {
  const updateLabel = () => {
    const label = SCHEME_LABELS[scheme];
    appearance.title = label;
    appearance.setAttribute("aria-label", `${label}. Change`);
  };
  updateLabel();
  appearance.hidden = false;
  appearance.addEventListener("click", () => {
    scheme = nextColorScheme(scheme);
    storeColorScheme(scheme);
    updateLabel();
  });
}

// django-cast owns the full chooser's forms. Add the current label to its existing button.
const chooser = document.querySelector<HTMLElement>("[data-current-theme]");
if (chooser) {
  for (const form of chooser.querySelectorAll<HTMLFormElement>(".cast-select-theme form")) {
    const field = form.querySelector<HTMLInputElement>('input[name="template_base_dir"]');
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (field?.value === chooser.dataset.currentTheme && button && !button.hasAttribute("aria-current")) {
      button.setAttribute("aria-current", "true");
      const label = document.createElement("span");
      label.className = "cr-current-theme";
      label.textContent = chooser.dataset.currentLabel ?? "";
      button.append(label);
    }
  }
}

if (navigator.clipboard?.writeText) {
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-copy-feed]")) {
    const link = button.parentElement?.querySelector("a");
    if (!link) continue;
    const copy = button.textContent;
    const copyLabel = button.getAttribute("aria-label") ?? "";
    let reset: number | undefined;
    button.hidden = false;
    button.addEventListener("click", async () => {
      let status: string | undefined;
      try {
        await navigator.clipboard.writeText(link.href);
        status = button.dataset.copied;
      } catch {
        status = button.dataset.copyFailed;
      }
      button.textContent = status ?? copy;
      button.setAttribute("aria-label", status ?? copyLabel);
      window.clearTimeout(reset);
      reset = window.setTimeout(() => {
        button.textContent = copy;
        button.setAttribute("aria-label", copyLabel);
      }, 1800);
    });
  }
}

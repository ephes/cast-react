import "vite/modulepreload-polyfill";
import "../../css/cast_react/shared.css";

import { applyColorScheme, nextColorScheme, readColorScheme, SCHEME_LABELS, storeColorScheme } from "./colorScheme";
import { initFeedCopy } from "./feedCopy";

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

const themeForm = document.querySelector<HTMLFormElement>("form.cr-theme-select");
themeForm?.querySelector("select")?.addEventListener("change", () => themeForm.requestSubmit());

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

initFeedCopy();

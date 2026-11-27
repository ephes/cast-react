import "vite/modulepreload-polyfill";
import "../../css/cast_react/shared.css";

import { initAppearanceMenu } from "./appearanceMenu";
import { subscribeColorScheme } from "./colorScheme";
import { initFeedCopy } from "./feedCopy";

const appearance = document.querySelector<HTMLElement>(".cr-appearance[data-appearance]");
if (appearance) {
  initAppearanceMenu(appearance);
} else {
  subscribeColorScheme(() => {});
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

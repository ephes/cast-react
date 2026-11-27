// Enhance feed controls while leaving the links and primary URL fields usable without JavaScript.
export function initFeedCopy(root: ParentNode = document): void {
  for (const button of root.querySelectorAll<HTMLButtonElement>("[data-copy-feed][hidden]")) {
    const group = button.parentElement;
    const field = group?.querySelector<HTMLInputElement>("[data-feed-copy-url]");
    const status = group?.querySelector<HTMLElement>("[data-feed-copy-status]");
    const url = field?.value ?? group?.querySelector("a")?.href;
    if (!url || (!field && !navigator.clipboard?.writeText)) continue;
    const copy = button.textContent;
    const copyLabel = button.getAttribute("aria-label") ?? "";
    let reset: number | undefined;
    button.hidden = false;

    const report = (message = "", selected = false) => {
      const buttonLabel = selected ? "" : message;
      button.textContent = buttonLabel || copy;
      button.setAttribute("aria-label", buttonLabel || copyLabel);
      if (status) {
        status.classList.toggle("cr-visually-hidden", !selected);
        status.textContent = message;
      }
    };

    button.addEventListener("click", async () => {
      window.clearTimeout(reset);
      let message = button.dataset.copyFailed;
      try {
        await navigator.clipboard.writeText(url);
        message = button.dataset.copied;
      } catch {
        if (field) {
          field.hidden = false;
          field.focus();
          field.select();
          report(button.dataset.selected, true);
          return;
        }
      }
      report(message);
      reset = window.setTimeout(() => report(), 2400);
    });
  }
}

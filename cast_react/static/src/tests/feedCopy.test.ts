import { initFeedCopy } from "@/feedCopy";

function addControl(primary = true) {
  document.body.innerHTML = `
    <div>
      <a href="/show/feed/rss.xml">RSS</a>
      <input type="text" value="https://podcast.example.org/show/feed/rss.xml" data-feed-copy-url readonly ${primary ? "" : "hidden"}>
      <button data-copy-feed data-copied="Copied" data-selected="URL selected." aria-label="Copy RSS link" hidden>Copy</button>
      <span role="status" class="cr-visually-hidden" data-feed-copy-status></span>
    </div>`;
  return {
    button: document.querySelector("button")!,
    field: document.querySelector("input")!,
    status: document.querySelector('[role="status"]')!,
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

it("copies the absolute feed URL and reports success before restoring the button", async () => {
  vi.useFakeTimers();
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  const { button, field, status } = addControl();

  expect(button.hidden).toBe(true);
  expect(field.readOnly && !field.hidden).toBe(true);
  initFeedCopy();
  initFeedCopy();
  expect(button.hidden).toBe(false);
  button.click();
  await Promise.resolve();

  expect(writeText).toHaveBeenCalledExactlyOnceWith(field.value);
  expect(button.textContent).toBe("Copied");
  expect(status.textContent).toBe("Copied");
  vi.runAllTimers();
  expect(button.textContent).toBe("Copy");
  expect(button.getAttribute("aria-label")).toBe("Copy RSS link");
  expect(status.textContent).toBe("");
});

it.each([false, true])("reveals and selects the URL when the clipboard is unavailable or denied (denied: %s)", async (denied) => {
  const clipboard = denied ? { writeText: vi.fn().mockRejectedValue(new Error("Denied")) } : undefined;
  vi.stubGlobal("navigator", { clipboard });
  const { button, field, status } = addControl(false);
  initFeedCopy();
  expect(field.hidden).toBe(true);
  button.click();
  await Promise.resolve();

  expect(button.hidden).toBe(false);
  expect(button.textContent).toBe("Copy");
  expect(field.hidden).toBe(false);
  expect(document.activeElement).toBe(field);
  expect([field.selectionStart, field.selectionEnd]).toEqual([0, field.value.length]);
  expect(status.classList.contains("cr-visually-hidden")).toBe(false);
  expect(status.textContent).toBe("URL selected.");
});

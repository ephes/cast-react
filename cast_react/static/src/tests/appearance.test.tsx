import { initAppearanceMenu } from "@/appearanceMenu";
import { readColorScheme, storeColorScheme } from "@/colorScheme";
import { Header } from "@/components/Header";
import { readConfig } from "@/config";
import headTemplate from "../../../templates/cast/react/_appearance_head.html?raw";
import { cleanup, render } from "./helpers";

const sharedKey = "cast-color-scheme";
const legacyKey = "cast-react-color-scheme";
const otherLegacyKey = "cast-vue:color-scheme";
const rootElement = document.documentElement;
const applyBeforeStyles = new Function("document", headTemplate.match(/<script\b[^>]*>([\s\S]+)<\/script>/)![1]);
const configDocument = document.implementation.createHTMLDocument();
configDocument.body.innerHTML = '<div id="cast-react-configuration" data-blog-id="1" data-blog-title="Ground Loop"></div>';
const config = readConfig(configDocument);

let disconnect: (() => void) | undefined;

async function mount(layout: "SPA" | "Django") {
  if (layout === "SPA") {
    await render(<Header config={config} />);
  } else {
    // The Django template tests check that the server renders this control structure.
    document.body.innerHTML = `
      <div class="cr-appearance" data-appearance>
        <button type="button" data-appearance-trigger aria-controls="appearance" aria-haspopup="menu"
                aria-expanded="false" hidden>
          <span data-scheme-icon="light" hidden></span>
          <span data-scheme-icon="dark" hidden></span>
          <span data-scheme-icon="system"></span>
        </button>
        <div id="appearance" class="cr-appearance__menu" role="menu" aria-label="Appearance" hidden>
          <button type="button" data-scheme-choice="light" data-appearance-label="Appearance: Light"
                  role="menuitemradio" tabindex="-1">Light</button>
          <button type="button" data-scheme-choice="dark" data-appearance-label="Appearance: Dark"
                  role="menuitemradio" tabindex="-1">Dark</button>
          <button type="button" data-scheme-choice="system" data-appearance-label="Appearance: System"
                  role="menuitemradio" tabindex="-1">System</button>
        </div>
      </div>`;
    disconnect = initAppearanceMenu(document.querySelector<HTMLElement>("[data-appearance]")!);
  }

  const trigger = document.querySelector<HTMLButtonElement>("[data-appearance-trigger]")!;
  const menu = document.getElementById(trigger.getAttribute("aria-controls")!)!;
  const items = [...menu.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')];
  return { trigger, menu, items };
}

function key(target: Element, value: string, shiftKey = false) {
  return target.dispatchEvent(new KeyboardEvent("keydown", { key: value, shiftKey, bubbles: true, cancelable: true }));
}

function storageEvent(storageKey: string | null, storageArea = localStorage) {
  window.dispatchEvent(new StorageEvent("storage", { key: storageKey, storageArea }));
}

afterEach(async () => {
  await cleanup();
  disconnect?.();
  disconnect = undefined;
  document.body.replaceChildren();
  vi.restoreAllMocks();
  storeColorScheme("system");
  localStorage.clear();
  sessionStorage.clear();
});

describe.each(["SPA", "Django"] as const)("%s appearance menu", (layout) => {
  it("shows the current choice and opens and closes without changing it", async () => {
    localStorage.setItem(sharedKey, "dark");
    const { trigger, menu, items } = await mount(layout);

    expect(trigger.hidden).toBe(false);
    expect(trigger.title).toBe("Appearance: Dark");
    expect(trigger.getAttribute("aria-label")).toBe(trigger.title);
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger.querySelector("[data-scheme-icon]:not([hidden])")?.getAttribute("data-scheme-icon")).toBe("dark");
    expect(menu.hidden).toBe(true);
    expect(menu.getAttribute("aria-label")).toBe("Appearance");
    expect(items.map((item) => item.textContent?.trim())).toEqual(["Light", "Dark", "System"]);
    expect(items.map((item) => item.getAttribute("aria-checked"))).toEqual(["false", "true", "false"]);

    trigger.click();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(menu.hidden).toBe(false);
    expect(document.activeElement).toBe(items[1]);

    trigger.click();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(menu.hidden).toBe(true);
    expect(rootElement.dataset.colorScheme).toBe("dark");
    expect(localStorage.getItem(sharedKey)).toBe("dark");
  });

  it("closes on Escape, outside click and Tab in either direction", async () => {
    const { trigger, menu, items } = await mount(layout);

    trigger.click();
    expect(key(items[2], "Escape")).toBe(false);
    expect(menu.hidden).toBe(true);
    expect(document.activeElement).toBe(trigger);

    trigger.click();
    document.body.click();
    expect(menu.hidden).toBe(true);

    for (const shiftKey of [false, true]) {
      trigger.click();
      expect(key(items[2], "Tab", shiftKey)).toBe(true);
      expect(menu.hidden).toBe(true);
      expect(document.activeElement).toBe(trigger);
    }
  });

  it("opens on the first or last choice and wraps arrow navigation", async () => {
    const { trigger, items } = await mount(layout);
    expect(key(trigger, "ArrowDown")).toBe(false);
    expect(document.activeElement).toBe(items[0]);
    key(items[0], "ArrowUp");
    expect(document.activeElement).toBe(items[2]);
    key(items[2], "ArrowDown");
    expect(document.activeElement).toBe(items[0]);
    key(items[0], "End");
    expect(document.activeElement).toBe(items[2]);
    key(items[2], "Home");
    expect(document.activeElement).toBe(items[0]);
    key(items[0], "Escape");
    expect(key(trigger, "ArrowUp")).toBe(false);
    expect(document.activeElement).toBe(items[2]);
  });

  it.each([["Light", 0, "light"], ["Dark", 1, "dark"], ["System", 2, null]] as const)(
    "applies %s, clears both legacy keys and returns focus to the trigger",
    async (name, index, scheme) => {
      localStorage.setItem(sharedKey, "light");
      localStorage.setItem(legacyKey, "dark");
      localStorage.setItem(otherLegacyKey, "dark");
      const { trigger, menu, items } = await mount(layout);
      expect(rootElement.getAttribute("data-color-scheme")).toBe("light");

      trigger.click();
      items[index].click();
      expect(rootElement.getAttribute("data-color-scheme")).toBe(scheme);
      expect(localStorage.getItem(sharedKey)).toBe(scheme);
      expect(localStorage.getItem(legacyKey)).toBeNull();
      expect(localStorage.getItem(otherLegacyKey)).toBeNull();
      expect(trigger.title).toBe(`Appearance: ${name}`);
      expect(trigger.getAttribute("aria-label")).toBe(trigger.title);
      expect(menu.querySelector('[aria-checked="true"]')).toBe(items[index]);
      expect(menu.hidden).toBe(true);
      expect(document.activeElement).toBe(trigger);

      storageEvent(sharedKey);
      expect(rootElement.getAttribute("data-color-scheme")).toBe(scheme);
      expect(trigger.title).toBe(`Appearance: ${name}`);
      expect(readColorScheme()).toBe(scheme ?? "system");

      const reloadedDocument = document.implementation.createHTMLDocument();
      applyBeforeStyles(reloadedDocument);
      expect(reloadedDocument.documentElement.getAttribute("data-color-scheme")).toBe(scheme);
    },
  );

  it("syncs when another tab changes or clears the stored choice", async () => {
    const { trigger, menu, items } = await mount(layout);
    trigger.click();
    sessionStorage.setItem(sharedKey, "light");
    storageEvent(sharedKey, sessionStorage);
    expect(trigger.title).toBe("Appearance: System");

    localStorage.setItem(sharedKey, "dark");
    storageEvent(sharedKey);
    expect(rootElement.dataset.colorScheme).toBe("dark");
    expect(trigger.title).toBe("Appearance: Dark");
    expect(menu.querySelector('[aria-checked="true"]')).toBe(items[1]);

    localStorage.clear();
    storageEvent(null);
    expect(rootElement.hasAttribute("data-color-scheme")).toBe(false);
    expect(trigger.title).toBe("Appearance: System");
    expect(menu.querySelector('[aria-checked="true"]')).toBe(items[2]);

    localStorage.setItem(legacyKey, "light");
    storageEvent(legacyKey);
    expect(rootElement.dataset.colorScheme).toBe("light");
    expect(trigger.title).toBe("Appearance: Light");
    expect(menu.querySelector('[aria-checked="true"]')).toBe(items[0]);
  });
});

it.each([[1, "dark"], [2, null]] as const)("reads and removes the legacy choice when choosing item %i", async (index, result) => {
  localStorage.setItem(legacyKey, "light");
  const { trigger, items } = await mount("SPA");
  expect(trigger.title).toBe("Appearance: Light");
  expect(localStorage.getItem(sharedKey)).toBeNull();
  expect(localStorage.getItem(legacyKey)).toBe("light");

  trigger.click();
  items[index].click();
  expect(localStorage.getItem(legacyKey)).toBeNull();
  expect(localStorage.getItem(sharedKey)).toBe(result);
});

it("keeps the page usable when reading and writing storage throw", async () => {
  const denied = () => { throw new Error("Storage blocked"); };
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(denied);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(denied);
  vi.spyOn(Storage.prototype, "removeItem").mockImplementation(denied);
  const { trigger, items } = await mount("Django");

  expect(trigger.title).toBe("Appearance: System");
  trigger.click();
  items[1].click();
  expect(trigger.title).toBe("Appearance: Dark");
  expect(rootElement.dataset.colorScheme).toBe("dark");
  trigger.click();
  items[2].click();
  expect(trigger.title).toBe("Appearance: System");
  expect(rootElement.hasAttribute("data-color-scheme")).toBe(false);
});

it("retains the page choice when storage is readable but writing fails", async () => {
  localStorage.setItem(sharedKey, "light");
  const failedWrite = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage full"); });
  const { trigger, items } = await mount("SPA");
  trigger.click();
  items[1].click();
  expect(localStorage.getItem(sharedKey)).toBe("light");
  expect(readColorScheme()).toBe("dark");

  failedWrite.mockRestore();
  localStorage.removeItem(sharedKey);
  storageEvent(sharedKey);
  expect(trigger.title).toBe("Appearance: System");
});

it("leaves only one menu open and updates both controls when a choice is made", async () => {
  const { trigger, menu } = await mount("SPA");
  const second = await render(<Header config={config} />);
  const otherTrigger = second.querySelector<HTMLButtonElement>("[data-appearance-trigger]")!;
  const otherMenu = document.getElementById(otherTrigger.getAttribute("aria-controls")!)!;
  expect(otherMenu).not.toBe(menu);
  trigger.click();
  otherTrigger.click();
  expect(menu.hidden).toBe(true);
  expect(otherMenu.hidden).toBe(false);
  otherMenu.querySelector<HTMLButtonElement>('[data-scheme-choice="light"]')!.click();
  expect(trigger.title).toBe("Appearance: Light");
  expect(otherTrigger.title).toBe(trigger.title);
});

describe("pre-paint appearance", () => {
  it.each([
    [null, null, undefined],
    [null, "dark", "dark"],
    ["light", "dark", "light"],
    ["invalid", "dark", undefined],
  ])("reads shared %s before legacy %s", (shared, legacy, expected) => {
    localStorage.setItem(otherLegacyKey, "dark");
    if (shared !== null) localStorage.setItem(sharedKey, shared);
    if (legacy !== null) localStorage.setItem(legacyKey, legacy);
    applyBeforeStyles(document);
    expect(rootElement.dataset.colorScheme).toBe(expected);
    expect(readColorScheme()).toBe(expected ?? "system");
  });

  it("ignores unavailable storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Storage blocked"); });
    expect(() => applyBeforeStyles(document)).not.toThrow();
    expect(rootElement.hasAttribute("data-color-scheme")).toBe(false);
  });
});

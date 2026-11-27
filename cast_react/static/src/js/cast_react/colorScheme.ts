// Without an explicit choice, CSS follows the device's color scheme live.

export const COLOR_SCHEMES = ["light", "dark", "system"] as const;
export type ColorScheme = (typeof COLOR_SCHEMES)[number];

const STORAGE_KEY = "cast-color-scheme";
const LEGACY_KEY = "cast-react-color-scheme";
const VUE_LEGACY_KEY = "cast-vue:color-scheme";
const subscribers = new Set<(scheme: ColorScheme) => void>();
let pageChoice: ColorScheme | undefined;

export function readColorScheme(): ColorScheme {
  if (pageChoice) {
    return pageChoice;
  }
  let stored: string | null | undefined;
  try {
    stored = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY);
  } catch {
    stored = document.documentElement.dataset.colorScheme;
  }
  return stored === "light" || stored === "dark" ? stored : "system";
}

export function applyColorScheme(scheme: ColorScheme): void {
  if (scheme === "system") {
    delete document.documentElement.dataset.colorScheme;
  } else {
    document.documentElement.dataset.colorScheme = scheme;
  }
}

function publishColorScheme(scheme: ColorScheme): void {
  applyColorScheme(scheme);
  for (const update of subscribers) {
    update(scheme);
  }
}

export function storeColorScheme(scheme: ColorScheme): void {
  try {
    if (scheme !== "system") {
      localStorage.setItem(STORAGE_KEY, scheme);
    }
    localStorage.removeItem(LEGACY_KEY);
    localStorage.removeItem(VUE_LEGACY_KEY);
    if (scheme === "system") {
      // Clear both fallbacks before other tabs can see the shared key disappear.
      localStorage.removeItem(STORAGE_KEY);
    }
    pageChoice = undefined;
  } catch {
    // The choice lasts for this page if storage is blocked.
    pageChoice = scheme;
  }
  publishColorScheme(scheme);
}

function syncColorScheme(event: StorageEvent): void {
  if (event.key !== null && event.key !== STORAGE_KEY && event.key !== LEGACY_KEY) {
    return;
  }
  if (event.storageArea) {
    try {
      if (event.storageArea !== localStorage) {
        return;
      }
    } catch {
      return;
    }
  }
  pageChoice = undefined;
  publishColorScheme(readColorScheme());
}

export function subscribeColorScheme(update: (scheme: ColorScheme) => void): () => void {
  const scheme = readColorScheme();
  applyColorScheme(scheme);
  update(scheme);
  subscribers.add(update);
  window.addEventListener("storage", syncColorScheme);
  return () => {
    subscribers.delete(update);
    if (subscribers.size === 0) {
      window.removeEventListener("storage", syncColorScheme);
    }
  };
}

// Light and dark appearance. Without a choice the page follows the system
// setting (CSS `prefers-color-scheme`); an explicit choice is remembered.

export type ColorScheme = "auto" | "light" | "dark";

const STORAGE_KEY = "cast-react-color-scheme";

export function readColorScheme(): ColorScheme {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "auto";
  } catch {
    return "auto";
  }
}

export function applyColorScheme(scheme: ColorScheme): void {
  if (scheme === "auto") {
    delete document.documentElement.dataset.colorScheme;
  } else {
    document.documentElement.dataset.colorScheme = scheme;
  }
}

export function storeColorScheme(scheme: ColorScheme): void {
  applyColorScheme(scheme);
  try {
    if (scheme === "auto") {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, scheme);
    }
  } catch {
    // Private browsing or blocked storage: the choice lasts for this page only.
  }
}

export function systemPrefersDark(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

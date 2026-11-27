// Site header and footer: blog title, navigation, appearance and theme choice.

import { useEffect, useState } from "react";
import { fetchJson } from "../api";
import { type ColorScheme, readColorScheme, storeColorScheme } from "../colorScheme";
import type { Config } from "../config";
import { Link } from "../navigation";
import type { Theme } from "../types";
import { AutoIcon, FeedIcon, MoonIcon, SunIcon } from "./icons";

const THEME_SLUG = "react";
// The header has room for a handful of links; a site with more pages than that
// needs its own navigation.
const MAX_NAVIGATION_LINKS = 5;
const SCHEME_ORDER: ColorScheme[] = ["auto", "light", "dark"];
const SCHEME_LABELS: Record<ColorScheme, string> = {
  auto: "Appearance: same as your device",
  light: "Appearance: light",
  dark: "Appearance: dark",
};

function ColorSchemeButton() {
  const [scheme, setScheme] = useState<ColorScheme>(readColorScheme);
  const next = SCHEME_ORDER[(SCHEME_ORDER.indexOf(scheme) + 1) % SCHEME_ORDER.length];
  const change = () => {
    storeColorScheme(next);
    setScheme(next);
  };
  return (
    <button
      type="button"
      className="cr-icon-button"
      onClick={change}
      aria-label={`${SCHEME_LABELS[scheme]}. Change`}
      title={SCHEME_LABELS[scheme]}
    >
      {scheme === "auto" ? <AutoIcon /> : scheme === "light" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

export function Header({ config }: { config: Config }) {
  return (
    <header className="cr-header">
      <div className="cr-header__inner">
        <Link className="cr-header__title" href={config.blogUrl}>
          {config.blogTitle}
        </Link>
        <nav className="cr-header__nav" aria-label="Site">
          {config.navigation
            .filter((link) => link.href !== config.blogUrl)
            .slice(0, MAX_NAVIGATION_LINKS)
            .map((link) => (
              <a key={link.href} href={link.href}>
                {link.text}
              </a>
            ))}
          {config.feedUrl && (
            <a className="cr-icon-button" href={config.feedUrl} aria-label="Feeds" title="Feeds">
              <FeedIcon />
            </a>
          )}
          <ColorSchemeButton />
        </nav>
      </div>
    </header>
  );
}

// django-cast lets visitors pick another installed theme for themselves.
function ThemeSelect({ config }: { config: Config }) {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!config.themeListApiUrl) {
      return;
    }
    let cancelled = false;
    fetchJson<{ items?: Theme[] }>(config.themeListApiUrl).then(
      (data) => {
        if (!cancelled && Array.isArray(data.items)) {
          setThemes(data.items);
        }
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [config.themeListApiUrl]);

  if (themes.length < 2) {
    return null;
  }
  // This page is rendered by the React theme, whatever the site-wide default says.
  const selected = themes.some((theme) => theme.slug === THEME_SLUG) ? THEME_SLUG : "";

  const change = async (slug: string) => {
    if (!slug || slug === selected) {
      return;
    }
    setError("");
    try {
      const response = await fetch(config.themeUpdateApiUrl, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRFToken": config.csrfToken },
        body: JSON.stringify({ theme_slug: slug }),
      });
      if (!response.ok) {
        throw new Error(String(response.status));
      }
      // Leave a temporary `?theme=` preview, or it would keep showing this theme.
      const url = new URL(window.location.href);
      url.searchParams.delete("theme");
      url.searchParams.delete("template_base_dir");
      if (url.href === window.location.href) {
        window.location.reload();
      } else {
        window.location.assign(url.href);
      }
    } catch {
      setError("The theme could not be changed. Reload the page and choose again.");
    }
  };

  return (
    <div className="cr-theme-select">
      <label htmlFor="cr-theme-select">Site theme</label>
      <select id="cr-theme-select" value={selected} onChange={(event) => void change(event.target.value)}>
        {selected === "" && <option value="">Choose…</option>}
        {themes.map((theme) => (
          <option key={theme.slug} value={theme.slug}>
            {theme.name}
          </option>
        ))}
      </select>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

export function Footer({ config }: { config: Config }) {
  return (
    <footer className="cr-footer">
      <div className="cr-footer__inner">
        <p>{config.blogTitle}</p>
        <ThemeSelect config={config} />
      </div>
    </footer>
  );
}

// Site header and footer: blog title, navigation, appearance and theme choice.

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { fetchJson } from "../api";
import { initAppearanceMenu } from "../appearanceMenu";
import { COLOR_SCHEMES } from "../colorScheme";
import type { Config } from "../config";
import { Link } from "../navigation";
import type { Theme } from "../types";
import { CheckIcon, FeedIcon, MonitorIcon, MoonIcon, SunIcon } from "./icons";

const THEME_SLUG = "react";
// The header has room for a handful of links; a site with more pages than that
// needs its own navigation.
const MAX_NAVIGATION_LINKS = 5;

const APPEARANCE_OPTIONS = {
  light: { label: "Light", Icon: SunIcon },
  dark: { label: "Dark", Icon: MoonIcon },
  system: { label: "System", Icon: MonitorIcon },
};

function ColorSchemeButton() {
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();
  useLayoutEffect(() => initAppearanceMenu(root.current!), []);

  return (
    <div className="cr-appearance" data-appearance="" ref={root}>
      <button
        type="button"
        className="cr-icon-button"
        data-appearance-trigger=""
        aria-label="Appearance: System"
        title="Appearance: System"
        aria-haspopup="menu"
        aria-expanded="false"
        aria-controls={menuId}
        hidden
      >
        {COLOR_SCHEMES.map((scheme) => {
          const { Icon } = APPEARANCE_OPTIONS[scheme];
          return (
            <span key={scheme} data-scheme-icon={scheme} hidden={scheme !== "system"}>
              <Icon />
            </span>
          );
        })}
      </button>
      <div className="cr-appearance__menu" id={menuId} role="menu" aria-label="Appearance" hidden>
        {COLOR_SCHEMES.map((scheme) => {
          const { label, Icon } = APPEARANCE_OPTIONS[scheme];
          return (
            <button
              key={scheme}
              type="button"
              className="cr-appearance__option"
              data-scheme-choice={scheme}
              data-appearance-label={`Appearance: ${label}`}
              role="menuitemradio"
              aria-checked={scheme === "system"}
              tabIndex={-1}
            >
              <Icon />
              <span>{label}</span>
              <span className="cr-appearance__check"><CheckIcon size={16} /></span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Header({ config }: { config: Config }) {
  const feedUrl = config.feedUrl || config.subscribe?.feedPageUrl || config.subscribe?.blogRssUrl;
  const feedLabel = config.subscribe?.isPodcast ? "Subscribe" : "Feeds";
  return (
    <header className="cr-header">
      <div className="cr-header__inner">
        <Link className="cr-header__title" href={config.blogUrl}>
          {config.blogTitle}
        </Link>
        <div className="cr-header__controls">
          <nav className="cr-header__nav" aria-label="Site">
            {config.navigation
              .filter((link) => link.href !== config.blogUrl)
              .slice(0, MAX_NAVIGATION_LINKS)
              .map((link) => (
                <a key={link.href} href={link.href}>
                  {link.text}
                </a>
              ))}
          </nav>
          <div className="cr-header__actions">
            {feedUrl && (
              <a
                className={config.subscribe ? "cr-button cr-header__subscribe" : "cr-icon-button"}
                href={feedUrl}
                aria-label={config.subscribe ? undefined : feedLabel}
                title={config.subscribe ? undefined : feedLabel}
              >
                <FeedIcon size={config.subscribe ? 16 : undefined} />
                {config.subscribe && feedLabel}
              </a>
            )}
            <ColorSchemeButton />
          </div>
        </div>
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
  const { subscribe } = config;
  const feedUrl = config.feedUrl || subscribe?.feedPageUrl || subscribe?.blogRssUrl;
  return (
    <footer className="cr-footer">
      <div className="cr-footer__inner">
        <div className="cr-footer__site">
          <p>{config.blogTitle}</p>
          {subscribe && (feedUrl || subscribe.followLinks.length > 0) && (
            <nav className="cr-footer__links" aria-label="Follow">
              {feedUrl && <a href={feedUrl}>{subscribe.isPodcast ? "Subscribe" : "Feeds"}</a>}
              {subscribe.followLinks.map((link) => (
                <a key={link.label} href={link.url} rel={link.rel || undefined}>{link.label}</a>
              ))}
            </nav>
          )}
        </div>
        <ThemeSelect config={config} />
      </div>
    </footer>
  );
}

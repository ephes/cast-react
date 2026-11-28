import type { Config } from "../config";

// Where to follow the show (Mastodon, LinkedIn, ...): a quiet line below the podcast apps.
export function FollowLinks({ config }: { config: Config }) {
  const links = config.subscribe?.followLinks ?? [];
  if (links.length === 0) return null;
  return (
    <nav className="cr-follow" aria-label="Follow">
      <span className="cr-follow__label">Follow</span>
      <ul className="cr-follow__links">
        {links.map((link) => (
          <li key={link.url}>
            <a href={link.url} rel={link.rel || undefined}>
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

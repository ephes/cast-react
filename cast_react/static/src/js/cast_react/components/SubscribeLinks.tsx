import type { Config } from "../config";
import { FeedIcon, HeadphonesIcon, MusicIcon, PodcastIcon, VideoIcon } from "./icons";

const appIcons = { podcast: PodcastIcon, headphones: HeadphonesIcon, music: MusicIcon, video: VideoIcon };

export function SubscribeLinks({ config, episode = false }: { config: Config; episode?: boolean }) {
  const { subscribe } = config;
  if (!subscribe?.isPodcast) return null;
  const apps = subscribe.platformLinks.filter((link) => link.id !== "castro");
  const optionsUrl = subscribe.feedPageUrl || config.feedUrl;
  const more = optionsUrl || subscribe.podcastRssUrl;
  if (!more && apps.length === 0) return null;

  return (
    <div className={episode ? "cr-subscribe cr-subscribe--episode" : "cr-subscribe"}>
      <p className="cr-subscribe__label">
        {episode ? `Subscribe to ${config.blogTitle || "the podcast"}` : "Listen in your podcast app"}
      </p>
      <div className="cr-subscribe__links">
        {apps.map((link) => {
          const Icon = appIcons[link.icon];
          return (
            <a className="cr-button cr-subscribe-app" key={link.id} href={link.url}>
              <Icon size={16} /> {link.label}
            </a>
          );
        })}
        {more && (
          <a className="cr-button cr-subscribe-app cr-subscribe__more" href={more}>
            <FeedIcon size={16} />
            {optionsUrl ? "More options" : "RSS"}
          </a>
        )}
      </div>
    </div>
  );
}

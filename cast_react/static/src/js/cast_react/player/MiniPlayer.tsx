// A slim bar at the bottom of the window. It appears while an episode is
// loaded whose full player is not on the current page, so playback can be
// controlled from the list or from another post.

import { useEffect } from "react";
import type { CSSProperties, MouseEvent } from "react";
import { BackIcon, CloseIcon, ForwardIcon, PauseIcon, PlayIcon } from "../components/icons";
import { isPlainClick, navigate, parseRoute } from "../router";
import { formatTime } from "../time";
import { useHasMountedPlayer } from "./Player";
import { SKIP_BACK_SECONDS, SKIP_FORWARD_SECONDS, seek, skip, toggle, unloadTrack, usePlayerState } from "./store";

export function MiniPlayer({ blogUrl }: { blogUrl: string }) {
  const state = usePlayerState();
  const track = state.track;
  const hasFullPlayer = useHasMountedPlayer(track?.audioId ?? null);
  const visible = track !== null && !hasFullPlayer;

  useEffect(() => {
    // Leave room at the end of the page so the bar never covers the last lines.
    document.body.classList.toggle("cr-has-mini-player", visible);
    return () => document.body.classList.remove("cr-has-mini-player");
  }, [visible]);

  if (!track || !visible) {
    return null;
  }
  const playing = state.status === "playing" || state.status === "loading";
  const duration = state.duration || track.duration || 0;
  const permalink = track.permalink ?? "";
  const route = permalink ? parseRoute(permalink, blogUrl) : null;

  const openEpisode = (event: MouseEvent<HTMLAnchorElement>) => {
    if (route?.name === "PostDetail" && isPlainClick(event)) {
      event.preventDefault();
      const url = new URL(permalink, window.location.origin);
      navigate(url.pathname);
    }
  };

  return (
    <aside className="cr-mini" aria-label="Now playing">
      <input
        className="cr-mini__seek"
        type="range"
        min={0}
        max={Math.max(1, Math.floor(duration))}
        step={5}
        value={Math.floor(state.currentTime)}
        disabled={duration <= 0}
        aria-label="Position in the episode"
        aria-valuetext={`${formatTime(state.currentTime)} of ${formatTime(duration)}`}
        style={{ "--cr-progress": duration > 0 ? `${(state.currentTime / duration) * 100}%` : "0%" } as CSSProperties}
        onChange={(event) => seek(Number(event.target.value))}
      />
      <div className="cr-mini__row">
        <button
          type="button"
          className="cr-mini__play"
          data-loading={state.status === "loading" || undefined}
          onClick={() => toggle()}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <PauseIcon size={22} /> : <PlayIcon size={22} />}
        </button>
        <div className="cr-mini__text">
          {permalink ? (
            <a className="cr-mini__title" href={permalink} onClick={openEpisode}>
              {track.title}
            </a>
          ) : (
            <span className="cr-mini__title">{track.title}</span>
          )}
          <span className="cr-mini__time">
            {state.status === "error"
              ? "The audio could not be loaded"
              : `${formatTime(state.currentTime)} / ${formatTime(duration)}`}
          </span>
        </div>
        <button
          type="button"
          className="cr-mini__button cr-mini__button--wide"
          onClick={() => skip(-SKIP_BACK_SECONDS)}
          aria-label={`Back ${SKIP_BACK_SECONDS} seconds`}
        >
          <BackIcon size={22} />
        </button>
        <button
          type="button"
          className="cr-mini__button cr-mini__button--wide"
          onClick={() => skip(SKIP_FORWARD_SECONDS)}
          aria-label={`Forward ${SKIP_FORWARD_SECONDS} seconds`}
        >
          <ForwardIcon size={22} />
        </button>
        <button type="button" className="cr-mini__button" onClick={unloadTrack} aria-label="Stop and close the player">
          <CloseIcon size={20} />
        </button>
      </div>
    </aside>
  );
}

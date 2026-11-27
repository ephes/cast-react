// The episode player: transport, a seek bar divided into chapters, speed,
// mute and a link that starts at the current time.

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { BackIcon, ForwardIcon, LinkIcon, MutedIcon, PauseIcon, PlayIcon, VolumeIcon } from "../components/icons";
import { formatTime } from "../time";
import type { Chapter, PlayerPayload } from "../types";
import {
  RATES,
  SKIP_BACK_SECONDS,
  SKIP_FORWARD_SECONDS,
  loadTrack,
  seek,
  setRate,
  toggle,
  toggleMuted,
  usePlayerState,
  viewFor,
} from "./store";

// Which episodes currently have a full player on the page. The mini player
// stays out of the way for those.
const mountedPlayers = new Map<number, number>();
const mountListeners = new Set<() => void>();

function subscribeMounted(listener: () => void): () => void {
  mountListeners.add(listener);
  return () => mountListeners.delete(listener);
}

function changeMounted(audioId: number, delta: number): void {
  const count = (mountedPlayers.get(audioId) ?? 0) + delta;
  if (count > 0) {
    mountedPlayers.set(audioId, count);
  } else {
    mountedPlayers.delete(audioId);
  }
  for (const listener of mountListeners) {
    listener();
  }
}

export function useHasMountedPlayer(audioId: number | null): boolean {
  return useSyncExternalStore(subscribeMounted, () => audioId !== null && mountedPlayers.has(audioId));
}

export function chapterIndexAt(chapters: Chapter[], seconds: number): number {
  let index = -1;
  for (let i = 0; i < chapters.length; i += 1) {
    if (chapters[i].start <= seconds) {
      index = i;
    } else {
      break;
    }
  }
  return index;
}

// Seek within `track`, making it the current track first if it is not yet.
export function seekIn(track: PlayerPayload, seconds: number): void {
  loadTrack(track, { startAt: seconds });
}

interface Segment {
  start: number;
  end: number;
  title: string;
}

export function buildSegments(chapters: Chapter[], duration: number): Segment[] {
  if (duration <= 0) {
    return [];
  }
  const inside = chapters.filter((chapter) => chapter.start < duration);
  if (inside.length === 0) {
    return [{ start: 0, end: duration, title: "" }];
  }
  const segments: Segment[] = [];
  if (inside[0].start > 0) {
    segments.push({ start: 0, end: inside[0].start, title: "" });
  }
  inside.forEach((chapter, index) => {
    segments.push({ start: chapter.start, end: inside[index + 1]?.start ?? duration, title: chapter.title });
  });
  return segments.filter((segment) => segment.end > segment.start);
}

function SeekBar({
  chapters,
  currentTime,
  duration,
  onSeek,
}: {
  chapters: Chapter[];
  currentTime: number;
  duration: number;
  onSeek: (seconds: number) => void;
}) {
  const [hover, setHover] = useState<{ ratio: number; seconds: number } | null>(null);
  const segments = buildSegments(chapters, duration);
  const ratio = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const chapter = chapters[chapterIndexAt(chapters, currentTime)];

  const trackHover = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch" || duration <= 0) {
      return;
    }
    const box = event.currentTarget.getBoundingClientRect();
    const position = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    setHover({ ratio: position, seconds: position * duration });
  };
  const hoverChapter = hover ? chapters[chapterIndexAt(chapters, hover.seconds)] : undefined;

  return (
    <div className="cr-seek" onPointerMove={trackHover} onPointerLeave={() => setHover(null)}>
      <div className="cr-seek__track" aria-hidden="true">
        {segments.length === 0 && <span className="cr-seek__segment" style={{ flexGrow: 1 }} />}
        {segments.map((segment) => {
          const length = segment.end - segment.start;
          const filled = Math.min(1, Math.max(0, (currentTime - segment.start) / length));
          return (
            <span key={segment.start} className="cr-seek__segment" style={{ flexGrow: length }}>
              <span className="cr-seek__fill" style={{ width: `${filled * 100}%` }} />
            </span>
          );
        })}
        <span className="cr-seek__thumb" style={{ left: `${ratio * 100}%` }} />
      </div>
      {hover && (
        <span className="cr-seek__hint" style={{ left: `${hover.ratio * 100}%` }} aria-hidden="true">
          {formatTime(hover.seconds)}
          {hoverChapter ? ` ${hoverChapter.title}` : ""}
        </span>
      )}
      <input
        className="cr-seek__input"
        type="range"
        min={0}
        max={Math.max(1, Math.floor(duration))}
        step={5}
        value={Math.floor(currentTime)}
        disabled={duration <= 0}
        aria-label="Position in the episode"
        aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}${chapter ? `, ${chapter.title}` : ""}`}
        onChange={(event) => onSeek(Number(event.target.value))}
      />
    </div>
  );
}

function shareUrl(track: PlayerPayload, seconds: number): string {
  const url = new URL(track.permalink || window.location.href, window.location.origin);
  url.hash = "";
  if (seconds >= 1) {
    url.searchParams.set("t", String(Math.floor(seconds)));
  } else {
    url.searchParams.delete("t");
  }
  return url.toString();
}

function CopyLinkButton({ track, currentTime }: { track: PlayerPayload; currentTime: number }) {
  const [copied, setCopied] = useState<"no" | "yes" | "failed">("no");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    let result: "yes" | "failed" = "yes";
    try {
      await navigator.clipboard.writeText(shareUrl(track, currentTime));
    } catch {
      result = "failed";
    }
    setCopied(result);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied("no"), 2500);
  };

  const label =
    copied === "yes" ? "Link copied" : copied === "failed" ? "Copying is blocked here" : "Copy link to this moment";
  return (
    <button type="button" className="cr-button cr-button--quiet" onClick={() => void copy()}>
      <LinkIcon size={18} />
      <span aria-live="polite">{label}</span>
    </button>
  );
}

export function Player({ track, heading = true }: { track: PlayerPayload; heading?: boolean }) {
  const state = usePlayerState();
  const view = viewFor(state, track);
  const playing = view.status === "playing" || view.status === "loading";
  const chapter = track.chapters[chapterIndexAt(track.chapters, view.currentTime)];

  useEffect(() => {
    changeMounted(track.audioId, 1);
    return () => changeMounted(track.audioId, -1);
  }, [track.audioId]);

  const seekTo = (seconds: number) => {
    if (view.isCurrent) {
      seek(seconds);
    } else {
      seekIn(track, seconds);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      (target.tagName === "INPUT" && (target as HTMLInputElement).type !== "range")
    ) {
      return;
    }
    const key = event.key.toLowerCase();
    if (key === "k") {
      toggle(track);
    } else if (key === "j") {
      seekTo(view.currentTime - SKIP_BACK_SECONDS);
    } else if (key === "l") {
      seekTo(view.currentTime + SKIP_FORWARD_SECONDS);
    } else if (key === "m" && view.isCurrent) {
      toggleMuted();
    } else {
      return;
    }
    event.preventDefault();
  };

  const nextRate = RATES[(RATES.indexOf(state.rate) + 1) % RATES.length] ?? 1;
  const remaining = Math.max(0, view.duration - view.currentTime);

  return (
    <section className="cr-player" aria-label={`Audio player: ${track.title}`} onKeyDown={onKeyDown}>
      {heading && (
        <div className="cr-player__now">
          <p className="cr-player__title">{track.title}</p>
          <p className="cr-player__chapter">{chapter ? chapter.title : track.subtitle}</p>
        </div>
      )}
      <SeekBar chapters={track.chapters} currentTime={view.currentTime} duration={view.duration} onSeek={seekTo} />
      <div className="cr-player__clock">
        <span>{formatTime(view.currentTime)}</span>
        <span>{view.duration > 0 ? `-${formatTime(remaining)}` : ""}</span>
      </div>
      <div className="cr-player__controls">
        <button
          type="button"
          className="cr-player__rate"
          onClick={() => setRate(nextRate)}
          aria-label={`Playback speed ${state.rate}×. Change to ${nextRate}×`}
        >
          {state.rate}×
        </button>
        <div className="cr-player__transport">
          <button
            type="button"
            className="cr-player__skip"
            onClick={() => seekTo(view.currentTime - SKIP_BACK_SECONDS)}
            aria-label={`Back ${SKIP_BACK_SECONDS} seconds`}
          >
            <BackIcon size={26} />
            <span aria-hidden="true">{SKIP_BACK_SECONDS}</span>
          </button>
          <button
            type="button"
            className="cr-player__play"
            data-loading={view.status === "loading" || undefined}
            onClick={() => toggle(track)}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <PauseIcon size={28} /> : <PlayIcon size={28} />}
          </button>
          <button
            type="button"
            className="cr-player__skip"
            onClick={() => seekTo(view.currentTime + SKIP_FORWARD_SECONDS)}
            aria-label={`Forward ${SKIP_FORWARD_SECONDS} seconds`}
          >
            <ForwardIcon size={26} />
            <span aria-hidden="true">{SKIP_FORWARD_SECONDS}</span>
          </button>
        </div>
        <button
          type="button"
          className="cr-player__mute"
          onClick={toggleMuted}
          disabled={!view.isCurrent}
          aria-label={state.muted && view.isCurrent ? "Turn sound on" : "Mute"}
          aria-pressed={state.muted && view.isCurrent}
        >
          {state.muted && view.isCurrent ? <MutedIcon size={22} /> : <VolumeIcon size={22} />}
        </button>
      </div>
      {view.status === "error" && (
        <p className="cr-player__error" role="alert">
          This audio file could not be loaded. Check your connection and press play again.
        </p>
      )}
      <div className="cr-player__extras">
        <CopyLinkButton track={track} currentTime={view.currentTime} />
      </div>
    </section>
  );
}

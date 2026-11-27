// Chapters and transcript of an episode, shown next to (or below) its player.

import { memo, useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { fetchJson } from "../api";
import { SearchIcon } from "../components/icons";
import { formatTime } from "../time";
import type { Cue, PlayerPayload } from "../types";
import { chapterIndexAt } from "./Player";
import { play, usePlayerSelector } from "./store";

const FOLLOW_KEY = "cast-react-transcript-follow";
// Without speaker names a transcript is one long column; start a new block
// after a pause in speech or when a block gets long.
const PAUSE_SECONDS = 2.5;
const MAX_CUES_PER_BLOCK = 8;

export function isCueArray(value: unknown): value is Cue[] {
  return (
    Array.isArray(value) &&
    value.every((item: unknown) => {
      if (!item || typeof item !== "object") {
        return false;
      }
      const cue = item as Partial<Cue>;
      return (
        typeof cue.text === "string" &&
        typeof cue.speaker === "string" &&
        typeof cue.start === "number" &&
        Number.isFinite(cue.start) &&
        typeof cue.end === "number" &&
        Number.isFinite(cue.end)
      );
    })
  );
}

export interface CueBlock {
  speaker: string;
  start: number;
  cues: { cue: Cue; index: number }[];
}

export function groupCues(cues: Cue[]): CueBlock[] {
  const blocks: CueBlock[] = [];
  cues.forEach((cue, index) => {
    const last = blocks[blocks.length - 1];
    const previous = last?.cues[last.cues.length - 1]?.cue;
    const sameSpeaker = last !== undefined && last.speaker === cue.speaker;
    const continues =
      sameSpeaker &&
      (cue.speaker !== "" ||
        (last.cues.length < MAX_CUES_PER_BLOCK && previous !== undefined && cue.start - previous.end < PAUSE_SECONDS));
    if (last && continues) {
      last.cues.push({ cue, index });
    } else {
      blocks.push({ speaker: cue.speaker, start: cue.start, cues: [{ cue, index }] });
    }
  });
  return blocks;
}

export function activeCueIndex(cues: Cue[], seconds: number): number {
  let low = 0;
  let high = cues.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (cues[middle].start <= seconds) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found;
}

function useCurrentTime(track: PlayerPayload): number {
  // Half-second steps are enough here and keep the panels from rendering on every time update.
  return usePlayerSelector((state) =>
    state.track?.audioId === track.audioId ? Math.floor(state.currentTime * 2) / 2 : -1,
  );
}

export function ChapterList({ track }: { track: PlayerPayload }) {
  const currentTime = useCurrentTime(track);
  const active = currentTime >= 0 ? chapterIndexAt(track.chapters, currentTime) : -1;
  return (
    <ol className="cr-chapters">
      {track.chapters.map((chapter, index) => (
        <li key={chapter.start}>
          <button
            type="button"
            className="cr-chapters__item"
            aria-current={index === active ? "true" : undefined}
            onClick={() => void play(track, { startAt: chapter.start })}
          >
            <span className="cr-chapters__time">{formatTime(chapter.start)}</span>
            <span className="cr-chapters__title">{chapter.title}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

function highlight(text: string, query: string): ReactNode {
  if (!query) {
    return text;
  }
  const parts: ReactNode[] = [];
  const lower = text.toLowerCase();
  let position = 0;
  let match = lower.indexOf(query, position);
  while (match !== -1) {
    if (match > position) {
      parts.push(text.slice(position, match));
    }
    parts.push(<mark key={match}>{text.slice(match, match + query.length)}</mark>);
    position = match + query.length;
    match = lower.indexOf(query, position);
  }
  parts.push(text.slice(position));
  return parts;
}

const Block = memo(function Block({
  block,
  activeIndex,
  query,
  onSeek,
}: {
  block: CueBlock;
  // Index of the cue being spoken if it is inside this block, otherwise -1.
  activeIndex: number;
  query: string;
  onSeek: (seconds: number) => void;
}) {
  return (
    <div className="cr-transcript__block">
      <p className="cr-transcript__who">
        {block.speaker && (
          <>
            <span className="cr-transcript__initial" aria-hidden="true">
              {block.speaker.slice(0, 1)}
            </span>
            <span className="cr-transcript__speaker">{block.speaker}</span>
          </>
        )}
        <button
          type="button"
          className="cr-transcript__time"
          onClick={() => onSeek(block.start)}
          aria-label={`Play from ${formatTime(block.start)}${block.speaker ? `, ${block.speaker}` : ""}`}
        >
          {formatTime(block.start)}
        </button>
      </p>
      <p className="cr-transcript__text">
        {block.cues.map(({ cue, index }) => (
          // Not a tab stop each (a transcript has hundreds of lines): the arrow
          // keys move through the lines once the transcript text has focus.
          <span
            key={index}
            role="button"
            tabIndex={-1}
            className="cr-transcript__cue"
            data-cue={index}
            data-active={index === activeIndex || undefined}
            onClick={() => onSeek(cue.start)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSeek(cue.start);
              }
            }}
          >
            {highlight(cue.text, query)}{" "}
          </span>
        ))}
      </p>
    </div>
  );
});

function readFollow(): boolean {
  try {
    return window.localStorage.getItem(FOLLOW_KEY) !== "off";
  } catch {
    return true;
  }
}

export function Transcript({ track }: { track: PlayerPayload }) {
  const url = track.transcript?.url ?? null;
  const [cues, setCues] = useState<Cue[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [follow, setFollow] = useState(readFollow);
  const scroller = useRef<HTMLDivElement>(null);
  const searchId = useId();
  const currentTime = useCurrentTime(track);

  useEffect(() => {
    if (!url) {
      return;
    }
    let cancelled = false;
    setFailed(false);
    fetchJson<{ cues?: unknown }>(url, { fresh: attempt > 0 }).then(
      (data) => {
        if (!cancelled) {
          if (isCueArray(data.cues)) {
            setCues(data.cues);
          } else {
            setFailed(true);
          }
        }
      },
      () => {
        if (!cancelled) {
          setFailed(true);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [url, attempt]);

  const needle = query.trim().toLowerCase();
  const blocks = useMemo(() => groupCues(cues ?? []), [cues]);
  const shown = useMemo(() => {
    if (!needle) {
      return blocks;
    }
    return blocks
      .map((block) => ({ ...block, cues: block.cues.filter(({ cue }) => cue.text.toLowerCase().includes(needle)) }))
      .filter((block) => block.cues.length > 0)
      .map((block) => ({ ...block, start: block.cues[0].cue.start }));
  }, [blocks, needle]);
  const matchCount = needle ? shown.reduce((total, block) => total + block.cues.length, 0) : 0;
  const active = cues && currentTime >= 0 ? activeCueIndex(cues, currentTime) : -1;

  // Keep the spoken line in view, inside the panel only: the page itself never scrolls.
  useEffect(() => {
    const box = scroller.current;
    if (!follow || needle || active < 0 || !box) {
      return;
    }
    const line = box.querySelector<HTMLElement>(`[data-cue="${active}"]`);
    if (!line) {
      return;
    }
    const top = line.offsetTop - box.offsetTop;
    const comfortable = top >= box.scrollTop + 24 && top + line.offsetHeight <= box.scrollTop + box.clientHeight - 48;
    if (!comfortable) {
      const reducedMotion =
        typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      box.scrollTo({ top: Math.max(0, top - box.clientHeight / 3), behavior: reducedMotion ? "auto" : "smooth" });
    }
  }, [active, follow, needle]);

  const onSeek = useMemo(() => (seconds: number) => void play(track, { startAt: seconds }), [track]);

  // Arrow keys walk through the lines; Enter or Space on a line plays from there.
  const moveThroughLines = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }
    const lines = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("[data-cue]"));
    if (lines.length === 0) {
      return;
    }
    const focused = lines.indexOf(document.activeElement as HTMLElement);
    const spoken = lines.findIndex((line) => line.hasAttribute("data-active"));
    const from = focused >= 0 ? focused : spoken;
    const step = event.key === "ArrowDown" ? 1 : -1;
    const target = from < 0 ? 0 : Math.min(lines.length - 1, Math.max(0, from + step));
    event.preventDefault();
    lines[target].focus();
  };

  const toggleFollow = () => {
    const next = !follow;
    setFollow(next);
    try {
      window.localStorage.setItem(FOLLOW_KEY, next ? "on" : "off");
    } catch {
      // Storage is optional.
    }
  };

  if (failed) {
    return (
      <div className="cr-transcript__status" role="alert">
        <p>The transcript could not be loaded.</p>
        <button type="button" className="cr-button" onClick={() => setAttempt((count) => count + 1)}>
          Load transcript again
        </button>
      </div>
    );
  }
  if (cues === null) {
    return (
      <p className="cr-transcript__status" role="status">
        <span className="cr-spinner" aria-hidden="true" /> Loading transcript…
      </p>
    );
  }
  if (cues.length === 0) {
    return <p className="cr-transcript__status">This episode has no transcript text yet.</p>;
  }

  return (
    <div className="cr-transcript">
      <div className="cr-transcript__tools">
        <label className="cr-search" htmlFor={searchId}>
          <SearchIcon size={18} />
          <span className="cr-visually-hidden">Search the transcript</span>
          <input
            id={searchId}
            type="search"
            value={query}
            placeholder="Search the transcript"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <button type="button" className="cr-button cr-button--toggle" aria-pressed={follow} onClick={toggleFollow}>
          Follow playback
        </button>
      </div>
      <p className="cr-transcript__count" role="status">
        {needle ? (matchCount === 1 ? "1 line matches" : `${matchCount} lines match`) : ""}
      </p>
      <div
        className="cr-transcript__scroll"
        ref={scroller}
        tabIndex={0}
        role="group"
        aria-label="Transcript text. Use the arrow keys to move through the lines and Enter to play from a line."
        onKeyDown={moveThroughLines}
      >
        {shown.length === 0 && <p className="cr-transcript__status">No line contains “{query.trim()}”.</p>}
        {shown.map((block) => {
          const first = block.cues[0].index;
          const last = block.cues[block.cues.length - 1].index;
          return (
            <Block
              key={first}
              block={block}
              activeIndex={active >= first && active <= last ? active : -1}
              query={needle}
              onSeek={onSeek}
            />
          );
        })}
      </div>
    </div>
  );
}

type PanelName = "chapters" | "transcript";

export function PlayerPanels({ track, transcriptPageUrl = "" }: { track: PlayerPayload; transcriptPageUrl?: string }) {
  const hasChapters = track.chapters.length > 0;
  const hasTranscript = track.transcript !== null;
  const [selected, setSelected] = useState<PanelName>(hasChapters ? "chapters" : "transcript");
  const baseId = useId();
  if (!hasChapters && !hasTranscript) {
    return null;
  }
  const names: PanelName[] = [];
  if (hasChapters) {
    names.push("chapters");
  }
  if (hasTranscript) {
    names.push("transcript");
  }
  const current = names.includes(selected) ? selected : names[0];
  const labels: Record<PanelName, string> = {
    chapters: `Chapters (${track.chapters.length})`,
    transcript: "Transcript",
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
      return;
    }
    const step = event.key === "ArrowRight" ? 1 : -1;
    const next = names[(names.indexOf(current) + step + names.length) % names.length];
    setSelected(next);
    document.getElementById(`${baseId}-tab-${next}`)?.focus();
    event.preventDefault();
  };

  return (
    <div className="cr-panels">
      <div className="cr-panels__tabs" role="tablist" aria-label="Episode contents" onKeyDown={onKeyDown}>
        {names.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            id={`${baseId}-tab-${name}`}
            aria-selected={name === current}
            aria-controls={`${baseId}-panel-${name}`}
            tabIndex={name === current ? 0 : -1}
            className="cr-panels__tab"
            onClick={() => setSelected(name)}
          >
            {labels[name]}
          </button>
        ))}
      </div>
      <div
        className="cr-panels__panel"
        role="tabpanel"
        id={`${baseId}-panel-${current}`}
        aria-labelledby={`${baseId}-tab-${current}`}
      >
        {current === "chapters" ? <ChapterList track={track} /> : <Transcript track={track} />}
        {current === "transcript" && transcriptPageUrl && (
          <p className="cr-panels__more">
            <a href={transcriptPageUrl}>Open the transcript as a page</a>
          </p>
        )}
      </div>
    </div>
  );
}

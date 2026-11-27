// One audio element for the whole app. Because the element lives outside the
// page components, an episode keeps playing while the reader moves between the
// list and other posts.

import { useSyncExternalStore } from "react";
import type { PlayerPayload } from "../types";

export type PlayerStatus = "idle" | "loading" | "playing" | "paused" | "error";

export interface PlayerState {
  track: PlayerPayload | null;
  status: PlayerStatus;
  currentTime: number;
  duration: number;
  rate: number;
  muted: boolean;
}

export const RATES = [0.75, 1, 1.25, 1.5, 1.75, 2];
export const SKIP_BACK_SECONDS = 15;
export const SKIP_FORWARD_SECONDS = 30;

const RATE_KEY = "cast-react-rate";
const POSITION_KEY_PREFIX = "cast-react-position-";
const POSITION_SAVE_INTERVAL_SECONDS = 5;
// Do not resume right before the end: that would look like a broken player.
const RESUME_END_MARGIN_SECONDS = 15;

function readNumber(key: string): number | null {
  try {
    const value = Number.parseFloat(window.localStorage.getItem(key) ?? "");
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function writeNumber(key: string, value: number | null): void {
  try {
    if (value === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, String(value));
    }
  } catch {
    // Storage is optional.
  }
}

export function savedPosition(audioId: number): number {
  return readNumber(`${POSITION_KEY_PREFIX}${audioId}`) ?? 0;
}

function initialRate(): number {
  const stored = readNumber(RATE_KEY);
  return stored !== null && RATES.includes(stored) ? stored : 1;
}

let state: PlayerState = {
  track: null,
  status: "idle",
  currentTime: 0,
  duration: 0,
  rate: 1,
  muted: false,
};
let rateLoaded = false;
let audio: HTMLAudioElement | null = null;
let pendingStart: number | null = null;
let lastSavedAt = 0;
const listeners = new Set<() => void>();

function setState(patch: Partial<PlayerState>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPlayerState(): PlayerState {
  if (!rateLoaded) {
    rateLoaded = true;
    state = { ...state, rate: initialRate() };
  }
  return state;
}

export function usePlayerState(): PlayerState {
  return useSyncExternalStore(subscribe, getPlayerState);
}

// Subscribe to one value derived from the player state. The selector must
// return a primitive, so components that do not show the clock (list cards)
// are not rendered again on every time update.
export function usePlayerSelector<T extends string | number | boolean | null>(
  selector: (state: PlayerState) => T,
): T {
  return useSyncExternalStore(subscribe, () => selector(getPlayerState()));
}

function knownDuration(): number {
  if (audio && Number.isFinite(audio.duration) && audio.duration > 0) {
    return audio.duration;
  }
  return state.track?.duration ?? 0;
}

function savePosition(force = false): void {
  if (!state.track || !audio) {
    return;
  }
  const time = audio.currentTime;
  if (!force && Math.abs(time - lastSavedAt) < POSITION_SAVE_INTERVAL_SECONDS) {
    return;
  }
  lastSavedAt = time;
  const duration = knownDuration();
  const finished = duration > 0 && time > duration - RESUME_END_MARGIN_SECONDS;
  writeNumber(`${POSITION_KEY_PREFIX}${state.track.audioId}`, finished || time < 1 ? null : Math.floor(time));
}

function applyPendingStart(): void {
  if (audio && pendingStart !== null && audio.readyState >= 1) {
    const duration = knownDuration();
    audio.currentTime = duration > 0 ? Math.min(pendingStart, Math.max(0, duration - 1)) : pendingStart;
    pendingStart = null;
  }
}

function updateMediaSession(): void {
  if (!("mediaSession" in navigator) || typeof MediaMetadata === "undefined") {
    return;
  }
  const track = state.track;
  navigator.mediaSession.metadata = track
    ? new MediaMetadata({
        title: track.title,
        artist: track.subtitle,
        artwork: track.poster ? [{ src: track.poster }] : [],
      })
    : null;
}

function ensureAudio(): HTMLAudioElement {
  if (audio) {
    return audio;
  }
  const element = new Audio();
  element.preload = "metadata";
  audio = element;
  element.addEventListener("loadedmetadata", () => {
    applyPendingStart();
    setState({ duration: knownDuration(), currentTime: element.currentTime });
  });
  element.addEventListener("durationchange", () => setState({ duration: knownDuration() }));
  element.addEventListener("timeupdate", () => {
    if (pendingStart === null) {
      setState({ currentTime: element.currentTime });
      savePosition();
    }
  });
  element.addEventListener("seeked", () => setState({ currentTime: element.currentTime }));
  element.addEventListener("play", () => setState({ status: element.readyState >= 3 ? "playing" : "loading" }));
  element.addEventListener("playing", () => setState({ status: "playing" }));
  element.addEventListener("waiting", () => {
    if (!element.paused) {
      setState({ status: "loading" });
    }
  });
  // After unloadTrack() the element still reports a last pause; ignore it.
  const stopped = () => {
    if (state.track) {
      savePosition(true);
      setState({ status: "paused" });
    }
  };
  element.addEventListener("pause", stopped);
  element.addEventListener("ended", stopped);
  element.addEventListener("error", () => {
    if (state.track) {
      setState({ status: "error" });
    }
  });
  element.addEventListener("ratechange", () => setState({ rate: element.playbackRate }));
  element.addEventListener("volumechange", () => setState({ muted: element.muted }));
  window.addEventListener("pagehide", () => savePosition(true));

  if ("mediaSession" in navigator) {
    const handlers: [MediaSessionAction, () => void][] = [
      ["play", () => void play()],
      ["pause", () => pause()],
      ["seekbackward", () => skip(-SKIP_BACK_SECONDS)],
      ["seekforward", () => skip(SKIP_FORWARD_SECONDS)],
    ];
    for (const [action, handler] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // The browser does not know this action.
      }
    }
  }
  return element;
}

function pickSource(element: HTMLAudioElement, track: PlayerPayload): string {
  const playable = track.sources.find((source) => element.canPlayType(source.type) !== "");
  return (playable ?? track.sources[0])?.src ?? "";
}

// Make `track` the current one. `startAt` wins over the remembered position.
export function loadTrack(track: PlayerPayload, options: { startAt?: number | null } = {}): void {
  const current = getPlayerState();
  if (current.track?.audioId === track.audioId) {
    if (typeof options.startAt === "number") {
      seek(options.startAt);
    }
    return;
  }
  savePosition(true);
  const element = ensureAudio();
  const source = pickSource(element, track);
  const startAt = typeof options.startAt === "number" ? options.startAt : savedPosition(track.audioId);
  pendingStart = startAt > 0 ? startAt : null;
  lastSavedAt = startAt;
  element.src = source;
  element.playbackRate = current.rate;
  // Setting `src` resets the rate to the default one in some browsers.
  element.defaultPlaybackRate = current.rate;
  setState({
    track,
    status: source ? "paused" : "error",
    currentTime: startAt,
    duration: track.duration ?? 0,
  });
  updateMediaSession();
}

export async function play(track?: PlayerPayload, options: { startAt?: number | null } = {}): Promise<void> {
  if (track) {
    loadTrack(track, options);
  }
  if (!audio || !state.track || !audio.getAttribute("src")) {
    return;
  }
  if (state.status === "error") {
    // Pressing play after a failure tries the file again from where it stopped.
    pendingStart = state.currentTime > 0 ? state.currentTime : null;
    audio.load();
  }
  setState({ status: "loading" });
  try {
    await audio.play();
  } catch (error) {
    // A newer play/pause call interrupted this one; the newer call sets the status.
    if (error instanceof DOMException && error.name === "AbortError") {
      return;
    }
    setState({ status: audio.error ? "error" : "paused" });
  }
}

export function pause(): void {
  audio?.pause();
}

export function toggle(track?: PlayerPayload): void {
  const isCurrent = !track || state.track?.audioId === track.audioId;
  if (isCurrent && (state.status === "playing" || state.status === "loading")) {
    pause();
  } else {
    void play(track);
  }
}

export function seek(seconds: number): void {
  if (!audio || !state.track) {
    return;
  }
  const duration = knownDuration();
  const target = Math.max(0, duration > 0 ? Math.min(seconds, duration) : seconds);
  if (audio.readyState >= 1) {
    pendingStart = null;
    audio.currentTime = target;
  } else {
    pendingStart = target;
  }
  setState({ currentTime: target });
}

export function skip(delta: number): void {
  seek(state.currentTime + delta);
}

export function setRate(rate: number): void {
  writeNumber(RATE_KEY, rate);
  if (audio) {
    audio.defaultPlaybackRate = rate;
    audio.playbackRate = rate;
  }
  setState({ rate });
}

export function toggleMuted(): void {
  if (audio) {
    audio.muted = !audio.muted;
  }
}

// Stop playback and forget the current track (closes the mini player).
export function unloadTrack(): void {
  if (audio) {
    savePosition(true);
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }
  pendingStart = null;
  setState({ track: null, status: "idle", currentTime: 0, duration: 0 });
  updateMediaSession();
}

// What a player for `track` should show: live values if it is the current
// track, otherwise the remembered position and the duration from the payload.
export function viewFor(current: PlayerState, track: PlayerPayload) {
  if (current.track?.audioId === track.audioId) {
    return {
      isCurrent: true,
      status: current.status,
      currentTime: current.currentTime,
      duration: current.duration || track.duration || 0,
    };
  }
  return {
    isCurrent: false,
    status: "idle" as PlayerStatus,
    currentTime: savedPosition(track.audioId),
    duration: track.duration ?? 0,
  };
}

// Test hook: drop the audio element and all state.
export function resetPlayerForTests(): void {
  audio = null;
  pendingStart = null;
  lastSavedAt = 0;
  rateLoaded = false;
  state = { track: null, status: "idle", currentTime: 0, duration: 0, rate: 1, muted: false };
  listeners.clear();
}

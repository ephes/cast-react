// Minimal render helper on top of react-dom, so the tests need no extra library.

import { act } from "react";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom has no layout, so it does not implement scrolling.
Element.prototype.scrollTo = () => undefined;
window.scrollTo = () => undefined;

const mounted: { root: Root; container: HTMLElement }[] = [];

export async function render(node: ReactNode): Promise<HTMLElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  mounted.push({ root, container });
  await act(async () => {
    root.render(node);
  });
  return container;
}

export async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

export async function click(element: Element | null): Promise<void> {
  if (!element) {
    throw new Error("element to click not found");
  }
  await act(async () => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
  });
}

export async function cleanup(): Promise<void> {
  for (const { root, container } of mounted.splice(0)) {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  }
}

export function jsonResponse(data: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => data } as Response;
}

// A stand-in for HTMLAudioElement: jsdom does not implement playback.
export class FakeAudio extends EventTarget {
  static instances: FakeAudio[] = [];
  src = "";
  preload = "";
  currentTime = 0;
  duration = Number.NaN;
  paused = true;
  muted = false;
  playbackRate = 1;
  defaultPlaybackRate = 1;
  readyState = 0;
  error: unknown = null;

  constructor() {
    super();
    FakeAudio.instances.push(this);
  }

  canPlayType(type: string): string {
    return type === "audio/mpeg" ? "probably" : "";
  }

  getAttribute(name: string): string | null {
    return name === "src" && this.src ? this.src : null;
  }

  removeAttribute(name: string): void {
    if (name === "src") {
      this.src = "";
    }
  }

  load(): void {}

  async play(): Promise<void> {
    this.paused = false;
    this.dispatchEvent(new Event("play"));
    this.dispatchEvent(new Event("playing"));
  }

  pause(): void {
    this.paused = true;
    this.dispatchEvent(new Event("pause"));
  }

  // Test control: pretend the metadata arrived.
  ready(duration: number): void {
    this.duration = duration;
    this.readyState = 4;
    this.dispatchEvent(new Event("loadedmetadata"));
  }
}

export const TRACK = {
  audioId: 7,
  title: "Chapter marks, the underrated feature",
  subtitle: "How we cut an episode",
  duration: 600,
  permalink: "/show/episode-05/",
  poster: "",
  sources: [
    { type: "audio/mp4", src: "/media/episode.m4a" },
    { type: "audio/mpeg", src: "/media/episode.mp3" },
  ],
  chapters: [
    { start: 0, title: "Hello" },
    { start: 120, title: "The main story" },
    { start: 400, title: "Listener mail" },
  ],
  transcript: { url: "/cast/api/audios/7/player-transcript/?post_id=3" },
};

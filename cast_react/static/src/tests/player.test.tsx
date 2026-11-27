import { act } from "react";
import { clearJsonCache } from "@/api";
import { MiniPlayer } from "@/player/MiniPlayer";
import { PlayerPanels } from "@/player/Panels";
import { Player } from "@/player/Player";
import { getPlayerState, play, resetPlayerForTests, seek } from "@/player/store";
import { FakeAudio, TRACK, cleanup, click, jsonResponse, render, settle } from "./helpers";

const CUES = [
  { start: 1, end: 4, speaker: "Mara", text: "Welcome back to the show." },
  { start: 5, end: 9, speaker: "Mara", text: "Today we talk about chapter marks." },
  { start: 10, end: 14, speaker: "Tobias", text: "And about cables, briefly." },
];

beforeEach(() => {
  FakeAudio.instances = [];
  vi.stubGlobal("Audio", FakeAudio);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => jsonResponse({ cues: CUES })),
  );
  window.localStorage.clear();
  clearJsonCache();
  resetPlayerForTests();
});

afterEach(async () => {
  await cleanup();
  vi.unstubAllGlobals();
});

describe("Player", () => {
  it("shows the episode length before anything is loaded", async () => {
    const view = await render(<Player track={TRACK} />);
    expect(view.querySelector(".cr-player__clock")?.textContent).toBe("0:00-10:00");
    expect(view.querySelectorAll(".cr-seek__segment")).toHaveLength(3);
    expect(FakeAudio.instances).toHaveLength(0);
  });

  it("plays and pauses, choosing a source the browser can play", async () => {
    const view = await render(<Player track={TRACK} />);
    await click(view.querySelector(".cr-player__play"));
    expect(FakeAudio.instances[0].src).toBe("/media/episode.mp3");
    expect(getPlayerState().status).toBe("playing");
    expect(view.querySelector(".cr-player__play")?.getAttribute("aria-label")).toBe("Pause");
    await click(view.querySelector(".cr-player__play"));
    expect(getPlayerState().status).toBe("paused");
  });

  it("skips and shows the current chapter", async () => {
    const view = await render(<Player track={TRACK} />);
    await click(view.querySelector(".cr-player__play"));
    await act(async () => FakeAudio.instances[0].ready(600));
    await click(view.querySelector('[aria-label="Forward 30 seconds"]'));
    expect(FakeAudio.instances[0].currentTime).toBe(30);
    await act(async () => seek(130));
    expect(view.querySelector(".cr-player__chapter")?.textContent).toBe("The main story");
    expect(view.querySelector(".cr-seek__input")?.getAttribute("aria-valuetext")).toBe(
      "2:10 of 10:00, The main story",
    );
  });

  it("changes the speed and remembers it", async () => {
    const view = await render(<Player track={TRACK} />);
    await click(view.querySelector(".cr-player__rate"));
    expect(view.querySelector(".cr-player__rate")?.textContent).toBe("1.25×");
    expect(window.localStorage.getItem("cast-react-rate")).toBe("1.25");
  });

  it("resumes where the listener stopped", async () => {
    window.localStorage.setItem("cast-react-position-7", "200");
    const view = await render(<Player track={TRACK} />);
    expect(view.querySelector(".cr-player__clock")?.textContent).toBe("3:20-6:40");
    await click(view.querySelector(".cr-player__play"));
    await act(async () => FakeAudio.instances[0].ready(600));
    expect(FakeAudio.instances[0].currentTime).toBe(200);
  });
});

describe("PlayerPanels", () => {
  it("lists chapters and starts playback at the chosen one", async () => {
    const view = await render(<PlayerPanels track={TRACK} />);
    const chapters = view.querySelectorAll(".cr-chapters__item");
    expect(chapters).toHaveLength(3);
    await click(chapters[1]);
    await act(async () => FakeAudio.instances[0].ready(600));
    expect(FakeAudio.instances[0].currentTime).toBe(120);
    expect(view.querySelectorAll(".cr-chapters__item")[1].getAttribute("aria-current")).toBe("true");
  });

  it("loads the transcript only when its tab is opened", async () => {
    const view = await render(<PlayerPanels track={TRACK} />);
    expect(fetch).not.toHaveBeenCalled();
    await click(view.querySelectorAll('[role="tab"]')[1]);
    await settle();
    expect(fetch).toHaveBeenCalledTimes(1);
    const blocks = view.querySelectorAll(".cr-transcript__block");
    expect(blocks).toHaveLength(2);
    expect(blocks[0].querySelector(".cr-transcript__speaker")?.textContent).toBe("Mara");
    expect(blocks[0].querySelectorAll(".cr-transcript__cue")).toHaveLength(2);
  });

  it("marks the line being spoken", async () => {
    const view = await render(<PlayerPanels track={TRACK} />);
    await click(view.querySelectorAll('[role="tab"]')[1]);
    await settle();
    await act(async () => {
      await play(TRACK);
      FakeAudio.instances[0].ready(600);
      seek(6);
    });
    expect(view.querySelector("[data-active]")?.textContent?.trim()).toBe("Today we talk about chapter marks.");
  });

  it("explains a transcript that cannot be loaded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({}, 500)),
    );
    const view = await render(<PlayerPanels track={{ ...TRACK, chapters: [] }} />);
    await settle();
    expect(view.querySelector('[role="alert"]')?.textContent).toContain("could not be loaded");
  });

  it("renders nothing without chapters and transcript", async () => {
    const view = await render(<PlayerPanels track={{ ...TRACK, chapters: [], transcript: null }} />);
    expect(view.innerHTML).toBe("");
  });
});

describe("MiniPlayer", () => {
  it("appears only when the episode has no full player on the page", async () => {
    const view = await render(<MiniPlayer blogUrl="/show/" />);
    expect(view.querySelector(".cr-mini")).toBeNull();
    await act(async () => {
      await play(TRACK);
    });
    expect(view.querySelector(".cr-mini__title")?.textContent).toBe(TRACK.title);
    expect(document.body.classList.contains("cr-has-mini-player")).toBe(true);

    await render(<Player track={TRACK} />);
    expect(view.querySelector(".cr-mini")).toBeNull();
  });

  it("closes and stops playback", async () => {
    const view = await render(<MiniPlayer blogUrl="/show/" />);
    await act(async () => {
      await play(TRACK);
    });
    await click(view.querySelector('[aria-label="Stop and close the player"]'));
    expect(getPlayerState().track).toBeNull();
    expect(FakeAudio.instances[0].paused).toBe(true);
    expect(view.querySelector(".cr-mini")).toBeNull();
  });
});

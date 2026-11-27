// The pages API returns each post as rendered HTML (cast/react/post_body.html).
// This module takes that markup apart: the data the template attached to it,
// the audio player payloads, and the HTML that is left to show.

import type { ArticleMeta, PlayerPayload } from "./types";

export const PLAYER_SLOT_ATTRIBUTE = "data-cast-react-player";

export interface ParsedPost {
  html: string;
  meta: ArticleMeta;
  players: PlayerPayload[];
}

function isPlayerPayload(value: unknown): value is PlayerPayload {
  if (!value || typeof value !== "object") {
    return false;
  }
  const payload = value as Partial<PlayerPayload>;
  return (
    typeof payload.audioId === "number" &&
    Array.isArray(payload.sources) &&
    payload.sources.every((source) => source && typeof source.src === "string" && typeof source.type === "string")
  );
}

function normalizePayload(payload: PlayerPayload): PlayerPayload {
  const chapters = Array.isArray(payload.chapters)
    ? payload.chapters
        .filter(
          (chapter) =>
            chapter &&
            typeof chapter.title === "string" &&
            typeof chapter.start === "number" &&
            Number.isFinite(chapter.start),
        )
        .sort((a, b) => a.start - b.start)
    : [];
  const transcript =
    payload.transcript && typeof payload.transcript.url === "string" ? { url: payload.transcript.url } : null;
  return {
    audioId: payload.audioId,
    title: typeof payload.title === "string" ? payload.title : "",
    subtitle: typeof payload.subtitle === "string" ? payload.subtitle : "",
    duration: typeof payload.duration === "number" && payload.duration > 0 ? payload.duration : null,
    permalink: typeof payload.permalink === "string" ? payload.permalink : undefined,
    poster: typeof payload.poster === "string" ? payload.poster : "",
    sources: payload.sources,
    chapters,
    transcript,
  };
}

// Players are always returned. `playerSlots` decides where an empty element is
// left in the HTML for the app to render its own player into: nowhere ("none"),
// or for every player but the first ("afterFirst"), which the post page shows
// at the top itself.
export function parsePostHtml(
  html: string,
  options: { playerSlots: "none" | "afterFirst"; permalink?: string },
): ParsedPost {
  const doc = new DOMParser().parseFromString(html || "", "text/html");

  const data = doc.querySelector<HTMLElement>(".cast-react-article-data")?.dataset ?? {};
  const meta: ArticleMeta = {
    date: data.articleDate ?? "",
    dateTime: data.articleDateTime ?? "",
    author: data.articleAuthor ?? "",
    transcriptUrl: data.transcriptUrl ?? "",
  };
  // Set for a preview of a post that was never saved: its transcripts cannot be loaded yet.
  const noTranscripts = data.noTranscripts !== undefined;
  doc.querySelectorAll(".cast-react-article-data").forEach((node) => node.remove());

  const players: PlayerPayload[] = [];
  doc.querySelectorAll("cast-audio-player").forEach((element) => {
    const payloadId = element.getAttribute("data-payload") ?? "";
    const script = payloadId ? doc.getElementById(payloadId) : null;
    let payload: PlayerPayload | null = null;
    try {
      const parsed: unknown = JSON.parse(script?.textContent ?? "null");
      if (isPlayerPayload(parsed)) {
        payload = normalizePayload(parsed);
        if (noTranscripts) {
          payload.transcript = null;
        }
        // The mini player links back to the post an episode belongs to.
        payload.permalink = payload.permalink || options.permalink;
      }
    } catch {
      payload = null;
    }
    script?.remove();
    if (payload && !players.some((player) => player.audioId === payload.audioId)) {
      players.push(payload);
      if (options.playerSlots === "afterFirst" && players.length > 1) {
        const slot = doc.createElement("div");
        slot.setAttribute(PLAYER_SLOT_ATTRIBUTE, String(payload.audioId));
        element.replaceWith(slot);
        return;
      }
    }
    element.remove();
  });
  // Leftovers of django-cast's own player markup, which this theme replaces.
  doc.querySelectorAll(".cast-player__panels, cast-transcript, cast-chapters, podlove-player").forEach((node) =>
    node.remove(),
  );
  doc.querySelectorAll("section[class^='block-']").forEach((section) => {
    if (section.children.length === 0 && (section.textContent ?? "").trim() === "") {
      section.remove();
    }
  });

  return { html: doc.body.innerHTML.trim(), meta, players };
}

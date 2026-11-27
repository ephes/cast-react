import { PLAYER_SLOT_ATTRIBUTE, parsePostHtml } from "@/postHtml";

const payload = (audioId: number) =>
  JSON.stringify({
    audioId,
    title: "Episode",
    subtitle: "",
    duration: 540,
    poster: "",
    sources: [{ type: "audio/mpeg", src: `/media/${audioId}.mp3` }],
    chapters: [
      { start: 90, title: "Second" },
      { start: 0, title: "First" },
      { start: "soon", title: "Broken" },
    ],
    transcript: { url: `/transcript/${audioId}/` },
  });

const player = (audioId: number) => `
  <section class="block-audio">
    <script id="cast-player-data-${audioId}" type="application/json">${payload(audioId)}</script>
    <cast-audio-player id="cast-player-${audioId}" data-payload="cast-player-data-${audioId}"></cast-audio-player>
    <div class="cast-player__panels"><cast-transcript for="cast-player-${audioId}"></cast-transcript></div>
  </section>`;

const article = (body: string) => `
  <article>
    <div class="cast-react-article-data" hidden data-article-date="Nov. 24, 2026"
         data-article-date-time="2026-11-24T08:30:00+01:00" data-article-author="Mara"
         data-transcript-url="/show/episode/transcript/"></div>
    <section class="block-paragraph"><p>Hello</p></section>
    ${body}
  </article>`;

describe("parsePostHtml", () => {
  it("reads the article data and removes its element", () => {
    const parsed = parsePostHtml(article(""), { playerSlots: "none" });
    expect(parsed.meta).toEqual({
      date: "Nov. 24, 2026",
      dateTime: "2026-11-24T08:30:00+01:00",
      author: "Mara",
      transcriptUrl: "/show/episode/transcript/",
    });
    expect(parsed.html).not.toContain("cast-react-article-data");
    expect(parsed.html).toContain("<p>Hello</p>");
  });

  it("returns the players and removes django-cast's player markup", () => {
    const parsed = parsePostHtml(article(player(1)), { playerSlots: "none", permalink: "/show/episode/" });
    expect(parsed.players).toHaveLength(1);
    expect(parsed.players[0].audioId).toBe(1);
    expect(parsed.players[0].permalink).toBe("/show/episode/");
    expect(parsed.players[0].chapters.map((chapter) => chapter.title)).toEqual(["First", "Second"]);
    expect(parsed.html).not.toContain("cast-audio-player");
    expect(parsed.html).not.toContain("cast-player__panels");
    expect(parsed.html).not.toContain("block-audio");
    expect(parsed.html).not.toContain("<script");
  });

  it("drops the transcripts of a post that was never saved", () => {
    expect(parsePostHtml(article(player(1)), { playerSlots: "none" }).players[0].transcript).toEqual({
      url: "/transcript/1/",
    });
    const unsaved = article(player(1)).replace("data-article-author", "data-no-transcripts data-article-author");
    const parsed = parsePostHtml(unsaved, { playerSlots: "none" });
    expect(parsed.players).toHaveLength(1);
    expect(parsed.players[0].transcript).toBeNull();
  });

  it("leaves slots for every player after the first", () => {
    const parsed = parsePostHtml(article(player(1) + player(2)), { playerSlots: "afterFirst" });
    expect(parsed.players.map((track) => track.audioId)).toEqual([1, 2]);
    const doc = new DOMParser().parseFromString(parsed.html, "text/html");
    const slots = doc.querySelectorAll(`[${PLAYER_SLOT_ATTRIBUTE}]`);
    expect(slots).toHaveLength(1);
    expect(slots[0].getAttribute(PLAYER_SLOT_ATTRIBUTE)).toBe("2");
  });

  it("ignores a player whose data is missing or broken", () => {
    const broken = `<cast-audio-player data-payload="nope"></cast-audio-player>
      <script id="bad" type="application/json">{not json</script>
      <cast-audio-player data-payload="bad"></cast-audio-player>`;
    const parsed = parsePostHtml(article(broken), { playerSlots: "afterFirst" });
    expect(parsed.players).toEqual([]);
    expect(parsed.html).not.toContain("cast-audio-player");
  });

  it("copes with empty input", () => {
    expect(parsePostHtml("", { playerSlots: "none" })).toEqual({
      html: "",
      meta: { date: "", dateTime: "", author: "", transcriptUrl: "" },
      players: [],
    });
  });
});

import { pageNumbers } from "@/components/Pagination";
import { activeCueIndex, groupCues, isCueArray } from "@/player/Panels";
import { buildSegments, chapterIndexAt } from "@/player/Player";

const cue = (start: number, speaker: string, text = "text") => ({ start, end: start + 2, speaker, text });

describe("pageNumbers", () => {
  it("shows first, last and neighbours with gaps", () => {
    expect(pageNumbers(1, 1)).toEqual([1]);
    expect(pageNumbers(2, 3)).toEqual([1, 2, 3]);
    expect(pageNumbers(5, 10)).toEqual([1, 0, 4, 5, 6, 0, 10]);
    expect(pageNumbers(1, 10)).toEqual([1, 2, 0, 10]);
  });
});

describe("chapters", () => {
  const chapters = [
    { start: 0, title: "A" },
    { start: 100, title: "B" },
  ];

  it("finds the chapter at a time", () => {
    expect(chapterIndexAt(chapters, 0)).toBe(0);
    expect(chapterIndexAt(chapters, 99.9)).toBe(0);
    expect(chapterIndexAt(chapters, 100)).toBe(1);
    expect(chapterIndexAt([{ start: 10, title: "Late" }], 5)).toBe(-1);
  });

  it("builds one seek bar segment per chapter", () => {
    expect(buildSegments(chapters, 300)).toEqual([
      { start: 0, end: 100, title: "A" },
      { start: 100, end: 300, title: "B" },
    ]);
    expect(buildSegments([], 300)).toEqual([{ start: 0, end: 300, title: "" }]);
    expect(buildSegments([{ start: 50, title: "Late" }], 300)[0]).toEqual({ start: 0, end: 50, title: "" });
    expect(buildSegments([{ start: 500, title: "Beyond the end" }], 300)).toEqual([{ start: 0, end: 300, title: "" }]);
    expect(buildSegments(chapters, 0)).toEqual([]);
  });
});

describe("transcript helpers", () => {
  it("groups consecutive cues of a speaker", () => {
    const blocks = groupCues([cue(0, "Mara"), cue(3, "Mara"), cue(6, "Tobias"), cue(9, "Mara")]);
    expect(blocks.map((block) => [block.speaker, block.start, block.cues.length])).toEqual([
      ["Mara", 0, 2],
      ["Tobias", 6, 1],
      ["Mara", 9, 1],
    ]);
  });

  it("splits unlabelled cues at pauses", () => {
    const blocks = groupCues([cue(0, ""), cue(2.5, ""), cue(20, "")]);
    expect(blocks.map((block) => block.cues.length)).toEqual([2, 1]);
  });

  it("finds the cue being spoken", () => {
    const cues = [cue(1, ""), cue(5, ""), cue(9, "")];
    expect(activeCueIndex(cues, 0)).toBe(-1);
    expect(activeCueIndex(cues, 5)).toBe(1);
    expect(activeCueIndex(cues, 100)).toBe(2);
  });

  it("validates fetched cues", () => {
    expect(isCueArray([cue(0, "")])).toBe(true);
    expect(isCueArray([{ start: 0, text: "no end" }])).toBe(false);
    expect(isCueArray("cues")).toBe(false);
  });
});

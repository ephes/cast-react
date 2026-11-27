import { formatDuration, formatTime, parseStartTime } from "@/time";

describe("formatTime", () => {
  it("formats minutes and hours", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(65.9)).toBe("1:05");
    expect(formatTime(3725)).toBe("1:02:05");
  });

  it("treats invalid values as zero", () => {
    expect(formatTime(Number.NaN)).toBe("0:00");
    expect(formatTime(-3)).toBe("0:00");
  });
});

describe("formatDuration", () => {
  it("names the duration", () => {
    expect(formatDuration(45)).toBe("45 s");
    expect(formatDuration(540)).toBe("9 min");
    expect(formatDuration(4320)).toBe("1 h 12 min");
    expect(formatDuration(7200)).toBe("2 h");
    expect(formatDuration(0)).toBe("");
  });
});

describe("parseStartTime", () => {
  it("reads the formats used in shared links", () => {
    expect(parseStartTime("83")).toBe(83);
    expect(parseStartTime("1:23")).toBe(83);
    expect(parseStartTime("1:02:03")).toBe(3723);
    expect(parseStartTime("1h2m3s")).toBe(3723);
    expect(parseStartTime("2m")).toBe(120);
  });

  it("rejects everything else", () => {
    expect(parseStartTime(null)).toBeNull();
    expect(parseStartTime("")).toBeNull();
    expect(parseStartTime("soon")).toBeNull();
    expect(parseStartTime("-5")).toBeNull();
  });
});

// Clock formatting and the `t` start-time parameter of shared links.

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    seconds = 0;
  }
  const whole = Math.floor(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const rest = String(whole % 60).padStart(2, "0");
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${rest}`;
  }
  return `${minutes}:${rest}`;
}

// A duration the way a person would say it: "1 h 12 min", "38 min", "45 s".
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "";
  }
  if (seconds < 60) {
    return `${Math.round(seconds)} s`;
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const rest = minutes % 60;
  return rest ? `${Math.floor(minutes / 60)} h ${rest} min` : `${Math.floor(minutes / 60)} h`;
}

// Accepts "83", "1:23", "1:02:03" and "1h2m3s"; returns seconds or null.
export function parseStartTime(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const text = value.trim();
  if (/^\d+(\.\d+)?$/.test(text)) {
    return Number.parseFloat(text);
  }
  if (/^\d+(:\d{1,2}){1,2}$/.test(text)) {
    return text.split(":").reduce((total, part) => total * 60 + Number.parseInt(part, 10), 0);
  }
  const parts = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(text);
  if (parts && (parts[1] || parts[2] || parts[3])) {
    return Number(parts[1] ?? 0) * 3600 + Number(parts[2] ?? 0) * 60 + Number(parts[3] ?? 0);
  }
  return null;
}

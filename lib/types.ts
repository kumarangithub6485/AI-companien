export type Child = { id: string; name: string };

/** One captured fact: a value in a (dynamic) column for a child on a day. */
export type Entry = {
  id: string;
  childId: string;
  date: string; // YYYY-MM-DD (local)
  column: string;
  value: string;
  time: string | null; // HH:MM, 24h
  createdAt: number;
};

export type Extracted = { column: string; value: string; time: string | null };

export type Data = { children: Child[]; entries: Entry[] };

/** True in the read-only preview build, where the server, downloads and dialogs are unavailable. */
export const isDemo = () => typeof window !== "undefined" && !!(window as { CARE_DEMO?: boolean }).CARE_DEMO;

export const AGG = "Aggression";
export const AGG_LEVELS = ["none", "mild", "moderate", "severe"] as const;

export function aggLevel(value: string): number {
  const i = AGG_LEVELS.indexOf(value.trim().toLowerCase() as (typeof AGG_LEVELS)[number]);
  return i < 0 ? 2 : i; // an unrecognised aggression note still counts as an episode
}

export function toDateStr(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return toDateStr(new Date(y, m - 1, d + days));
}

export function fmtDate(date: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, opts);
}

export function fmtTime(time: string | null): string {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

/** Reuse an existing column name when the new one only differs by case/spacing. */
export function canonicalColumn(name: string, existing: string[]): string {
  const key = name.trim().toLowerCase().replace(/\s+/g, " ");
  const hit = existing.find((c) => c.toLowerCase() === key);
  if (hit) return hit;
  const t = name.trim().replace(/\s+/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

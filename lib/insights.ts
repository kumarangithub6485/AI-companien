import { AGG, aggLevel, shiftDate, type Entry } from "./types.ts";

export type Day = {
  date: string;
  level: number; // 0 none .. 3 severe (max of the day)
  aggTimes: (string | null)[];
  feats: Set<string>;
};

export type Driver = {
  label: string;
  lag: boolean; // true = the factor happened the day before
  withN: number;
  withAgg: number;
  withoutN: number;
  withoutAgg: number;
  rateWith: number;
  rateWithout: number;
  diff: number; // rateWith - rateWithout, in 0..1 terms
  p: number; // chance of a gap at least this unusual if the factor made no difference
  evidence: "strong" | "moderate" | "weak";
};

export const MIN_DAYS = 10; // logged days needed before drivers are shown
export const MIN_GROUP = 3; // days needed on each side of a comparison

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

function num(value: string): number | null {
  const m = norm(value).match(/^(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)?\b/);
  if (!m) return null;
  const n = Number(m[1]);
  return m[2] && m[2].startsWith("m") ? n / 60 : n;
}

/** One record per logged day. A logged day with no aggression mention counts as calm. */
export function buildDays(entries: Entry[], childId: string): Day[] {
  const mine = entries.filter((e) => e.childId === childId);
  const byDate = new Map<string, Entry[]>();
  for (const e of mine) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);

  // Columns whose values are mostly numbers get split at their median.
  const numeric = new Map<string, number>();
  const byCol = new Map<string, string[]>();
  for (const e of mine) if (e.column !== AGG) byCol.set(e.column, [...(byCol.get(e.column) ?? []), e.value]);
  for (const [col, vals] of byCol) {
    const ns = vals.map(num).filter((n): n is number => n !== null).sort((a, b) => a - b);
    if (ns.length >= 4 && ns.length / vals.length >= 0.6 && ns[0] !== ns[ns.length - 1]) {
      numeric.set(col, ns[Math.floor(ns.length / 2)]);
    }
  }

  const days: Day[] = [];
  for (const [date, es] of byDate) {
    const agg = es.filter((e) => e.column === AGG);
    const level = agg.reduce((mx, e) => Math.max(mx, aggLevel(e.value)), 0);
    const feats = new Set<string>();
    for (const e of es) {
      if (e.column === AGG) continue;
      const median = numeric.get(e.column);
      const n = num(e.value);
      if (median !== undefined && n !== null) {
        const m = Number(median.toFixed(1));
        feats.add(n >= median ? `${e.column}: ${m} or more` : `${e.column}: under ${m}`);
      } else {
        feats.add(`${e.column}: ${norm(e.value)}`);
      }
    }
    days.push({ date, level, aggTimes: agg.filter((e) => aggLevel(e.value) > 0).map((e) => e.time), feats });
  }
  return days.sort((a, b) => a.date.localeCompare(b.date));
}

export function findDrivers(days: Day[]): Driver[] {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const all = new Set<string>();
  for (const d of days) for (const f of d.feats) all.add(f);
  const out: Driver[] = [];

  for (const lag of [false, true]) {
    // For "day before" effects only days whose previous day was also logged can be judged.
    const pool = days
      .map((d) => ({ d, src: lag ? byDate.get(shiftDate(d.date, -1)) : d }))
      .filter((x): x is { d: Day; src: Day } => !!x.src);
    for (const f of all) {
      let withN = 0, withAgg = 0, withoutN = 0, withoutAgg = 0;
      for (const { d, src } of pool) {
        const a = d.level > 0 ? 1 : 0;
        if (src.feats.has(f)) { withN++; withAgg += a; } else { withoutN++; withoutAgg += a; }
      }
      if (withN < MIN_GROUP || withoutN < MIN_GROUP) continue;
      const rateWith = withAgg / withN;
      const rateWithout = withoutAgg / withoutN;
      const p = fisher(withAgg, withN - withAgg, withoutAgg, withoutN - withoutAgg);
      const evidence = p < 0.01 ? "strong" : p < 0.05 ? "moderate" : "weak";
      out.push({ label: f, lag, withN, withAgg, withoutN, withoutAgg, rateWith, rateWithout, diff: rateWith - rateWithout, p, evidence });
    }
  }
  // "Nap: yes" lowering aggression and "Nap: no" raising it are the same finding; keep the "raises" side.
  const mirrored = (a: Driver, b: Driver) =>
    a.lag === b.lag && a.label.split(":")[0] === b.label.split(":")[0] && a.withN === b.withoutN && a.withAgg === b.withoutAgg;
  const kept = out.filter((d) => d.diff > 0 || !out.some((o) => o.diff > 0 && mirrored(d, o)));
  return kept.sort((a, b) => a.p - b.p || Math.abs(b.diff) - Math.abs(a.diff));
}

/** Two-sided Fisher exact test for the 2x2 table [[a, b], [c, d]]. */
export function fisher(a: number, b: number, c: number, d: number): number {
  const lf = (n: number) => { let s = 0; for (let i = 2; i <= n; i++) s += Math.log(i); return s; };
  const r1 = a + b, r2 = c + d, c1 = a + c, n = r1 + r2;
  const prob = (x: number) =>
    Math.exp(lf(r1) + lf(r2) + lf(c1) + lf(n - c1) - lf(n) - lf(x) - lf(r1 - x) - lf(c1 - x) - lf(r2 - c1 + x));
  const obs = prob(a);
  let p = 0;
  for (let x = Math.max(0, c1 - r2); x <= Math.min(r1, c1); x++) if (prob(x) <= obs * (1 + 1e-9)) p += prob(x);
  return Math.min(1, p);
}

export const PARTS = ["Morning", "Afternoon", "Evening", "Night", "Time not given"] as const;

export function partOfDay(time: string | null): (typeof PARTS)[number] {
  if (!time) return "Time not given";
  const h = Number(time.slice(0, 2));
  return h >= 5 && h < 12 ? "Morning" : h >= 12 && h < 17 ? "Afternoon" : h >= 17 && h < 21 ? "Evening" : "Night";
}

export function describe(d: Driver): string {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const when = d.lag ? "the day after" : "on days with";
  return `Aggression happened ${when} “${d.label}” ${pct(d.rateWith)} of the time (${d.withAgg} of ${d.withN} days), compared with ${pct(d.rateWithout)} otherwise (${d.withoutAgg} of ${d.withoutN} days).`;
}

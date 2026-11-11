import { AGG, shiftDate, type Data, type Entry } from "./types.ts";

export const SAMPLE_CHILD_ID = "sample-child";

/** Deterministic made-up data so the charts can be explored before real logging starts. */
export function sampleData(today: string, daysBack = 90): Data {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
  const entries: Entry[] = [];
  let n = 0;
  const add = (date: string, column: string, value: string, time: string | null) =>
    entries.push({ id: `sample-${n++}`, childId: SAMPLE_CHILD_ID, date, column, value, time, createdAt: 0 });

  let prevSleep = 8;
  for (let i = daysBack - 1; i >= 0; i--) {
    const date = shiftDate(today, -i);
    if (rnd() < 0.08) continue; // a few days nobody logged
    const nap = rnd() < 0.6;
    const outing = pick(["park", "park", "school", "school", "mall", "none"]);
    const snack = rnd() < 0.7;
    add(date, "Breakfast", pick(["idli", "dosa", "cereal", "toast"]), "08:00");
    add(date, "Lunch", pick(["rice and dal", "chapati", "curd rice"]), "13:00");
    add(date, "Nap", nap ? "yes" : "no", nap ? "14:00" : null);
    add(date, "Outing", outing, outing === "none" ? null : "16:00");
    add(date, "Snacks", snack ? pick(["fruit", "biscuits"]) : "no", snack ? "17:00" : null);

    let p = 0.08;
    if (!nap) p += 0.4;
    if (prevSleep < 7) p += 0.25;
    if (outing === "mall") p += 0.25;
    if (rnd() < p) add(date, AGG, pick(["mild", "moderate", "moderate", "severe"]), pick(["18:30", "19:00", "17:30", "11:00"]));
    else add(date, AGG, "none", null);

    prevSleep = 5.5 + Math.round(rnd() * 7) / 2;
    add(date, "Night sleep", `${prevSleep} hours`, "21:00");
  }
  return { children: [{ id: SAMPLE_CHILD_ID, name: "Sample child (demo)" }], entries };
}

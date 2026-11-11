import { AGG, type Extracted } from "./types.ts";

/**
 * Keyword-based fallback used when no AI key is configured.
 * Far less capable than the AI extraction, but keeps the app usable offline.
 */

const PART_OF_DAY: [RegExp, string][] = [
  [/\bmorning\b/, "09:00"],
  [/\b(after ?noon|noon)\b/, "14:00"],
  [/\bevening\b/, "18:00"],
  [/\b(night|bedtime)\b/, "21:00"],
];

export function parseTime(text: string): string | null {
  const m = text.match(/\b(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?m\.?|p\.?m\.?|o'?clock)?/i);
  if (m && (m[3] || m[2])) {
    let h = Number(m[1]);
    const min = Number(m[2] ?? 0);
    const ap = (m[3] ?? "").toLowerCase();
    if (ap.startsWith("p") && h < 12) h += 12;
    if (ap.startsWith("a") && h === 12) h = 0;
    if (h < 24 && min < 60) return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  }
  for (const [re, t] of PART_OF_DAY) if (re.test(text)) return t;
  return null;
}

const NEG = /\b(no|not|didn'?t|did not|skipped|refused|without|wasn'?t|was not|never)\b/;

function clean(s: string): string {
  return s
    .replace(/\b(he|she|they|today|also|just|the child|had|has|have|ate|eaten|took|taken|was|were|is|a|an|the|some|for|at|in|on|to)\b/gi, " ")
    .replace(/\b\d{1,2}([:.]\d{2})?\s*(a\.?m\.?|p\.?m\.?)/gi, " ")
    .replace(/\b(morning|afternoon|evening|night)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function localExtract(transcript: string): Extracted[] {
  const clauses = transcript
    .toLowerCase()
    .split(/[.;,!?\n]|\band then\b|\bthen\b|\band\b|\bbut\b/)
    .map((c) => c.trim())
    .filter((c) => c.length > 2);
  const out: Extracted[] = [];
  for (const c of clauses) {
    const time = parseTime(c);
    const neg = NEG.test(c);
    let m: RegExpMatchArray | null;
    if (/aggress|violent|hit |hitting|bit |biting|kick|tantrum|meltdown|scream|threw/.test(c)) {
      const value = /\b(not|no|wasn'?t|was not|without)\b[^.]*aggress/.test(c) || /no aggression/.test(c)
        ? "none"
        : /severe|very|extremely|really|a lot|badly/.test(c)
          ? "severe"
          : /mild|slight|a little|a bit|somewhat/.test(c)
            ? "mild"
            : "moderate";
      out.push({ column: AGG, value, time: value === "none" ? null : time });
    } else if ((m = c.match(/\b(breakfast|lunch|dinner|supper)\b/))) {
      const col = m[1] === "supper" ? "Dinner" : m[1][0].toUpperCase() + m[1].slice(1);
      const v = clean(c.replace(m[1], " "));
      out.push({ column: col, value: neg ? "skipped" : v || "yes", time });
    } else if (/\bsnacks?\b/.test(c)) {
      const v = clean(c.replace(/\bsnacks?\b/, " "));
      out.push({ column: "Snacks", value: neg ? "no" : v || "yes", time });
    } else if (/\b(slept|sleep|nap|napped|woke|asleep)\b/.test(c)) {
      const d = c.match(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?)/);
      const isNap = /\bnap/.test(c);
      const value = neg ? "no" : d ? `${d[1]} ${d[2].startsWith("h") ? "hour" : "minute"}${Number(d[1]) === 1 ? "" : "s"}` : "yes";
      out.push({ column: isNap ? "Nap" : "Sleep", value, time });
    } else if ((m = c.match(/\b(?:went|go|gone|going|trip|visit(?:ed)?|walk(?:ed)?)\b(?: (?:out|over))?(?: to| in)?(?: the| a)? (.+)/))) {
      out.push({ column: "Outing", value: neg ? "none" : clean(m[1]) || "yes", time });
    } else if (/\b(had|ate|eat|eats|eaten|drank|drink)\b/.test(c) && clean(c).replace(/\b(my|son|daughter|eat|eats|drank|drink)\b/g, " ").trim()) {
      // "morning had a dosa": no meal named, so pick it from the time of day.
      const h = time ? Number(time.slice(0, 2)) : -1;
      const col = h < 0 ? "Food" : h < 11 ? "Breakfast" : h < 16 ? "Lunch" : h < 18 ? "Snacks" : "Dinner";
      out.push({ column: col, value: neg ? "no" : clean(c).replace(/\b(my|son|daughter|eat|eats|drank|drink)\b/g, " ").replace(/\s+/g, " ").trim(), time });
    } else if (out.length && c.split(" ").length <= 3 && !["none", "no", "yes", "skipped"].includes(out[out.length - 1].value) && out[out.length - 1].column !== AGG) {
      // A short leftover such as "idli" after "had dosa and idli" belongs to the previous item.
      out[out.length - 1].value += ` and ${clean(c) || c}`;
    } else if (/\b(calm|happy|cheerful|sad|anxious|upset|tired|restless|irritable|cranky)\b/.test(c)) {
      out.push({ column: "Mood", value: c.match(/\b(calm|happy|cheerful|sad|anxious|upset|tired|restless|irritable|cranky)\b/)![1], time });
    } else if (c.split(" ").length >= 2) {
      out.push({ column: "Notes", value: c, time });
    }
  }
  return out;
}

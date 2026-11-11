"use client";
import { AGG, aggLevel, fmtDate, fmtTime, type Child, type Data, type Entry } from "@/lib/types";

type Props = { child: Child; date: string; entries: Entry[]; update: (fn: (d: Data) => Data) => void };

export default function Timeline({ child, date, entries, update }: Props) {
  const day = entries
    .filter((e) => e.date === date)
    .sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99") || a.createdAt - b.createdAt);

  const remove = (id: string) => update((d) => ({ ...d, entries: d.entries.filter((e) => e.id !== id) }));
  const editValue = (e: Entry) => {
    const v = window.prompt(`${e.column}`, e.value)?.trim();
    if (v) update((d) => ({ ...d, entries: d.entries.map((x) => (x.id === e.id ? { ...x, value: v } : x)) }));
  };

  return (
    <section className="card">
      <h2>{child.name}: {fmtDate(date, { weekday: "long", day: "numeric", month: "long" })}</h2>
      {!day.length ? (
        <p className="empty">Nothing recorded for this day. Pick another date, or go to Record.</p>
      ) : (
        <ul className="timeline">
          {day.map((e) => (
            <li key={e.id} className={e.column === AGG && aggLevel(e.value) > 0 ? "agg" : ""}>
              <span className="t">{fmtTime(e.time) || "Any time"}</span>
              <span className="dot" />
              <span>
                <div className="col">{e.column}</div>
                <div className="val">{e.value}</div>
              </span>
              <span className="row" style={{ gap: 4 }}>
                <button className="btn small" onClick={() => editValue(e)}>Edit</button>
                <button className="btn small danger" onClick={() => remove(e.id)} aria-label={`Delete ${e.column}`}>Delete</button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

"use client";
import { useState } from "react";
import { AGG, aggLevel, fmtDate, fmtTime, type Child, type Data, type Entry } from "@/lib/types";

type Props = { child: Child; date: string; entries: Entry[]; update: (fn: (d: Data) => Data) => void };

export default function Timeline({ child, date, entries, update }: Props) {
  const day = entries
    .filter((e) => e.date === date)
    .sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99") || a.createdAt - b.createdAt);

  const remove = (id: string) => update((d) => ({ ...d, entries: d.entries.filter((e) => e.id !== id) }));
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const saveEdit = () => {
    const v = editing?.value.trim();
    if (editing && v) update((d) => ({ ...d, entries: d.entries.map((x) => (x.id === editing.id ? { ...x, value: v } : x)) }));
    setEditing(null);
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
                {editing?.id === e.id ? (
                  <form onSubmit={(ev) => { ev.preventDefault(); saveEdit(); }}>
                    <input className="field" autoFocus aria-label={`${e.column} value`} value={editing.value} onChange={(ev) => setEditing({ id: e.id, value: ev.target.value })} style={{ width: "100%" }} />
                  </form>
                ) : (
                  <div className="val">{e.value}</div>
                )}
              </span>
              <span className="row" style={{ gap: 4 }}>
                {editing?.id === e.id
                  ? <button className="btn small" onClick={saveEdit}>Save</button>
                  : <button className="btn small" onClick={() => setEditing({ id: e.id, value: e.value })}>Edit</button>}
                <button className="btn small danger" onClick={() => remove(e.id)} aria-label={`Delete ${e.column}`}>Delete</button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

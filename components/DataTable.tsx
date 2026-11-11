"use client";
import { useRef } from "react";
import { download } from "@/lib/store";
import { sampleData, SAMPLE_CHILD_ID } from "@/lib/sample";
import { AGG, fmtDate, isDemo, type Child, type Data, type Entry } from "@/lib/types";

type Props = {
  child?: Child;
  entries: Entry[];
  data: Data;
  today: string;
  update: (fn: (d: Data) => Data) => void;
  onPick: (date: string) => void;
  onChild: (id: string) => void;
};

export default function DataTable({ child, entries, data, today, update, onPick, onChild }: Props) {
  const file = useRef<HTMLInputElement>(null);
  const cols = [...new Set(entries.map((e) => e.column))].sort((a, b) => (a === AGG ? -1 : b === AGG ? 1 : 0));
  const dates = [...new Set(entries.map((e) => e.date))].sort().reverse();
  const cell = (date: string, col: string) => entries.filter((e) => e.date === date && e.column === col).map((e) => e.value).join("; ");

  const csv = () => {
    const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const lines = [["Date", ...cols].map(q).join(","), ...dates.map((d) => [d, ...cols.map((c) => cell(d, c))].map(q).join(","))];
    download(`${child?.name ?? "child"}-log.csv`, lines.join("\n"), "text/csv");
  };

  const loadSample = () => {
    const s = sampleData(today);
    update((d) => ({
      children: [...d.children.filter((c) => c.id !== SAMPLE_CHILD_ID), ...s.children],
      entries: [...d.entries.filter((e) => e.childId !== SAMPLE_CHILD_ID), ...s.entries],
    }));
    onChild(SAMPLE_CHILD_ID);
  };

  const restore = async (f: File) => {
    try {
      const d = JSON.parse(await f.text()) as Data;
      if (!Array.isArray(d.children) || !Array.isArray(d.entries)) throw new Error();
      if (window.confirm("Replace everything on this device with the backup file?")) update(() => d);
    } catch {
      window.alert("That file is not a Care Companion backup.");
    }
  };

  const removeChild = () => {
    if (!child || !window.confirm(`Delete ${child.name} and all of their records from this device? This cannot be undone.`)) return;
    update((d) => ({ children: d.children.filter((c) => c.id !== child.id), entries: d.entries.filter((e) => e.childId !== child.id) }));
  };

  return (
    <>
      <section className="card">
        <div className="row spread">
          <div>
            <h2>{child ? `${child.name}: all days` : "All days"}</h2>
            <p className="sub">Columns appear as you mention new things. Tap a row to open that day.</p>
          </div>
          {!isDemo() && <button className="btn" onClick={csv} disabled={!dates.length}>Download CSV</button>}
        </div>
        {!dates.length ? (
          <p className="empty">No records yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Date</th>{cols.map((c) => <th key={c}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {dates.map((d) => (
                  <tr key={d} onClick={() => onPick(d)}>
                    <td>{fmtDate(d, { day: "numeric", month: "short", year: "numeric" })}</td>
                    {cols.map((c) => <td key={c}>{cell(d, c)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Your data</h2>
        <p className="sub">Records are kept in this browser on this device only. Download a backup regularly, and use it to move to another device.</p>
        {isDemo() ? <p className="notice">Backup, restore and CSV download are available in the real app, not in this preview.</p> : <div className="row" style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => download("care-companion-backup.json", JSON.stringify(data), "application/json")}>Download backup</button>
          <button className="btn" onClick={() => file.current?.click()}>Restore backup</button>
          <input ref={file} type="file" accept="application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) restore(f); e.target.value = ""; }} />
          <button className="btn" onClick={loadSample}>Load sample data</button>
          {child && <button className="btn danger" onClick={removeChild}>Delete {child.name}</button>}
        </div>}
      </section>
    </>
  );
}

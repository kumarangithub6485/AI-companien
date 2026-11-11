"use client";
import { useEffect, useMemo, useState } from "react";
import { useData, uid } from "@/lib/store";
import { fmtDate, shiftDate, toDateStr } from "@/lib/types";
import Recorder from "@/components/Recorder";
import Timeline from "@/components/Timeline";
import DataTable from "@/components/DataTable";
import Insights from "@/components/Insights";

const TABS = ["Record", "Timeline", "Table", "Insights"] as const;
type Tab = (typeof TABS)[number];

export default function Home() {
  const { data, update, ready } = useData();
  const [tab, setTab] = useState<Tab>("Record");
  const [date, setDate] = useState(() => toDateStr(new Date()));
  const [childId, setChildId] = useState("");

  useEffect(() => {
    if (!data.children.some((c) => c.id === childId)) setChildId(data.children[0]?.id ?? "");
  }, [data.children, childId]);

  const child = data.children.find((c) => c.id === childId);
  const entries = useMemo(() => data.entries.filter((e) => e.childId === childId), [data.entries, childId]);
  const columns = useMemo(() => [...new Set(entries.map((e) => e.column))], [entries]);

  const addChild = () => {
    const name = window.prompt("Child's name")?.trim();
    if (!name) return;
    const id = uid();
    update((d) => ({ ...d, children: [...d.children, { id, name }] }));
    setChildId(id);
  };

  if (!ready) return null;

  return (
    <main className="app">
      <header className="top">
        <h1 className="brand">Care Companion</h1>
        <div className="controls">
          <select className="field" aria-label="Child" value={childId} onChange={(e) => setChildId(e.target.value)} disabled={!data.children.length}>
            {!data.children.length && <option value="">No child yet</option>}
            {data.children.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button className="btn" onClick={addChild}>+ Add child</button>
          <span className="row" style={{ gap: 4 }}>
            <button className="btn icon" aria-label="Previous day" onClick={() => setDate(shiftDate(date, -1))}>‹</button>
            <input className="field" type="date" aria-label="Date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
            <button className="btn icon" aria-label="Next day" onClick={() => setDate(shiftDate(date, 1))}>›</button>
          </span>
        </div>
      </header>

      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className="tab" onClick={() => setTab(t)}>{t}</button>
        ))}
      </nav>

      {!child && tab !== "Table" ? (
        <div className="card empty">
          <p style={{ marginBottom: 12 }}>Add a child to start recording their day.</p>
          <button className="btn primary" onClick={addChild}>+ Add child</button>
          <p className="muted" style={{ marginTop: 12 }}>Want to look around first? Open the Table tab and load the sample data.</p>
        </div>
      ) : (
        <>
          {tab === "Record" && child && (
            <Recorder child={child} date={date} columns={columns} update={update} onSaved={() => setTab("Timeline")} />
          )}
          {tab === "Timeline" && child && <Timeline child={child} date={date} entries={entries} update={update} />}
          {tab === "Table" && (
            <DataTable child={child} entries={entries} data={data} update={update} today={toDateStr(new Date())}
              onPick={(d) => { setDate(d); setTab("Timeline"); }} onChild={setChildId} />
          )}
          {tab === "Insights" && child && <Insights child={child} date={date} entries={data.entries} onPick={setDate} />}
        </>
      )}
      <p className="muted" style={{ textAlign: "center" }}>Showing {fmtDate(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
    </main>
  );
}

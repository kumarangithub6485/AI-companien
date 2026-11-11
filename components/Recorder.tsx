"use client";
import { useEffect, useRef, useState } from "react";
import { localExtract } from "@/lib/localExtract";
import { uid } from "@/lib/store";
import { AGG, AGG_LEVELS, canonicalColumn, fmtDate, type Child, type Data, type Extracted } from "@/lib/types";

type Props = {
  child: Child;
  date: string;
  columns: string[];
  update: (fn: (d: Data) => Data) => void;
  onSaved: () => void;
};

export default function Recorder({ child, date, columns, update, onSaved }: Props) {
  const [text, setText] = useState("");
  const [interim, setInterim] = useState("");
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [rows, setRows] = useState<Extracted[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const rec = useRef<any>(null);
  const wantOn = useRef(false);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return setSupported(false);
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = navigator.language || "en-US";
    r.onresult = (ev: any) => {
      let live = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const t = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) setText((p) => (p ? p.trimEnd() + " " : "") + t.trim());
        else live += t;
      }
      setInterim(live);
    };
    r.onerror = (ev: any) => {
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        wantOn.current = false;
        setNote("Microphone access was blocked. Allow it in the browser's site settings, or type the note instead.");
      }
    };
    // Browsers stop listening after a pause; keep going until the user taps stop.
    r.onend = () => {
      if (wantOn.current) { try { r.start(); return; } catch {} }
      setListening(false);
      setInterim("");
    };
    rec.current = r;
    return () => { wantOn.current = false; try { r.abort(); } catch {} };
  }, []);

  const toggle = () => {
    if (!rec.current) return;
    if (listening) {
      wantOn.current = false;
      rec.current.stop();
    } else {
      setNote("");
      wantOn.current = true;
      try { rec.current.start(); setListening(true); } catch {}
    }
  };

  const extract = async () => {
    if (listening) toggle();
    setBusy(true);
    setNote("");
    let result: Extracted[] | null = null;
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ transcript: text, columns }),
      });
      if (res.ok) result = (await res.json()).observations;
      else if (res.status === 503) setNote("AI is not set up yet, so simple keyword rules were used. Check each line before saving.");
      else setNote("The AI could not be reached, so simple keyword rules were used. Check each line before saving.");
    } catch {
      setNote("You appear to be offline, so simple keyword rules were used. Check each line before saving.");
    }
    result ??= localExtract(text);
    setRows(result.map((r) => ({ ...r, column: canonicalColumn(r.column, [AGG, ...columns]) })));
    setBusy(false);
  };

  const edit = (i: number, patch: Partial<Extracted>) => setRows((rs) => rs!.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const save = () => {
    const clean = rows!
      .map((r) => ({ ...r, column: canonicalColumn(r.column, [AGG, ...columns]), value: r.value.trim() }))
      .filter((r) => r.column && r.value);
    if (!clean.length) return;
    update((d) => ({
      ...d,
      entries: [...d.entries, ...clean.map((r) => ({ ...r, id: uid(), childId: child.id, date, time: r.time || null, createdAt: Date.now() }))],
    }));
    setRows(null);
    setText("");
    onSaved();
  };

  return (
    <section className="card">
      <h2>Record {child.name}'s day</h2>
      <p className="sub">{fmtDate(date, { weekday: "long", day: "numeric", month: "long" })}. Tap the microphone and talk about meals, outings, sleep, snacks and behaviour.</p>

      <div className="mic-wrap">
        <button className={`mic ${listening ? "on" : ""}`} onClick={toggle} disabled={!supported} aria-label={listening ? "Stop listening" : "Start listening"}>
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            {listening ? <rect x="6" y="6" width="12" height="12" rx="2" /> : <path d="M12 15a3.5 3.5 0 0 0 3.5-3.5v-6a3.5 3.5 0 0 0-7 0v6A3.5 3.5 0 0 0 12 15Zm6-3.5a1 1 0 1 0-2 0 4 4 0 0 1-8 0 1 1 0 1 0-2 0 6 6 0 0 0 5 5.9V20H8.5a1 1 0 1 0 0 2h7a1 1 0 1 0 0-2H13v-2.6a6 6 0 0 0 5-5.9Z" />}
          </svg>
        </button>
        <span className="sub">{!supported ? "This browser cannot listen. Type the note below (Chrome supports speech)." : listening ? "Listening… tap to stop" : "Tap to speak"}</span>
        <span className="interim">{interim}</span>
      </div>

      <textarea className="field" value={text} onChange={(e) => setText(e.target.value)}
        placeholder="What you say appears here. You can also type or correct it." aria-label="Transcript" />
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn primary" onClick={extract} disabled={!text.trim() || busy}>{busy ? "Reading the note…" : "Create columns"}</button>
        {text && <button className="btn" onClick={() => { setText(""); setRows(null); setNote(""); }}>Clear</button>}
      </div>
      {note && <p className="notice">{note}</p>}

      {rows && (
        <>
          <h2 style={{ marginTop: 20 }}>Check before saving</h2>
          <p className="sub">{rows.length ? "Fix anything that was misheard. New columns are outlined." : "Nothing could be picked out of that note. Add a line by hand or try again."}</p>
          <div className="review">
            {rows.map((r, i) => {
              const isNew = !!r.column && ![AGG, ...columns].some((c) => c.toLowerCase() === r.column.trim().toLowerCase());
              return (
                <div className="review-row" key={i}>
                  <input className={`field ${isNew ? "new" : ""}`} value={r.column} onChange={(e) => edit(i, { column: e.target.value })} aria-label="Column" placeholder="Column" list="cols" />
                  {r.column === AGG ? (
                    <select className="field" value={r.value} onChange={(e) => edit(i, { value: e.target.value })} aria-label="Aggression level">
                      {AGG_LEVELS.map((l) => <option key={l}>{l}</option>)}
                    </select>
                  ) : (
                    <input className="field" value={r.value} onChange={(e) => edit(i, { value: e.target.value })} aria-label="Value" placeholder="Value" />
                  )}
                  <input className="field" type="time" value={r.time ?? ""} onChange={(e) => edit(i, { time: e.target.value || null })} aria-label="Time" />
                  <button className="btn icon danger" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="Remove line">×</button>
                </div>
              );
            })}
            <datalist id="cols">{[AGG, ...columns].map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <div className="row">
            <button className="btn" onClick={() => setRows([...rows, { column: "", value: "", time: null }])}>+ Add line</button>
            <button className="btn primary" onClick={save} disabled={!rows.some((r) => r.column.trim() && r.value.trim())}>Save to {fmtDate(date)}</button>
          </div>
        </>
      )}
    </section>
  );
}

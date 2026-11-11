"use client";
import { useEffect, useRef, useState } from "react";
import { localExtract } from "@/lib/localExtract";
import { uid } from "@/lib/store";
import { AGG, AGG_LEVELS, canonicalColumn, fmtDate, isDemo, type Child, type Data, type Extracted } from "@/lib/types";

type Props = {
  child: Child;
  date: string;
  columns: string[];
  update: (fn: (d: Data) => Data) => void;
  onSaved: () => void;
};

const LANGS = [["en-IN", "English"], ["ta-IN", "தமிழ்"]] as const;

export default function Recorder({ child, date, columns, update, onSaved }: Props) {
  const [text, setText] = useState("");
  const [interim, setInterim] = useState("");
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [rows, setRows] = useState<Extracted[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [lang, setLang] = useState("en-IN");
  const rec = useRef<any>(null);
  const wantOn = useRef(false);
  const dict = useRef<any>(null); // preview build only: the host page's dictation service

  useEffect(() => {
    if (isDemo()) {
      setSupported(false);
      let offs: (() => void)[] = [];
      const use = (window as any).claude?.use;
      Promise.resolve(use ? use("dictation") : null).then((d: any) => {
        if (!d) return setNote("Speaking is not available in this preview on this device or browser (it needs Chrome or the Claude desktop app). Type a note below instead; speaking works in the real app.");
        dict.current = d;
        setSupported(true);
        offs = [
          d.onPartial((e: { text: string }) => setInterim(e.text)),
          d.onFinal((e: { text: string }) => setText((p) => (p ? p + e.text : e.text.trimStart()))),
          d.onState((e: { state: string }) => { setListening(e.state !== "idle"); if (e.state === "idle") setInterim(""); }),
        ];
      });
      return () => offs.forEach((off) => off());
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return setSupported(false);
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
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
        setListening(false);
        setNote(isDemo() ? "The microphone is switched off in this preview. Type a note below to try it; speaking works in the real app." : "Microphone access was blocked. Allow it in the browser's site settings, or type the note instead.");
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

  useEffect(() => {
    try { const saved = localStorage.getItem("speech-lang"); if (saved) setLang(saved); } catch {}
  }, []);
  const pickLang = (l: string) => {
    setLang(l);
    try { localStorage.setItem("speech-lang", l); } catch {}
    if (listening) { wantOn.current = false; rec.current?.stop(); dict.current?.stop(); }
  };

  const toggle = () => {
    if (dict.current) {
      if (listening) return void dict.current.stop();
      setNote("");
      dict.current.start({ language: lang.slice(0, 2) }).catch((e: { code?: string }) => {
        if (e.code === "stopped" || e.code === "dismissed") return;
        setNote(
          e.code === "not_granted" ? "Microphone use was not allowed for this preview. Type the note instead, or allow it in the page's Permissions menu."
          : e.code === "unavailable" ? (lang.startsWith("ta") ? "Tamil listening is not available in this preview. Switch to English here; Tamil is selectable in the real app." : "Speaking is not available for this account in the preview. Type the note instead.")
          : "Listening could not start just now. Try again in a moment, or type the note.");
      });
      return;
    }
    if (!rec.current) return;
    if (listening) {
      wantOn.current = false;
      rec.current.stop();
    } else {
      setNote("");
      wantOn.current = true;
      rec.current.lang = lang;
      try { rec.current.start(); setListening(true); } catch {}
    }
  };

  const extract = async () => {
    if (listening) toggle();
    setBusy(true);
    setNote("");
    let result: Extracted[] | null = null;
    if (isDemo()) {
      setNote("Preview: simple English keyword rules were used here. The real app uses AI for this step, which also understands Tamil and free-form speech.");
      setRows(localExtract(text).map((r) => ({ ...r, column: canonicalColumn(r.column, [AGG, ...columns]) })));
      setBusy(false);
      return;
    }
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
    if (!result && /[\u0B80-\u0BFF]/.test(text)) {
      setNote("Tamil notes need the AI to translate them, and it is not available right now. Nothing was picked out; add lines by hand or try again once the AI is set up.");
      result = [];
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
      <p className="sub">{fmtDate(date, { weekday: "long", day: "numeric", month: "long" })}. Tap the microphone and talk about meals, outings, sleep, snacks and behaviour, in Tamil or English. Results are always shown in English.</p>

      <div className="mic-wrap">
        <button className={`mic ${listening ? "on" : ""}`} onClick={toggle} disabled={!supported} aria-label={listening ? "Stop listening" : "Start listening"}>
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            {listening ? <rect x="6" y="6" width="12" height="12" rx="2" /> : <path d="M12 15a3.5 3.5 0 0 0 3.5-3.5v-6a3.5 3.5 0 0 0-7 0v6A3.5 3.5 0 0 0 12 15Zm6-3.5a1 1 0 1 0-2 0 4 4 0 0 1-8 0 1 1 0 1 0-2 0 6 6 0 0 0 5 5.9V20H8.5a1 1 0 1 0 0 2h7a1 1 0 1 0 0-2H13v-2.6a6 6 0 0 0 5-5.9Z" />}
          </svg>
        </button>
        <span className="sub">{!supported ? (isDemo() ? "Type the note below" : "This browser cannot listen. Type the note below (Chrome supports speech).") : listening ? "Listening… tap to stop" : "Tap to speak"}</span>
        <div className="lang" role="group" aria-label="Language you will speak">
          {LANGS.map(([code, label]) => (
            <button key={code} className="btn small" aria-pressed={lang === code} onClick={() => pickLang(code)}>{label}</button>
          ))}
        </div>
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

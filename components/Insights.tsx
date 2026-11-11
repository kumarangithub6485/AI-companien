"use client";
import { useMemo, useState } from "react";
import { buildDays, describe, findDrivers, MIN_DAYS, partOfDay, PARTS, type Driver } from "@/lib/insights";
import { AGG_LEVELS, fmtDate, isDemo, shiftDate, type Child, type Entry } from "@/lib/types";

type Props = { child: Child; date: string; entries: Entry[]; onPick: (date: string) => void };

const pct = (x: number) => `${Math.round(x * 100)}%`;
const EVIDENCE = { strong: "Strong pattern", moderate: "Likely pattern", weak: "Could be chance" } as const;

export default function Insights({ child, date, entries, onPick }: Props) {
  const [range, setRange] = useState(30);
  const [showWeak, setShowWeak] = useState(false);
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);

  const days = useMemo(() => buildDays(entries, child.id), [entries, child.id]);
  const drivers = useMemo(() => findDrivers(days), [days]);
  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);

  if (!days.length) return <div className="card empty">No records for {child.name} yet. Insights appear once a few days are logged.</div>;

  const aggDays = days.filter((d) => d.level > 0).length;
  const window = Array.from({ length: range }, (_, i) => shiftDate(date, i - range + 1));
  const up = drivers.filter((d) => d.diff > 0);
  const down = drivers.filter((d) => d.diff < 0);
  const solid = (ds: Driver[]) => ds.filter((d) => d.evidence !== "weak");
  const top = solid(up)[0];

  const parts = PARTS.map((p) => ({ p, n: days.flatMap((d) => d.aggTimes).filter((t) => partOfDay(t) === p).length }));
  const maxPart = Math.max(1, ...parts.map((x) => x.n));

  const askAI = async () => {
    setBusy(true);
    setSummary("");
    const stats = [
      `Days logged: ${days.length}. Days with aggression: ${aggDays}.`,
      ...drivers.slice(0, 12).map((d) => `${d.lag ? "[previous day] " : ""}${d.label}: aggression on ${d.withAgg}/${d.withN} days with it vs ${d.withoutAgg}/${d.withoutN} without (evidence: ${d.evidence})`),
      `Aggression episodes by time of day: ${parts.map((x) => `${x.p} ${x.n}`).join(", ")}`,
    ].join("\n");
    try {
      const res = await fetch("/api/summary", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ stats }) });
      setSummary(res.ok ? (await res.json()).text : res.status === 503 ? "AI summaries need an API key to be set up. The findings below do not depend on it." : "The AI summary could not be created just now. Try again in a moment.");
    } catch {
      setSummary("The AI summary could not be reached. Check the connection and try again.");
    }
    setBusy(false);
  };

  const list = (ds: Driver[]) =>
    ds.map((d) => (
      <div className="driver" key={`${d.lag}${d.label}`}>
        <div className="row spread">
          <span className="name">{d.label}{d.lag && <span className="muted"> (the day before)</span>}</span>
          <span className={`badge ${d.evidence}`}>{EVIDENCE[d.evidence]}</span>
        </div>
        <div className="hbar" data-tip={`${d.withAgg} of ${d.withN} days`} style={{ position: "relative" }} tabIndex={0}>
          <span>{d.lag ? "After it" : "With it"}</span>
          <span className="track"><span className="fill" style={{ display: "block", width: pct(d.rateWith), background: "var(--series-1)" }} /></span>
          <span className="num">{pct(d.rateWith)} <span className="muted">of {d.withN}</span></span>
        </div>
        <div className="hbar" data-tip={`${d.withoutAgg} of ${d.withoutN} days`} style={{ position: "relative" }} tabIndex={0}>
          <span>Other days</span>
          <span className="track"><span className="fill" style={{ display: "block", width: pct(d.rateWithout), background: "var(--series-2)" }} /></span>
          <span className="num">{pct(d.rateWithout)} <span className="muted">of {d.withoutN}</span></span>
        </div>
      </div>
    ));

  return (
    <>
      <div className="tiles">
        <div className="tile"><div className="k">Days logged</div><div className="v">{days.length}</div><div className="n">since {fmtDate(days[0].date, { day: "numeric", month: "short" })}</div></div>
        <div className="tile"><div className="k">Days with aggression</div><div className="v">{pct(aggDays / days.length)}</div><div className="n">{aggDays} of {days.length} days</div></div>
        <div className="tile"><div className="k">Biggest driver so far</div><div className="v" style={{ fontSize: 20, paddingTop: 6 }}>{top ? top.label : "Not clear yet"}</div><div className="n">{top ? `${pct(top.rateWith)} vs ${pct(top.rateWithout)} of days${top.lag ? ", next day" : ""}` : "needs more days"}</div></div>
      </div>

      <section className="card">
        <div className="row spread">
          <div>
            <h2>Aggression by day</h2>
            <p className="sub">{range} days up to {fmtDate(date)}. Tap a bar to select that day.</p>
          </div>
          <select className="field" aria-label="Range" value={range} onChange={(e) => setRange(Number(e.target.value))}>
            <option value={14}>14 days</option><option value={30}>30 days</option><option value={90}>90 days</option>
          </select>
        </div>
        <div className="trend">
          <div className="yax"><span>calm</span><span>mild</span><span>moderate</span><span>severe</span></div>
          <div className="plot">
            {window.map((d) => {
              const day = byDate.get(d);
              const tip = `${fmtDate(d)}: ${day ? AGG_LEVELS[day.level] === "none" ? "calm" : AGG_LEVELS[day.level] : "not logged"}`;
              return (
                <button key={d} className={`slot ${d === date ? "sel" : ""}`} data-tip={tip} aria-label={tip} onClick={() => onPick(d)}>
                  {day && (day.level > 0 ? <span className="bar" style={{ height: `${(day.level / 3) * 100}%` }} /> : <span className="calm" />)}
                </button>
              );
            })}
          </div>
          <div className="xax"><span>{fmtDate(window[0], { day: "numeric", month: "short" })}</span><span>{fmtDate(date, { day: "numeric", month: "short" })}</span></div>
        </div>
        <p className="muted" style={{ marginTop: 8 }}>A grey dash is a logged day with no aggression. A gap is a day nothing was logged.</p>
      </section>

      <section className="card">
        <div className="row spread">
          <div>
            <h2>What goes with aggression for {child.name}</h2>
            <p className="sub">How often aggression happened on days with each factor, against all other logged days.</p>
          </div>
          {days.length >= MIN_DAYS && !isDemo() && <button className="btn" onClick={askAI} disabled={busy}>{busy ? "Writing…" : "Explain with AI"}</button>}
        </div>
        {days.length < MIN_DAYS ? (
          <p className="notice">{days.length} of {MIN_DAYS} days logged. Patterns from fewer days are too unreliable to show, so keep recording daily.</p>
        ) : (
          <>
            {summary && <p className="notice summary">{summary}</p>}
            {top && <p className="notice">{describe(top)}</p>}
            <div className="legend"><span><i style={{ background: "var(--series-1)" }} />Days with the factor</span><span><i style={{ background: "var(--series-2)" }} />All other days</span></div>
            {!solid(up).length && !solid(down).length && <p className="sub" style={{ padding: "12px 0" }}>No factor stands out clearly yet. More days of records will sharpen this.</p>}
            {solid(up).length > 0 && <><h3 style={{ fontSize: 15, marginTop: 12 }}>More aggression</h3>{list(solid(up))}</>}
            {solid(down).length > 0 && <><h3 style={{ fontSize: 15, marginTop: 16 }}>Less aggression</h3>{list(solid(down))}</>}
            {drivers.some((d) => d.evidence === "weak") && (
              <>
                <button className="btn small" style={{ marginTop: 12 }} onClick={() => setShowWeak(!showWeak)}>{showWeak ? "Hide" : "Show"} weaker patterns ({drivers.filter((d) => d.evidence === "weak").length})</button>
                {showWeak && list(drivers.filter((d) => d.evidence === "weak"))}
              </>
            )}
            <p className="muted" style={{ marginTop: 14 }}>These are patterns in the records, not proof of cause. A logged day with no mention of aggression is counted as calm. Share them with the child's therapist before changing routines.</p>
          </>
        )}
      </section>

      <section className="card">
        <h2>When aggression happens</h2>
        <p className="sub">Number of episodes by time of day, across all logged days.</p>
        <div style={{ marginTop: 10 }}>
          {parts.map(({ p, n }) => (
            <div className="hbar" key={p} data-tip={`${n} episode${n === 1 ? "" : "s"}`} style={{ position: "relative" }} tabIndex={0}>
              <span>{p}</span>
              <span className="track"><span className="fill" style={{ display: "block", width: `${(n / maxPart) * 100}%`, background: n ? "var(--series-1)" : "transparent" }} /></span>
              <span className="num">{n}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

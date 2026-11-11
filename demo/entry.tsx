// Entry point for the preview build (see demo/build.mjs). Not used by the real app.
import { createRoot } from "react-dom/client";
import Home from "../app/page";
import { SAMPLE_CHILD_ID } from "../lib/sample";
import type { Data } from "../lib/types";

(window as { CARE_DEMO?: boolean }).CARE_DEMO = true;

// Earlier previews opened with a made-up sample child. Remove its made-up records once,
// keeping anything the viewer recorded themselves, so columns come only from their own notes.
try {
  const raw = localStorage.getItem("ai-companion-v1");
  if (raw && !localStorage.getItem("care-preview-clean")) {
    const d = JSON.parse(raw) as Data;
    const entries = d.entries.filter((e) => !e.id.startsWith("sample-"));
    const kept = entries.some((e) => e.childId === SAMPLE_CHILD_ID);
    const children = d.children
      .filter((c) => c.id !== SAMPLE_CHILD_ID || kept)
      .map((c) => (c.id === SAMPLE_CHILD_ID ? { ...c, name: "My child" } : c));
    localStorage.setItem("ai-companion-v1", JSON.stringify({ children, entries }));
  }
  localStorage.setItem("care-preview-clean", "1");
} catch {}

createRoot(document.getElementById("root")!).render(
  <>
    <p className="demo-banner">Preview. Add a child, then speak or type a note on the Record tab, in Tamil or English. Columns are created only from what you say, and the date is set to today for you.</p>
    <Home />
  </>,
);

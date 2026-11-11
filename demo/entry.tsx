// Entry point for the read-only preview build (see demo/build.mjs). Not used by the real app.
import { createRoot } from "react-dom/client";
import Home from "../app/page";
import { sampleData } from "../lib/sample";
import { toDateStr } from "../lib/types";

(window as { CARE_DEMO?: boolean }).CARE_DEMO = true;
try {
  if (!localStorage.getItem("ai-companion-v1")) {
    localStorage.setItem("ai-companion-v1", JSON.stringify(sampleData(toDateStr(new Date()))));
  }
} catch {}

createRoot(document.getElementById("root")!).render(
  <>
    <p className="demo-banner">Preview with made-up sample records. Speak or type a note on the Record tab, in Tamil or English, to try it.</p>
    <Home />
  </>,
);

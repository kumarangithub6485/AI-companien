// Builds a single self-contained HTML preview of the app: node demo/build.mjs <out.html>
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";

const out = await build({
  entryPoints: ["demo/entry.tsx"], bundle: true, minify: true, write: false, format: "iife",
  jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' }, tsconfig: "tsconfig.json",
});
const css = readFileSync("app/globals.css", "utf8") +
  "\n.demo-banner{max-width:980px;margin:12px auto 0;padding:10px 12px;border-radius:10px;background:var(--accent-soft);font-size:14px;width:calc(100% - 32px)}";
writeFileSync(process.argv[2], `<title>Care Companion Preview</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>${css}</style>
<div id="root"></div>
<script>${out.outputFiles[0].text.replace(/<\/script/g, "<\\/script")}</script>
`);

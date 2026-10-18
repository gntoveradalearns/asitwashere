// Looks for broken links inside the built site (dist/): pages, images, scripts, and images named in the content files.
// It only warns; it never stops a deploy.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const files = walk(OUT);
let bad = 0;
const exists = (p) => {
  if (fs.existsSync(p)) return fs.statSync(p).isDirectory() ? fs.existsSync(path.join(p, "index.html")) : true;
  return false;
};
const report = (from, ref) => { bad++; console.warn(`  broken: ${path.relative(OUT, from)} -> ${ref}`); };

for (const file of files.filter((f) => f.endsWith(".html"))) {
  const html = fs.readFileSync(file, "utf8");
  for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const ref = m[1];
    if (/^(https?:|mailto:|tel:|data:|#|javascript:)/.test(ref) || ref === "") continue;
    const clean = ref.split("#")[0].split("?")[0];
    if (!clean) continue;
    const target = clean.startsWith("/") ? path.join(OUT, clean) : path.resolve(path.dirname(file), clean);
    if (!exists(target)) report(file, ref);
  }
}
for (const file of files.filter((f) => f.includes(path.sep + "data" + path.sep) && f.endsWith(".json"))) {
  let items = [];
  try { items = JSON.parse(fs.readFileSync(file, "utf8")).items || []; } catch (e) { console.warn(`  unreadable: ${path.relative(OUT, file)}`); bad++; continue; }
  for (const w of items) if (w.src && !/^https?:/.test(w.src) && !exists(path.join(OUT, String(w.src).replace(/^\/+/, "")))) report(file, `${w.title}: ${w.src}`);
}
console.log(bad ? `link check: ${bad} problem(s) found` : "link check: no broken links");

// Builds the site into dist/.
//  1. copies public/ to dist/
//  2. draws a link-preview card (1200x630) for every photograph, drawing and musing, plus one for the site
//  3. writes a small share page for every piece at /share/<kind>/<id>/ with the preview tags already filled in
//
// Chat apps and social sites read a page's HTML but do not run its JavaScript, so a shared link
// needs its own page for the preview to show that piece. People who open a share page are sent
// straight to the piece.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { Resvg } from "@resvg/resvg-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "public");
const OUT = path.join(ROOT, "dist");

const readJson = (file, fallback) => {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { return fallback; }
};
const config = readJson(path.join(SRC, "site.config.json"), {});

// the address the site lives at. preview tags need full addresses.
const fromNetlify = process.env.CONTEXT === "production" || !process.env.DEPLOY_PRIME_URL ? process.env.URL : process.env.DEPLOY_PRIME_URL;
const siteUrl = String(config.siteUrl || fromNetlify || "").trim().replace(/\/+$/, "");
const abs = (p) => (siteUrl ? siteUrl + p : p);
const showArt = config.previewArt !== false;

/* ---------- pieces, with the same ids the website uses ---------- */
const slug = (s) => String(s || "").toLowerCase().replace(/\.[a-z0-9]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
function withIds(items, type) {
  const used = new Set();
  return items.map((w) => {
    const base = slug(w.src ? w.src.split("/").pop().split("?")[0] : w.title) || type;
    let id = base;
    for (let n = 2; used.has(id); n++) id = base + "-" + n;
    used.add(id);
    return { ...w, type, id };
  });
}
const load = (name, type) => withIds(readJson(path.join(SRC, "data", name + ".json"), {}).items || [], type);
const pieces = [...load("photos", "photo"), ...load("drawings", "drawing"), ...load("musings", "musing")];
const PAGES = { photo: "photos.html", drawing: "drawings.html", musing: "musings.html" };

/* ---------- drawing the cards ---------- */
const W = 1200, H = 630;
const C = { black: "#000000", wall: "#1c1c1c", mat: "#272727", read: "#101010", ink: "#ededed", gray: "#9a9a9a", dim: "#707070", blue: "#8aa0ff", rule: "#2a2a2a" };
const SANS = "Liberation Sans", SERIF = "Liberation Serif";
const FONTS = ["LiberationSans-Regular", "LiberationSans-Bold", "LiberationSerif-Regular", "LiberationSerif-Italic"].map((f) =>
  path.join(ROOT, "scripts", "fonts", f + ".ttf")
);

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const low = (s) => String(s || "").toLowerCase().trim();
const metaOf = (w) => [w.medium, w.year].filter(Boolean).join(", ");
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

function wrap(text, maxWidth, size, factor, maxLines) {
  const per = Math.max(1, Math.floor(maxWidth / (size * factor)));
  const lines = [];
  let line = "";
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    const next = line ? line + " " + word : word;
    if (next.length <= per) { line = next; continue; }
    if (line) lines.push(line);
    line = word.length > per ? word.slice(0, per - 1) + "…" : word;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    const last = lines[maxLines - 1].replace(/[\s,.;:]+$/, "");
    lines[maxLines - 1] = (last.length > per - 1 ? last.slice(0, per - 1).trimEnd() : last) + "…";
  }
  return lines;
}

const frame = (bg, inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${bg}"/>${inner}</svg>`;

const toPng = (svg) =>
  new Resvg(svg, {
    fitTo: { mode: "width", value: W },
    font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: SANS },
  }).render().asPng();

// the work itself, fitted inside a box. the file is read, turned upright and shrunk first.
async function artwork(w, boxW, boxH) {
  const file = path.join(SRC, String(w.src).replace(/^\/+/, ""));
  const { data, info } = await sharp(file, { failOn: "none", density: 200 })
    .rotate()
    .resize({ width: boxW * 2, height: boxH * 2, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer({ resolveWithObject: true });
  const ratio = info.width / info.height;
  let w2 = boxW, h2 = Math.round(boxW / ratio);
  if (h2 > boxH) { h2 = boxH; w2 = Math.round(boxH * ratio); }
  return { w: w2, h: h2, href: "data:image/jpeg;base64," + data.toString("base64") };
}

// photographs: a black stage with the picture whole, and a caption line, like the viewer on the site
const photoCard = (w, art) => {
  const x = Math.round(48 + (1104 - art.w) / 2);
  const y = Math.round(28 + (500 - art.h) / 2);
  const meta = clip(low(metaOf(w)), 28);
  return frame(C.black, `
    <image x="${x}" y="${y}" width="${art.w}" height="${art.h}" href="${art.href}"/>
    <text x="48" y="598" font-family="${SANS}" font-size="26"><tspan font-weight="700" fill="#ffffff">${esc(clip(low(w.title), 30))}</tspan>${meta ? `<tspan dx="14" fill="${C.gray}">${esc(meta)}</tspan>` : ""}</text>
    <text x="1152" y="598" text-anchor="end" font-family="${SANS}" font-size="26" font-weight="700" fill="${C.dim}">asitwashere</text>`);
};

// drawings: a matted print on a gray wall, with a gallery label
const drawingCard = (w, art) => {
  const matW = art.w + 64, matH = art.h + 64;
  const mx = Math.round((W - matW) / 2);
  const my = Math.round(24 + (466 - matH) / 2);
  return frame(C.wall, `
    <rect x="${mx}" y="${my}" width="${matW}" height="${matH}" fill="${C.mat}" stroke="${C.rule}"/>
    <image x="${mx + 32}" y="${my + 32}" width="${art.w}" height="${art.h}" href="${art.href}"/>
    <text x="600" y="548" text-anchor="middle" font-family="${SERIF}" font-style="italic" font-size="36" fill="${C.blue}">${esc(clip(low(w.title), 52))}</text>
    <text x="600" y="586" text-anchor="middle" font-family="${SANS}" font-size="24" fill="${C.gray}">${esc(clip(low(metaOf(w)), 60))}</text>
    <text x="1152" y="606" text-anchor="end" font-family="${SANS}" font-size="22" font-weight="700" fill="${C.dim}">asitwashere</text>`);
};

// musings, and any piece shown without its picture: a quiet page of type
const textCard = (kind, w, body) => {
  const title = low(w.title);
  const size = title.length <= 28 ? 84 : title.length <= 56 ? 64 : 52;
  const lines = wrap(title, 1040, size, 0.58, 3);
  const top = 200;
  const titleSvg = lines.map((l, i) => `<tspan x="80" dy="${i ? Math.round(size * 1.1) : 0}">${esc(l)}</tspan>`).join("");
  const titleBottom = top + size + (lines.length - 1) * Math.round(size * 1.1);
  const bodyStart = titleBottom + 62;
  const room = Math.max(0, Math.floor((548 - bodyStart) / 48) + 1);
  const bodyLines = body ? wrap(low(body), 980, 34, 0.46, Math.min(3, room)) : [];
  const bodySvg = bodyLines.map((l, i) => `<tspan x="80" dy="${i ? 48 : 0}">${esc(l)}</tspan>`).join("");
  return frame(C.read, `
    <rect width="${W}" height="4" fill="${C.blue}"/>
    <text x="80" y="124" font-family="${SANS}" font-size="26" fill="${C.gray}">${esc([kind, w.year].filter(Boolean).join(", "))}</text>
    <text x="80" y="${top + size}" font-family="${SANS}" font-size="${size}" font-weight="700" fill="${C.ink}">${titleSvg}</text>
    ${bodySvg ? `<text x="80" y="${bodyStart}" font-family="${SERIF}" font-size="34" fill="${C.gray}">${bodySvg}</text>` : ""}
    <text x="80" y="588" font-family="${SANS}" font-size="28" font-weight="700" fill="${C.ink}">asitwashere</text>`);
};

// the card for the site itself, used by every ordinary page
const siteCard = () => {
  const tag = wrap(low(config.tagline || "photographs, drawings and musings"), 1000, 52, 0.46, 2);
  return frame(C.black, `
    <text x="64" y="330" font-family="${SANS}" font-size="176" font-weight="700" letter-spacing="-8" fill="${C.ink}">${esc(low(config.name || "asitwashere"))}</text>
    <text x="76" y="416" font-family="${SERIF}" font-style="italic" font-size="52" fill="${C.blue}">${tag.map((l, i) => `<tspan x="76" dy="${i ? 62 : 0}">${esc(l)}</tspan>`).join("")}</text>`);
};

/* ---------- share pages ---------- */
const KIND = { photo: "photograph", drawing: "drawing", musing: "musing" };
const firstParagraph = (b) => (Array.isArray(b) ? b[0] : String(b || "").split(/\n\s*\n/)[0]) || "";

function descriptionOf(w) {
  const d = w.type === "musing" ? w.excerpt || firstParagraph(w.body) : metaOf(w) || KIND[w.type];
  return clip(low(d).replace(/\s+/g, " "), 200);
}

function sharePage(w, hasCard) {
  const title = low(w.title);
  const desc = descriptionOf(w);
  const url = abs(`/share/${w.type}/${w.id}/`);
  const image = abs(hasCard ? `/previews/${w.type}-${w.id}.png` : "/previews/site.png");
  const target = `../../../${PAGES[w.type]}#${w.id}`;
  const alt = w.type === "musing" ? `${title}, a musing` : low(w.alt) || `${title}, ${KIND[w.type]}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} | asitwashere</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="noindex">
<meta property="og:site_name" content="asitwashere">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:width" content="${W}">
<meta property="og:image:height" content="${H}">
<meta property="og:image:alt" content="${esc(alt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(image)}">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#000;color:#ededed;font:16px/1.5 "Helvetica Neue",Helvetica,Arial,sans-serif}a{color:#8aa0ff}</style>
<script>location.replace(${JSON.stringify(target)});</script>
</head>
<body>
<p><a href="${esc(target)}">${esc(title)} on asitwashere</a></p>
</body>
</html>
`;
}

/* ---------- run ---------- */
fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(SRC, OUT, { recursive: true });
fs.mkdirSync(path.join(OUT, "previews"), { recursive: true });

fs.writeFileSync(path.join(OUT, "previews", "site.png"), toPng(siteCard()));

let cards = 0;
for (const w of pieces) {
  let png = null;
  try {
    if (w.type === "musing") {
      png = toPng(textCard(KIND.musing, w, w.excerpt || firstParagraph(w.body)));
    } else if (!showArt || !w.src) {
      png = toPng(textCard(KIND[w.type], w, low(metaOf(w))));
    } else if (w.type === "photo") {
      png = toPng(photoCard(w, await artwork(w, 1104, 500)));
    } else {
      png = toPng(drawingCard(w, await artwork(w, 1000, 402)));
    }
  } catch (e) {
    console.warn(`  could not draw a card for "${w.title}" (${w.src || "no image"}): ${e.message}`);
    try { png = toPng(textCard(KIND[w.type], w, low(metaOf(w)))); } catch (e2) { png = null; }
  }
  if (png) {
    fs.writeFileSync(path.join(OUT, "previews", `${w.type}-${w.id}.png`), png);
    cards++;
  }
  const dir = path.join(OUT, "share", w.type, w.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), sharePage(w, !!png));
}

/* ---------- compress images in dist/ (the originals in public/ are never touched) ---------- */
let saved = 0, shrunk = 0;
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
for (const file of walk(path.join(OUT, "images"))) {
  const ext = path.extname(file).toLowerCase();
  if (![".jpg", ".jpeg", ".png", ".webp"].includes(ext)) continue;
  try {
    const before = fs.statSync(file).size;
    let img = sharp(file, { failOn: "none" }).rotate().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true });
    img = ext === ".png" ? img.png({ compressionLevel: 9, palette: false }) : ext === ".webp" ? img.webp({ quality: 82 }) : img.jpeg({ quality: 82, mozjpeg: true });
    const out = await img.toBuffer();
    if (out.length < before) { fs.writeFileSync(file, out); saved += before - out.length; shrunk++; }
  } catch (e) { console.warn(`  could not compress ${path.relative(OUT, file)}: ${e.message}`); }
}

/* ---------- favicons ---------- */
const favSvg = fs.readFileSync(path.join(SRC, "favicon.svg"), "utf8");
const favPng = (n) => new Resvg(favSvg, { fitTo: { mode: "width", value: n } }).render().asPng();
fs.writeFileSync(path.join(OUT, "favicon-32.png"), favPng(32));
fs.writeFileSync(path.join(OUT, "apple-touch-icon.png"), favPng(180));

/* ---------- canonical addresses, sitemap and robots.txt ---------- */
const PAGE_FILES = ["index.html", "photos.html", "drawings.html", "musings.html", "about.html"];
if (siteUrl) {
  for (const f of fs.readdirSync(OUT).filter((n) => n.endsWith(".html"))) {
    const file = path.join(OUT, f);
    let html = fs.readFileSync(file, "utf8").replaceAll('content="/previews/', `content="${siteUrl}/previews/`);
    if (PAGE_FILES.includes(f)) {
      const url = f === "index.html" ? siteUrl + "/" : `${siteUrl}/${f}`;
      html = html.replace("</head>", `  <link rel="canonical" href="${url}">\n  <meta property="og:url" content="${url}">\n</head>`);
    }
    fs.writeFileSync(file, html);
  }
}
const today = new Date().toISOString().slice(0, 10);
const loc = (f) => (f === "index.html" ? "/" : "/" + f);
fs.writeFileSync(path.join(OUT, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  PAGE_FILES.map((f) => `  <url><loc>${abs(loc(f))}</loc><lastmod>${today}</lastmod></url>`).join("\n") + `\n</urlset>\n`);
fs.writeFileSync(path.join(OUT, "robots.txt"),
  `User-agent: *\nAllow: /\nDisallow: /admin/\n` + (siteUrl ? `\nSitemap: ${siteUrl}/sitemap.xml\n` : ""));

// alt text reminder
const noAlt = pieces.filter((w) => w.type !== "musing" && !String(w.alt || "").trim());
if (noAlt.length) console.warn(`  ${noAlt.length} piece(s) have no image description (alt text): ${noAlt.map((w) => w.title).join(", ")}`);

console.log(`built dist/: ${pieces.length} share pages, ${cards + 1} preview cards, ${shrunk} images compressed (saved ${(saved / 1048576).toFixed(1)} MB), site address ${siteUrl || "(not set, using relative links)"}`);
if (!siteUrl) console.log("  tip: set the website address in the editor, or deploy on Netlify, so previews, canonical links and the sitemap use full addresses.");

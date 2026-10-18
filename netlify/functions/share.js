// Shared links look like /p/photo/some-photo.
// Chat apps and social sites read this page's preview tags (they ignore the # part of a link
// and don't run scripts), then visitors are sent on to the piece itself.
const { site, PAGES, KIND, find, origin } = require("../lib/works");

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

function describe(w) {
  if (w.type === "musing") {
    const first = String(w.excerpt || w.body || "").split(/\n\s*\n/)[0].replace(/\s+/g, " ").trim();
    return clip(first, 160) || "a musing";
  }
  return [KIND[w.type], w.medium, w.year].filter(Boolean).join(", ");
}

exports.handler = async (event) => {
  const q = event.queryStringParameters || {};
  const w = find(q.type, q.id);
  if (!w) return { statusCode: 302, headers: { Location: "/" }, body: "" };

  const base = origin(event);
  const name = String(site.name || "").toLowerCase();
  const title = String(w.title || "").toLowerCase();
  const description = describe(w).toLowerCase();
  const self = base + "/p/" + w.type + "/" + encodeURIComponent(w.id);
  const image = base + "/.netlify/functions/card?type=" + w.type + "&id=" + encodeURIComponent(w.id);
  const target = "/" + PAGES[w.type] + "#" + encodeURIComponent(w.id);
  const alt = String(w.alt || w.title || "").toLowerCase();

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} | ${esc(name)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(self)}">
<meta property="og:site_name" content="${esc(name)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(self)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(alt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(image)}">
<meta http-equiv="refresh" content="0;url=${esc(target)}">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#000;color:#ededed;font:16px/1.5 "Helvetica Neue",Helvetica,Arial,sans-serif}a{color:#8aa0ff}</style>
</head>
<body>
<p><a href="${esc(target)}">continue to ${esc(title)}</a></p>
<script>location.replace(${JSON.stringify(target)})</script>
</body>
</html>`;

  return {
    statusCode: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" },
    body: html,
  };
};

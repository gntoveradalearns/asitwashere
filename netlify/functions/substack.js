// Reads your Substack RSS feed on the server (browsers can't fetch it directly)
// and returns the latest posts as JSON. Handle comes from public/site.config.json.
const config = require("../../public/site.config.json");

const decode = (s) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");

const tag = (xml, name) => {
  const m = xml.match(new RegExp("<" + name + "[^>]*>([\\s\\S]*?)</" + name + ">"));
  return m ? decode(m[1]).trim() : "";
};

const plain = (html) =>
  decode(html)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const reply = (status, body, cache) => ({
  statusCode: status,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": cache || "no-store",
  },
  body: JSON.stringify(body),
});

exports.handler = async () => {
  const s = config.substack || {};
  const handle = (s.handle || "").trim();
  let feed = (s.feedUrl || "").trim();

  if (!feed && /^[a-z0-9-]+$/i.test(handle)) {
    feed = "https://" + handle + ".substack.com/feed";
  }
  if (!/^https:\/\//.test(feed)) return reply(200, { items: [] });

  try {
    const res = await fetch(feed, {
      headers: { "User-Agent": "Mozilla/5.0 (portfolio feed reader)" },
    });
    if (!res.ok) return reply(502, { items: [], error: "Feed returned " + res.status });
    const xml = await res.text();

    const items = xml
      .split("<item>")
      .slice(1, 7)
      .map((chunk) => {
        const body = chunk.split("</item>")[0];
        const summary = plain(tag(body, "description"));
        return {
          title: tag(body, "title"),
          link: tag(body, "link"),
          date: tag(body, "pubDate"),
          summary: summary.length > 180 ? summary.slice(0, 177).trimEnd() + "..." : summary,
        };
      })
      .filter((p) => p.title && /^https:\/\//.test(p.link));

    return reply(200, { items }, "public, max-age=600");
  } catch (e) {
    return reply(502, { items: [], error: "Feed could not be reached" });
  }
};

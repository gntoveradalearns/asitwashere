// Shared by the share and card functions: finds a piece by type and id.
// Ids are made the same way as in public/js/app.js, so links match.
const site = require("../../public/site.config.json");

const data = {
  photo: require("../../public/data/photos.json").items || [],
  drawing: require("../../public/data/drawings.json").items || [],
  musing: require("../../public/data/musings.json").items || [],
};

const PAGES = { photo: "photos.html", drawing: "drawings.html", musing: "musings.html" };
const KIND = { photo: "photograph", drawing: "drawing", musing: "musing" };

const slug = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const idOf = (w, type) => slug(w.src ? w.src.split("/").pop().split("?")[0] : w.title) || type;

function find(type, id) {
  if (!Object.prototype.hasOwnProperty.call(data, type) || !id) return null;
  const w = data[type].find((x) => idOf(x, type) === id);
  return w ? { ...w, type, id } : null;
}

// the site's own address, used for links and for fetching the artwork
function origin(event) {
  const fromEnv = process.env.DEPLOY_PRIME_URL || process.env.URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  const h = (event && event.headers) || {};
  const host = h["x-forwarded-host"] || h.host || "";
  if (!/^[a-z0-9.-]+(:\d+)?$/i.test(host)) return "";
  return (h["x-forwarded-proto"] || "https") + "://" + host;
}

module.exports = { site, PAGES, KIND, find, origin };

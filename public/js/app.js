(() => {
  const $ = (id) => document.getElementById(id);
  const page = document.body.dataset.page;

  const el = (tag, props = {}, children = []) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else node.setAttribute(k, v);
    }
    for (const c of [].concat(children)) node.append(c);
    return node;
  };
  const note = (text) => el("p", { class: "note", text });
  const fetchJson = (url) =>
    fetch(url).then((r) => {
      if (!r.ok) throw new Error(url + " " + r.status);
      return r.json();
    });
  const metaOf = (w) => [w.medium, w.year].filter(Boolean).join(", ");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // images go through Netlify's image resizing when it is there, and fall back to the original file
  const sized = (src, w) =>
    /^https?:|\.(svg|gif)$/i.test(src)
      ? src
      : "/.netlify/images?url=" + encodeURIComponent("/" + src.replace(/^\//, "")) + "&w=" + w + "&q=82";
  const picture = (w, width, props = {}) => {
    const img = el("img", { alt: w.alt || w.title, decoding: "async", ...props });
    img.addEventListener("error", () => {
      if (img.dataset.fallback !== "1") { img.dataset.fallback = "1"; img.src = w.src; }
    });
    img.src = sized(w.src, width);
    return img;
  };
  // a musing's text can be one string (blank line between paragraphs) or a list of paragraphs
  const paragraphs = (b) =>
    (Array.isArray(b) ? b : String(b || "").split(/\n\s*\n/)).map((p) => p.trim()).filter(Boolean);
  // entries added in the editor carry no pixel sizes, so measure small copies before layout needs them
  const measure = (list) =>
    Promise.race([
      Promise.all(
        list
          .filter((w) => w.src && !(w.width && w.height))
          .map((w) => new Promise((done) => {
            const probe = new Image();
            let retried = false;
            probe.onload = () => { w.width = probe.naturalWidth; w.height = probe.naturalHeight; done(); };
            probe.onerror = () => { if (retried) return done(); retried = true; probe.src = w.src; };
            probe.src = sized(w.src, 400);
          }))
      ),
      new Promise((done) => setTimeout(done, 6000)),
    ]);

  let config = {};
  let works = [];

  /* ---------- theme (dark is the default) ---------- */
  const toggle = $("theme-toggle");
  const current = () => (document.documentElement.dataset.theme === "light" ? "light" : "dark");
  function paintToggle() {
    toggle.setAttribute("aria-checked", String(current() === "dark"));
  }
  toggle.addEventListener("click", () => {
    const next = current() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch (e) {}
    paintToggle();
  });
  paintToggle();

  document.querySelectorAll("[data-nav]").forEach((a) => {
    if (a.dataset.nav === page) a.setAttribute("aria-current", "page");
  });

  /* ---------- protection: discourage saving images and copying text ---------- */
  const isOpen = () => document.documentElement.dataset.open === "1";
  const inField = (t) => !!(t && t.closest && t.closest("input, textarea"));
  const elOf = (t) => (t && t.nodeType === 3 ? t.parentElement : t);
  document.addEventListener("contextmenu", (e) => {
    const t = elOf(e.target);
    if (!isOpen() && !inField(t) && !(t && t.closest && t.closest("a"))) e.preventDefault();
  });
  document.addEventListener("selectstart", (e) => { if (!isOpen() && !inField(elOf(e.target))) e.preventDefault(); });
  document.addEventListener("copy", (e) => { if (!isOpen() && !inField(elOf(e.target))) e.preventDefault(); });
  document.addEventListener("cut", (e) => { if (!isOpen() && !inField(elOf(e.target))) e.preventDefault(); });
  document.addEventListener("dragstart", (e) => { if (!isOpen() && elOf(e.target) && elOf(e.target).tagName === "IMG") e.preventDefault(); });
  document.addEventListener("keydown", (e) => {
    // "save page as" would download the images too
    if (!isOpen() && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") e.preventDefault();
  });

  /* ---------- sharing: every piece has its own link ---------- */
  const slug = (s) => String(s || "").toLowerCase().replace(/\.[a-z0-9]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  // same rule as scripts/build.mjs, so a share link always finds its piece
  const withIds = (items, type) => {
    const used = new Set();
    return items.map((w) => {
      const base = slug(w.src ? w.src.split("/").pop().split("?")[0] : w.title) || type;
      let id = base;
      for (let n = 2; used.has(id); n++) id = base + "-" + n;
      used.add(id);
      return { ...w, type, id };
    });
  };
  const PAGES = { photo: "photos.html", drawing: "drawings.html", musing: "musings.html" };
  // the share page carries the link-preview card, then sends visitors to the piece
  const shareUrl = (w) => new URL("share/" + w.type + "/" + w.id + "/", location.href).href;
  const setHash = (h) => { try { history.replaceState(null, "", h); } catch (e) {} };
  function toast(text) {
    const t = el("div", { class: "toast", role: "status", text });
    (document.getElementById("viewer") && document.getElementById("viewer").open ? document.getElementById("viewer") : document.body).append(t);
    setTimeout(() => t.remove(), 2200);
  }
  async function share(w) {
    const url = shareUrl(w);
    if (navigator.share) {
      try { await navigator.share({ title: w.title, text: w.title, url }); return; }
      catch (e) { if (e && e.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(url); toast("link copied"); }
    catch (e) { window.prompt("copy this link", url); }
  }

  /* ---------- viewer: a different layout for photos, drawings and musings ---------- */
  const viewer = $("viewer");
  const progress = $("v-progress");
  let viewList = [];
  let viewIndex = 0;
  let viewing = null;

  function show(list, i) {
    viewList = list;
    viewIndex = (i + list.length) % list.length;
    const w = list[viewIndex];
    viewing = w;
    if (page !== "home") setHash("#" + w.id);
    const count = list.length > 1 ? viewIndex + 1 + " of " + list.length : "";
    const body = $("v-body");
    body.replaceChildren();
    viewer.dataset.kind = w.type;
    progress.hidden = w.type !== "musing";
    progress.style.width = "0";

    if (w.type === "musing") {
      body.append(
        el("article", { class: "v-read" }, [
          el("h2", { text: w.title }),
          el("div", { class: "v-meta" }, [el("span", { text: w.year || "" }), el("span", { text: count })]),
          ...paragraphs(w.body || w.excerpt).map((p) => el("p", { text: p })),
        ])
      );
    } else if (w.type === "drawing") {
      body.append(
        el("figure", { class: "v-print" }, [
          el("div", { class: "v-mat" }, [picture(w, 2400)]),
          el("figcaption", { class: "v-label" }, [
            el("i", { text: w.title }),
            el("span", { text: metaOf(w) }),
            el("span", { class: "v-count", text: count }),
          ]),
        ])
      );
    } else {
      body.append(
        el("figure", { class: "v-photo" }, [
          picture(w, 2400),
          el("figcaption", {}, [
            el("span", {}, [el("b", { text: w.title }), " " + metaOf(w)]),
            el("span", { text: count }),
          ]),
        ])
      );
    }
    $("v-prev").hidden = $("v-next").hidden = list.length < 2;
    if (!viewer.open) viewer.showModal();
    viewer.scrollTop = 0;
  }

  if (viewer) {
    const step = (d) => show(viewList, viewIndex + d);
    $("v-share").addEventListener("click", () => viewing && share(viewing));
    viewer.addEventListener("close", () => { if (page !== "home") setHash(location.pathname + location.search); });
    $("v-close").addEventListener("click", () => viewer.close());
    $("v-prev").addEventListener("click", () => step(-1));
    $("v-next").addEventListener("click", () => step(1));
    // clicking empty space around a photo or print closes it
    viewer.addEventListener("click", (e) => {
      const t = e.target;
      const outside = t === viewer || t.classList.contains("v-body") || t.classList.contains("v-photo") || t.classList.contains("v-print");
      if (!outside) return;
      const img = viewer.querySelector(".v-body img");
      if (img) {
        const r = img.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) return;
      }
      viewer.close();
    });
    viewer.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    });
    // swipe left or right on touch screens
    let x0 = null;
    viewer.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    viewer.addEventListener("touchend", (e) => {
      if (x0 === null || viewList.length < 2) return;
      const dx = e.changedTouches[0].clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 60) step(dx < 0 ? 1 : -1);
    }, { passive: true });
    // reading progress for musings
    viewer.addEventListener("scroll", () => {
      const max = viewer.scrollHeight - viewer.clientHeight;
      progress.style.width = max > 0 ? (viewer.scrollTop / max) * 100 + "%" : "0";
    }, { passive: true });
  }

  /* ---------- home carousel: photos, drawings and musings mixed ---------- */
  function interleave(groups) {
    const out = [];
    const max = Math.max(...groups.map((g) => g.length));
    for (let i = 0; i < max; i++) groups.forEach((g) => g[i] && out.push(g[i]));
    return out;
  }

  function renderCarousel() {
    const track = $("track");
    const items = interleave(["photo", "drawing", "musing"].map((t) => works.filter((w) => w.type === t)));
    track.replaceChildren();
    if (!items.length) {
      track.append(note("nothing here yet."));
      return;
    }
    items.forEach((w, i) => {
      let slide;
      if (w.type === "musing") {
        const btn = el("button", { type: "button", "aria-label": "Read " + w.title }, [
          el("span", {}, [
            el("span", { class: "row-title", text: w.title }),
            el("span", { class: "row-meta", text: w.year || "" }),
          ]),
          el("span", { class: "row-text", text: w.excerpt || "" }),
        ]);
        btn.addEventListener("click", () => show(items, i));
        slide = el("div", { class: "slide text" }, [btn]);
      } else {
        const img = picture(w, 1200, i === 0 ? { loading: "eager", fetchpriority: "high" } : { loading: i < 3 ? "eager" : "lazy" });
        if (w.width && w.height) {
          img.setAttribute("width", w.width);
          img.setAttribute("height", w.height);
        }
        const btn = el("button", { type: "button", "aria-label": "Open " + w.title }, [img]);
        btn.addEventListener("click", () => show(items, i));
        slide = el("figure", { class: "slide" }, [
          btn,
          el("figcaption", { class: "cap" }, [w.title + " ", el("span", { text: metaOf(w) })]),
        ]);
      }
      track.append(slide);
    });

    const slides = [...track.children];
    const last = slides.length - 1;
    const padLeft = () => parseFloat(getComputedStyle(track).paddingLeft) || 0;
    const startOf = (i) => slides[i].offsetLeft - padLeft();
    const goTo = (i) =>
      track.scrollTo({ left: startOf(i), behavior: reduceMotion ? "auto" : "smooth" });
    const currentIndex = () => {
      let idx = 0;
      slides.forEach((s, i) => { if (startOf(i) <= track.scrollLeft + 4) idx = i; });
      return idx;
    };
    const atEnd = () => track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
    const next = () => (atEnd() ? goTo(0) : goTo(Math.min(currentIndex() + 1, last)));
    const prev = () => {
      const cur = currentIndex();
      if (track.scrollLeft <= 4) return goTo(last);
      goTo(track.scrollLeft - startOf(cur) > 4 ? cur : cur - 1);
    };
    $("car-next").addEventListener("click", next);
    $("car-prev").addEventListener("click", prev);

    // dots replace the scrollbar: one per slide, current one stretched
    const dotsBox = $("dots");
    const dots = slides.map((_, i) => {
      const d = el("button", { type: "button", class: "dot", "aria-label": "Slide " + (i + 1) + " of " + slides.length });
      d.addEventListener("click", () => goTo(i));
      dotsBox.append(d);
      return d;
    });
    const nearest = () => {
      if (atEnd()) return last;
      let best = 0;
      slides.forEach((_, i) => {
        if (Math.abs(startOf(i) - track.scrollLeft) < Math.abs(startOf(best) - track.scrollLeft)) best = i;
      });
      return best;
    };
    let shown = -1;
    const WINDOW = 9; // with many slides, only a sliding window of dots is shown
    const paintDots = () => {
      const n = nearest();
      if (n === shown) return;
      shown = n;
      const many = dots.length > WINDOW;
      const from = many ? Math.min(Math.max(n - Math.floor(WINDOW / 2), 0), dots.length - WINDOW) : 0;
      const to = many ? from + WINDOW - 1 : dots.length - 1;
      dots.forEach((d, i) => {
        d.hidden = i < from || i > to;
        d.classList.toggle("far", many && ((i === from && from > 0) || (i === to && to < dots.length - 1)));
        if (i === n) d.setAttribute("aria-current", "true");
        else d.removeAttribute("aria-current");
      });
    };
    track.addEventListener("scroll", paintDots, { passive: true });
    window.addEventListener("resize", paintDots);
    paintDots();
    track.addEventListener("keydown", (e) => {
      if (e.target !== track) return;
      if (e.key === "ArrowRight") { e.preventDefault(); next(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
    });

    // autoplay: advances every few seconds, pauses while the visitor is
    // interacting, the carousel is off screen, or the viewer is open.
    // Off entirely when the visitor prefers reduced motion.
    if (reduceMotion || slides.length < 2) return;
    const carousel = track.closest(".carousel");
    let timer = null;
    let visible = true;
    let held = false;
    const stop = () => { clearInterval(timer); timer = null; };
    const play = () => {
      if (timer || held || !visible || viewer.open || document.hidden) return;
      timer = setInterval(next, 4500);
    };
    const hold = () => { held = true; stop(); };
    const release = () => { held = false; play(); };
    carousel.addEventListener("mouseenter", hold);
    carousel.addEventListener("mouseleave", release);
    carousel.addEventListener("focusin", hold);
    carousel.addEventListener("focusout", (e) => { if (!carousel.contains(e.relatedTarget)) release(); });
    let touchTimer;
    carousel.addEventListener("touchstart", () => { hold(); clearTimeout(touchTimer); }, { passive: true });
    carousel.addEventListener("touchend", () => { touchTimer = setTimeout(release, 6000); }, { passive: true });
    viewer.addEventListener("close", play);
    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : play()));
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((entries) => {
        visible = entries[0].isIntersecting;
        visible ? play() : stop();
      }).observe(carousel);
    }
    play();
  }

  /* ---------- photos / drawings grid ---------- */
  function renderGrid(type) {
    const items = works.filter((w) => w.type === type);
    const grid = $("grid");
    grid.replaceChildren();
    if (!items.length) {
      grid.append(note("nothing here yet."));
      return;
    }
    const layout = document.body.dataset.layout;
    grid.className = layout === "masonry" ? "masonry" : "prints";

    const makePiece = (w, i) => {
      const img = picture(w, 1000, { loading: i < 4 ? "eager" : "lazy" });
      if (w.width && w.height) {
        img.setAttribute("width", w.width);
        img.setAttribute("height", w.height);
      }
      const btn = el("button", { type: "button", "aria-label": "Open " + w.title }, [img]);
      btn.addEventListener("click", () => show(items, i));
      const cap =
        layout === "masonry"
          ? el("span", { class: "mcap", "aria-hidden": "true", text: w.title })
          : el("figcaption", { class: "cap" }, [w.title + " ", el("span", { text: metaOf(w) })]);
      return el("figure", { class: "piece" }, [btn, cap]);
    };
    const pieces = items.map(makePiece);

    if (layout !== "masonry") {
      grid.append(...pieces);
      return;
    }

    // masonry: place each photo in the currently shortest column
    let colCount = 0;
    const build = () => {
      const w = grid.clientWidth || window.innerWidth;
      const n = Math.min(items.length, w < 560 ? 2 : w < 980 ? 3 : 4);
      if (n === colCount) return;
      colCount = n;
      grid.replaceChildren();
      const cols = Array.from({ length: n }, () => el("div", { class: "mcol" }));
      const heights = new Array(n).fill(0);
      items.forEach((it, i) => {
        const ratio = it.width && it.height ? it.height / it.width : 1;
        const shortest = heights.indexOf(Math.min(...heights));
        cols[shortest].append(pieces[i]);
        heights[shortest] += ratio;
      });
      grid.append(...cols);
    };
    build();
    new ResizeObserver(build).observe(grid);
  }

  /* ---------- instagram (photos and drawings pages) ---------- */
  function renderInstagram(key) {
    const ig = config.instagram || {};
    const box = $("ig-posts");
    const handle = (ig.handle || "").replace(/^@/, "");
    const posts = (ig[key] || []).filter((u) => /^https:\/\/(www\.)?instagram\.com\//.test(u));

    if (handle) {
      const link = $("ig-link");
      link.href = "https://www.instagram.com/" + handle + "/";
      link.textContent = "Follow @" + handle;
      link.hidden = false;
    }
    if (!posts.length) {
      box.append(note("instagram posts will show here once you add their links in the editor."));
      return;
    }
    posts.forEach((url) => {
      const clean = url.split("?")[0];
      box.append(
        el("blockquote", { class: "instagram-media", "data-instgrm-permalink": clean, "data-instgrm-version": "14" }, [
          el("a", { href: clean, target: "_blank", rel: "noopener", text: "View this post on Instagram" }),
        ])
      );
    });

    // Instagram's script loads only when the section nears the screen
    const loadScript = () => {
      if (window.instgrm) return window.instgrm.Embeds.process();
      const s = document.createElement("script");
      s.async = true;
      s.src = "https://www.instagram.com/embed.js";
      document.body.append(s);
    };
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            io.disconnect();
            loadScript();
          }
        },
        { rootMargin: "400px" }
      );
      io.observe(box);
    } else {
      loadScript();
    }
  }

  /* ---------- musings page ---------- */
  function renderPieces() {
    const pieces = works.filter((w) => w.type === "musing");
    const list = $("pieces");
    if (!pieces.length) {
      list.remove();
      $("sub-head").style.marginTop = "0";
      return;
    }
    pieces.forEach((w, i) => {
      const btn = el("button", { type: "button", class: "row" }, [
        el("span", { class: "row-title", text: w.title }),
        el("span", { class: "row-meta", text: w.year || "" }),
        el("span", { class: "row-text", text: w.excerpt || "" }),
      ]);
      btn.addEventListener("click", () => show(pieces, i));
      list.append(el("li", {}, [btn]));
    });
  }

  function substackBase() {
    const s = config.substack || {};
    if (s.feedUrl) return s.feedUrl.replace(/\/feed\/?$/, "");
    if (s.handle) return "https://" + s.handle + ".substack.com";
    return "";
  }

  async function renderSubstack() {
    const list = $("substack");
    const base = substackBase();
    if (!base) {
      list.replaceWith(note("your latest substack posts will show here once you add your handle in the editor."));
      return;
    }
    const link = $("substack-link");
    link.href = base + "/subscribe";
    link.hidden = false;
    try {
      const res = await fetch("/.netlify/functions/substack");
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      if (!data.items.length) throw new Error("empty");
      data.items.forEach((p) => {
        const date = p.date
          ? new Date(p.date).toLocaleDateString("en", { year: "numeric", month: "long", day: "numeric" })
          : "";
        list.append(
          el("li", {}, [
            el("a", { class: "row", href: p.link, target: "_blank", rel: "noopener" }, [
              el("span", { class: "row-title", text: p.title }),
              el("span", { class: "row-meta", text: date }),
              el("span", { class: "row-text", text: p.summary }),
            ]),
          ])
        );
      });
    } catch (e) {
      list.replaceWith(
        el("p", { class: "note" }, [
          "Posts couldn't load. Read them on ",
          el("a", { href: base, target: "_blank", rel: "noopener", text: "Substack" }),
          ".",
        ])
      );
    }
  }

  /* ---------- about + chrome ---------- */
  function renderAbout() {
    const about = $("about-text");
    (config.about || []).forEach((p) => about.append(el("p", { text: p })));
    const links = [];
    if (config.email) links.push(el("a", { href: "mailto:" + config.email, text: config.email }));
    const ig = ((config.instagram || {}).handle || "").replace(/^@/, "");
    if (ig) links.push(el("a", { href: "https://www.instagram.com/" + ig + "/", target: "_blank", rel: "noopener", text: "Instagram" }));
    const sub = substackBase();
    if (sub) links.push(el("a", { href: sub, target: "_blank", rel: "noopener", text: "Substack" }));
    if (links.length) {
      const c = $("contact");
      c.append("You can also reach me at ");
      links.forEach((a, i) => {
        if (i) c.append(i === links.length - 1 ? " or " : ", ");
        c.append(a);
      });
      c.append(".");
      c.hidden = false;
    }
  }

  function setupContactForm() {
    const form = $("contact-form");
    if (!form) return;
    const status = $("form-status");
    const btn = form.querySelector("button[type=submit]");
    const opened = Date.now();
    const rules = {
      name: (v) => (v.trim() ? "" : "please enter your name."),
      email: (v) => (!v.trim() ? "please enter your email." : /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? "" : "that email doesn't look right."),
      message: (v) => (v.trim().length >= 5 ? "" : "please write a short message."),
    };
    const check = (name) => {
      const input = form.elements[name];
      const msg = rules[name](input.value);
      $("e-" + name).textContent = msg;
      input.setAttribute("aria-invalid", msg ? "true" : "false");
      return !msg;
    };
    Object.keys(rules).forEach((n) => {
      form.elements[n].addEventListener("blur", () => check(n));
      form.elements[n].addEventListener("input", () => { if (form.elements[n].getAttribute("aria-invalid") === "true") check(n); });
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      status.textContent = "";
      const bad = Object.keys(rules).filter((n) => !check(n));
      if (bad.length) { form.elements[bad[0]].focus(); return; }
      // a filled hidden field, or a form sent in under 3 seconds, is a bot: pretend it worked and send nothing
      if (form.elements["bot-field"].value || Date.now() - opened < 3000) {
        form.reset();
        status.textContent = "message sent. thank you.";
        return;
      }
      btn.disabled = true;
      status.textContent = "sending...";
      try {
        const res = await fetch("/", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams(new FormData(form)).toString(),
        });
        if (!res.ok) throw new Error(String(res.status));
        form.reset();
        status.textContent = "message sent. thank you.";
      } catch (err) {
        status.textContent = "the message didn't send. try again, or use the links below the form.";
      }
      btn.disabled = false;
    });
  }

  // optional visitor counting, set up in the editor. skipped for "do not track", local previews and the editor.
  function setupAnalytics() {
    const a = config.analytics || {};
    const id = String(a.id || "").trim();
    if (!a.provider || a.provider === "none" || !id) return;
    if (navigator.doNotTrack === "1" || /^(localhost|127\.|\[::1\])/.test(location.hostname)) return;
    const add = (src, attrs) => {
      const s = document.createElement("script");
      s.async = true; s.src = src;
      Object.entries(attrs || {}).forEach(([k, v]) => s.setAttribute(k, v));
      document.head.append(s);
    };
    if (a.provider === "plausible") add("https://plausible.io/js/script.js", { defer: "", "data-domain": id });
    else if (a.provider === "goatcounter") add("https://gc.zgo.at/count.js", { "data-goatcounter": "https://" + id + ".goatcounter.com/count" });
    else if (a.provider === "google" && /^G-[A-Z0-9]+$/i.test(id)) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag("js", new Date());
      window.gtag("config", id);
      add("https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id));
    }
  }

  function renderChrome() {
    const name = config.name || "asitwashere";
    if (page === "home") {
      document.title = name;
      $("site-name").textContent = name;
      $("tagline").textContent = config.tagline || "";
    }
    $("foot-name").textContent = name;
    $("foot-year").textContent = new Date().getFullYear();
  }

  /* ---------- start ---------- */
  setupContactForm();
  // a shared link like photos.html#some-photo opens that piece
  function openFromLink(list) {
    const asked = new URLSearchParams(location.search).get("open");
    let id = asked || location.hash.slice(1);
    try { id = decodeURIComponent(id); } catch (e) {}
    const i = id ? list.findIndex((w) => w.id === id) : -1;
    if (i >= 0) {
      show(list, i);
      if (asked) setHash(location.pathname + "#" + list[i].id);
    }
  }
  let linkList = [];
  window.addEventListener("hashchange", () => openFromLink(linkList));

  const listOf = (name, type) =>
    fetchJson("data/" + name + ".json")
      .then((d) => withIds(d.items || [], type))
      .catch((e) => { console.warn(e); return []; });

  Promise.all([
    fetchJson("site.config.json"),
    listOf("photos", "photo"),
    listOf("drawings", "drawing"),
    listOf("musings", "musing"),
  ])
    .then(async ([c, photos, drawings, musings]) => {
      config = c;
      if (config.protect === false) document.documentElement.dataset.open = "1";
      works = [...photos, ...drawings, ...musings];
      renderChrome();
      setupAnalytics();
      if (page === "home" || page === "photos" || page === "drawings") await measure(works);
      if (page === "home") renderCarousel();
      if (page === "photos" || page === "drawings") {
        renderGrid(document.body.dataset.grid);
        renderInstagram(document.body.dataset.ig);
        linkList = works.filter((w) => w.type === document.body.dataset.grid);
        openFromLink(linkList);
      }
      if (page === "musings") {
        renderPieces();
        renderSubstack();
        linkList = works.filter((w) => w.type === "musing");
        openFromLink(linkList);
      }
      if (page === "about") renderAbout();
    })
    .catch((e) => {
      const target = $("grid") || $("track") || $("about-text") || $("pieces");
      if (target) target.append(note("The site's content couldn't load. Check the files in data/ and site.config.json."));
      console.error(e);
    });
})();

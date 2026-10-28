(() => {
  "use strict";
  const DATA = window.GRANA_DATA || {};
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else node.setAttribute(k, v === true ? "" : v);
    }
    for (const c of children) if (c != null) node.append(c);
    return node;
  }

  /* Pretraining gallery. A tile whose instruction differs from its caption gets a
     button that reveals the full instruction on hover, keyboard focus or tap. */
  function renderTasks() {
    const host = $("#task-gallery");
    const data = DATA.tasks;
    if (!host || !data) return;
    const base = new URL("../../", document.currentScript.src).href;
    const items = [...data.items].sort((x, y) => ((x.rank ?? 1e9) - (y.rank ?? 1e9)) || x.seq - y.seq);
    const tiles = [];
    items.forEach((it, index) => {
      const img = el("img", { src: base + it.img, alt: `${it.task} — top camera frame`, loading: "lazy", decoding: "async", width: 480, height: 360 });
      const caption = el("figcaption", { text: it.task });
      const hasMore = it.instruction && it.instruction.trim().toLowerCase() !== it.task.trim().toLowerCase();
      let media;
      if (hasMore) {
        const noteId = `task-instruction-${index}`;
        media = el("button", { class: "tile-media", type: "button", "aria-expanded": "false", "aria-describedby": noteId, "aria-label": `${it.task}: show the full instruction` },
          img,
          el("span", { class: "tile-dot", "aria-hidden": "true" }),
          el("span", { class: "tile-instruction", id: noteId, role: "note" }, el("b", { text: "Instruction" }), el("span", { text: it.instruction })));
      } else {
        media = el("div", { class: "tile-media" }, img);
      }
      const tile = el("figure", { class: "tile" }, media, caption);
      if (hasMore) {
        media.addEventListener("click", () => {
          const open = !tile.classList.contains("is-open");
          tiles.forEach((t) => { if (t !== tile) close(t); });
          tile.classList.toggle("is-open", open);
          media.setAttribute("aria-expanded", String(open));
        });
        media.addEventListener("keydown", (event) => { if (event.key === "Escape") close(tile); });
        tiles.push(tile);
      }
      host.append(tile);
    });
    function close(tile) {
      tile.classList.remove("is-open");
      const button = $("button.tile-media", tile);
      if (button) button.setAttribute("aria-expanded", "false");
    }
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".tile")) tiles.forEach(close);
    });
    /* Instructions longer than their tile scroll inside the overlay: mark them
       so the clipped bottom edge fades (a cue that there is more). */
    const notes = $$(".tile-instruction", host);
    const measure = () => notes.forEach((note) => {
      note.classList.remove("is-long");
      note.classList.toggle("is-long", note.scrollHeight > note.clientHeight + 1);
    });
    if ("ResizeObserver" in window) new ResizeObserver(measure).observe(host);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  }

  /* Deep links into collapsed method details: open every enclosing <details>
     (and the target itself when it is one), then scroll it into view. */
  let pendingScroll = 0;
  function targetOf(hash) {
    let id;
    try { id = decodeURIComponent((hash || "").slice(1)); } catch (_) { return null; }
    return id ? document.getElementById(id) : null;
  }
  function openAround(target) {
    if (!target.closest("details")) return false;
    if (target.tagName === "DETAILS") target.open = true;
    for (let details = target.parentElement && target.parentElement.closest("details"); details; details = details.parentElement && details.parentElement.closest("details")) details.open = true;
    return true;
  }
  function reveal(hash) {
    const target = targetOf(hash);
    if (!target || !openAround(target)) return false;
    cancelAnimationFrame(pendingScroll);
    pendingScroll = requestAnimationFrame(() => target.scrollIntoView({ block: "start" }));
    return true;
  }

  /* A page opened at #fragment: typeset math, web fonts and posters keep
     changing heights for a moment after the first scroll (a smooth scroll
     would aim at a stale position). Land instantly, then keep the target at
     its landing line while the layout settles, until the visitor scrolls,
     clicks or types. */
  let interacted = false;
  const INTERACTIONS = ["wheel", "touchstart", "pointerdown", "keydown"];
  INTERACTIONS.forEach((name) => window.addEventListener(name, () => { interacted = true; }, { capture: true, passive: true, once: true }));
  let releaseHold = null;
  function holdTarget(duration) {
    const target = targetOf(location.hash);
    if (!target || interacted || !("ResizeObserver" in window)) return;
    if (releaseHold) releaseHold();
    openAround(target);
    let active = true, frame = 0;
    const place = () => { frame = 0; if (active) target.scrollIntoView({ block: "start", behavior: "instant" }); };
    const observer = new ResizeObserver(() => { if (active && !frame) frame = requestAnimationFrame(place); });
    const timer = setTimeout(() => release(), duration);
    function release() {
      if (!active) return;
      active = false;
      observer.disconnect(); cancelAnimationFrame(frame); clearTimeout(timer);
      INTERACTIONS.forEach((name) => window.removeEventListener(name, release, true));
      releaseHold = null;
    }
    releaseHold = release;
    INTERACTIONS.forEach((name) => window.addEventListener(name, release, { capture: true, passive: true }));
    observer.observe(document.body);
    place();
  }
  function methodNavigation() {
    window.addEventListener("hashchange", () => { if (releaseHold) releaseHold(); reveal(location.hash); });
    for (const link of $$(".method-nav a[href^='#'], .evaluation-nav a[href^='#'], .details-body a[href^='#']")) {
      link.addEventListener("click", () => {
        if (link.hash === location.hash) reveal(link.hash);
      });
    }
    /* After every deferred script: the player scripts create some targets
       (#policy-<id>, #prediction-<id>). */
    document.addEventListener("DOMContentLoaded", () => { if (location.hash) holdTarget(4000); }, { once: true });
  }

  /* KaTeX: loaded here rather than as deferred <script> tags, so a slow or
     blocked CDN never holds up DOMContentLoaded (and the scripts that wait
     for it). async=false keeps katex.min.js before auto-render.min.js. */
  const KATEX = "https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/";
  function loadScript(src) {
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.crossOrigin = "anonymous";
    document.head.append(script);
    return script;
  }
  function math() {
    if (typeof window.renderMathInElement !== "function" && !document.querySelector('script[src*="auto-render"]')) {
      loadScript(`${KATEX}katex.min.js`);
      loadScript(`${KATEX}contrib/auto-render.min.js`);
    }
    let rendered = false;
    const render = () => {
      if (rendered || typeof window.renderMathInElement !== "function") return;
      rendered = true;
      window.renderMathInElement(document.body, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "\\[", right: "\\]", display: true },
          { left: "\\(", right: "\\)", display: false },
        ],
        throwOnError: false,
        ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"],
      });
      document.documentElement.classList.add("math-ready");
      /* Typeset math changes heights: keep a deep link on its target (again,
         if the math arrived late and the visitor has not moved yet). */
      if (location.hash && !releaseHold) holdTarget(2000);
    };
    if (typeof window.renderMathInElement === "function") { render(); return; }
    const script = document.querySelector('script[src*="auto-render"]');
    if (script) script.addEventListener("load", render, { once: true });
    window.addEventListener("load", render, { once: true });
  }

  renderTasks();
  math();
  methodNavigation();
})();

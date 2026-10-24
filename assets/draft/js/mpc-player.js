/* PRISM draft: MPC examples player (section 03, #mpc-player).
 *
 * Built like the policy player (assets/js/policy.js) and with its classes: story tabs (name, meta,
 * duration), a panel with the video and its transport, and a context column. One 16:9 clip per story
 * (window.PRISM_DRAFT.mpc, assets/draft/js/mpc-data.js). Under the video, a strip made of the film's
 * own caption timeline (one segment per caption, coloured by kind) works as the seek bar: click a
 * segment to jump to that caption, drag to scrub, or use the arrow keys; the current caption is
 * repeated in large type under it.
 *
 * Loading and playback: posters and the source are set only near the viewport (900 px); the 1080 file
 * when the stage is >= 1400 device pixels wide, else the 720 one. Muted autoplay only while the stage
 * is >= 50% visible, motion is not reduced, the visitor has not paused and no other page video plays;
 * it pauses below 15% visible or in a hidden tab. One video element serves every story, so only one
 * clip ever plays. Deep links: #mpc-<id>.
 */
(() => {
  "use strict";
  const host = document.getElementById("mpc-player");
  const DATA = window.PRISM_DRAFT && window.PRISM_DRAFT.mpc;
  if (!host || !DATA || !Array.isArray(DATA.stories) || !DATA.stories.length) return;
  const script = document.currentScript;
  const BASE = new URL("../../../", (script && script.src) || document.baseURI).href;
  const abs = (path) => new URL(path, BASE).href;

  const STORIES = DATA.stories;
  /* Strip / caption colour group of each kind (red only ever means failure). */
  const TONE = { setup: "plain", run: "plain", mpc: "plan", imagine: "plan", judge: "plan", alone: "bad", wrong: "bad", reject: "bad", chosen: "good", done: "good" };
  const MARK = { alone: "✕", wrong: "✕", reject: "✕", chosen: "●", done: "✓" };
  const LEAD = 0.2;   /* a jump lands this far into a caption: its burned-in text has faded in by then */
  const SPEEDS = [0.5, 0.75, 1];
  const NS = "http://www.w3.org/2000/svg";
  const reduceMQ = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  const hasVFC = typeof HTMLVideoElement !== "undefined" && "requestVideoFrameCallback" in HTMLVideoElement.prototype;

  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") n.className = v; else if (k === "text") n.textContent = v; else n.setAttribute(k, v === true ? "" : v);
    }
    for (const c of kids) if (c != null) n.append(c);
    return n;
  };
  const icon = (d) => {
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "btn-ico");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", d);
    svg.append(p);
    return svg;
  };
  const mmss = (s) => { s = Math.max(0, s || 0); return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`; };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const pct = (f) => `${(clamp(f, 0, 1) * 100).toFixed(3)}%`;
  const say = (b) => b.say || b.text;

  /* ---------- Markup (DOM order = phone order: tabs, panel, context) ---------- */
  const tabs = el("div", { class: "policy-tabs mpc-tabs", role: "tablist", "aria-label": "MPC examples" });
  const tabButtons = STORIES.map((s) => el("button", {
    id: `mpc-tab-${s.id}`, class: "policy-task-tab mpc-tab", type: "button", role: "tab",
    "aria-selected": "false", "aria-controls": "mpc-active-panel", tabindex: "-1", "data-story": s.id,
  },
  el("span", { class: "policy-task-name", text: s.tab }),
  el("span", { class: "policy-task-count", text: s.meta }),
  el("span", { class: "policy-task-dur", "aria-hidden": "true", text: mmss(s.dur) })));
  tabButtons.forEach((b) => tabs.append(b));

  /* Deep-link targets (#mpc-<id>, plus the file name's id where it differs), as in the policy player. */
  const anchors = [];
  STORIES.forEach((s) => [s.id, s.alias].forEach((id) => {
    if (id && !document.getElementById(`mpc-${id}`)) anchors.push(el("span", { id: `mpc-${id}`, class: "policy-task-anchor", "aria-hidden": "true" }));
  }));
  const title = el("h3", { id: "mpc-active-title" });
  const meta = el("p", { class: "policy-task-meta" });
  const identity = el("header", { class: "policy-task-identity mpc-identity" }, ...anchors, title, meta);

  const video = el("video", { class: "mpc-video", muted: true, playsinline: true, loop: true, preload: "none", width: 1920, height: 1080, disablepictureinpicture: true });
  video.muted = true;
  video.defaultMuted = true;
  const stage = el("div", { class: "mpc-stage is-paused" }, video);

  const head = el("span", { class: "mpc-head" });
  const track = el("div", { class: "mpc-track", "aria-hidden": "true" }, head);
  const marks = el("div", { class: "mpc-marks", "aria-hidden": "true" });
  const tip = el("span", { class: "mpc-tip", "aria-hidden": "true", hidden: true });
  const strip = el("div", {
    class: "mpc-strip", role: "slider", tabindex: "0", "aria-label": "Story timeline (arrow keys: previous or next caption)",
    "aria-valuemin": "0", "aria-valuemax": "0", "aria-valuenow": "0",
  }, marks, track, tip);
  const time = el("span", { class: "transport-time mpc-time", text: "0:00 / 0:00" });
  const stripRow = el("div", { class: "mpc-strip-row" }, strip, time);
  const now = el("p", { class: "mpc-now", "aria-hidden": "true" });

  const playBtn = el("button", { class: "btn btn--sm btn--play mpc-play", type: "button", text: "Play" });
  const prevBtn = el("button", { class: "btn btn--sm btn--ghost mpc-step", type: "button", "aria-label": "Previous caption" }, icon("M15 6l-6 6 6 6"), el("span", { class: "mpc-step-label", text: "Prev" }));
  const nextBtn = el("button", { class: "btn btn--sm btn--ghost mpc-step", type: "button", "aria-label": "Next caption" }, el("span", { class: "mpc-step-label", text: "Next" }), icon("M9 6l6 6-6 6"));
  const rate = el("select", { class: "mpc-speed", "aria-label": "Playback speed" }, ...SPEEDS.map((r) => el("option", { value: r, text: `${r}×`, selected: r === 1 || null })));
  const fsBtn = el("button", { class: "btn btn--sm btn--ghost mpc-fs", type: "button", "aria-label": "Full screen", title: "Full screen" }, icon("M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"));
  const transport = el("div", { class: "controls policy-transport transport mpc-transport" }, playBtn, prevBtn, nextBtn, rate, fsBtn);
  const viewer = el("div", { class: "policy-viewer mpc-viewer" }, stage, stripRow, now, transport);
  const panel = el("div", { id: "mpc-active-panel", class: "policy-active-panel mpc-panel", role: "tabpanel" }, identity, viewer);

  const compare = el("dl", { class: "mpc-compare" });
  const note = el("p", { class: "policy-caption mpc-note" });
  const legendRows = [
    ["bad", "✕ policy alone", "The same start, without MPC."],
    ["good", "✓ PRISM's pick", "The imagined future PRISM picked; it ran on the robot."],
    ["bad", "✕ PRISM", "PRISM rated all four imagined futures too risky."],
    ["plain", "×N · fast-forward · MPC idle", "Sped up, or no planning in that stretch."],
  ];
  const legend = el("details", { class: "disclosure mpc-legend" },
    el("summary", { text: "How to read the clips" }),
    el("div", { class: "disclosure-body" },
      el("dl", { class: "mpc-legend-list" }, ...legendRows.map(([tone, term, def]) => el("div", { "data-tone": tone }, el("dt", { text: term }), el("dd", { text: def })))),
      el("p", { class: "mpc-legend-strip" },
        "The bar under each video follows the captions: ",
        el("span", { class: "mpc-key", "data-tone": "plan", text: "imagining" }), ", ",
        el("span", { class: "mpc-key", "data-tone": "good", text: "chosen or done" }), ", ",
        el("span", { class: "mpc-key", "data-tone": "bad", text: "a failure or too risky" }), ", ",
        el("span", { class: "mpc-key", "data-tone": "plain", text: "the robot acts" }), ".")));
  const context = el("div", { class: "policy-task-context mpc-context" }, compare, note, legend);

  const card = el("div", { class: "card mpc-card", "data-no-reveal": true }, tabs, panel, context);

  /* ---------- Gallery: one before/after card per story; the full story opens in a dialog ----------
     Each card loops two short real clips from the same start: the policy alone (left) and with MPC (right),
     muted, only while in view (posters under reduced motion). A click opens the player above in a modal. */
  const dialog = el("dialog", { class: "mpc-dialog", "aria-labelledby": "mpc-active-title" });
  const closeBtn = el("button", { class: "mpc-close", type: "button", "aria-label": "Close the story" }, icon("M6 6l12 12M18 6L6 18"));
  dialog.append(el("div", { class: "mpc-dialog-body" }, closeBtn, card));
  const gallery = el("div", { class: "mpc-gallery", role: "list", "aria-label": "MPC examples" });
  const previews = [];
  STORIES.forEach((s) => {
    if (!s.card) return;
    const half = (side, tone, tag) => {
      const v = el("video", { muted: true, playsinline: true, preload: "none", "aria-hidden": "true", disablepictureinpicture: true,
        poster: abs(`assets/draft/video/cards/${s.id}_${side}.jpg`), "data-src": abs(`assets/draft/video/cards/${s.id}_${side}.mp4`) });
      v.muted = true;
      const node = el("figure", { class: "mpc-half", "data-tone": tone },
        el("div", { class: "mpc-half-media" }, v,
          el("span", { class: "mpc-half-tag", "data-tone": tone, text: tag }),
          el("span", { class: "mpc-half-speed", text: s.card[side].speed })),
        el("figcaption", { text: s.card[side].text }));
      return { v, node };
    };
    const a = half("alone", "bad", "✕ policy alone"), m = half("mpc", "good", "✓ with PRISM");
    /* beat 2: PRISM judges the round's 4 imagined futures (real WAM futures, a 2x2 clip) and stamps each one */
    let jv = null;
    const J = s.card.judge;
    if (J) {
      jv = el("video", { muted: true, loop: true, playsinline: true, preload: "none", "aria-hidden": "true", disablepictureinpicture: true,
        poster: abs(`assets/draft/video/cards/${s.id}_judge.jpg`), "data-src": abs(`assets/draft/video/cards/${s.id}_judge.mp4`) });
      jv.muted = true;
      const cells = J.cells.map(([tone, txt], k) => el("span", { class: "mpc-judge-cell", "data-tone": tone, style: `--k:${k}` },
        el("span", { class: "mpc-judge-stamp" }, el("b", { text: tone === "good" ? "✓" : "✕" }), el("span", { text: txt }))));
      a.node.querySelector(".mpc-half-media").append(el("div", { class: "mpc-judge", "aria-hidden": "true" },
        el("span", { class: "mpc-judge-head" }, el("span", { class: "mpc-judge-gem", text: "◆" }), el("span", {}, "PRISM judges 4 ", el("span", { class: "mpc-judge-im", text: "imagined " }), "futures")),
        el("div", { class: "mpc-judge-stage" }, jv, el("div", { class: "mpc-judge-grid" }, ...cells), el("span", { class: "mpc-judge-scan" })),
        el("span", { class: "mpc-judge-foot", "data-tone": J.cells.some((c) => c[0] === "good") ? "good" : "bad", text: J.foot })));
    }
    const open = el("button", { class: "mpc-open", type: "button", "aria-haspopup": "dialog" },
      el("span", { class: "mpc-open-ico", "aria-hidden": "true", text: "▶" }), el("span", { text: "Watch how PRISM fixes it" }),
      el("span", { class: "mpc-open-dur", text: mmss(s.dur) }));
    const item = el("article", { class: "mpc-gcard", role: "listitem", "data-story": s.id, "aria-labelledby": `mpc-g-${s.id}` },
      el("h3", { class: "mpc-gcard-title", id: `mpc-g-${s.id}`, text: s.title }),
      el("div", { class: "mpc-pair" }, a.node, m.node), open);
    item.addEventListener("click", () => openStory(s, open));
    item.style.setProperty("--i", String(previews.length));
    item.dataset.phase = "alone";
    /* a soft light follows the pointer over the card */
    item.addEventListener("pointermove", (e) => {
      const r = item.getBoundingClientRect();
      item.style.setProperty("--mx", `${e.clientX - r.left}px`); item.style.setProperty("--my", `${e.clientY - r.top}px`);
    });
    gallery.append(item);
    const p = { item, videos: [a.v, m.v], judge: jv, inView: false, phase: 0, timer: 0 };
    /* the relay: the policy alone fails -> PRISM judges the imagined futures -> the fix runs -> again */
    a.v.addEventListener("ended", () => { if (p.phase === 0) relayTo(p, p.judge ? 1 : 2, 300); });
    m.v.addEventListener("ended", () => { if (p.phase === 2) relayTo(p, 0, 900); });
    previews.push(p);
  });
  host.append(gallery, dialog);
  const JUDGE_MS = 3300;
  function relayTo(p, phase, ms) {        /* (not schedule(): the player below has its own) */
    clearTimeout(p.timer);
    p.timer = setTimeout(() => {
      p.timer = 0;
      setPhase(p, phase);
      syncPreviews();
      if (phase === 1) relayTo(p, 2, JUDGE_MS);
    }, ms);
  }
  function setPhase(p, phase) {
    p.phase = phase;
    p.item.dataset.phase = ["alone", "judge", "fix"][phase];
    const v = phase === 0 ? p.videos[0] : phase === 2 ? p.videos[1] : null;
    if (v) { try { v.currentTime = 0; } catch (_) { /* ignore */ } }
    const panel = p.item.querySelector(".mpc-judge");
    if (panel && phase === 1) { panel.classList.remove("is-judging"); void panel.offsetWidth; panel.classList.add("is-judging"); }
    if (panel && phase === 0) panel.classList.remove("is-judging");
  }
  /* cards rise in one after another when the gallery first comes into view */
  if (!reduceMQ.matches && "IntersectionObserver" in window) {
    gallery.classList.add("js-anim");
    new IntersectionObserver((entries, observer) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      observer.disconnect();
      previews.forEach((p) => p.item.classList.add("is-in"));
    }, { threshold: 0.12 }).observe(gallery);
  }

  let opener = null;
  const EASE = "cubic-bezier(.2,.8,.2,1)";
  /* FLIP: the dialog starts on the card's box and grows to its own (and goes back on close) */
  function flip(fromRect, reverse, done) {
    if (!fromRect || reduceMQ.matches || typeof dialog.animate !== "function") { if (done) done(); return; }
    const r = dialog.getBoundingClientRect();
    if (!r.width || !r.height) { if (done) done(); return; }
    const t = `translate(${fromRect.left - r.left}px, ${fromRect.top - r.top}px) scale(${fromRect.width / r.width}, ${fromRect.height / r.height})`;
    const frames = [{ transform: t, opacity: 0.35, borderRadius: "16px" }, { transform: "none", opacity: 1 }];
    const anim = dialog.animate(reverse ? frames.slice().reverse() : frames, { duration: reverse ? 320 : 460, easing: EASE, fill: "both" });
    anim.onfinish = () => { anim.cancel(); if (done) done(); };
  }
  const cardRect = () => { const c = opener && opener.closest(".mpc-gcard"); return c ? c.getBoundingClientRect() : null; };
  /* The tabs, timeline, caption and controls stay in view on short windows: the video gives way (letterboxed).
     Measured, not fixed (the tabs and the caption wrap differently at each width); mpc.css has a fallback cap. */
  const dlgBody = dialog.firstElementChild;
  function fitStage() {
    if (!dialog.open) return;
    stage.style.maxHeight = "";
    const b = dlgBody.getBoundingClientRect(), st = stage.getBoundingClientRect(), tr = transport.getBoundingClientRect();
    const k = b.height / (dlgBody.offsetHeight || b.height || 1);              // the open/close animation scales the dialog
    const above = (st.top - b.top) / k + dlgBody.scrollTop, below = (tr.bottom - st.bottom) / k;
    const pad = parseFloat(getComputedStyle(dlgBody).paddingBottom) || 16;
    stage.style.maxHeight = Math.max(200, Math.floor(dlgBody.clientHeight - above - below - pad)) + "px";
  }
  window.addEventListener("resize", fitStage);
  if ("ResizeObserver" in window) new ResizeObserver(fitStage).observe(now);   // a caption that wraps to a 2nd line
  function openStory(s, from) {
    opener = from || null;
    previews.forEach((p) => [...p.videos, p.judge].forEach((v) => { if (v && !v.paused) v.pause(); }));
    dialog.style.transformOrigin = "top left";
    if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", "");
    document.documentElement.classList.add("mpc-dialog-open");
    near = true;
    select(s, { user: true });
    fitStage();
    flip(cardRect(), false);
    if (reduceMQ.matches) applyMedia(); else play(true);
    closeBtn.focus();
  }
  let closing = false;
  function closeDialog() {
    if (!dialog.open || closing) return;
    closing = true;
    flip(cardRect(), true, () => { closing = false; dialog.close(); });
  }
  dialog.addEventListener("cancel", (e) => { e.preventDefault(); closeDialog(); });   /* Esc: animate, then close */
  dialog.addEventListener("close", () => {
    pause(false);
    document.documentElement.classList.remove("mpc-dialog-open");
    syncPreviews();
    if (opener && document.contains(opener)) opener.focus();
  });
  closeBtn.addEventListener("click", closeDialog);
  dialog.addEventListener("click", (e) => { if (e.target === dialog) closeDialog(); });   /* a click on the backdrop */

  const canPreview = () => !reduceMQ.matches && !document.hidden && !dialog.open;
  const start = (v) => { const pr = v.play(); if (pr && typeof pr.catch === "function") pr.catch(() => {}); };
  function syncPreviews() {
    previews.forEach((p) => {
      p.item.classList.toggle("is-relay", canPreview());
      const on = p.inView && canPreview();
      const active = p.phase === 0 ? 0 : p.phase === 2 ? 1 : -1;
      p.videos.forEach((v, k) => {
        if (on && !v.getAttribute("src")) { v.preload = "auto"; v.src = v.dataset.src; }
        if (on && k === active) { if (v.paused && !p.timer) start(v); } else if (!v.paused) v.pause();
      });
      if (p.judge) {
        if (on && !p.judge.getAttribute("src")) { p.judge.preload = "auto"; p.judge.src = p.judge.dataset.src; }
        if (on && p.phase === 1) { if (p.judge.paused) start(p.judge); } else if (!p.judge.paused) p.judge.pause();
      }
    });
  }
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        const p = previews.find((q) => q.item === e.target);
        if (!p) return;
        p.inView = e.isIntersecting && e.intersectionRatio >= 0.35;
        /* the first start is staggered card by card, so the hand-overs ripple across the row */
        if (p.inView && !p.started) {
          p.started = true;
          const i = previews.indexOf(p);
          if (i > 0) p.timer = setTimeout(() => { p.timer = 0; syncPreviews(); }, i * 450);
        }
      });
      syncPreviews();
    }, { threshold: [0, 0.35, 0.6] });
    previews.forEach((p) => io.observe(p.item));
  }
  document.addEventListener("visibilitychange", syncPreviews);
  if (reduceMQ.addEventListener) reduceMQ.addEventListener("change", syncPreviews);

  /* ---------- State ---------- */
  let story = null;
  let beats = [];
  let segs = [];
  let beatIdx = -1;
  let started = false;       /* the clip has played or been seeked since the story was picked */
  let shownSec = -1;
  let srcKind = "";          /* "hd" | "sd" once a source is set */
  let pendingSeek = null;    /* applied once metadata is in */
  let speed = 1;
  let near = !("IntersectionObserver" in window);
  let ratio = 0;             /* visible fraction of the stage */
  let userPaused = false;    /* the visitor paused: no autoplay until they press Play or pick a story */
  let userStarted = false;   /* the current playback was started by the visitor */
  let frameId = 0;
  let tipTimer = 0;

  const isFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  const otherVideoPlaying = () => Array.prototype.some.call(document.querySelectorAll("video"),
    (v) => v !== video && !v.paused && !v.ended && !v.closest(".hero") && !v.closest(".mpc-gallery"));
  const pickKind = () => ((stage.clientWidth || host.clientWidth || 0) * (window.devicePixelRatio || 1) >= 1400 ? "hd" : "sd");

  /* ---------- Media ---------- */
  const blobs = new Map();   /* file URL -> blob: URL (see makeSeekable) */
  let fileUrl = "";          /* the file behind the current source */
  const position = () => (pendingSeek != null ? pendingSeek : video.currentTime);
  const seekable = () => { const r = video.seekable; return !!(r && r.length && r.end(r.length - 1) > 1); };

  function applyMedia() {
    if (!near || !story) return;
    const poster = abs(story.poster);
    if (video.getAttribute("poster") !== poster) video.setAttribute("poster", poster);
    if (!video.getAttribute("src")) setSource(pickKind());
  }
  function setSource(kind) {
    srcKind = kind;
    fileUrl = abs(story.src[kind]);
    video.preload = "metadata";
    video.src = blobs.get(fileUrl) || fileUrl;
    video.defaultPlaybackRate = video.playbackRate = speed;
  }
  /* A server without HTTP range requests (python -m http.server, as used for local previews) makes
     the clip unseekable, so every caption jump would land on 0:00. There, the file is loaded once as
     a blob, which is seekable. Hosts with range requests (GitHub Pages) and file:// never get here. */
  function makeSeekable() {
    const url = fileUrl;
    if (!url || blobs.has(url) || !/^https?:$/.test(location.protocol) || typeof fetch !== "function") return;
    blobs.set(url, "");
    fetch(url).then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status))))).then((blob) => {
      const obj = URL.createObjectURL(blob);
      blobs.set(url, obj);
      if (url !== fileUrl) return;
      const t = position(), playing = !video.paused;
      video.src = obj;
      video.defaultPlaybackRate = video.playbackRate = speed;
      pendingSeek = t > 0.05 ? t : null;
      if (playing) video.play().catch(() => {});
      else sync();
    }).catch(() => {
      blobs.delete(url);
      if (url === fileUrl && video.error) { now.textContent = "The video could not be loaded."; now.dataset.tone = "bad"; }
    });
  }
  function play(user) {
    if (!story) return;
    if (user) { userPaused = false; userStarted = true; } else userStarted = false;
    near = true;
    applyMedia();
    video.playbackRate = speed;
    const p = video.play();
    if (p && typeof p.catch === "function") p.catch(() => { setPlaying(!video.paused); });
  }
  function pause(user) {
    if (user) userPaused = true;
    if (!video.paused) video.pause();
  }
  function toggle() { if (video.paused) play(true); else pause(true); }
  function autoplayAllowed() {
    return near && ratio >= 0.5 && !userPaused && !reduceMQ.matches && !document.hidden && !otherVideoPlaying();
  }
  /* Autoplay / auto-pause; runs on every visibility, tab-visibility and page-video change. */
  function sync() {
    if (!story) return;
    if (video.paused) {
      if (autoplayAllowed()) play(false);
    } else if (!isFullscreen() && (ratio < 0.15 || document.hidden)) {
      pause(false);
    }
  }

  /* ---------- Timeline strip ---------- */
  function buildStrip() {
    segs.forEach((s) => s.remove());
    marks.textContent = "";
    beats = story.beats;
    segs = beats.map((b) => {
      const seg = el("i", { class: "mpc-seg", "data-kind": b.kind, "data-tone": TONE[b.kind] || "plain" });
      seg.style.left = pct(b.t0 / story.dur);
      seg.style.width = `calc(${pct((b.t1 - b.t0) / story.dur)} - 1px)`;
      track.insertBefore(seg, head);
      return seg;
    });
    beats.forEach((b) => {
      if (!MARK[b.kind]) return;
      const m = el("b", { class: "mpc-mark", "data-tone": TONE[b.kind], text: MARK[b.kind] });
      m.style.left = pct(b.t0 / story.dur);
      marks.append(m);
    });
    strip.setAttribute("aria-valuemax", story.dur.toFixed(1));
  }
  /* The caption on screen at t: the last one that has started (held through the gaps). */
  function beatAt(t) {
    let k = 0;
    for (let i = 0; i < beats.length; i++) { if (beats[i].t0 <= t + 0.05) k = i; else break; }
    return k;
  }
  /* The caption under t on the strip, or -1 between captions. */
  function beatUnder(t) {
    for (let i = 0; i < beats.length; i++) if (t >= beats[i].t0 - 0.05 && t <= beats[i].t1 + 0.05) return i;
    return -1;
  }
  /* k = -1 before the clip has started: the poster is a later frame, so no caption is claimed yet. */
  function setBeat(k) {
    beatIdx = k;
    segs.forEach((s, i) => { s.classList.toggle("is-now", i === k); s.classList.toggle("is-past", i < k); });
    const b = beats[k];
    now.textContent = b ? say(b) : "Play, or jump to a caption on the bar above.";
    now.dataset.tone = b ? TONE[b.kind] || "plain" : "hint";
    strip.setAttribute("aria-valuetext", b ? `${mmss(position())}, ${say(b)}` : `${mmss(0)}, ${story.title}`);
  }
  function render(t) {
    if (!story) return;
    t = clamp(t || 0, 0, story.dur);
    head.style.left = pct(t / story.dur);
    const sec = Math.floor(t);
    if (sec !== shownSec) { shownSec = sec; time.textContent = `${mmss(t)} / ${mmss(story.dur)}`; }
    const k = started ? beatAt(t) : -1;
    if (k !== beatIdx) setBeat(k);
    strip.setAttribute("aria-valuenow", t.toFixed(1));
  }
  function frame() {
    frameId = 0;
    render(position());
    if (!video.paused) schedule();
  }
  function schedule() {
    if (frameId) return;
    frameId = hasVFC ? video.requestVideoFrameCallback(frame) : requestAnimationFrame(frame);
  }
  function unschedule() {
    if (!frameId) return;
    if (hasVFC) video.cancelVideoFrameCallback(frameId); else cancelAnimationFrame(frameId);
    frameId = 0;
  }
  function seek(t) {
    if (!story) return;
    t = clamp(t, 0, Math.max(0, story.dur - 0.05));
    near = true;
    applyMedia();
    if (video.readyState >= 1 && seekable()) {
      pendingSeek = null;
      try { video.currentTime = t; } catch (_) { pendingSeek = t; }
    } else {
      pendingSeek = t;    /* applied once the metadata (or the seekable copy) is in */
      if (video.readyState >= 1) makeSeekable();
    }
    /* Stepping through a paused clip: keep the frame clear (the disc returns on hover). */
    if (video.paused) stage.classList.add("is-browsing");
    started = true;
    render(t);
    strip.setAttribute("aria-valuetext", `${mmss(t)}, ${say(beats[beatAt(t)])}`);
  }
  function jumpTo(k) {
    const b = beats[clamp(k, 0, beats.length - 1)];
    seek(Math.min(b.t0 + LEAD, (b.t0 + b.t1) / 2));
  }
  function step(dir) {
    const t = position();
    if (dir > 0) {
      const k = beats.findIndex((b) => b.t0 > t + 0.1);
      jumpTo(k < 0 ? 0 : k);          /* past the last caption: wrap, as the clip loops */
    } else {
      const k = beatAt(t);
      if (t - beats[k].t0 > LEAD + 0.8) jumpTo(k);   /* well into a caption: back to its start */
      else if (k > 0) jumpTo(k - 1);
      else seek(0);
    }
  }

  /* Tooltip: the caption under the pointer (or the current one, for the keyboard). */
  function showTip(t, k) {
    clearTimeout(tipTimer);
    tip.textContent = "";
    tip.append(el("span", { class: "mpc-tip-time", text: mmss(k >= 0 ? beats[k].t0 : t) }), k >= 0 ? say(beats[k]) : "");
    tip.dataset.tone = k >= 0 ? (TONE[beats[k].kind] || "plain") : "plain";
    tip.hidden = false;
    const w = strip.clientWidth, half = tip.offsetWidth / 2;
    const x = (clamp(t / story.dur, 0, 1)) * w;
    tip.style.left = `${clamp(x, Math.min(half, w / 2), Math.max(w - half, w / 2))}px`;
  }
  function hideTip(delay) {
    clearTimeout(tipTimer);
    if (delay) tipTimer = setTimeout(() => { tip.hidden = true; }, delay);
    else tip.hidden = true;
  }
  const timeAtX = (x) => {
    const r = track.getBoundingClientRect();
    return clamp((x - r.left) / (r.width || 1), 0, 1) * story.dur;
  };

  let drag = null;
  let dragFrame = 0;
  strip.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || !story) return;
    drag = { id: e.pointerId, x0: e.clientX, x: e.clientX, moved: false };
    try { strip.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    const t = timeAtX(e.clientX);
    showTip(t, beatUnder(t));
  });
  strip.addEventListener("pointermove", (e) => {
    if (!story) return;
    const t = timeAtX(e.clientX);
    if (drag && e.pointerId === drag.id) {
      drag.x = e.clientX;
      if (!drag.moved && Math.abs(e.clientX - drag.x0) < 5) return;
      drag.moved = true;
      showTip(t, beatUnder(t));
      if (!dragFrame) dragFrame = requestAnimationFrame(() => { dragFrame = 0; if (drag) seek(timeAtX(drag.x)); });
    } else if (e.pointerType === "mouse") {
      showTip(t, beatUnder(t));
    }
  });
  function endDrag(e, cancelled) {
    if (!drag || e.pointerId !== drag.id) return;
    const t = timeAtX(e.clientX);
    if (!cancelled) {
      const k = beatUnder(t);
      if (drag.moved || k < 0) seek(t); else jumpTo(k);
    }
    drag = null;
    hideTip(e.pointerType === "mouse" ? 0 : 900);
    if (e.pointerType === "mouse" && strip.matches(":hover")) showTip(t, beatUnder(t));
  }
  strip.addEventListener("pointerup", (e) => endDrag(e, false));
  strip.addEventListener("pointercancel", (e) => endDrag(e, true));
  strip.addEventListener("pointerleave", () => { if (!drag) hideTip(0); });
  strip.addEventListener("keydown", (e) => {
    if (!story) return;
    const t = position();
    switch (e.key) {
      case "ArrowRight": case "ArrowUp": if (e.shiftKey) seek(t + 1); else step(1); break;
      case "ArrowLeft": case "ArrowDown": if (e.shiftKey) seek(t - 1); else step(-1); break;
      case "PageUp": seek(t + 5); break;
      case "PageDown": seek(t - 5); break;
      case "Home": seek(0); break;
      case "End": jumpTo(beats.length - 1); break;
      case " ": case "Enter": toggle(); break;
      default: return;
    }
    e.preventDefault();
    const tt = position();
    showTip(tt, beatUnder(tt) >= 0 ? beatUnder(tt) : beatAt(tt));
    hideTip(1600);
  });
  strip.addEventListener("blur", () => hideTip(0));

  /* ---------- Transport ---------- */
  function setPlaying(on) {
    playBtn.textContent = on ? "Pause" : "Play";
    playBtn.dataset.state = on ? "playing" : "paused";
    playBtn.setAttribute("aria-label", on ? "Pause" : "Play");
    stage.classList.toggle("is-paused", !on);
    if (on) stage.classList.remove("is-browsing");
  }
  playBtn.addEventListener("click", toggle);
  stage.addEventListener("click", toggle);
  prevBtn.addEventListener("click", () => step(-1));
  nextBtn.addEventListener("click", () => step(1));
  rate.addEventListener("change", () => {
    speed = Number(rate.value) || 1;
    video.defaultPlaybackRate = video.playbackRate = speed;
  });
  /* Full screen: the video element itself (native controls there); a large screen gets the 1080 file. */
  fsBtn.addEventListener("click", () => {
    if (isFullscreen()) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) exit.call(document);
      return;
    }
    near = true;
    applyMedia();
    const big = Math.max(screen.width || 0, screen.height || 0) * (window.devicePixelRatio || 1) >= 1400;
    if (big && srcKind === "sd") {
      const t = position(), playing = !video.paused;
      setSource("hd");
      pendingSeek = t > 0.05 ? t : null;   /* applied on loadedmetadata */
      if (playing) video.play().catch(() => {});
    }
    try {
      if (video.requestFullscreen) video.requestFullscreen().catch(() => {});
      else if (video.webkitRequestFullscreen) video.webkitRequestFullscreen();
      else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
    } catch (_) { /* not available */ }
  });
  ["fullscreenchange", "webkitfullscreenchange"].forEach((type) => document.addEventListener(type, () => sync()));

  video.addEventListener("play", () => { started = true; setPlaying(true); schedule(); });
  video.addEventListener("playing", () => { setPlaying(true); schedule(); });
  video.addEventListener("pause", () => { setPlaying(false); unschedule(); render(position()); });
  video.addEventListener("emptied", () => { setPlaying(false); unschedule(); });
  video.addEventListener("seeked", () => render(position()));
  video.addEventListener("timeupdate", () => { if (!frameId) render(position()); });
  video.addEventListener("loadedmetadata", () => {
    if (!seekable()) { makeSeekable(); return; }
    if (pendingSeek != null) { const t = pendingSeek; pendingSeek = null; try { video.currentTime = t; } catch (_) { /* ignore */ } }
  });
  video.addEventListener("error", () => {
    const src = video.getAttribute("src");
    if (!src) return;
    /* Safari will not play from a server without range requests at all: try the blob copy first. */
    if (!src.startsWith("blob:") && !blobs.has(fileUrl) && /^https?:$/.test(location.protocol)) { makeSeekable(); return; }
    now.textContent = "The video could not be loaded.";
    now.dataset.tone = "bad";
  });

  /* ---------- Stories ---------- */
  function select(s, { updateHash = true, user = false } = {}) {
    if (!s) return;
    if (s === story) {                 /* the current story again: just let it play */
      if (user) userPaused = false;
      sync();
      return;
    }
    pause(false);
    story = s;
    unschedule();
    video.removeAttribute("src");
    video.removeAttribute("poster");
    try { video.load(); } catch (_) { /* ignore */ }
    srcKind = "";
    fileUrl = "";
    pendingSeek = null;
    stage.classList.remove("is-browsing");
    buildStrip();
    title.textContent = s.title;
    meta.textContent = `${mmss(s.dur)} · real robot`;
    compare.textContent = "";
    (s.context || []).forEach((c) => compare.append(el("div", { class: "mpc-compare-item", "data-tone": c.tone || "plain" }, el("dt", { text: c.label }), el("dd", { text: c.text }))));
    note.textContent = s.note || "";
    note.hidden = !s.note;
    video.setAttribute("aria-label", `${s.title}: real-robot clip with burned-in captions, no sound`);
    panel.setAttribute("aria-labelledby", `mpc-tab-${s.id}`);
    tabButtons.forEach((b) => {
      const on = b.dataset.story === s.id;
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
    });
    beatIdx = -2;
    started = false;
    shownSec = -1;
    render(0);
    applyMedia();
    if (user) { userPaused = false; }
    if (updateHash) history.replaceState(history.state, "", `#mpc-${s.id}`);
    sync();
  }
  const byHash = (hash) => STORIES.find((s) => hash === `#mpc-${s.id}` || (s.alias && hash === `#mpc-${s.alias}`));
  tabButtons.forEach((b) => b.addEventListener("click", () => select(STORIES.find((s) => s.id === b.dataset.story), { user: true })));
  tabs.addEventListener("keydown", (event) => {
    const index = tabButtons.indexOf(document.activeElement);
    if (index < 0) return;
    let next;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % tabButtons.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + tabButtons.length) % tabButtons.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabButtons.length - 1;
    else return;
    event.preventDefault();
    tabButtons[next].focus();
    select(STORIES[next], { user: true });
  });
  window.addEventListener("hashchange", () => {
    const s = byHash(location.hash);
    if (s && s !== story) select(s, { updateHash: false });
  });

  /* ---------- Visibility, other page videos, reduced motion ---------- */
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      for (const e of entries) ratio = e.isIntersecting ? e.intersectionRatio : 0;
      sync();
    }, { threshold: [0, 0.15, 0.5, 0.75, 1] }).observe(stage);
    new IntersectionObserver((entries, observer) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      near = true;
      observer.disconnect();
      applyMedia();
      sync();
    }, { rootMargin: "900px 0px" }).observe(card);
  }
  document.addEventListener("visibilitychange", sync);
  /* One clip at a time: another page video starting pauses this one (it may resume later). */
  document.addEventListener("play", (e) => {
    const v = e.target;
    if (v === video || !(v instanceof HTMLMediaElement) || v.closest(".hero") || v.closest(".mpc-gallery")) return;
    if (!video.paused) pause(false);
  }, true);
  ["pause", "ended"].forEach((type) => document.addEventListener(type, (e) => {
    if (e.target !== video && e.target instanceof HTMLMediaElement) setTimeout(sync, 0);
  }, true));
  const onReduce = () => { if (reduceMQ.matches && !video.paused && !userStarted) pause(false); else sync(); };
  if (reduceMQ.addEventListener) reduceMQ.addEventListener("change", onReduce);
  else if (reduceMQ.addListener) reduceMQ.addListener(onReduce);

  const initial = byHash(location.hash) || STORIES.find((s) => s.id === DATA.default) || STORIES[0];
  select(initial, { updateHash: false });

  window.PRISM_DRAFT.mpcPlayer = {
    open: (id) => openStory(STORIES.find((s) => s.id === id || s.alias === id)),
    close: closeDialog,
    previews: () => previews.map((p) => ({ id: p.item.dataset.story, phase: p.item.dataset.phase, inView: p.inView, playing: p.videos.map((v) => !v.paused), judging: !!(p.judge && !p.judge.paused) })),
    select: (id) => select(STORIES.find((s) => s.id === id || s.alias === id), { user: true }),
    play: () => play(true),
    pause: () => pause(true),
    seek,
    jump: jumpTo,
    state: () => ({
      id: story && story.id, t: video.currentTime, paused: video.paused, file: fileUrl, src: video.currentSrc || video.getAttribute("src") || "",
      kind: srcKind, poster: video.getAttribute("poster") || "", beat: beatIdx, now: now.textContent, ratio, near, userPaused,
    }),
  };
})();

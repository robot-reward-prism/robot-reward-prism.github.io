/* PRISM draft · section 02 "Post-training with PRISM" (draft.html #policy).
 *   - The film: assets/draft/video/posttrain_{1080,720}.mp4, the cover film's post-training segment (33 s): how
 *     PRISM's progress becomes the training signal, then the results. Muted; it plays while in view.
 *   - One card per task. Each shows the post-trained policy's real rollout (front view, sped up; one selected
 *     successful evaluation episode) and its success rate against the alternative, from the paper (Sec. 4.5,
 *     Figs. 5-6; the alternative is the strongest other reward source, named as in Fig. 5). The bars fill when the cards come into view.
 *   - "All four cameras" opens the four-camera player (assets/js/policy.js, built in #policy-player) in a dialog,
 *     on that task. No control of the old section is lost.
 */
(() => {
  "use strict";
  const host = document.getElementById("pt-section");
  if (!host) return;
  const BASE = new URL("../../../", document.currentScript.src).href;
  const abs = (p) => new URL(p, BASE).href;
  const reduceMQ = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  const TASKS = [
    { id: "star", title: "Star insertion", method: "Offline RL", speed: "×2", tag: "✓ success", dur: "0:15",
      bars: [["PRISM", 65.0, "13/20"], ["RoboMeter (finetuned)", 50.0, "10/20"]], note: "20 trials · zero-shot", dec: 1 },
    { id: "tube", title: "Tube transfer", method: "Offline RL", speed: "×5", tag: "✓ success", dur: "0:33",
      bars: [["PRISM", 66.7, "8/12"], ["RoboMeter (finetuned)", 41.7, "5/12"]], note: "12 trials · zero-shot · SARM2 also 41.7 %", dec: 1 },
    { id: "airplane", title: "Airplane model", method: "Weighted cloning", speed: "×20", tag: "✓ assembled", dur: "2:47",
      bars: [["PRISM-weighted", 75.0, "9/12"], ["Unweighted", 50.0, "6/12"]], note: "12 trials · Iter2", dec: 1 },
    { id: "car", title: "Car model", method: "Weighted cloning", speed: "×30", tag: "✓ assembled", dur: "4:22",
      bars: [["PRISM-weighted", 66.7, "8/12"], ["Unweighted", 41.7, "5/12"]], note: "12 trials · Iter2", dec: 1 },
  ];

  function el(tag, attrs = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k === "style") n.setAttribute("style", v);
      else n.setAttribute(k, v === true ? "" : v);
    }
    for (const c of kids) if (c != null) n.append(c);
    return n;
  }
  const filmState = { choice: null, blocked: false };
  const cardsState = { choice: null, blocked: false };
  const playback = [];
  const enabled = (state) => state.choice !== "pause" && !state.blocked && (!reduceMQ.matches || state.choice === "play");

  /* ---------- the film ---------- */
  const small = window.matchMedia && window.matchMedia("(max-width: 900px), (max-height: 500px)").matches;
  const film = el("video", { class: "pt-film-video", muted: true, loop: true, playsinline: true, preload: "none",
    poster: abs("assets/draft/video/posttrain_poster.jpg"), "data-pt-src": abs(`assets/draft/video/posttrain_${small ? 720 : 1080}.mp4?v=p1`),
    "aria-label": "Film: how PRISM's progress trains the policy, then the results (33 seconds, no sound)" });
  film.muted = true;
  film.id = "pt-film-video";
  const filmToggle = el("button", { class: "pt-playback pt-film-toggle", type: "button", "aria-controls": film.id });
  const full = el("button", { class: "pt-playback pt-film-full", type: "button", "aria-label": "Full screen & control timeline to find specific frames" },
    el("span", { text: "Full screen & control timeline" }));
  full.addEventListener("click", () => {
    filmState.choice = "play";
    filmState.blocked = false;
    sync();
    const f = film.requestFullscreen || film.webkitRequestFullscreen || film.webkitEnterFullscreen;
    if (f) { try { const r = f.call(film); if (r && r.catch) r.catch(() => {}); } catch (_) { /* ignore */ } }
  });
  const filmFig = el("figure", { class: "pt-film" },
    el("div", { class: "pt-film-media" }, film),
    el("div", { class: "pt-film-controls" }, filmToggle, full),
    el("figcaption", { class: "pt-film-cap" },
      el("strong", { text: "Progress-based policy training." }),
      el("span", { text: " In this rollout, predicted progress decreases when the wing slips. Progress differences are converted into rewards or imitation weights." }),
      el("span", { class: "pt-film-dur", text: "0:33 · no sound" })));
  playback.push({ video: film, state: filmState, inView: false, pending: false });

  /* ---------- the cards ---------- */
  const gallery = el("div", { id: "pt-gallery", class: "pt-gallery", role: "list", "aria-label": "Post-training results by task" });
  const cardsToggle = el("button", { class: "pt-playback pt-cards-toggle", type: "button", "aria-controls": gallery.id });
  const galleryControls = el("div", { class: "pt-gallery-controls" }, cardsToggle);
  TASKS.forEach((t, i) => {
    const v = el("video", { muted: true, loop: true, playsinline: true, preload: "none", "aria-hidden": "true", disablepictureinpicture: true,
      poster: abs(`assets/draft/video/cards/pt_${t.id}.jpg`), "data-pt-src": abs(`assets/draft/video/cards/pt_${t.id}.mp4`) });
    v.muted = true;
    playback.push({ video: v, state: cardsState, inView: false, pending: false });
    const fmt = (x) => `${x.toFixed(t.dec)} %`;
    const rows = t.bars.map(([name, val, frac], r) => el("div", { class: `pt-row${r === 0 ? " is-prism" : ""}` },
      el("span", { class: "pt-name", text: name }),
      el("span", { class: "pt-track" }, el("i", { style: `--v:${(val / 100).toFixed(3)}` })),
      el("span", { class: "pt-val" }, el("b", { text: fmt(val) }), el("small", { text: frac }))));
    const open = el("button", { class: "pt-open", type: "button", "aria-haspopup": "dialog" },
      el("span", { class: "pt-open-ico", "aria-hidden": "true", text: "▶" }), el("span", { text: "All four cameras" }),
      el("span", { class: "pt-open-dur", text: t.dur }));
    const [a, b] = t.bars;
    const card = el("article", { class: "pt-card", role: "listitem", "data-task": t.id, style: `--i:${i}`, "aria-labelledby": `pt-t-${t.id}` },
      el("div", { class: "pt-head" }, el("h3", { class: "pt-card-title", id: `pt-t-${t.id}`, text: t.title }), el("span", { class: "pt-chip", text: t.method })),
      el("div", { class: "pt-media" }, v, el("span", { class: "pt-tag", text: t.tag }), el("span", { class: "pt-speed", text: t.speed })),
      el("div", { class: "pt-bars", role: "img", "aria-label": `Success rate: ${a[0]} ${fmt(a[1])} (${a[2]}), ${b[0]} ${fmt(b[1])} (${b[2]})` }, ...rows),
      el("p", { class: "pt-note", text: t.note }),
      open);
    card.addEventListener("click", (e) => { if (!e.target.closest(".pt-open")) return; openTask(t, open); });
    gallery.append(card);
  });
  host.append(filmFig, galleryControls, gallery);

  /* ---------- the four-camera player in a dialog ---------- */
  const dialog = el("dialog", { class: "pt-dialog", "aria-label": "Four synchronized camera views" });
  const close = el("button", { class: "pt-close", type: "button", "aria-label": "Close" }, el("span", { "aria-hidden": "true", text: "×" }));
  const body = el("div", { class: "pt-dialog-body" }, close);
  dialog.append(body);
  const player = document.getElementById("policy-player");
  if (player) body.append(player);                      // (policy.js has already built it; moving keeps its listeners)
  host.append(dialog);                                  // (inside the dark band: the player keeps its dark colours)
  let opener = null;
  function openTask(t, from, updateHash = true) {
    if (!t) return;
    if (from) opener = from;
    else if (!dialog.open) opener = document.activeElement;
    if (!dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", "");
    }
    document.documentElement.classList.add("mpc-dialog-open");
    const tab = document.getElementById(`policy-tab-${t.id}`);
    if (tab && tab.getAttribute("aria-selected") !== "true") tab.click();
    if (updateHash && location.hash !== `#policy-${t.id}`) history.replaceState(history.state, "", `#policy-${t.id}`);
    sync();
    close.focus({ preventScroll: true });
  }
  function shut() { if (dialog.open) dialog.close(); }
  close.addEventListener("click", shut);
  dialog.addEventListener("click", (e) => { if (e.target === dialog) shut(); });
  dialog.addEventListener("close", () => {
    document.documentElement.classList.remove("mpc-dialog-open");
    const policy = window.PRISM && window.PRISM.policy;
    if (policy) policy.pause();
    else if (player) player.querySelectorAll("video").forEach((v) => v.pause());
    if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    sync();
  });

  /* User choices survive scrolling, visibility changes and opening the player.
     Each video is observed separately: horizontal cards outside the scrollport
     must neither acquire a source nor keep playing. */
  function updateControls() {
    filmToggle.textContent = enabled(filmState) ? "Pause film" : "Play film";
    cardsToggle.textContent = enabled(cardsState) ? "Pause previews" : "Play previews";
  }
  function toggle(state) {
    state.choice = enabled(state) ? "pause" : "play";
    state.blocked = false;
    sync();
  }
  filmToggle.addEventListener("click", () => toggle(filmState));
  cardsToggle.addEventListener("click", () => toggle(cardsState));
  function wantsPlayback(item) {
    return item.inView && !document.hidden && !dialog.open && enabled(item.state);
  }
  function start(item) {
    const v = item.video;
    if (!v.paused || item.pending) return;
    if (!v.getAttribute("src")) v.src = v.dataset.ptSrc;
    item.pending = true;
    const failed = (error) => {
      // A pause during loading aborts play normally; a browser refusal needs
      // an explicit retry, exposed by the same Play control.
      if (error && error.name !== "AbortError") item.state.blocked = true;
    };
    const settled = () => {
      item.pending = false;
      if (!wantsPlayback(item)) v.pause();
      else if (v.paused) start(item);
      updateControls();
    };
    try {
      const attempt = v.play();
      if (attempt && attempt.then) attempt.then(settled, (error) => { failed(error); settled(); sync(); });
      else settled();
    } catch (error) { failed(error); settled(); }
  }
  function sync() {
    playback.forEach((item) => {
      if (wantsPlayback(item)) start(item);
      else item.video.pause();
    });
    updateControls();
  }
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const item = playback.find((p) => p.video === entry.target);
        item.inView = entry.isIntersecting && entry.intersectionRatio >= 0.35;
        if (item.inView && item.state === cardsState) gallery.classList.add("is-in");
      });
      sync();
    }, { threshold: [0, 0.35] });
    playback.forEach((item) => observer.observe(item.video));
  } else {
    // Keep explicit playback usable in older browsers while also accounting
    // for the gallery's horizontal clipping.
    const measure = () => {
      const g = gallery.getBoundingClientRect();
      playback.forEach((item) => {
        const r = item.video.getBoundingClientRect();
        const left = item.state === cardsState ? Math.max(0, g.left) : 0;
        const right = item.state === cardsState ? Math.min(innerWidth, g.right) : innerWidth;
        const width = Math.max(0, Math.min(right, r.right) - Math.max(left, r.left));
        const height = Math.max(0, Math.min(innerHeight, r.bottom) - Math.max(0, r.top));
        item.inView = r.width * r.height > 0 && width * height / (r.width * r.height) >= 0.35;
      });
      sync();
    };
    gallery.classList.add("is-in");
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    gallery.addEventListener("scroll", measure, { passive: true });
    measure();
  }
  document.addEventListener("visibilitychange", sync);
  const onReduceChange = () => {
    if (reduceMQ.matches) [filmState, cardsState].forEach((state) => {
      // A newly enabled OS preference pauses motion; Play remains available.
      if (state.choice === "play") state.choice = null;
    });
    sync();
  };
  if (reduceMQ.addEventListener) reduceMQ.addEventListener("change", onReduceChange);
  else if (reduceMQ.addListener) reduceMQ.addListener(onReduceChange);
  updateControls();

  /* Initial deep links, browser navigation and repeated same-hash clicks all
     open the requested task. Modified clicks retain normal link behavior. */
  const taskFromHash = (hash) => TASKS.find((t) => hash === `#policy-${t.id}`);
  const openFromHash = () => {
    const task = taskFromHash(location.hash);
    if (task) openTask(task, null, false);
    else if (dialog.open) shut();
  };
  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest("a[href]");
    if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname || url.search !== location.search) return;
    const task = taskFromHash(url.hash);
    if (!task) return;
    event.preventDefault();
    if (location.hash !== url.hash) history.pushState(history.state, "", url.hash);
    openTask(task, link, false);
  });
  window.addEventListener("hashchange", openFromHash);

  window.PRISM_DRAFT = window.PRISM_DRAFT || {};
  window.PRISM_DRAFT.posttrain = { open: (id) => openTask(TASKS.find((t) => t.id === id) || TASKS[0]), close: shut, film, dialog };
  openFromHash();
})();

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
  const start = (v) => { if (!v.getAttribute("src") && v.dataset.src) v.src = v.dataset.src; const p = v.play(); if (p && p.catch) p.catch(() => {}); };

  /* ---------- the film ---------- */
  const small = window.matchMedia && window.matchMedia("(max-width: 900px), (max-height: 500px)").matches;
  const film = el("video", { class: "pt-film-video", muted: true, loop: true, playsinline: true, preload: "none",
    poster: abs("assets/draft/video/posttrain_poster.jpg"), "data-src": abs(`assets/draft/video/posttrain_${small ? 720 : 1080}.mp4?v=p1`),
    "aria-label": "Film: how PRISM's progress trains the policy, then the results (33 seconds, no sound)" });
  film.muted = true;
  const full = el("button", { class: "pt-film-full", type: "button", "aria-label": "Watch the film full screen" },
    el("span", { "aria-hidden": "true", text: "⛶" }), el("span", { text: "Full screen" }));
  full.addEventListener("click", () => {
    start(film);
    const f = film.requestFullscreen || film.webkitRequestFullscreen || film.webkitEnterFullscreen;
    if (f) { try { const r = f.call(film); if (r && r.catch) r.catch(() => {}); } catch (_) { /* ignore */ } }
  });
  const filmFig = el("figure", { class: "pt-film" },
    el("div", { class: "pt-film-media" }, film, full),
    el("figcaption", { class: "pt-film-cap" },
      el("strong", { text: "How it works, then the results." }),
      el("span", { text: " A real rollout: PRISM's progress drops when the wing slips; the change in progress becomes the reward or the weight." }),
      el("span", { class: "pt-film-dur", text: "0:33 · no sound" })));
  if (reduceMQ.matches) film.removeAttribute("loop");

  /* ---------- the cards ---------- */
  const gallery = el("div", { class: "pt-gallery", role: "list", "aria-label": "Post-training results by task" });
  const cardVideos = [];
  TASKS.forEach((t, i) => {
    const v = el("video", { muted: true, loop: true, playsinline: true, preload: "none", "aria-hidden": "true", disablepictureinpicture: true,
      poster: abs(`assets/draft/video/cards/pt_${t.id}.jpg`), "data-src": abs(`assets/draft/video/cards/pt_${t.id}.mp4`) });
    v.muted = true; cardVideos.push(v);
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
  host.append(filmFig, gallery);

  /* ---------- the four-camera player in a dialog ---------- */
  const dialog = el("dialog", { class: "pt-dialog", "aria-label": "Four synchronized camera views" });
  const close = el("button", { class: "pt-close", type: "button", "aria-label": "Close" }, el("span", { "aria-hidden": "true", text: "×" }));
  const body = el("div", { class: "pt-dialog-body" }, close);
  dialog.append(body);
  const player = document.getElementById("policy-player");
  if (player) body.append(player);                      // (policy.js has already built it; moving keeps its listeners)
  host.append(dialog);                                  // (inside the dark band: the player keeps its dark colours)
  let opener = null;
  function openTask(t, from) {
    opener = from || null;
    film.pause(); cardVideos.forEach((v) => v.pause());
    if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", "");
    document.documentElement.classList.add("mpc-dialog-open");
    const tab = document.getElementById(`policy-tab-${t.id}`);
    if (tab) tab.click();
    close.focus();
  }
  function shut() { if (dialog.open) dialog.close(); }
  close.addEventListener("click", shut);
  dialog.addEventListener("click", (e) => { if (e.target === dialog) shut(); });
  dialog.addEventListener("close", () => {
    document.documentElement.classList.remove("mpc-dialog-open");
    const pv = player && player.querySelectorAll("video");
    if (pv) pv.forEach((v) => { if (!v.paused) v.pause(); });
    if (opener && document.contains(opener)) opener.focus();
    sync();
  });

  /* ---------- play only what is in view; the bars fill once ---------- */
  let filmIn = false, cardsIn = false;
  function sync() {
    const ok = !reduceMQ.matches && !document.hidden && !dialog.open;
    if (ok && filmIn) start(film); else if (!film.paused) film.pause();
    cardVideos.forEach((v) => { if (ok && cardsIn) start(v); else if (!v.paused) v.pause(); });
  }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((es) => { filmIn = es[0].isIntersecting; sync(); }, { threshold: 0.35 }).observe(filmFig);
    new IntersectionObserver((es) => {
      cardsIn = es[0].isIntersecting;
      if (cardsIn) gallery.classList.add("is-in");
      sync();
    }, { threshold: 0.2 }).observe(gallery);
  } else { gallery.classList.add("is-in"); }
  document.addEventListener("visibilitychange", sync);

  /* links such as #policy-star (the appendix tables) open the four cameras on that task */
  window.addEventListener("hashchange", () => {
    const m = /^#policy-(star|tube|airplane|car)$/.exec(location.hash);
    if (m && !dialog.open) openTask(TASKS.find((t) => t.id === m[1]));
  });

  window.PRISM_DRAFT = window.PRISM_DRAFT || {};
  window.PRISM_DRAFT.posttrain = { open: (id) => openTask(TASKS.find((t) => t.id === id) || TASKS[0]), close: shut, film, dialog };
})();

/* PRISM draft · result charts (HTML + CSS; labels are text, so they stay readable on phones).
 * Every number is the paper's (arXiv v1: Fig. 4, Tables 3, 4 and 8, Figs. 5-6); the five-task chart uses the page's own
 * table (airplane and car = Table 3, D15; three more tasks go beyond the paper).
 * Readability rules (the user, 2026-10-24: "I can't tell at a glance what it is"): one message per chart, at most ~6 bars,
 * plain-language labels at 16 px, the value on every bar, PRISM in the accent colour with a callout, axes from 0.
 *   <figure class="pc" data-pc="zeroshot"></figure>  ->  rendered from CHARTS below.
 */
(() => {
  "use strict";
  const CHARTS = {
    zeroshot: {
      title: "20.7 % lower error than RoboMeter",
      sub: "Progress error (RMSE) on 50 held-out tasks the models never saw. Shorter bar = better.",
      max: 0.3, fmt: 3,
      rows: [{ label: "RoboMeter", meta: "official release", v: 0.279, kind: "ref" }, { label: "SARM", v: 0.268 }, { label: "SARM2", v: 0.237 },
             { label: "RoboMeter", meta: "fine-tuned on our 200 tasks", v: 0.227, kind: "best" }, { label: "PRISM", v: 0.180, kind: "ours", callout: "−20.7 %" }],
      note: "All models except the official release are trained on the same 200 tasks. Paper Fig. 4(a).",
    },
    pretrain: {
      title: "More pretraining tasks, lower error",
      sub: "PRISM pretrained on 15, 30 or 200 tasks, tested on the same 50 unseen tasks.",
      max: 0.3, fmt: 3,
      rows: [{ label: "15 tasks", v: 0.278 }, { label: "30 tasks", v: 0.222 }, { label: "200 tasks", v: 0.180, kind: "ours", callout: "−35.3 %" }],
      note: "Paper Fig. 4(b).",
    },
    longtask: {
      title: "15 trajectories beat baselines trained on 100",
      sub: "Progress error after adapting to a long assembly task. Shorter bar = better.",
      max: 0.5, fmt: 3,
      groups: [
        { title: "Airplane model", meta: "9 subtasks", rows: [
          { label: "SARM2", meta: "best baseline · 100 trajectories", v: 0.461, kind: "best" },
          { label: "PRISM", meta: "15 trajectories", v: 0.308, kind: "ours", callout: "−33 %" },
          { label: "PRISM", meta: "100 trajectories", v: 0.262, kind: "ours-lite" }] },
        { title: "Car model", meta: "10 subtasks", rows: [
          { label: "SARM2", meta: "best baseline · 100 trajectories", v: 0.472, kind: "best" },
          { label: "PRISM", meta: "15 trajectories", v: 0.394, kind: "ours", callout: "−17 %" },
          { label: "PRISM", meta: "100 trajectories", v: 0.319, kind: "ours-lite" }] },
      ],
      note: "Paper Table 3. The table below lists every method and budget.",
    },
    fivetask: {
      title: "Lowest error on all five long-horizon tasks",
      sub: "How much lower PRISM's error is than the best other model on each task, after adapting with 15 trajectories.",
      max: 40, pctlower: true,
      rows: [
        { label: "Pupgo car", meta: "18 subtasks · vs RoboMeter", v: 19.7, kind: "ours" },
        { label: "Firetruck", meta: "9 subtasks · vs GPT6 composition", v: 22.3, kind: "ours" },
        { label: "Circuit + switch", meta: "3 subtasks · vs RoboMeter", v: 16.1, kind: "ours" },
        { label: "Airplane model", meta: "9 subtasks · vs GPT6 composition", v: 31.6, kind: "ours" },
        { label: "Car model", meta: "10 subtasks · vs GPT6 composition", v: 24.8, kind: "ours" },
      ],
      note: "Airplane and car are from the paper's Table 3; the other three tasks go beyond the paper.",
    },
    composition: {
      title: "Composing subtasks cuts the error; pretraining cuts it further",
      sub: "Progress error on car model assembly, zero-shot, with the same Qwen3.5-4B backbone. Shorter bar = better.",
      max: 5, fmt: 3,
      rows: [
        { label: "Direct prediction", meta: "the base model guesses whole-task progress", v: 4.541 },
        { label: "+ Composition", meta: "select the subtask, predict its progress", v: 3.068, kind: "best", callout: "−32 %" },
        { label: "+ PRISM pretraining", meta: "the same workflow, our pretrained model", v: 1.380, kind: "ours", callout: "−55 %" },
      ],
      note: "With GPT6, composition alone cuts the error from 1.578 to 0.524. Paper Table 8.",
    },
    embodiment: {
      title: "18.7 % lower error on a new robot",
      sub: "Airplane assembly moved from the YAM robot to Tianji, adapted with 10 Tianji trajectories. Shorter bar = better.",
      max: 1.25, fmt: 3,
      rows: [{ label: "SARM2", v: 1.167 }, { label: "SARM", v: 0.919 }, { label: "RoboMeter", v: 0.556, kind: "best" },
             { label: "PRISM", v: 0.452, kind: "ours", callout: "−18.7 %" }],
      note: "30 Tianji test trajectories. Paper Table 4.",
    },
    cost: {
      type: "stats", title: "88× faster per query, and no API bill",
      sub: "PRISM on one NVIDIA H100 vs GPT6 composition through its API.",
      stats: [["0.47 s", "41.55 s", "per query (latency over 8,000 calls)"], ["$0", "≈ $38", "per trajectory (API at 1 fps, 340 s trajectories)"]],
    },
    offlinerl: {
      type: "multiples", dark: true, pct: true, title: "Offline RL, every reward source",
      sub: "Success rate, higher is better · the same scored BC rollouts per task · Fig. 5",
      panels: [
        { title: "Star insertion", meta: "20 trials", max: 100, rows: [["BC", 20.0], ["Sparse", 30.0], ["SARM2", 45.0], ["RoboMeter (official)", 45.0], ["RoboMeter (finetuned)", 50.0], ["PRISM", 65.0, "ours"]] },
        { title: "Tube transfer", meta: "12 trials", max: 100, rows: [["BC", 33.3], ["Sparse", 33.3], ["SARM2", 41.7], ["RoboMeter (official)", 33.3], ["RoboMeter (finetuned)", 41.7], ["PRISM", 66.7, "ours"]] },
      ],
    },
    weightedbc: {
      type: "multiples", dark: true, pct: true, title: "Weighted cloning, both iterations",
      sub: "Success rate, higher is better · 12 trials each · the BC parent starts at 25 % · Fig. 6",
      panels: [
        { title: "Airplane · Iter1", meta: "same parent", max: 100, rows: [["Unweighted", 41.7], ["SARM2", 33.3], ["PRISM", 58.3, "ours"]] },
        { title: "Airplane · Iter2", meta: "best Iter1 parent", max: 100, rows: [["Unweighted", 50.0], ["PRISM", 75.0, "ours"]] },
        { title: "Car · Iter1", meta: "same parent", max: 100, rows: [["Unweighted", 41.7], ["SARM2", 41.7], ["PRISM", 58.3, "ours"]] },
        { title: "Car · Iter2", meta: "best Iter1 parent", max: 100, rows: [["Unweighted", 41.7], ["PRISM", 66.7, "ours"]] },
      ],
    },
  };

  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

  /* one horizontal bar: label (+ meta) | bar with its value | callout */
  function bar(spec, r, max, i) {
    const row = el("div", "pc-row" + (r.kind ? ` is-${r.kind}` : ""));
    row.style.setProperty("--i", i);
    const lab = el("span", "pc-label");
    lab.append(el("span", "pc-name", r.label));
    if (r.meta) lab.append(el("span", "pc-meta", r.meta));
    const track = el("span", "pc-track");
    const f = Math.min(1, r.v / max);
    const b = el("i"); b.style.setProperty("--v", f.toFixed(4)); track.append(b);
    const txt = spec.pctlower ? `−${r.v.toFixed(1)} %` : spec.pct ? `${r.v.toFixed(1)} %` : r.v.toFixed(spec.fmt || 3);
    const end = el("span", "pc-end"); end.style.setProperty("--v", f.toFixed(4));   // the value (and PRISM's callout) past the end;
    end.append(el("b", "pc-val", txt));                                              // bars use at most --span of the track, so it fits
    if (r.callout) end.append(el("em", "pc-callout", r.callout));
    track.append(end);
    row.append(lab, track);
    return row;
  }
  function renderBars(fig, spec) {
    const body = el("div", "pc-body");
    if (spec.groups) {
      spec.groups.forEach((g, gi) => {
        const box = el("div", "pc-group");
        const gt = el("p", "pc-group-title", g.title); if (g.meta) gt.append(el("span", null, g.meta));
        box.append(gt);
        const rows = el("div", "pc-rows");
        g.rows.forEach((r, i) => rows.append(bar(spec, r, spec.max, gi * 3 + i)));
        box.append(rows); body.append(box);
      });
    } else {
      const rows = el("div", "pc-rows");
      spec.rows.forEach((r, i) => rows.append(bar(spec, r, spec.max, i)));
      body.append(rows);
    }
    fig.append(body);
  }
  function renderMultiples(fig, spec) {                 // (the post-training fold: every reward source)
    const body = el("div", "pc-body pc-grid"); body.style.setProperty("--n", spec.panels.length);
    spec.panels.forEach((p) => {
      const panel = el("div", "pc-panel");
      const ph = el("p", "pc-group-title", p.title); if (p.meta) ph.append(el("span", null, p.meta));
      const rows = el("div", "pc-rows");
      p.rows.forEach(([label, v, kind], i) => rows.append(bar(spec, { label, v, kind }, p.max, i)));
      panel.append(ph, rows); body.append(panel);
    });
    fig.append(body);
  }
  function renderStats(fig, spec) {
    const body = el("div", "pc-body pc-stats");
    spec.stats.forEach(([ours, other, what]) => {
      const s = el("div", "pc-stat");
      const big = el("p", "pc-stat-big");
      const o = el("span", "pc-stat-ours"); o.append(el("small", null, "PRISM"), el("strong", null, ours));
      const g = el("span", "pc-stat-other"); g.append(el("small", null, "GPT6 composition"), el("strong", null, other));
      big.append(o, g);
      s.append(big, el("p", "pc-stat-what", what));
      body.append(s);
    });
    fig.append(body);
  }
  function render(fig, spec) {
    const type = spec.type || "bars";
    fig.classList.add("pc--" + type);
    if (spec.dark) fig.classList.add("pc--dark");
    const head = el("figcaption", "pc-head");
    head.append(el("h4", "pc-title", spec.title));
    if (spec.sub) head.append(el("p", "pc-sub", spec.sub));
    fig.append(head);
    if (type === "bars") renderBars(fig, spec);
    if (type === "multiples") renderMultiples(fig, spec);
    if (type === "stats") renderStats(fig, spec);
    if (spec.note) fig.append(el("p", "pc-note", spec.note));
  }

  const figs = [...document.querySelectorAll("[data-pc]")];
  figs.forEach((fig) => { const spec = CHARTS[fig.dataset.pc]; if (spec && !fig.dataset.pcDone) { render(fig, spec); fig.dataset.pcDone = "1"; } });
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function reveal(list) {
    if (reduce || !("IntersectionObserver" in window)) { list.forEach((f) => f.classList.add("is-in")); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } }), { threshold: 0.2 });
    list.forEach((f) => io.observe(f));
  }
  reveal(figs);
  window.PRISM_DRAFT = window.PRISM_DRAFT || {};
  window.PRISM_DRAFT.charts = { CHARTS };
})();

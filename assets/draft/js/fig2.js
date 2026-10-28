/* Grana draft · Fig. 2 "From local to global task progress", animated.
 *   markup: draft.html #fig2 · styles: assets/draft/css/fig2.css · data: assets/draft/js/fig2-data.js
 *   media: assets/draft/video/fig2-airplane-views.mp4, -start.jpg, -poster.jpg
 *
 * Every module is in the markup and on screen from the first frame. This script only moves what is inside them:
 *   - the camera tiles play the episode: one 2 x 2 loop. The Top tile is the <video> itself (cropped by CSS), the
 *     other three are canvases copied from it, so the video is always on screen (iOS keeps visible muted video playing);
 *   - the selector's halo and the description chip move to the subtask Grana selects;
 *   - light flows along the wires; at each new subtask a pulse runs selector -> description -> VLM and k;
 *   - the local curve draws over the subtask's window and restarts at every new subtask; the composition bar fills;
 *   - the global curve climbs; completed subtasks keep their band of credit;
 *   - live readouts: (k + p) / K, the subtask counter and the episode clock.
 * Numbers: Grana's per-second scores (fig2-data.js). Readouts and curve heads hold the latest score; nothing is
 * interpolated between scores.
 * Clock: the video (a 6x time-lapse) while it plays, else the script's own. Jumps need a seekable video; on a server
 * without HTTP range requests (python3 -m http.server) the loop is fetched once as a blob after a seek fails, as
 * mpc-player.js does. GitHub Pages and file:// never need that.
 * Autoplay only in view with the tab visible; two loops, then it rests on the paper's example frame.
 * Reduced motion: that frame ((6 + 0.50) / 9), no flow, nothing loads until the visitor presses Play.
 * No colour lives in this file: every hue comes from the --f2d-* tokens in fig2.css.
 */
(() => {
  "use strict";
  const fig = document.querySelector("[data-f2d]");
  if (!fig) return;
  const DATA = window.GRANA_FIG2_DATA;
  const ok = DATA && Array.isArray(DATA.t) && Array.isArray(DATA.g) && DATA.t.length > 1 && DATA.t.length === DATA.g.length;
  if (!ok || !window.CanvasRenderingContext2D) {
    document.documentElement.classList.remove("f2d-js");          // the static figure shows instead
    return;
  }
  fig.classList.add("is-live");                                    // the head script's load check looks for this

  /* ------------------------------------------------------------------ constants */
  const K = DATA.K || 9, SPEED = DATA.speed || 6, DUR = DATA.duration;
  const T0 = DATA.videoStart != null ? DATA.videoStart : DATA.t[0];  // episode time of the loop's first frame
  const VDUR = (DUR - T0) / SPEED;                                  // the loop, in video seconds
  const HOLD = 2.6, LOOPS = 2, EPS = 1e-6;
  const T_STILL = ((DATA.still != null ? DATA.still : DATA.t[0]) - T0) / SPEED;
  /* The nine subtasks go by the cover film's stage names (the user, 2026-10-24). The chip's and the pills' tooltips
     carry each one's full description as the model gets it, "[From <start state>] <instruction>" (the user's task
     config; its "Fastern" is spelled "Fasten" here). */
  const NAMES = ["Place bottom wing", "Insert bottom screw", "Drill bottom screw", "Hand off the drill",
                 "Flip the plane", "Place top wing", "Insert top screw", "Fasten top screw", "Drill to the desk"];
  const FROM = [
    "0/2 red wings installed on plane body",
    "1/2 wings (with wheels) is on flipped plane body but no screw inserted",
    "1/2 wings (with wheels) and screw are assembled on flipped plane body",
    "1/2 wings (with wheels and screw) is installed on flipped plane body + drill is in the air",
    "1/2 wings (with wheels and screw) is installed on flipped plane body + drill is on the desk",
    "1/2 wings installed on the upright plane",
    "2/2 wings installed on the upright plane + no screw in the top wing hole",
    "2/2 wings installed on the upright plane + screw is placed in the top wing hole",
    "2/2 wings installed on the upright plane + screw is fastened in the top wing hole",
  ];
  const DESC = [
    "Pick the bottom wing with wheels and place it onto the plane body",
    "Pick the screw and place it into the hole of the wing with wheels on the plane body",
    "Fasten the screw into the wing with drill",
    "Hand the drill off and place it on the desk",
    "Flip over the plane and then pick up the remaining wing on the table",
    "Place the remaining 2/2 wing flush onto the plane",
    "Place screw on the top wing",
    "Fasten the screw with the drill",
    "Hand the drill off and place it on the desk",
  ];
  const chipLabel = (k) => "“" + NAMES[k] + "”";
  const prompt = (k) => "[From " + FROM[k] + "] " + DESC[k];
  const fullLabel = (k) => "Subtask " + (k + 1) + " · " + chipLabel(k);
  const mmss = (s) => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);

  /* ------------------------------------------------------------------ data */
  const TT = DATA.t, GG = DATA.g, N = TT.length;
  const KS = GG.map((v) => clamp(Math.floor(v + 1e-9), 0, K - 1));
  const PS = GG.map((v, i) => clamp(v - KS[i], 0, 1));
  const WIN = Array.from({ length: K }, () => ({ i0: -1, i1: -1, t0: 0, t1: 1 }));
  KS.forEach((k, i) => { const w = WIN[k]; if (w.i0 < 0) w.i0 = i; w.i1 = i; });
  WIN.forEach((w) => {
    if (w.i0 < 0) return;
    w.t0 = TT[w.i0];
    w.t1 = w.i1 < N - 1 ? TT[w.i1 + 1] : DUR;
  });
  const epT = (T) => T0 + T * SPEED;                               // video seconds -> episode seconds
  const vidT = (t) => (t - T0) / SPEED;
  function locate(t) {                                             // the latest score at episode time t
    if (t <= TT[0] + EPS) return 0;
    let lo = 0, hi = N - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (TT[m] <= t + EPS) lo = m; else hi = m - 1; }
    return lo;
  }
  function stateAt(T) {
    const t = epT(clamp(T, 0, VDUR)), i = locate(t), k = KS[i];
    return { T, t, i, k, p: PS[i], g: GG[i] / K };
  }

  /* ------------------------------------------------------------------ elements */
  const $ = (s, r = fig) => r.querySelector(s);
  const $$ = (s, r = fig) => Array.from(r.querySelectorAll(s));
  const card = $(".f2d-card"), inner = $(".f2d-in"), grid = $(".f2d-grid");
  const wireCv = $(".f2d-wires"), fxCv = $(".f2d-fx"), video = $(".f2d-video");
  const tiles = $$(".f2d-tile canvas");
  const pills = $$(".f2d-pill"), halo = $(".f2d-halo"), pillsWrap = $(".f2d-pills-wrap");
  const chip = $(".f2d-desc"), chipText = $(".f2d-desc span"), nameEl = $(".f2d-name");
  const countEl = $(".f2d-count b");
  const segs = $$(".f2d-segs i"), segFill = segs.map((s) => $("b", s));
  const eqK = $(".f2d-eq-k"), eqP = $(".f2d-eq-p"), eqG = $(".f2d-eq-g");
  const locCv = $('[data-chart="loc"]'), globCv = $('[data-chart="glob"]');
  const playBtn = $(".f2d-play"), rateSel = $(".f2d-rate");
  const NODES = {
    ctx: $(".f2d-ctx"), sel: $(".f2d-sel"), obs: $(".f2d-obs"), model: $(".f2d-model"), vlm: $(".f2d-vlm"),
    feats: $(".f2d-feats"), head: $(".f2d-head"), out: $(".f2d-out"), loc: $(".f2d-loc"), comp: $(".f2d-comp"), glob: $(".f2d-glob"),
  };
  pills.forEach((b, k) => {
    b.setAttribute("aria-label", fullLabel(k) + " (jump here)");
    b.title = fullLabel(k) + "\n" + prompt(k);
    b.addEventListener("click", () => jumpTo(k));
  });

  /* ------------------------------------------------------------------ colours and fonts from fig2.css */
  const probe = document.createElement("canvas").getContext("2d");
  function parseColor(v) {                                         // any CSS colour -> [r, g, b, a]
    probe.fillStyle = "transparent";
    try { probe.fillStyle = String(v || "").trim() || "transparent"; } catch (e) { /* stays transparent */ }
    const s = String(probe.fillStyle);
    if (s.charAt(0) === "#") { const n = parseInt(s.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255, 1]; }
    const m = s.match(/[\d.]+/g) || [0, 0, 0, 0];
    return [+m[0], +m[1], +m[2], m.length > 3 ? +m[3] : 1];
  }
  const rgba = (c, a = 1) => "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + +(c[3] * a).toFixed(3) + ")";
  let PAL = null, F = null, SPRITES = {};
  function readStyle() {
    const cs = getComputedStyle(card), v = (n) => parseColor(cs.getPropertyValue(n));
    PAL = {
      sub: Array.from({ length: K }, (_, i) => v("--f2d-s" + (i + 1))),
      ink: v("--f2d-ink"), ink2: v("--f2d-ink-2"), ink3: v("--f2d-ink-3"),
      wire: v("--f2d-wire"), arrow: v("--f2d-arrow"), spark: v("--f2d-spark"),
      plain: v("--f2d-p-plain"), cam: v("--f2d-p-cam"), feat: v("--f2d-p-feat"),
      grid: v("--f2d-grid"), curve: v("--f2d-curve"), tag: v("--f2d-tag"), bead: v("--f2d-bead"),
    };
    const fam = (n, d) => cs.getPropertyValue(n).trim() || d;
    F = {
      mono: "500 14px " + fam("--font-mono", "monospace"),
      serif: "italic 600 18px " + fam("--font-serif", "serif"),
    };
    SPRITES = {};
  }

  /* ------------------------------------------------------------------ state */
  const RM = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  let userPaused = RM.matches;                                     // the visitor's Play / Pause (reduced motion: paused)
  let T = RM.matches ? T_STILL : 0;                                // the clock, in video seconds
  let rate = 1, loops = 0, holdUntil = 0, holdLeft = 0, inView = false, raf = 0, lastNow = 0, fadeIn = 1;
  let scrubbing = false, curK = -1, prevLocal = null, chartKey = "", tileKey = -9;
  const shown = { k: "", p: "", g: "", n: "", f: new Array(K).fill(-1) };
  const dirty = { wires: true, dyn: true };

  /* ------------------------------------------------------------------ geometry */
  let L = "wide", W = 0, H = 0, DPR = 1, FXDPR = 1, box = null;
  const G = {};
  const anim = { hx: 0, hw: 40, cx: 0, tx: 0, tw: 40, tcx: 0, chipW: 120, chipH: 32 };
  function rect(el) {
    const r = el.getBoundingClientRect(), x = r.left - box.left, y = r.top - box.top;
    return { x, y, w: r.width, h: r.height, r: x + r.width, b: y + r.height, cx: x + r.width / 2, cy: y + r.height / 2 };
  }
  function sizeCanvas(cv, w, h, dpr) {
    const bw = Math.max(1, Math.round(w * dpr)), bh = Math.max(1, Math.round(h * dpr));
    if (cv.width !== bw) cv.width = bw;
    if (cv.height !== bh) cv.height = bh;
  }
  /* The chip wraps within the selector's width (in one column: the figure's), and the gap it rides in is sized for
     the tallest of the nine descriptions at that width (fig2.css reads --f2d-chip-h). Before the card is measured. */
  function fitChip() {
    const ics = getComputedStyle(inner);
    const w = L === "narrow" ? inner.clientWidth - (parseFloat(ics.paddingLeft) || 16) - (parseFloat(ics.paddingRight) || 16)
                             : NODES.sel.getBoundingClientRect().width;
    if (!(w > 0)) return;
    chip.style.maxWidth = Math.floor(w) + "px";
    const keep = chipText.textContent;
    let h = 32;
    NAMES.forEach((_, k) => { chipText.textContent = chipLabel(k); h = Math.max(h, chip.offsetHeight); });
    chipText.textContent = keep;
    grid.style.setProperty("--f2d-chip-h", h + "px");
  }
  function measure() {
    L = getComputedStyle(grid).getPropertyValue("--f2d-layout").trim() || "wide";
    fitChip();
    box = card.getBoundingClientRect();
    W = box.width; H = box.height;
    if (!W || !H) return false;
    DPR = Math.min(2, window.devicePixelRatio || 1);
    FXDPR = Math.min(1.5, DPR);
    readStyle();
    sizeCanvas(wireCv, W, H, FXDPR);
    sizeCanvas(fxCv, W, H, FXDPR);
    Object.keys(NODES).forEach((k) => { G[k] = rect(NODES[k]); });
    G.inner = rect(inner);
    const ics = getComputedStyle(inner);
    G.padL = parseFloat(ics.paddingLeft) || 16;
    G.padR = parseFloat(ics.paddingRight) || 16;
    G.wrap = rect(pillsWrap);
    G.pills = pills.map(rect);
    sizeCanvas(locCv, locCv.clientWidth, locCv.clientHeight, DPR);
    sizeCanvas(globCv, globCv.clientWidth, globCv.clientHeight, DPR);
    tiles.forEach((cv) => sizeCanvas(cv, cv.clientWidth, cv.clientWidth * 0.75, DPR));
    tileKey = -9; chartKey = "";
    aim(true);
    buildStatic();
    dirty.dyn = dirty.wires = true;
    seedAll();
    return true;
  }
  /* the halo's and the chip's targets for the selected subtask; snap = jump there */
  function aim(snap) {
    if (curK < 0 || !G.pills) return;
    const p = G.pills[curK];
    anim.tx = p.cx; anim.tw = p.w + 8;
    anim.chipW = chip.offsetWidth || anim.chipW; anim.chipH = chip.offsetHeight || 32;
    const lo = L === "narrow" ? G.inner.x + G.padL : G.sel.x, hi = L === "narrow" ? G.inner.r - G.padR : G.sel.r;
    anim.tcx = clamp(p.cx, lo + anim.chipW / 2, hi - anim.chipW / 2);
    if (snap) { anim.hx = anim.tx; anim.hw = anim.tw; anim.cx = anim.tcx; }
    dirty.dyn = true;
    placeHaloChip();
  }
  const chipY = () => (G.sel.b + G.obs.y) / 2;
  function placeHaloChip() {
    halo.style.transform = "translateX(" + (anim.hx - anim.hw / 2 - G.wrap.x).toFixed(2) + "px)";
    halo.style.width = anim.hw.toFixed(2) + "px";
    chip.style.transform = "translate(" + (anim.cx - anim.chipW / 2 - G.inner.x).toFixed(2) + "px, " +
      (chipY() - anim.chipH / 2 - G.inner.y).toFixed(2) + "px)";
  }
  function chipRect() {
    const cy = chipY(), x = anim.cx - anim.chipW / 2, y = cy - anim.chipH / 2;
    return { x, y, r: x + anim.chipW, b: y + anim.chipH, cx: anim.cx, cy };
  }

  /* ------------------------------------------------------------------ wires */
  /* Orthogonal waypoints -> a dense polyline with rounded corners (the wire, its flow and its pulses share it). */
  function dense(way, rad = 10) {
    const pts = way.filter((p, i) => i === 0 || Math.hypot(p[0] - way[i - 1][0], p[1] - way[i - 1][1]) > 0.5);
    const out = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i - 1], b = pts[i], c = pts[i + 1];
      const d1 = Math.hypot(b[0] - a[0], b[1] - a[1]), d2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
      const r = Math.min(rad, d1 / 2, d2 / 2);
      const p1 = [b[0] - (b[0] - a[0]) / d1 * r, b[1] - (b[1] - a[1]) / d1 * r];
      const p2 = [b[0] + (c[0] - b[0]) / d2 * r, b[1] + (c[1] - b[1]) / d2 * r];
      for (let s = 0; s <= 8; s++) {
        const t = s / 8, m = 1 - t;
        out.push([m * m * p1[0] + 2 * m * t * b[0] + t * t * p2[0], m * m * p1[1] + 2 * m * t * b[1] + t * t * p2[1]]);
      }
    }
    if (pts.length > 1) out.push(pts[pts.length - 1]);
    const cum = [0];
    for (let i = 1; i < out.length; i++) cum.push(cum[i - 1] + Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]));
    return { pts: out, cum, len: cum[cum.length - 1] };
  }
  function at(w, s) {
    const cum = w.cum, pts = w.pts;
    s = clamp(s, 0, w.len);
    let lo = 0, hi = cum.length - 1;
    while (lo < hi - 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
    const seg = cum[hi] - cum[lo] || 1, f = (s - cum[lo]) / seg;
    return [lerp(pts[lo][0], pts[hi][0], f), lerp(pts[lo][1], pts[hi][1], f)];
  }
  /* kinds: plain (task text), cam (pixels), feat (features), sub (the selected subtask: its hue) */
  const FLOW = {
    ctxSel: { kind: "plain", speed: 40, gap: 46 },
    bus: { kind: "plain", speed: 40, gap: 50 },
    ctxBus: { kind: "plain", speed: 40, gap: 50 },
    obsVlm: { kind: "cam", speed: 64, gap: 22 },
    selChip: { kind: "sub", speed: 34, gap: 30 },
    chipVlm: { kind: "sub", speed: 52, gap: 38 },
    k: { kind: "sub", speed: 56, gap: 56 },
    vlmFeat: { kind: "feat", speed: 40, gap: 17 },
    featHead: { kind: "feat", speed: 40, gap: 17 },
    headLoc: { kind: "sub", speed: 52, gap: 34 },
    locComp: { kind: "sub", speed: 42, gap: 34 },
    compGlob: { kind: "plain", speed: 42, gap: 34 },
  };
  const WIRES = {};                                                // id -> { geo, arrow, dots, on, parts, next }
  let BEAD = null;                                                 // where the k label sits on its wire
  function setWire(id, way, opts = {}) {
    const w = WIRES[id] || (WIRES[id] = { parts: [], next: 0 });
    w.geo = dense(way);
    w.arrow = opts.arrow !== false;
    w.dots = opts.dots || null;
    w.on = true;
    return w;
  }
  function buildStatic() {
    Object.values(WIRES).forEach((w) => { w.on = false; });
    const g = G, yV = g.vlm.cy;
    if (L === "narrow") {
      const lL = g.inner.x + g.padL / 2;
      setWire("ctxSel", [[g.ctx.cx, g.ctx.b], [g.ctx.cx, g.sel.y]]);
      setWire("ctxBus", [[g.ctx.x, g.ctx.cy], [lL, g.ctx.cy], [lL, chipY()]], { arrow: false });
      setWire("obsVlm", [[g.vlm.cx, g.obs.b], [g.vlm.cx, g.vlm.y]]);
      setWire("headLoc", [[g.head.cx, g.head.b], [g.head.cx, g.loc.y]]);
      setWire("locComp", [[g.comp.cx, g.loc.b], [g.comp.cx, g.comp.y]]);
      setWire("compGlob", [[g.comp.cx, g.comp.b], [g.comp.cx, g.glob.y]]);
    } else {
      const y1 = g.sel.cy, xA = (g.ctx.r + g.sel.x) / 2;
      setWire("ctxSel", [[g.ctx.r, y1], [g.sel.x, y1]]);
      setWire("bus", [[xA, y1], [xA, yV]], { arrow: false, dots: [[xA, y1], [xA, yV]] });
      setWire("obsVlm", [[g.obs.r, yV], [g.vlm.x, yV]]);
      if (L === "wide") {
        const xB = (g.head.r + g.out.x) / 2;
        setWire("headLoc", [[g.head.r, yV], [xB, yV], [xB, g.loc.cy], [g.loc.x, g.loc.cy]]);
        setWire("locComp", [[g.comp.cx, g.loc.y], [g.comp.cx, g.comp.b]]);
        setWire("compGlob", [[g.comp.cx, g.comp.y], [g.comp.cx, g.glob.b]]);
      } else {
        const top = Math.max(g.obs.b, g.model.b), yA = lerp(top, g.out.y, 0.45);
        setWire("headLoc", [[g.head.cx, g.head.b], [g.head.cx, yA], [g.loc.cx, yA], [g.loc.cx, g.loc.y]]);
        setWire("locComp", [[g.loc.r, g.comp.cy], [g.comp.x, g.comp.cy]]);
        setWire("compGlob", [[g.comp.cx, g.comp.b], [g.comp.cx, g.glob.y]]);
      }
    }
    setWire("vlmFeat", [[g.vlm.r, yV], [g.feats.x - 3, yV]], { arrow: false });
    setWire("featHead", [[g.feats.r + 3, yV], [g.head.x, yV]]);
  }
  function buildDynamic() {
    if (!G.sel) return;
    const g = G, c = chipRect(), yV = g.vlm.cy;
    setWire("selChip", [[anim.hx, g.sel.b], [anim.hx, c.y]], { arrow: false });
    if (L === "narrow") {
      const lL = g.inner.x + g.padL / 2, lR = g.inner.r - g.padR / 2;
      setWire("chipVlm", [[c.x, c.cy], [lL, c.cy], [lL, yV], [g.vlm.x, yV]], { dots: [[lL, c.cy]] });
      setWire("k", [[c.r, c.cy], [lR, c.cy], [lR, g.comp.cy], [g.comp.r, g.comp.cy]]);
      BEAD = [lR, (g.model.b + g.loc.y) / 2];
    } else {
      if (g.vlm.cx > c.x + 14 && g.vlm.cx < c.r - 14) setWire("chipVlm", [[g.vlm.cx, c.b], [g.vlm.cx, g.vlm.y]]);
      else setWire("chipVlm", [[c.x, c.cy], [g.vlm.cx, c.cy], [g.vlm.cx, g.vlm.y]]);
      if (L === "wide") {
        const xB = (g.head.r + g.out.x) / 2;
        setWire("k", [[c.r, c.cy], [xB, c.cy], [xB, g.comp.cy], [g.comp.x, g.comp.cy]]);
        BEAD = Math.abs(g.comp.cy - c.cy) > 48 ? [xB, (c.cy + g.comp.cy) / 2] : [lerp(c.r, xB, 0.55), c.cy];
      } else {
        const lR = g.inner.r - g.padR / 2;
        setWire("k", [[c.r, c.cy], [lR, c.cy], [lR, g.comp.cy], [g.comp.r, g.comp.cy]]);
        BEAD = [lR, (Math.max(g.obs.b, g.model.b) + g.out.y) / 2];
      }
    }
  }

  /* ------------------------------------------------------------------ flow: particles and pulses */
  function sprite(col) {
    const key = col.join(",");
    if (SPRITES[key]) return SPRITES[key];
    const c = document.createElement("canvas"); c.width = c.height = 48;
    const g = c.getContext("2d"), r = g.createRadialGradient(24, 24, 0, 24, 24, 24);
    r.addColorStop(0, rgba(PAL.spark, 1));
    r.addColorStop(0.16, rgba(col, 1));
    r.addColorStop(0.42, rgba(col, 0.32));
    r.addColorStop(1, rgba(col, 0));
    g.fillStyle = r; g.fillRect(0, 0, 48, 48);
    return (SPRITES[key] = c);
  }
  const kindColor = (kind) => (kind === "sub" ? PAL.sub[Math.max(0, curK)] : kind === "cam" ? PAL.cam : kind === "feat" ? PAL.feat : PAL.plain);
  function seedAll() {
    Object.keys(WIRES).forEach((id) => {
      const w = WIRES[id], f = FLOW[id];
      w.parts = [];
      if (!w.on || !f) return;
      for (let s = Math.random() * f.gap; s < w.geo.len; s += f.gap * (0.7 + Math.random() * 0.6)) w.parts.push(s);
      w.next = 0;
    });
  }
  function stepParticles(dt) {
    Object.keys(WIRES).forEach((id) => {
      const w = WIRES[id], f = FLOW[id];
      if (!w.on || !f) return;
      w.next -= dt;
      if (w.next <= 0) { w.parts.push(0); w.next = (f.gap / f.speed) * (0.7 + Math.random() * 0.6); }
      for (let i = 0; i < w.parts.length; i++) w.parts[i] += f.speed * dt;
      if (w.parts.length && w.parts[0] > w.geo.len) w.parts = w.parts.filter((s) => s <= w.geo.len);
    });
  }
  /* At a new subtask: selector -> description, then on to the VLM and (as k) to the composition. */
  let pulses = [];
  function firePulses(now) {
    pulses = [
      { id: "selChip", t0: now, dur: 280 },
      { id: "chipVlm", t0: now + 250, dur: 780 },
      { id: "k", t0: now + 250, dur: 780, end: () => flash(eqK) },
    ];
  }
  function flash(el) { el.classList.remove("is-flash"); void el.offsetWidth; el.classList.add("is-flash"); }

  /* ------------------------------------------------------------------ canvases: wires (static layer) and flow */
  const wc = wireCv.getContext("2d"), fc = fxCv.getContext("2d");
  function drawWires() {
    dirty.wires = false;
    const c = wc;
    c.setTransform(FXDPR, 0, 0, FXDPR, 0, 0);
    c.clearRect(0, 0, W, H);
    c.lineCap = "round"; c.lineJoin = "round";
    const sub = PAL.sub[Math.max(0, curK)];
    Object.keys(WIRES).forEach((id) => {
      const w = WIRES[id];
      if (!w.on || w.geo.pts.length < 2) return;
      const isSub = (FLOW[id] || {}).kind === "sub", pts = w.geo.pts;
      c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
      c.strokeStyle = isSub ? rgba(sub, 0.13) : rgba(PAL.wire, 0.25); c.lineWidth = 5; c.stroke();
      c.strokeStyle = isSub ? rgba(sub, 0.55) : rgba(PAL.wire, 1); c.lineWidth = 1.3; c.stroke();
      if (w.arrow) {
        const a = pts[pts.length - 1], b = pts[pts.length - 2], ang = Math.atan2(a[1] - b[1], a[0] - b[0]);
        c.save(); c.translate(a[0], a[1]); c.rotate(ang);
        c.beginPath(); c.moveTo(1, 0); c.lineTo(-7, -4.2); c.lineTo(-7, 4.2); c.closePath();
        c.fillStyle = isSub ? rgba(sub, 0.9) : rgba(PAL.arrow, 1); c.fill(); c.restore();
      }
      if (w.dots) w.dots.forEach((d) => { c.beginPath(); c.arc(d[0], d[1], 2.6, 0, 6.2832); c.fillStyle = isSub ? rgba(sub, 0.9) : rgba(PAL.arrow, 1); c.fill(); });
    });
    if (WIRES.k && WIRES.k.on && BEAD) {                          // the k label on its wire
      const rb = L === "narrow" ? 9 : 11.5;
      c.beginPath(); c.arc(BEAD[0], BEAD[1], rb, 0, 6.2832);
      c.fillStyle = rgba(PAL.bead, 1); c.fill();
      c.lineWidth = 1.3; c.strokeStyle = rgba(sub, 0.8); c.stroke();
      c.font = F.serif; c.fillStyle = rgba(PAL.ink, 1); c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText("k", BEAD[0] - 0.5, BEAD[1] + 0.5);
    }
  }
  let fxClear = true;
  function drawFx(now, flowOn) {
    const c = fc;
    const live = flowOn && !RM.matches;
    if (!live && !pulses.length) {
      if (!fxClear) { c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, fxCv.width, fxCv.height); fxClear = true; }
      return;
    }
    fxClear = false;
    c.setTransform(FXDPR, 0, 0, FXDPR, 0, 0);
    c.clearRect(0, 0, W, H);
    c.globalCompositeOperation = "lighter";
    if (live) {
      Object.keys(WIRES).forEach((id) => {
        const w = WIRES[id], f = FLOW[id];
        if (!w.on || !f || !w.parts.length) return;
        const spr = sprite(kindColor(f.kind)), size = f.kind === "cam" || f.kind === "feat" ? 6 : 8;
        for (const s of w.parts) {
          const fade = Math.min(1, s / 10, (w.geo.len - s) / 10) * 0.85;
          if (fade <= 0) continue;
          let q = at(w.geo, s - 5);
          c.globalAlpha = fade * 0.4; c.drawImage(spr, q[0] - size * 0.8, q[1] - size * 0.8, size * 1.6, size * 1.6);
          q = at(w.geo, s);
          c.globalAlpha = fade; c.drawImage(spr, q[0] - size, q[1] - size, size * 2, size * 2);
        }
      });
    }
    if (pulses.length && !RM.matches) {
      const spr = sprite(PAL.sub[Math.max(0, curK)]);
      pulses = pulses.filter((p) => {
        const w = WIRES[p.id], f = (now - p.t0) / p.dur;
        if (f >= 1 || !w || !w.on) { if (f >= 1 && p.end) p.end(); return false; }
        if (f < 0) return true;
        const s = w.geo.len * easeOut(f), a = f > 0.85 ? (1 - f) / 0.15 : 1;
        for (let j = 3; j >= 0; j--) {
          const q = at(w.geo, s - j * 7), z = 13 * (1 - j * 0.17);
          c.globalAlpha = (j ? 0.45 / j : 1) * a;
          c.drawImage(spr, q[0] - z, q[1] - z, z * 2, z * 2);
        }
        return true;
      });
    } else pulses = [];
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";
  }

  /* ------------------------------------------------------------------ charts */
  const locC = locCv.getContext("2d"), globC = globCv.getContext("2d");
  function begin(c, cv) {
    const w = cv.width / DPR, h = cv.height / DPR;
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
    c.clearRect(0, 0, w, h);
    return [w, h];
  }
  function localPts(k, upto) {                                     // Grana's scores for subtask k, up to index upto
    const w = WIN[k], out = [];
    if (w.i0 < 0) return out;
    for (let j = w.i0; j <= Math.min(w.i1, upto); j++) if (KS[j] === k) out.push([(TT[j] - w.t0) / (w.t1 - w.t0), PS[j]]);
    return out;
  }
  function polyline(c, pts, X, Y) {
    c.beginPath(); c.moveTo(X(pts[0][0]), Y(pts[0][1]));
    for (let i = 1; i < pts.length; i++) c.lineTo(X(pts[i][0]), Y(pts[i][1]));
  }
  function glowLine(c, pts, X, Y, col, width) {                   // a soft under-stroke instead of shadowBlur
    if (!pts.length) return;
    polyline(c, pts, X, Y);
    c.lineJoin = "round"; c.lineCap = "round";
    c.lineWidth = width + 5; c.strokeStyle = rgba(col, 0.16); c.stroke();
    c.lineWidth = width; c.strokeStyle = rgba(col, 1); c.stroke();
  }
  function headDot(c, x, y, col) {
    const g = c.createRadialGradient(x, y, 0, x, y, 16);
    g.addColorStop(0, rgba(col, 0.55)); g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g; c.beginPath(); c.arc(x, y, 16, 0, 6.2832); c.fill();
    c.beginPath(); c.arc(x, y, 5, 0, 6.2832); c.fillStyle = rgba(PAL.ink, 1); c.fill();
    c.lineWidth = 2; c.strokeStyle = rgba(col, 1); c.stroke();
  }
  function valueTag(c, x, y, txt, w, padL) {
    c.font = F.mono; c.textBaseline = "alphabetic"; c.textAlign = "left";
    const tw = c.measureText(txt).width;
    let tx = x + 10, ty = y - 10;
    if (tx + tw > w - 2) tx = x - 10 - tw;
    if (tx < padL + 2) tx = padL + 2;
    if (ty < 15) ty = y + 22;
    c.fillStyle = rgba(PAL.tag, 1);
    c.fillRect(tx - 4, ty - 13, tw + 8, 18);
    c.fillStyle = rgba(PAL.ink, 1); c.fillText(txt, tx, ty);
  }
  function drawLocal(s) {
    const c = locC, [w, h] = begin(c, locCv);
    const padL = 30, padR = 12, padT = 8, padB = 6;
    const X = (u) => padL + u * (w - padL - padR), Y = (v) => padT + (1 - v) * (h - padT - padB);
    c.font = F.mono; c.textAlign = "right"; c.textBaseline = "middle"; c.fillStyle = rgba(PAL.ink3, 1);
    c.fillText("1", padL - 12, Y(1)); c.fillText("0", padL - 12, Y(0));
    [[1, 0.1], [0.5, 0.05], [0, 0.22]].forEach(([v, a]) => { c.fillStyle = rgba(PAL.grid, a); c.fillRect(padL, Math.round(Y(v)) - 0.5, w - padL - padR, 1); });
    c.fillStyle = rgba(PAL.grid, 0.08); c.fillRect(Math.round(X(1)) - 0.5, Y(1), 1, Y(0) - Y(1));   // T_k+1
    const k = s.k, col = PAL.sub[k];
    if (prevLocal && prevLocal.alpha > 0.01 && prevLocal.pts.length) {   // the finished subtask's curve, fading out
      c.globalAlpha = prevLocal.alpha * fadeIn;
      polyline(c, prevLocal.pts, X, (v) => Y(v) - (1 - prevLocal.alpha) * 12);
      c.lineWidth = 1.5; c.strokeStyle = rgba(PAL.sub[prevLocal.k], 0.75); c.stroke();
      c.globalAlpha = 1;
    }
    const pts = localPts(k, s.i);
    c.globalAlpha = fadeIn;
    if (pts.length) {
      const grd = c.createLinearGradient(0, Y(1), 0, Y(0));
      grd.addColorStop(0, rgba(col, 0.3)); grd.addColorStop(1, rgba(col, 0.02));
      c.beginPath(); c.moveTo(X(pts[0][0]), Y(0));
      pts.forEach((p) => c.lineTo(X(p[0]), Y(p[1])));
      c.lineTo(X(pts[pts.length - 1][0]), Y(0)); c.closePath();
      c.fillStyle = grd; c.fill();
      glowLine(c, pts, X, Y, col, 2);
      const hp = pts[pts.length - 1];
      headDot(c, X(hp[0]), Y(hp[1]), col);
      valueTag(c, X(hp[0]), Y(hp[1]), s.p.toFixed(2), w, padL);
    }
    c.globalAlpha = 1;
  }
  function drawGlobal(s) {
    const c = globC, [w, h] = begin(c, globCv);
    const padL = 36, padR = 12, padT = 8, padB = 24;
    const X = (t) => padL + (t / DUR) * (w - padL - padR), Y = (v) => padT + (1 - v) * (h - padT - padB);
    const k = s.k, col = PAL.sub[k], tNow = TT[s.i];
    for (let i = 0; i <= K; i++) { c.fillStyle = rgba(PAL.grid, i === 0 ? 0.22 : 0.05); c.fillRect(padL, Math.round(Y(i / K)) - 0.5, w - padL - padR, 1); }
    c.globalAlpha = fadeIn;
    c.fillStyle = rgba(col, 0.1);                                  // the selected subtask's band [k/K, (k+1)/K]
    c.fillRect(X(WIN[k].t0), Y((k + 1) / K), Math.max(0, X(tNow) - X(WIN[k].t0)), Y(k / K) - Y((k + 1) / K));
    c.fillStyle = rgba(col, 0.55);
    c.fillRect(padL, Math.round(Y((k + 1) / K)) - 0.5, w - padL - padR, 1);
    c.fillRect(padL, Math.round(Y(k / K)) - 0.5, w - padL - padR, 1);
    const pts = [];                                                // the curve; under it one band of credit per subtask
    for (let j = 0; j <= s.i; j++) pts.push([TT[j], GG[j] / K]);
    const grd = c.createLinearGradient(0, Y(0), 0, Y(1));
    for (let i = 0; i < K; i++) { grd.addColorStop(i / K + 0.0005, rgba(PAL.sub[i], 0.26)); grd.addColorStop((i + 1) / K - 0.0005, rgba(PAL.sub[i], 0.26)); }
    c.beginPath(); c.moveTo(X(pts[0][0]), Y(0));
    pts.forEach((p) => c.lineTo(X(p[0]), Y(p[1])));
    c.lineTo(X(pts[pts.length - 1][0]), Y(0)); c.closePath();
    c.fillStyle = grd; c.fill();
    glowLine(c, pts, X, Y, PAL.curve, 2);
    const hp = pts[pts.length - 1];
    c.fillStyle = rgba(PAL.grid, 0.18); c.fillRect(Math.round(X(hp[0])) - 0.5, Y(hp[1]), 1, Y(0) - Y(hp[1]));
    headDot(c, X(hp[0]), Y(hp[1]), col);
    valueTag(c, X(hp[0]), Y(hp[1]), s.g.toFixed(2), w, padL);
    c.globalAlpha = 1;
    const ax = padL - 11;                                          // y axis: the composition stack (done = full, now = p)
    for (let i = 0; i < K; i++) {
      const y0 = Y(i / K) - 1, y1 = Y((i + 1) / K) + 1, hh = y0 - y1;
      c.fillStyle = rgba(PAL.grid, 0.09); c.fillRect(ax, y1, 5, hh);
      const f = i < k ? 1 : i === k ? s.p : 0;
      if (f > 0) { c.fillStyle = rgba(PAL.sub[i], 1); c.fillRect(ax, y0 - hh * f, 5, hh * f); }
    }
    c.font = F.mono; c.fillStyle = rgba(PAL.ink3, 1); c.textAlign = "right"; c.textBaseline = "middle";
    c.fillText("1", ax - 6, Y(1) + 1); c.fillText("0", ax - 6, Y(0) - 1);
    c.textBaseline = "alphabetic";                                 // time axis: start, end and the latest score
    const nowX = X(tNow), nowTxt = mmss(tNow), nowW = c.measureText(nowTxt).width;
    const nx = clamp(nowX - nowW / 2, padL, w - padR - nowW);
    const endTxt = mmss(DUR), endW = c.measureText(endTxt).width, startW = c.measureText("0:00").width;
    c.fillStyle = rgba(PAL.ink3, 1);
    if (nx > padL + startW + 8) { c.textAlign = "left"; c.fillText("0:00", padL, h - 5); }
    if (nx + nowW < w - padR - endW - 8) { c.textAlign = "right"; c.fillText(endTxt, w - padR, h - 5); }
    c.fillStyle = rgba(PAL.ink, 1); c.textAlign = "left"; c.fillText(nowTxt, nx, h - 5);
    for (let i = 0; i <= k; i++) {                                 // where each reached subtask began
      c.fillStyle = rgba(PAL.sub[i], 1); c.fillRect(Math.round(X(WIN[i].t0)) - 1, Y(0) + 1, 2, 5);
    }
  }

  /* ------------------------------------------------------------------ camera tiles */
  /* data-f2d-* (not data-src): site.js lazy-loads every video[data-src]; this loop loads only when it is wanted. */
  const srcURL = new URL(video.dataset.f2dSrc, document.baseURI).href;
  const posterURL = { start: video.dataset.f2dStart, still: video.dataset.f2dStill };
  const posters = {};
  function poster(which) {
    if (posters[which]) return posters[which];
    const img = new Image();
    img.decoding = "async";
    img.onload = () => { tileKey = -9; if (!raf) drawTiles(); };
    img.src = new URL(posterURL[which], document.baseURI).href;
    return (posters[which] = img);
  }
  video.poster = new URL(RM.matches ? posterURL.still : posterURL.start, document.baseURI).href;
  function drawTiles() {
    let src = null, sw = 0, sh = 0, key;
    if (videoReady && videoOK && video.readyState >= 2) {
      src = video; sw = video.videoWidth; sh = video.videoHeight; key = video.currentTime;
    } else {
      const which = Math.abs(T - T_STILL) < 0.5 ? "still" : "start", img = poster(which);
      if (img.complete && img.naturalWidth) { src = img; sw = img.naturalWidth; sh = img.naturalHeight; key = which === "still" ? -2 : -3; }
      if (video.getAttribute("src") == null) {
        const want = new URL(posterURL[which], document.baseURI).href;
        if (video.poster !== want) video.poster = want;
      }
    }
    if (!src || !sw || key === tileKey) return;
    tileKey = key;
    tiles.forEach((cv) => {
      const q = +cv.dataset.q;
      cv.getContext("2d").drawImage(src, (q % 2) * sw / 2, Math.floor(q / 2) * sh / 2, sw / 2, sh / 2, 0, 0, cv.width, cv.height);
    });
  }

  /* ------------------------------------------------------------------ selection + readouts */
  function select(k, now, step) {
    const prev = curK;
    curK = k;
    card.dataset.k = String(k);
    pills.forEach((b, i) => {
      b.classList.toggle("is-done", i < k);
      b.classList.toggle("is-now", i === k);
      if (i === k) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
    });
    segs.forEach((sg, i) => sg.classList.toggle("is-now", i === k));
    chipText.textContent = chipLabel(k);
    chip.title = "Selected subtask description: " + prompt(k);
    nameEl.textContent = fullLabel(k);
    if (step && prev >= 0 && k === prev + 1) {                       // forward in playback: hand over to the next subtask
      chip.classList.remove("is-swap"); void chip.offsetWidth; chip.classList.add("is-swap");
      prevLocal = { k: prev, pts: localPts(prev, N - 1), alpha: 0.65 };
      const sg = segs[prev]; sg.classList.remove("is-flash"); void sg.offsetWidth; sg.classList.add("is-flash");
      const pb = pills[prev]; pb.classList.remove("is-pop"); void pb.offsetWidth; pb.classList.add("is-pop");
      if (!RM.matches) firePulses(now);
      aim(false);
    } else {
      prevLocal = null; pulses = [];
      aim(true);
    }
    dirty.wires = true; chartKey = "";
  }
  function readouts(s) {
    const set = (key, el, v) => { if (shown[key] !== v) { shown[key] = v; el.textContent = v; } };
    set("k", eqK, String(s.k));
    set("p", eqP, s.p.toFixed(2));
    set("g", eqG, s.g.toFixed(2));
    set("n", countEl, String(s.k + 1));
    for (let i = 0; i < K; i++) {
      const f = i < s.k ? 1 : i === s.k ? s.p : 0;
      if (Math.abs(f - shown.f[i]) > 0.002) { shown.f[i] = f; segFill[i].style.setProperty("--f", f.toFixed(3)); }
    }
  }

  /* ------------------------------------------------------------------ render */
  function render(dt, now) {
    if (!box || !W) return;
    const s = stateAt(T);
    if (s.k !== curK) select(s.k, now, dt > 0 && !scrubbing);
    if (dt > 0) {
      const e = 1 - Math.exp(-dt * 9);
      const moving = Math.abs(anim.hx - anim.tx) > 0.3 || Math.abs(anim.hw - anim.tw) > 0.3 || Math.abs(anim.cx - anim.tcx) > 0.3;
      if (moving) {
        anim.hx = lerp(anim.hx, anim.tx, e); anim.hw = lerp(anim.hw, anim.tw, e); anim.cx = lerp(anim.cx, anim.tcx, e);
        dirty.dyn = true;
      }
      if (prevLocal) { prevLocal.alpha = Math.max(0, prevLocal.alpha - dt / 0.5); if (!prevLocal.alpha) prevLocal = null; }
      if (fadeIn < 1) fadeIn = Math.min(1, fadeIn + dt / 0.5);
      if (!RM.matches) stepParticles(dt * rate);
    }
    if (dirty.dyn) { dirty.dyn = false; placeHaloChip(); buildDynamic(); dirty.wires = true; }
    readouts(s);
    const key = s.i + "|" + s.k + "|" + (prevLocal ? prevLocal.alpha.toFixed(2) : "") + "|" + fadeIn.toFixed(2);
    if (key !== chartKey) { chartKey = key; drawLocal(s); drawGlobal(s); }
    if (!rvfc || !raf || video.paused) drawTiles();
    if (dirty.wires) drawWires();
    drawFx(now, !!raf);
  }
  function renderStill() {
    if (!box && !measure()) return;
    render(0, performance.now());
  }

  /* ------------------------------------------------------------------ the clock */
  let videoWanted = false, videoReady = false, videoOK = true, videoBlocked = false, videoWaiting = false;
  let pendingT = null, seekTarget = null, blobState = "", loadTimer = 0;
  const videoDrives = () => videoOK && videoReady && !videoWaiting && !videoBlocked && !video.paused;
  /* While the loop loads, seeks or buffers, the diagram waits for it, so the cameras and the scores never drift
     apart. Only without a usable video (error, autoplay refused, too slow) does the diagram keep its own clock. */
  const videoExpected = () => videoOK && !videoBlocked;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = lastNow ? Math.min(0.1, (now - lastNow) / 1000) : 0;
    lastNow = now;
    if (holdUntil) {
      T = VDUR;
      if (now >= holdUntil) endOfLoop();
    } else if (!scrubbing) {
      if (videoDrives()) T = Math.min(VDUR, video.currentTime);
      else if (!videoExpected()) T = Math.min(VDUR, T + dt * rate);
      if (T >= VDUR - 0.03 || (videoDrives() && video.ended)) startHold(now);
    }
    render(dt, now);
  }
  function startHold(now) { T = VDUR; holdUntil = now + HOLD * 1000; if (!video.paused) video.pause(); }
  function endOfLoop() {
    holdUntil = 0;
    loops += 1;
    if (loops >= LOOPS) { loops = 0; seekEp(epT(T_STILL)); setPaused(true); return; }   // rest on the paper's example
    T = 0; fadeIn = 0; prevLocal = null; curK = -1;
    if (videoOK && videoReady) { setVideoTime(0); playVideo(); }
  }

  /* ------------------------------------------------------------------ the video */
  function ensureVideo() {
    if (videoWanted || !videoOK) return;
    videoWanted = true;
    video.preload = "auto";
    video.src = srcURL;                                            // range requests make it seekable (GitHub Pages)
    video.defaultPlaybackRate = video.playbackRate = rate;
    loadTimer = setTimeout(() => { if (!videoReady) videoBlocked = true; }, 6000);   // too slow: run without it meanwhile
  }
  const seekable = () => { const r = video.seekable; return !!(r && r.length && r.end(r.length - 1) > 1); };
  function setVideoTime(v) {                                       // v: video seconds
    v = clamp(v, 0, VDUR - 0.04);
    if (!videoReady) { pendingT = v; return; }
    if (Math.abs(video.currentTime - v) < 0.04 && !video.seeking) { videoWaiting = false; return; }
    if (v > 0.05 && !seekable()) { pendingT = v; waitForBlob(); return; }
    seekTarget = v;
    try { video.currentTime = v; } catch (e) { pendingT = v; waitForBlob(); }
  }
  /* No range requests (python3 -m http.server): every seek lands on 0:00. Load the loop once as a blob, which is
     seekable; meanwhile the diagram waits and the tiles hold their frame. */
  function waitForBlob() {
    if (blobState === "failed") { videoWaiting = false; return; } // nothing more to try: follow the video's own clock
    videoWaiting = true;
    if (!video.paused) video.pause();
    if (blobState) return;
    if (!/^https?:$/.test(location.protocol) || typeof fetch !== "function" || !window.URL || !URL.createObjectURL) {
      blobState = "failed"; videoWaiting = false; return;
    }
    blobState = "loading";
    fetch(srcURL).then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status))))).then((b) => {
      blobState = "done";
      videoReady = false;
      video.src = URL.createObjectURL(b);                          // loadeddata realigns it with the diagram
      video.defaultPlaybackRate = video.playbackRate = rate;
    }).catch(() => { blobState = "failed"; videoWaiting = false; sync(); });
  }
  function playVideo() {
    if (!videoOK || !videoReady || videoWaiting) return;
    video.playbackRate = rate;
    const p = video.play();
    if (p && p.then) p.then(() => { videoBlocked = false; }, () => { if (video.paused) videoBlocked = true; });   // refused: the diagram keeps its own clock
  }
  video.addEventListener("loadeddata", () => {
    clearTimeout(loadTimer);
    videoReady = true; videoWaiting = false; videoBlocked = false;
    const v = pendingT != null ? pendingT : T;
    pendingT = null;
    setVideoTime(v);
    tileKey = -9;
    sync();
  });
  video.addEventListener("seeked", () => {
    if (seekTarget != null && Math.abs(video.currentTime - seekTarget) > 0.5) { pendingT = seekTarget; seekTarget = null; waitForBlob(); return; }
    seekTarget = null; videoWaiting = false; tileKey = -9;
    if (!raf) renderStill(); else sync();
  });
  video.addEventListener("ended", () => { if (raf && !holdUntil) startHold(performance.now()); });
  video.addEventListener("error", () => { videoOK = false; videoReady = false; videoWaiting = false; tileKey = -9; if (!raf) renderStill(); });
  const rvfc = typeof video.requestVideoFrameCallback === "function";
  if (rvfc) {
    const onFrame = () => { drawTiles(); video.requestVideoFrameCallback(onFrame); };
    video.requestVideoFrameCallback(onFrame);
  }

  /* ------------------------------------------------------------------ playing = not paused by the visitor, in view, tab visible */
  function sync() {
    const want = !userPaused && inView && !document.hidden;
    card.classList.toggle("is-paused", !want);
    if (want) {
      ensureVideo();
      if (holdLeft) { holdUntil = performance.now() + holdLeft; holdLeft = 0; }
      if (videoOK && videoReady && !holdUntil && !videoWaiting) {
        if (Math.abs(video.currentTime - T) > 0.08) setVideoTime(T);
        if (!videoWaiting && video.paused && !videoBlocked) playVideo();
      }
      if (!raf) { lastNow = 0; raf = requestAnimationFrame(frame); }
    } else {
      if (holdUntil) { holdLeft = Math.max(0, holdUntil - performance.now()); holdUntil = 0; }
      if (!video.paused) video.pause();
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      renderStill();
    }
  }
  function setPaused(p) {
    userPaused = p;
    playBtn.setAttribute("aria-pressed", String(p));
    sync();
  }
  function seekEp(t) {                                             // t: episode seconds
    holdUntil = 0; holdLeft = 0; fadeIn = 1;
    T = clamp(vidT(t), 0, VDUR);
    const s = stateAt(T);
    if (s.k !== curK) select(s.k, performance.now(), false);
    if (videoWanted && videoOK) setVideoTime(T);
    else if (videoOK) { pendingT = T; ensureVideo(); }             // a jump shows its camera frame, even while paused
    chartKey = ""; tileKey = -9;
    if (!raf) renderStill();
  }
  function jumpTo(k) {
    if (WIN[k].i0 < 0) return;
    loops = 0;
    seekEp(WIN[k].t0 + EPS);
    if (raf && videoReady && !videoWaiting) playVideo();
  }

  /* ------------------------------------------------------------------ controls */
  playBtn.setAttribute("aria-pressed", String(userPaused));
  playBtn.addEventListener("click", () => {
    loops = 0;
    if (userPaused && videoBlocked) { videoBlocked = false; }      // a tap may start what autoplay could not
    if (userPaused && T >= VDUR - 0.03) seekEp(T0);               // pressing Play at the end starts over
    setPaused(!userPaused);
  });
  $('[data-act="prev"]').addEventListener("click", () => {
    const s = stateAt(T), into = (s.t - WIN[s.k].t0) / SPEED;     // seconds of animation into this subtask
    jumpTo(into > 1 || s.k === 0 ? s.k : s.k - 1);
  });
  $('[data-act="next"]').addEventListener("click", () => {
    const s = stateAt(T);
    if (holdUntil || T >= VDUR - 0.03) { loops = 0; seekEp(T0); return; }
    if (s.k < K - 1) jumpTo(s.k + 1);
    else { loops = 0; seekEp(DUR); }
  });
  $('[data-act="restart"]').addEventListener("click", () => {
    loops = 0; videoBlocked = false;
    seekEp(T0);
    setPaused(false);
  });
  rateSel.addEventListener("change", () => {
    rate = +rateSel.value || 1;
    video.defaultPlaybackRate = video.playbackRate = rate;
  });
  document.addEventListener("visibilitychange", sync);
  if (RM.addEventListener) RM.addEventListener("change", () => { if (RM.matches) setPaused(true); else { dirty.wires = true; renderStill(); } });

  /* scrub along the global plot */
  function scrubTo(e) {
    const r = globCv.getBoundingClientRect(), padL = 36, padR = 12;
    seekEp(clamp((e.clientX - r.left - padL) / (r.width - padL - padR), 0, 1) * DUR);
  }
  globCv.addEventListener("pointerdown", (e) => {
    scrubbing = true; loops = 0;
    try { globCv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (!video.paused) video.pause();
    scrubTo(e);
  });
  globCv.addEventListener("pointermove", (e) => { if (scrubbing) scrubTo(e); });
  ["pointerup", "pointercancel", "lostpointercapture"].forEach((n) => globCv.addEventListener(n, () => {
    if (!scrubbing) return;
    scrubbing = false;
    sync();
  }));

  /* ------------------------------------------------------------------ start */
  let lay = 0;
  function relayout() {
    if (lay) return;
    lay = requestAnimationFrame(() => { lay = 0; if (measure()) { if (curK >= 0) aim(true); renderStill(); } });
  }
  if ("ResizeObserver" in window) new ResizeObserver(relayout).observe(card);
  else window.addEventListener("resize", relayout);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((es) => {
      const e = es[es.length - 1];
      inView = e.isIntersecting && e.intersectionRatio >= 0.15;
      sync();
    }, { threshold: [0, 0.15, 0.3] }).observe(card);
  } else inView = true;
  measure();
  select(stateAt(T).k, performance.now(), false);
  renderStill();
  if (document.fonts && document.fonts.load) {                    // canvas text waits for the page fonts
    Promise.all([F.mono, F.serif].map((f) => document.fonts.load(f).catch(() => {}))).then(relayout);
    if (document.fonts.ready) document.fonts.ready.then(relayout);
  }
  if (!("IntersectionObserver" in window)) sync();
})();

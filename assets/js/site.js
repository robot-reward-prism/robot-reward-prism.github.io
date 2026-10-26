/* PRISM page: shared behaviour (no dependencies, ES5-compatible).
 *
 *  - Accent switch: ?brand=anon | green  ->  <html data-brand="...">; the
 *    favicon follows, and the footer swatches show only with ?brand=.
 *  - Scroll chrome: 3px progress bar, left rail that docks once the hero is
 *    scrolled past (hero bottom - 96px), scroll spy at 32% of the viewport,
 *    light rail ink while the rail overlaps a dark band (or while keyboard
 *    focus reveals it over the film).
 *  - Hero video: plays only while visible and the tab is shown; never
 *    autoplays under prefers-reduced-motion or ?preview=light, and shows a "Play film" button
 *    with the title-card poster when the browser blocks autoplay; optional
 *    pause/play toggle (.hero-toggle).
 *  - Media: video[data-autoplay] plays while >=12% visible; video[data-src] /
 *    source[data-src] load when within 700px of the viewport.
 *  - [data-expand]: opens the contained video in a <dialog>, unmuted (other
 *    playing videos pause; it continues from the inline copy's position);
 *    an image URL (or a container holding only an image) opens a zoomable view.
 *  - Copy buttons: .bibtex-copy or [data-copy="#selector"].
 *  - Scroll reveal for section headers / figures / tables.
 *  - table.scorecard: row + column crosshair on hover; sideways-scrolling
 *    tables get edge fades.
 *  - "Read more" toggles swap to "Show less"; header paper notes close on
 *    Escape / outside click while shown as popovers; printing opens every
 *    <details> and restores them afterwards.
 */
(function () {
  "use strict";

  var doc = document;
  var root = doc.documentElement;
  var BRANDS = { green: true, anon: true };
  var FAVICON_BEAM = { green: "%2376b900", anon: "%235b50d6" };

  /* ---------- Brand (runs immediately; the <head> script does the same before first paint) ---------- */
  function setFavicon(b) {
    var link = doc.querySelector("link[rel~='icon']");
    var href = link && link.getAttribute("href");
    if (!href || href.indexOf("data:image/svg+xml") !== 0) return;
    link.setAttribute("href", href.replace(/(M20 19h11' stroke=')%23[0-9a-f]{6}/i, "$1" + FAVICON_BEAM[b]));
  }
  function setBrand(b) {
    b = String(b || "").toLowerCase();
    if (!BRANDS[b]) return false;
    root.setAttribute("data-brand", b);
    setFavicon(b);
    return true;
  }
  try {
    var qBrand = new URLSearchParams(window.location.search).get("brand");
    if (qBrand) { root.classList.add("brand-ui"); setBrand(qBrand); }
  } catch (e) { /* old browser: keep the markup default */ }

  /* Keep TOPBAR_QUERY in sync with the top-bar media query in the kit stylesheet. */
  var TOPBAR_QUERY = "(max-width: 768px), (max-height: 600px)";
  var reduceMQ = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  var topbarMQ = window.matchMedia ? window.matchMedia(TOPBAR_QUERY) : { matches: false };
  function onMQChange(mq, fn) {
    if (mq.addEventListener) mq.addEventListener("change", fn);
    else if (mq.addListener) mq.addListener(fn);
  }
  function toArray(list) { return Array.prototype.slice.call(list); }
  function $$(sel, ctx) { return toArray((ctx || doc).querySelectorAll(sel)); }
  function safePlay(v) {
    var p = v.play();
    if (p && typeof p.catch === "function") p.catch(function () {});
  }
  function onReady(fn) {
    if (doc.readyState !== "loading") fn();
    else doc.addEventListener("DOMContentLoaded", fn);
  }

  onReady(function () {
    initScrollChrome();
    initHeroVideo();
    initMedia();
    initExpand();
    initCopy();
    initReveal();
    initScorecards();
    initBrandButtons();
    initMore();
    initRefPopovers();
    initPrint();
  });
  /* Player scripts build their seek bars and tables after this script runs;
     DOMContentLoaded fires once every deferred script has executed (KaTeX is
     loaded by app.js outside that chain, so a slow CDN cannot delay this). */
  doc.addEventListener("DOMContentLoaded", function () {
    initRanges();
    initTableFades();
  });

  /* ---------- Seek bars: paint the played part of the track ---------- */
  function initRanges() {
    var desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    if (!desc || !desc.get || !desc.set) return;
    $$(".transport input[type='range']").forEach(function (input) {
      if (input.__fill) return;
      input.__fill = true;
      function paint() {
        var min = parseFloat(input.min) || 0;
        var max = parseFloat(input.max);
        if (!(max > min)) max = min + 1;
        var v = parseFloat(desc.get.call(input)) || 0;
        var p = Math.max(0, Math.min(1, (v - min) / (max - min)));
        input.style.setProperty("--fill", (p * 100).toFixed(3) + "%");
      }
      /* Players set .value directly while media plays: wrap the setter. */
      Object.defineProperty(input, "value", {
        configurable: true,
        get: function () { return desc.get.call(this); },
        set: function (v) { desc.set.call(this, v); paint(); }
      });
      input.addEventListener("input", paint);
      if (window.MutationObserver) new MutationObserver(paint).observe(input, { attributes: true, attributeFilter: ["max", "min"] });
      paint();
    });
  }

  /* ---------- Progress bar, rail docking, scroll spy, rail-on-dark ---------- */
  function initScrollChrome() {
    var bar = doc.querySelector(".scroll-progress");
    var nav = doc.querySelector(".navbar");
    var hero = doc.querySelector("[data-hero]") || doc.querySelector(".hero");
    var navLinks = nav ? nav.querySelector(".nav-links") : null;
    var darks = $$(".band-dark, [data-band='dark']");
    var railItems = nav ? $$(".nav-link, .nav-foot, .nav-brand", nav) : [];
    var spy = [];
    if (nav) {
      $$(".nav-link[href^='#']", nav).forEach(function (a) {
        var id = a.getAttribute("data-spy") || decodeURIComponent(a.hash.slice(1));
        var el = id ? doc.getElementById(id) : null;
        if (el) spy.push({ a: a, el: el });
      });
    }
    var current = null;
    var ticking = false;

    function docTop(el) { return el.getBoundingClientRect().top + window.pageYOffset; }

    function overDark(el) {
      var r = el.getBoundingClientRect();
      for (var i = 0; i < darks.length; i++) {
        var d = darks[i].getBoundingClientRect();
        var mid = (r.top + r.bottom) / 2;   // label counts as "over dark" only when its centre line is inside the band
        if (d.top <= mid && d.bottom > mid && d.left < r.right && d.right > r.left) return true;
      }
      return false;
    }

    function updateFades() {
      if (!navLinks) return;
      var canScroll = topbarMQ.matches && navLinks.scrollWidth > navLinks.clientWidth + 1;
      navLinks.classList.toggle("fade-l", canScroll && navLinks.scrollLeft > 2);
      navLinks.classList.toggle("fade-r", canScroll && navLinks.scrollLeft + navLinks.clientWidth < navLinks.scrollWidth - 2);
    }

    function centerActive(a) {
      if (!navLinks || !topbarMQ.matches || navLinks.scrollWidth <= navLinks.clientWidth) return;
      var left = a.offsetLeft - navLinks.offsetLeft - (navLinks.clientWidth - a.offsetWidth) / 2;
      left = Math.max(0, Math.min(left, navLinks.scrollWidth - navLinks.clientWidth));
      if (navLinks.scrollTo) navLinks.scrollTo({ left: left, behavior: reduceMQ.matches ? "auto" : "smooth" });
      else navLinks.scrollLeft = left;
    }

    function update() {
      ticking = false;
      var y = window.pageYOffset;
      var vh = window.innerHeight;
      var max = root.scrollHeight - root.clientHeight;

      if (bar) {
        var p = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
        bar.style.setProperty("--progress", p.toFixed(4));
      }

      if (nav) {
        var threshold = hero ? docTop(hero) + hero.offsetHeight - 96 : 12;
        var docked = y > threshold;
        nav.classList.toggle("scrolled", docked);
        doc.body.classList.toggle("nav-docked", docked);

        /* Keyboard focus can reveal the rail before it docks, i.e. over the
           film: give it dark glass and light ink (rail mode only). */
        var railMode = !topbarMQ.matches;
        var focusReveal = railMode && !docked && nav.matches(":focus-within");
        nav.classList.toggle("focus-reveal", focusReveal);

        /* Light ink per rail item while it overlaps a dark band (rail mode only) */
        var checkDark = (docked || focusReveal) && darks.length && railMode;
        railItems.forEach(function (el) {
          el.classList.toggle("on-dark", !!(focusReveal || (checkDark && overDark(el))));
        });
      }

      if (spy.length) {
        var line = y + vh * 0.32;
        var active = spy[0];
        for (var j = 0; j < spy.length; j++) if (docTop(spy[j].el) <= line) active = spy[j];
        if (max > 0 && y >= max - 2) active = spy[spy.length - 1];
        if (active !== current) {
          current = active;
          spy.forEach(function (s) {
            var on = s === active;
            s.a.classList.toggle("active", on);
            if (on) s.a.setAttribute("aria-current", "true");
            else s.a.removeAttribute("aria-current");
          });
          centerActive(active.a);
        }
      }
      updateFades();
    }

    function request() {
      if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    }
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
    window.addEventListener("load", request);
    /* Rail geometry is only final once its slide-in ends: re-check dark overlap then. */
    if (nav) nav.addEventListener("transitionend", function (e) { if (e.target === nav) request(); });
    if (nav) { nav.addEventListener("focusin", request); nav.addEventListener("focusout", request); }
    if (navLinks) navLinks.addEventListener("scroll", updateFades, { passive: true });
    onMQChange(topbarMQ, function () { current = null; request(); });
    update();
  }

  /* ---------- Hero video ---------- */
  function initHeroVideo() {
    var hero = doc.querySelector("[data-hero]") || doc.querySelector(".hero");
    if (!hero) return;
    var v = hero.querySelector("video");
    if (!v) return;
    var btn = hero.querySelector(".hero-toggle");
    var bigPlay = hero.querySelector(".hero-play");
    var inView = true;
    var userChoice = null; /* "play" | "pause" | null */
    var blocked = false;   /* the browser refused autoplay (NotAllowedError) */
    var still = v.getAttribute("data-still-poster");
    var lightPreview = false;
    try { lightPreview = new URLSearchParams(window.location.search).get("preview") === "light"; } catch (e) {}

    v.muted = true;
    v.defaultMuted = true;
    v.setAttribute("muted", "");
    v.setAttribute("playsinline", "");
    if ((reduceMQ.matches || lightPreview) && still) v.poster = still;

    /* Keep the URL inert until playback: setting preload alone cannot stop an
       autoplaying video from fetching through a slow preview tunnel. */
    function ensureSource() {
      if (v.currentSrc || v.getAttribute("src")) return;
      var small = window.matchMedia && window.matchMedia("(max-width: 900px), (max-height: 500px)").matches;
      var pick = null;
      $$("source", v).forEach(function (s) {
        var url = s.getAttribute("data-cover-src") || s.getAttribute("src");
        var isSmall = /720/.test(url || "");
        if (!pick && isSmall === small) pick = url;
      });
      /* A cover with one source serves that file at every viewport size. */
      if (!pick) {
        var fallback = v.querySelector("source[data-cover-src], source[src]");
        if (fallback) pick = fallback.getAttribute("data-cover-src") || fallback.getAttribute("src");
      }
      if (pick) { v.preload = "auto"; v.src = pick; }
    }
    function wantPlay() {
      if (userChoice === "pause") return false;
      if (doc.hidden || !inView) return false;
      if ((reduceMQ.matches || lightPreview || blocked) && userChoice !== "play") return false;
      return true;
    }
    function sync() {
      if (!wantPlay()) { if (!v.paused) v.pause(); return; }
      ensureSource();
      var p = v.play();
      if (p && typeof p.catch === "function") {
        p.catch(function (err) {
          if (!err || err.name !== "NotAllowedError" || userChoice === "play") return;
          /* Autoplay is blocked (Low Power Mode, "never auto-play", ...): show
             the title card and the large Play button instead of a dark frame. */
          blocked = true;
          if (still) v.poster = still;
          syncButton();
        });
      }
    }
    function syncButton() {
      if (btn) {
        btn.setAttribute("aria-pressed", v.paused ? "true" : "false");
        btn.setAttribute("aria-label", v.paused ? "Play the cover film" : "Pause the cover film");
      }
      if (bigPlay) bigPlay.hidden = !(v.paused && (reduceMQ.matches || lightPreview || blocked) && userChoice !== "pause");
    }

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
        sync();
      }).observe(hero);
    }
    doc.addEventListener("visibilitychange", sync);
    onMQChange(reduceMQ, sync);
    v.addEventListener("play", syncButton);
    v.addEventListener("pause", syncButton);
    if (btn) {
      btn.addEventListener("click", function () {
        userChoice = v.paused ? "play" : "pause";
        sync();
        syncButton();
      });
    }
    if (bigPlay) {
      bigPlay.addEventListener("click", function () {
        var hadFocus = doc.activeElement === bigPlay;
        userChoice = "play";
        sync();
        /* The button hides once the film plays: keep keyboard focus on the toggle. */
        if (hadFocus && btn) btn.focus({ preventScroll: true });
      });
    }
    sync();
    syncButton();
  }

  /* ---------- In-view autoplay + lazy sources ---------- */
  function initMedia() {
    var lazy = $$("video[data-src], video source[data-src]").map(function (n) {
      return n.tagName === "SOURCE" ? n.parentNode : n;
    }).filter(function (v, i, arr) { return arr.indexOf(v) === i; });
    var auto = $$("video[data-autoplay]");

    function load(v) {
      if (v.getAttribute("data-poster")) { v.poster = v.getAttribute("data-poster"); v.removeAttribute("data-poster"); }
      if (v.getAttribute("data-src")) { v.src = v.getAttribute("data-src"); v.removeAttribute("data-src"); }
      var changed = false;
      $$("source[data-src]", v).forEach(function (s) { s.src = s.getAttribute("data-src"); s.removeAttribute("data-src"); changed = true; });
      if (changed) v.load();
    }

    auto.forEach(function (v) {
      v.muted = true;
      v.setAttribute("muted", "");
      v.setAttribute("playsinline", "");
      if (reduceMQ.matches) v.controls = true;
    });

    if (!("IntersectionObserver" in window)) {
      lazy.forEach(load);
      return;
    }
    var lazyIO = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        load(e.target);
        obs.unobserve(e.target);
      });
    }, { rootMargin: "700px 0px" });
    lazy.forEach(function (v) { lazyIO.observe(v); });

    var playIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting && !reduceMQ.matches) {
          load(v);
          safePlay(v);
        } else if (!v.paused) {
          v.pause();
        }
      });
    }, { threshold: 0.12 });
    auto.forEach(function (v) { playIO.observe(v); });
  }

  /* ---------- Click-to-expand (video or figure) in a native <dialog> ---------- */
  function initExpand() {
    var triggers = $$("[data-expand]");
    if (!triggers.length) return;

    /* showModal(): Escape closes from any focus position (also inside the
       video's own controls) and the page behind is inert. */
    var modal = doc.createElement("dialog");
    var hasDialog = typeof modal.showModal === "function";
    if (!hasDialog) {
      modal = doc.createElement("div");
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
    }
    modal.className = "media-modal";
    modal.setAttribute("aria-label", "Expanded video");
    modal.innerHTML = '<button class="media-modal-close" type="button" aria-label="Close">&times;</button>' +
      '<video controls playsinline></video>' +
      '<div class="media-modal-image"><img alt=""></div>' +
      '<p class="media-modal-hint">Scroll sideways to read the figure</p>';
    doc.body.appendChild(modal);
    var full = modal.querySelector("video");
    var imageBox = modal.querySelector(".media-modal-image");
    var image = imageBox.querySelector("img");
    var closeBtn = modal.querySelector(".media-modal-close");
    var inline = null;        /* page video that plays the same file */
    var pausedByModal = [];
    var lastFocus = null;
    var IMAGE_RE = /\.(png|jpe?g|webp|gif|svg)(\?|#|$)/i;

    function urlFor(t) {
      var explicit = t.getAttribute("data-expand");
      if (explicit) return explicit;
      var v = t.querySelector("video");
      if (!v) return "";
      if (v.currentSrc) return v.currentSrc;
      if (v.getAttribute("src")) return v.getAttribute("src");
      if (v.getAttribute("data-src")) return v.getAttribute("data-src");
      var s = v.querySelector("source[src], source[data-src]");
      return s ? (s.getAttribute("src") || s.getAttribute("data-src")) : "";
    }
    function abs(u) { try { return new URL(u, doc.baseURI).href; } catch (e) { return u; } }
    /* The trigger's own video, or another page video with the same file (the
       overview card for the "Video" button). */
    function inlineCopy(t, url) {
      var own = t.querySelector("video");
      if (own) return own;
      var target = abs(url), found = null;
      $$("video").forEach(function (v) {
        if (found || v === full || v.closest(".hero")) return;
        var s = v.querySelector("source[src]");
        var src = v.currentSrc || v.getAttribute("src") || (s ? s.getAttribute("src") : "");
        if (src && abs(src) === target) found = v;
      });
      return found;
    }
    function show() {
      if (hasDialog && !modal.open) modal.showModal();
      modal.classList.add("open");
      doc.body.style.overflow = "hidden";
      closeBtn.focus({ preventScroll: true });
    }
    function open(t) {
      var url = urlFor(t);
      if (!url) return;
      lastFocus = doc.activeElement;
      if (IMAGE_RE.test(url)) {
        var source = t.querySelector("img");
        image.src = url;
        image.alt = t.getAttribute("data-expand-alt") || (source ? source.getAttribute("alt") || "" : "");
        modal.setAttribute("aria-label", "Enlarged figure");
        modal.classList.add("is-image");
        show();
        imageBox.scrollTop = 0;
        imageBox.scrollLeft = 0;
        return;
      }
      inline = inlineCopy(t, url);
      modal.setAttribute("aria-label", "Expanded video");
      modal.classList.remove("is-image");
      full.setAttribute("aria-label", (inline && inline.getAttribute("aria-label")) || "Video");
      /* One soundtrack at a time: pause every audible video and the cover film
         (the film, a muted loop, resumes on close). */
      pausedByModal = [];
      $$("video").forEach(function (x) {
        if (x === full || x.paused) return;
        if (!x.muted || x.closest(".hero") || x.hasAttribute("data-autoplay")) { x.pause(); pausedByModal.push(x); }
      });
      /* A sound-on inline copy that is part-way through continues from there. */
      var from = inline && !inline.muted && !inline.ended && inline.currentTime > 0.5 ? inline.currentTime : 0;
      full.src = url;
      full.poster = t.getAttribute("data-expand-poster") || (inline ? (inline.getAttribute("poster") || "") : "");
      full.muted = false;
      show();
      var start = function () {
        try { full.currentTime = from; } catch (e) { /* not seekable yet */ }
        safePlay(full);
      };
      if (full.readyState >= 1) start();
      else full.addEventListener("loadedmetadata", start, { once: true });
    }
    /* Runs once the dialog has closed (close button, Escape, backdrop click). */
    function cleanup() {
      if (!modal.classList.contains("open")) return;
      var wasImage = modal.classList.contains("is-image");
      modal.classList.remove("open", "is-image");
      doc.body.style.overflow = "";
      if (wasImage) {
        image.removeAttribute("src");
      } else {
        var t = full.currentTime || 0;
        var ended = full.ended;
        full.pause();
        full.removeAttribute("src");
        full.load();
        /* The sound-on inline copy picks up where the lightbox stopped (paused). */
        if (inline && !inline.muted && t > 0.5 && !ended) { try { inline.currentTime = t; } catch (e) { /* ignore */ } }
        pausedByModal.forEach(function (x) {
          if (x.muted && !reduceMQ.matches) safePlay(x);
        });
        pausedByModal = [];
        inline = null;
      }
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    }
    function close() {
      if (hasDialog) { if (modal.open) modal.close(); else cleanup(); }
      else cleanup();
    }

    triggers.forEach(function (t) {
      if (!t.hasAttribute("tabindex")) t.setAttribute("tabindex", "0");
      if (!t.hasAttribute("role")) t.setAttribute("role", "button");
      if (!t.hasAttribute("aria-label")) t.setAttribute("aria-label", "Play full screen");
      t.addEventListener("click", function (e) { e.preventDefault(); open(t); });
      t.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(t); }
      });
    });
    closeBtn.addEventListener("click", close);
    modal.addEventListener("click", function (e) { if (e.target === modal || e.target === imageBox) close(); });
    if (hasDialog) {
      modal.addEventListener("close", cleanup);
    } else {
      doc.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
      doc.addEventListener("focusin", function (e) {
        if (modal.classList.contains("open") && !modal.contains(e.target)) closeBtn.focus({ preventScroll: true });
      });
    }
  }

  /* ---------- Copy (BibTeX) ---------- */
  function initCopy() {
    $$(".bibtex-copy, [data-copy]").forEach(function (btn) {
      if (btn.__copyBound) return;
      btn.__copyBound = true;
      var sel = btn.getAttribute("data-copy");
      var scope = btn.closest(".bibtex-block") || doc;
      var target = sel ? doc.querySelector(sel) : scope.querySelector("pre, code");
      if (!target) return;
      var label = btn.querySelector(".copy-label") || btn;
      var original = label.textContent;
      var live = doc.createElement("span");
      live.className = "sr-only";
      live.setAttribute("aria-live", "polite");
      btn.parentNode.insertBefore(live, btn.nextSibling);
      var timer = null;

      function done() {
        label.textContent = "Copied";
        btn.classList.add("copied");
        live.textContent = "Copied to clipboard";
        clearTimeout(timer);
        timer = setTimeout(function () {
          label.textContent = original;
          btn.classList.remove("copied");
          live.textContent = "";
        }, 1600);
      }
      function failed() {
        /* Could not write to the clipboard: select the text so it can be copied by hand. */
        label.textContent = "Select & copy";
        live.textContent = "Copy failed; the text is selected";
        try {
          var range = doc.createRange();
          range.selectNodeContents(target);
          var sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        } catch (e) { /* ignore */ }
      }
      btn.addEventListener("click", function () {
        var text = target.textContent.trim();
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(text).then(done, function () { if (fallbackCopy(text)) done(); else failed(); });
        } else if (fallbackCopy(text)) {
          done();
        } else {
          failed();
        }
      });
    });
  }
  function fallbackCopy(text) {
    var ta = doc.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.opacity = "0";
    doc.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = doc.execCommand("copy"); } catch (e) { ok = false; }
    doc.body.removeChild(ta);
    return ok;
  }

  /* ---------- Scroll reveal ---------- */
  function initReveal() {
    if (reduceMQ.matches || !("IntersectionObserver" in window)) return;
    if (doc.body.getAttribute("data-reveal") === "off") return;
    var els = $$("[data-reveal], .section-header, .figure, .scorecard-card, .proof").filter(function (el) {
      return !el.hasAttribute("data-no-reveal") && !el.closest(".hero");
    });
    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("in");
        obs.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    els.forEach(function (el) {
      el.classList.add("reveal");
      io.observe(el);
    });
  }

  /* ---------- Scorecard crosshair ---------- */
  function initScorecards() {
    $$("table.scorecard").forEach(function (table) {
      var cols = [];
      function add(i, cell) { (cols[i] = cols[i] || []).push(cell); }
      $$("thead th[data-col]", table).forEach(function (th) { add(+th.getAttribute("data-col"), th); });
      $$("tbody tr", table).forEach(function (tr) {
        if (tr.classList.contains("sc-bench")) return;
        $$("td:not(.sc-arrow)", tr).forEach(function (td, i) { td.setAttribute("data-col", i); add(i, td); });
      });
      var row = null, col = null, cell = null;
      function clear() {
        if (row) row.classList.remove("sc-row-hover");
        if (col !== null && cols[col]) cols[col].forEach(function (c) { c.classList.remove("sc-col-hover"); });
        if (cell) cell.classList.remove("sc-cell-hover");
        row = col = cell = null;
      }
      table.addEventListener("pointerover", function (e) {
        var td = e.target.closest("td[data-col]");
        if (!td) {
          var th = e.target.closest("thead th[data-col]");
          clear();
          if (th) {
            col = +th.getAttribute("data-col");
            (cols[col] || []).forEach(function (c) { c.classList.add("sc-col-hover"); });
          }
          return;
        }
        if (td === cell) return;
        clear();
        cell = td;
        row = td.parentElement;
        col = +td.getAttribute("data-col");
        row.classList.add("sc-row-hover");
        (cols[col] || []).forEach(function (c) { c.classList.add("sc-col-hover"); });
        td.classList.add("sc-cell-hover");
      });
      table.addEventListener("pointerleave", clear);
    });
  }

  /* ---------- Optional brand buttons: <button data-set-brand="anon"> ---------- */
  function initBrandButtons() {
    var btns = $$("[data-set-brand]");
    if (!btns.length) return;
    function sync() {
      var cur = root.getAttribute("data-brand") || "green";
      btns.forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-set-brand") === cur)); });
    }
    btns.forEach(function (b) {
      b.addEventListener("click", function () {
        var brand = b.getAttribute("data-set-brand");
        if (!setBrand(brand)) return;
        sync();
        try {
          var u = new URL(window.location.href);
          u.searchParams.set("brand", brand);
          window.history.replaceState(null, "", u.toString());
        } catch (e) { /* ignore */ }
      });
    });
    sync();
  }

  /* ---------- "Read more": the toggle stays and reads "Show less" when open ---------- */
  function initMore() {
    $$("details.more").forEach(function (d) {
      var summary = d.querySelector("summary");
      if (!summary) return;
      var closedLabel = summary.textContent;
      function sync() { summary.textContent = d.open ? "Show less" : closedLabel; }
      d.addEventListener("toggle", sync);
      sync();
    });
  }

  /* ---------- Header paper notes shown as popovers (wide rail mode) ---------- */
  function initRefPopovers() {
    var refs = $$(".section-header > details.ref");
    if (!refs.length) return;
    function isPopover(d) { return window.getComputedStyle(d).position === "absolute"; }
    doc.addEventListener("click", function (e) {
      refs.forEach(function (d) { if (d.open && isPopover(d) && !d.contains(e.target)) d.open = false; });
    });
    doc.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      refs.forEach(function (d) {
        if (!d.open || !isPopover(d)) return;
        var hadFocus = d.contains(doc.activeElement);
        d.open = false;
        if (hadFocus) d.querySelector("summary").focus({ preventScroll: true });
      });
    });
  }

  /* ---------- Print / Save as PDF: every <details> prints open ---------- */
  function initPrint() {
    var opened = [];
    window.addEventListener("beforeprint", function () {
      opened = $$("details:not([open])");
      opened.forEach(function (d) { d.open = true; });
    });
    window.addEventListener("afterprint", function () {
      opened.forEach(function (d) { d.open = false; });
      opened = [];
    });
  }

  /* ---------- Sideways-scrolling tables: edge fades (.fade-l / .fade-r) ---------- */
  function initTableFades() {
    var wraps = $$(".scorecard-wrap, .table-card, .table-wrap");
    if (!wraps.length) return;
    function update(w) {
      var max = w.scrollWidth - w.clientWidth;
      w.classList.toggle("fade-l", max > 1 && w.scrollLeft > 2);
      w.classList.toggle("fade-r", max > 1 && w.scrollLeft < max - 2);
    }
    wraps.forEach(function (w) {
      w.addEventListener("scroll", function () { update(w); }, { passive: true });
      update(w);
    });
    if ("ResizeObserver" in window) {
      /* Watch the wrapper and its table (content width changes too). */
      var ro = new ResizeObserver(function (entries) { entries.forEach(function (e) { update(e.target.__fadeWrap || e.target); }); });
      wraps.forEach(function (w) {
        ro.observe(w);
        var c = w.firstElementChild;
        if (c) { c.__fadeWrap = w; ro.observe(c); }
      });
    } else {
      window.addEventListener("resize", function () { wraps.forEach(update); });
    }
    /* Typeset math and late fonts change table widths */
    window.addEventListener("load", function () { wraps.forEach(update); });
  }

  window.siteKit = { setBrand: setBrand };
})();

/* PRISM draft · the two topic modules (#predictions, #details) on phones and short screens: there the topic menu of
 * assets/js/evaluation-nav.js is not active and every topic would stack, so each topic folds behind its title
 * (the first one open). On roomy screens the toggles are hidden and the menu works as before (charts.css). */
(() => {
  "use strict";
  const readerQuery = window.matchMedia("(min-width: 1100px) and (min-height: 700px)");
  const topics = [];
  let scrollFrame = 0;
  function targetOf(hash) {
    try { return document.getElementById(decodeURIComponent((hash || "").slice(1))); }
    catch (_) { return null; }
  }
  function setOpen({ pane, btn }, open, revealCharts = true) {
    pane.classList.toggle("is-collapsed", !open);
    btn.setAttribute("aria-expanded", String(open));
    if (open && revealCharts) pane.querySelectorAll("[data-pc]").forEach((f) => f.classList.add("is-in"));
  }
  document.querySelectorAll("#predictions .evaluation-workspace, #details .evaluation-workspace").forEach((ws) => {
    [...ws.querySelectorAll(".evaluation-nav-links a")].forEach((a, i) => {
      const pane = targetOf(a.hash);
      if (!pane) return;
      const title = a.querySelector(".reader-topic-title");
      const btn = document.createElement("button");
      btn.type = "button"; btn.className = "topic-toggle";
      btn.append(Object.assign(document.createElement("span"), { textContent: title ? title.textContent : a.textContent }));
      btn.append(Object.assign(document.createElement("i"), { ariaHidden: "true" }));
      btn.setAttribute("aria-controls", pane.id);
      pane.prepend(btn);
      const topic = { pane, btn };
      topics.push(topic);
      setOpen(topic, i === 0, false);
      btn.addEventListener("click", () => {
        setOpen(topic, pane.classList.contains("is-collapsed"));
      });
    });
  });

  function reveal(hash, scroll = true) {
    if (readerQuery.matches) return; // The desktop reader owns panel selection and scrolling.
    const target = targetOf(hash);
    if (!target) return;
    const enclosing = topics.filter(({ pane }) => pane === target || pane.contains(target));
    if (!enclosing.length) return;
    enclosing.forEach((topic) => setOpen(topic, true));
    for (let details = target.closest("details"); details; details = details.parentElement?.closest("details")) details.open = true;
    cancelAnimationFrame(scrollFrame);
    if (scroll) scrollFrame = requestAnimationFrame(() => target.scrollIntoView({ block: "start", behavior: "instant" }));
  }
  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest("a[href]");
    if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
    let url;
    try { url = new URL(link.href, location.href); } catch (_) { return; }
    if (url.origin === location.origin && url.pathname === location.pathname && url.search === location.search) reveal(url.hash);
  });
  window.addEventListener("hashchange", () => reveal(location.hash));
  readerQuery.addEventListener("change", () => reveal(location.hash, false));
  // Expand before the shared initial-fragment handler measures and scrolls the page.
  reveal(location.hash, false);
  document.addEventListener("DOMContentLoaded", () => reveal(location.hash), { once: true });
})();

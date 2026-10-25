/* PRISM draft · the two topic modules (#predictions, #details) on phones and short screens: there the topic menu of
 * assets/js/evaluation-nav.js is not active and every topic would stack, so each topic folds behind its title
 * (the first one open). On roomy screens the toggles are hidden and the menu works as before (charts.css). */
(() => {
  "use strict";
  document.querySelectorAll("#predictions .evaluation-workspace, #details .evaluation-workspace").forEach((ws) => {
    [...ws.querySelectorAll(".evaluation-nav-links a")].forEach((a, i) => {
      const pane = document.getElementById(decodeURIComponent(a.hash.slice(1)));
      if (!pane) return;
      const title = a.querySelector(".reader-topic-title");
      const btn = document.createElement("button");
      btn.type = "button"; btn.className = "topic-toggle";
      btn.append(Object.assign(document.createElement("span"), { textContent: title ? title.textContent : a.textContent }));
      btn.append(Object.assign(document.createElement("i"), { ariaHidden: "true" }));
      btn.setAttribute("aria-expanded", i === 0 ? "true" : "false");
      pane.prepend(btn);
      if (i !== 0) pane.classList.add("is-collapsed");
      btn.addEventListener("click", () => {
        const open = pane.classList.toggle("is-collapsed") === false;
        btn.setAttribute("aria-expanded", String(open));
        if (open) pane.querySelectorAll("[data-pc]").forEach((f) => f.classList.add("is-in"));   // (its bars grow at once)
      });
    });
  });
})();

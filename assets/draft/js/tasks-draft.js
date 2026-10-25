/* PRISM draft: the pretraining gallery (#task-gallery). Loaded after assets/js/data/tasks.js (a published file, left
 * untouched) and before assets/js/app.js, which renders what is left.
 *  - 20 tiles (4 full rows of 5): the five tasks with the longest instructions (23-48 words) stay out (the user, 2026-10-24).
 *  - No tile shows its full instruction on hover: every tile is just its photo and short title (for a uniform grid),
 *    so app.js draws no dot and no overlay.
 * Remove a seq from DROP to bring its tile back. */
(() => {
  const T = window.PRISM_DATA && window.PRISM_DATA.tasks;
  if (!T || !Array.isArray(T.items)) return;
  const DROP = new Set([
    47,   // Slot the cutlery into the organizer (45 words)
    141,  // Spray, wipe and rack the plate (48)
    160,  // Swap the flashlight battery pack (31)
    219,  // Push each pen cap onto its end (23)
    370,  // Load tennis balls and close the lid (29)
  ]);
  T.items = T.items.filter((it) => !DROP.has(it.seq)).map((it) => Object.assign({}, it, { instruction: it.task }));
})();

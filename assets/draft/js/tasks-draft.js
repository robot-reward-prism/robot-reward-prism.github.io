/* PRISM draft: the pretraining gallery (#task-gallery) without the tasks whose instructions are long, multi-step
 * paragraphs (19-48 words; the user, 2026-10-24). Loaded after assets/js/data/tasks.js (a published file, left
 * untouched) and before assets/js/app.js, which renders what is left: 17 tiles, every instruction a short single step.
 * Remove a seq from DROP to bring its tile back. */
(() => {
  const T = window.PRISM_DATA && window.PRISM_DATA.tasks;
  if (!T || !Array.isArray(T.items)) return;
  const DROP = new Set([
    47,   // Slot the cutlery into the organizer (45 words)
    141,  // Spray, wipe and rack the plate (48)
    160,  // Swap the flashlight battery pack (31)
    214,  // Fill the pill organizer and snap lids (19)
    219,  // Push each pen cap onto its end (23)
    225,  // Drop screws, nuts and bolts into bins (20)
    299,  // Slot necklaces into the jewelry box (22)
    370,  // Load tennis balls and close the lid (29)
  ]);
  T.items = T.items.filter((it) => !DROP.has(it.seq));
})();

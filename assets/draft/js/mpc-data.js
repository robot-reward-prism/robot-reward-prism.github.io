/* PRISM draft: data for the MPC examples (assets/draft/js/mpc-player.js): the gallery cards and the full player.
 *
 * Beat times are the film's own caption timeline in each clip (the fast cut of the cover film's MPC
 * part; extracted from the film source and spot-checked against frames), so the strip and the line
 * under the video follow the captions burned into the video. `text` is the burned-in caption, verbatim.
 * `say`, where present, is what the page shows instead.
 *
 * kind: setup | alone (policy alone) | mpc | imagine | judge (PRISM scores) |
 *       wrong (wrong step) | reject (PRISM: all four too risky) | chosen | run | done
 *
 * Presentation (the user's decision, 2026-10-24): PRISM is presented as the judge, with no "illustrative"
 * notes. Each round's provenance is recorded with the film (PRISM_cover_film/README.md).
 * (The "How it works" round was removed at the user's request, 2026-10-24; the cover film explains MPC.)
 */
window.PRISM_DRAFT = window.PRISM_DRAFT || {};
window.PRISM_DRAFT.mpc = {
  /* card: the gallery's before/after pair, same start: the policy alone (left) and with MPC (right); real footage, speed as shown. */
  default: "banana",
  stories: [
    {
      id: "banana",
      card: { judge: { cells: [["bad", "banana"], ["bad", "banana"], ["good", "pick"], ["bad", "banana"]],
                     foot: "✓ PRISM's pick: the drawer first" },
              alone: { text: "Grabs the banana while the drawer is still closed", speed: "×2" },
              mpc: { text: "Opens the drawer first, then puts the banana in", speed: "fast-forward" } },   /* the before/after card (clips: assets/draft/video/cards/banana_{alone,mpc}.mp4) */
      tab: "Banana in drawer",
      meta: "Opens drawer first",
      title: "Put the banana in the drawer",
      dur: 31.4,
      src: { hd: "assets/draft/video/mpc_banana_1080.mp4", sd: "assets/draft/video/mpc_banana_720.mp4" },
      poster: "assets/draft/video/mpc_banana_poster.jpg",
      context: [
        { tone: "bad", label: "Policy alone", text: "Goes for the banana while the drawer is still closed." },
        { tone: "good", label: "With MPC", text: "Backs up and opens the drawer first, then puts the banana in and shuts the drawer." },
      ],
      beats: [
        { t0: 0.32, t1: 1.82, kind: "setup", text: "drawer closed" },
        { t0: 2.17, t1: 4.92, kind: "alone", text: "✕ policy alone: banana first, drawer still closed" },
        { t0: 5.12, t1: 6.95, kind: "mpc", text: "MPC backs up" },
        { t0: 6.95, t1: 8.7, kind: "imagine", text: "MPC imagines 4 futures" },
        { t0: 8.7, t1: 11.0, kind: "wrong", text: "✕ wrong step: drawer still closed" },
        { t0: 11.1, t1: 12.85, kind: "imagine", text: "new step: open drawer" },
        { t0: 12.85, t1: 14.4, kind: "chosen", text: "chosen: the handle" },
        { t0: 14.4, t1: 16.4, kind: "run", text: "it runs on the robot" },
        { t0: 16.4, t1: 18.77, kind: "run", text: "next rounds: grip the handle, pull" },
        { t0: 19.32, t1: 21.07, kind: "imagine", text: "next step: the banana" },
        { t0: 21.07, t1: 22.62, kind: "chosen", text: "chosen: the banana" },
        { t0: 22.62, t1: 24.49, kind: "run", text: "grab, carry, lower" },
        { t0: 24.49, t1: 26.19, kind: "run", text: "banana released" },
        { t0: 26.19, t1: 28.15, kind: "imagine", text: "next step: close the drawer" },
        { t0: 28.15, t1: 31.25, kind: "done", text: "✓ the banana is in, the drawer is shut" },
      ],
    },
    {
      id: "fridge",
      card: { judge: { cells: [["bad", "jams knob"], ["bad", "half grip"], ["good", "pick"], ["bad", "lets go"]],
                     foot: "✓ PRISM's pick: a firm grip" },
              alone: { text: "Reaches for the knob but never grips it", speed: "×3" },
              mpc: { text: "Grips the knob, opens the door, puts the apple in", speed: "fast-forward" } },   /* the before/after card (clips: assets/draft/video/cards/fridge_{alone,mpc}.mp4) */
      tab: "Apple in fridge",
      meta: "Grips knob firmly",
      title: "Put the apple in the fridge",
      dur: 29.133,
      src: { hd: "assets/draft/video/mpc_fridge_1080.mp4", sd: "assets/draft/video/mpc_fridge_720.mp4" },
      poster: "assets/draft/video/mpc_fridge_poster.jpg",
      context: [
        { tone: "bad", label: "Policy alone", text: "Never grips the knob." },
        { tone: "good", label: "With MPC", text: "Grips the knob firmly and pulls the door open; later it puts the apple in and shuts the door." },
      ],
      beats: [
        { t0: 0.48, t1: 1.98, kind: "setup", text: "door closed" },
        { t0: 2.33, t1: 5.18, kind: "alone", text: "✕ policy alone: it never grips the knob" },
        { t0: 5.38, t1: 7.45, kind: "mpc", text: "MPC: back up, then replan" },
        { t0: 7.45, t1: 9.2, kind: "imagine", text: "4 futures, PRISM scores" },
        { t0: 9.2, t1: 10.75, kind: "chosen", text: "chosen: firm grip" },
        { t0: 10.75, t1: 12.75, kind: "run", text: "it runs on the robot" },
        { t0: 13.3, t1: 15.05, kind: "imagine", text: "4 futures, PRISM scores" },
        { t0: 15.05, t1: 16.6, kind: "chosen", text: "chosen: clean pull" },
        { t0: 16.6, t1: 19.0, kind: "run", text: "the door swings open wide" },
        { t0: 19.0, t1: 21.2, kind: "run", text: "3 min later: the apple" },
        { t0: 21.2, t1: 24.37, kind: "run", text: "carry it in, let go of the apple" },
        { t0: 24.37, t1: 25.77, kind: "run", text: "shuts it" },
        { t0: 25.77, t1: 28.97, kind: "done", text: "✓ the apple is in, the door is shut" },
      ],
    },
    {
      id: "tractor",
      card: { judge: { cells: [["bad", "big wheel"], ["bad", "big wheel"], ["bad", "big wheel"], ["bad", "big wheel"]],
                      foot: "✕ all 4 too risky → imagine again" },
              alone: { text: "Takes the big rear wheel to the front axle", speed: "×2" },
              mpc: { text: "Puts the small wheel on the front axle", speed: "×2" } },   /* the before/after card (clips: assets/draft/video/cards/tractor_{alone,mpc}.mp4) */
      tab: "Tractor assembly",
      meta: "Takes small wheel",
      title: "Assemble the tractor",
      dur: 69.133,
      src: { hd: "assets/draft/video/mpc_tractor_1080.mp4", sd: "assets/draft/video/mpc_tractor_720.mp4" },
      poster: "assets/draft/video/mpc_tractor_poster.jpg",
      context: [
        { tone: "bad", label: "Policy alone", text: "Takes the big rear wheel to the front axle, where the small wheel belongs." },
        { tone: "good", label: "With MPC", text: "Three times, all four imagined futures go for a big wheel, and PRISM rates them too risky. The futures chosen instead pull away, then head for the small wheel. It ends assembled and upright." },
      ],
      beats: [
        { t0: 0.47, t1: 1.8, kind: "setup", text: "same start" },
        { t0: 2.15, t1: 6.03, kind: "alone", text: "✕ policy alone: the big rear wheel to the front axle" },
        { t0: 6.23, t1: 8.13, kind: "mpc", text: "with MPC" },
        { t0: 8.13, t1: 10.63, kind: "imagine", text: "imagined: all grab the big wheel" },
        { t0: 10.63, t1: 12.93, kind: "reject", text: "✕ PRISM: all too risky, imagine again" },
        { t0: 13.03, t1: 14.78, kind: "imagine", text: "new futures: pull away" },
        { t0: 14.78, t1: 16.33, kind: "chosen", text: "chosen: pull away" },
        { t0: 18.17, t1: 20.03, kind: "run", text: "the policy goes back" },
        { t0: 20.03, t1: 22.87, kind: "run", text: "next round: right hand over a big wheel" },
        { t0: 23.42, t1: 25.42, kind: "imagine", text: "again: all reach for it" },
        { t0: 25.42, t1: 27.72, kind: "reject", text: "✕ PRISM: too risky again" },
        { t0: 27.82, t1: 30.07, kind: "imagine", text: "new: slide to the corner wheel" },
        { t0: 30.07, t1: 31.62, kind: "chosen", text: "chosen: small wheel" },
        { t0: 37.45, t1: 39.45, kind: "run", text: "on the front axle" },
        { t0: 40.42, t1: 43.78, kind: "run", text: "big wheel: rear axle" },
        { t0: 43.78, t1: 44.85, kind: "run", text: "flip" },
        { t0: 44.85, t1: 46.88, kind: "run", text: "a big wheel again" },
        { t0: 47.43, t1: 49.68, kind: "imagine", text: "again: all grab the big wheel" },
        { t0: 49.68, t1: 51.98, kind: "reject", text: "✕ PRISM: too risky" },
        { t0: 52.08, t1: 54.08, kind: "imagine", text: "new: to the small wheel" },
        { t0: 54.08, t1: 55.63, kind: "chosen", text: "chosen: small wheel" },
        { t0: 59.23, t1: 61.93, kind: "run", text: "on the front axle again" },
        { t0: 62.83, t1: 65.67, kind: "run", text: "big wheel: rear axle" },
        { t0: 65.67, t1: 66.87, kind: "run", text: "upright" },
        { t0: 66.87, t1: 69.07, kind: "done", text: "✓ assembled, upright" },
      ],
    },
  ],
};

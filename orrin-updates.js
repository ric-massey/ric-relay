// Orrin's progress notes — what the "PROGRESS NOTES" region on orrin.html draws.
// Newest first. Plain English for friends and family: what was tried, what
// happened, what's next. Not commit messages (the GitHub regions below already
// show those) and no claims that Orrin feels or is aware of anything: the
// labels name engineering parts, as the page itself says.
//
// Written from the Orrin repo by `scripts/site_update.py` (orrin_v3), which
// inserts an entry right after the opening bracket and publishes just that
// change; hand edits are fine too. .github/test/orrin-updates.mjs checks the shape.
//
// kind: "run result" | "build" | "design" | "note"
window.ORRIN_UPDATES = [
  {
    date: "2026-10-04",
    kind: "build",
    title: "Fixes for the next run: honest answers, deeper research",
    body: "Four fixes from the Run 12 write-up. A question now only counts as answered if Orrin found something it didn't already have. 'What did I get wrong?' needs an actual contradiction, not a definition. Finished topics get a second round with new search angles instead of silently going nowhere. And there's a new kind of goal where Orrin guesses what makes its own memory or CPU climb, then checks the guess against data recorded afterwards. Those guesses can be wrong, and on real data the first ones were.",
    href: "https://github.com/ric-massey/orrin_v3/commit/3690056",
  },
  {
    date: "2026-10-04",
    kind: "design",
    title: "Design: running continuously instead of in ticks",
    body: "Orrin works in cycles: notice, remember, choose one thing, act, save, repeat. People don't. A lot happens in parallel, and only the deliberate part is one-thing-at-a-time. Orrin is already partly like that, so the plan isn't to throw the loop away. It's to measure time in seconds instead of cycles, let something important wake it up early, and let an activity like reading carry on across many moments instead of being re-chosen every few seconds.",
    href: "https://github.com/ric-massey/orrin_v3/blob/main/docs/Core%20Architecture%2C%20Embodiment%20%26%20Evolution/CONTINUOUS_TIME_DESIGN_2026-10-04.md",
  },
  {
    date: "2026-10-04",
    kind: "run result",
    title: "Run 12: didn't pass, but for new reasons",
    body: "The twelfth long test run (Aug 19–21). Good: Orrin shut down cleanly when its lifespan ran out, and stopped spending almost every cycle in its expensive 'think hard' mode (98% down to 67%). Bad: its research pipeline went quiet after five hours, because it kept re-picking topics it had already finished. And the growth numbers that looked like a breakthrough were a bug. A word-matching mistake let any web page 'answer' any question. The Mac also slept through 15 of the 28 hours.",
    href: "https://github.com/ric-massey/orrin_v3/blob/main/docs/Behavioral%20Evaluation%20%26%20Runtime%20Diagnostics/demo_runs/2026-08-19-run/DEMO_RUN_2026-08-19.md",
  },
];

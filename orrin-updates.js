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
    date: "2026-10-08",
    kind: "build",
    title: "Run 14 fixes built: less churn, a fed research lane, memory about the world",
    body: "The Run 13 life showed a list of problems; all 28 fixes for them are now built and tested against files from that life. The largest: a goal that waits hours for fresh measurements is no longer picked up and abandoned every 15 minutes, which was behind all 18 bookkeeping mismatches and most of the goal log. Goal-making is no longer blocked by a one-cycle rule, and new research topics now come from subjects his own reading defined in passing. His working memory stops holding his own selection logs and alarms, which had filled 74 percent of long memory; findings about the outside world are now kept preferentially. Rewards stop paying for an action that cannot work without a language model, for no-op calls, and for garbled drafts from his small language model. Next: a short test life to check the research lane stays fed, then Run 14.",
    href: "https://github.com/ric-massey/orrin_v3/commit/be077f4",
  },
  {
    date: "2026-10-08",
    kind: "build",
    title: "Status card now starts with each life",
    body: "Housekeeping before the Run 14 build. The small read-only program that feeds the 'Is Orrin running?' card on this page used to be started by hand. The launcher now starts it with each life and stops it when the life ends, sending one final update so the card shows the stop right away instead of after three minutes. It only reads Orrin's state files and never writes into them, so it cannot affect a run's results. That closes the post-Run-13 housekeeping list; next is the Run 14 fix list.",
    href: "https://github.com/ric-massey/orrin_v3/commit/96990f6",
  },
  {
    date: "2026-10-07",
    kind: "run result",
    title: "Run 13: the first time Orrin actually learned something",
    body: "The thirteenth test ran 29 hours and ended on schedule, with no crashes and the computer awake the whole time. For the first time, his 'I answered a question' counts are real: he answered 14 different questions with things he didn't already know (we first counted 26, but some were repeats), and twice he made a guess about his own behavior (his memory use goes up after he reads a book), tested it on data recorded afterwards, and was right. It still didn't pass. His research went quiet for up to four hours at a stretch, and a few old bugs came back. The bigger lesson is about what he thinks about: mostly himself. Three-quarters of his long-term memories are notes about his own activity, his 'world' was just his own folder, and he kept circling the same few topics. Next: give him a real world to wander, and make most of his memories about it.",
    href: "https://github.com/ric-massey/orrin_v3/blob/main/docs/Behavioral%20Evaluation%20%26%20Runtime%20Diagnostics/demo_runs/2026-10-06-run/DEMO_RUN_2026-10-06.md",
  },
  {
    date: "2026-10-06",
    kind: "note",
    title: "Run 13 has started",
    body: "The thirteenth long test run began this afternoon with all twelve fixes from the Run 12 write-up. It's set to live about a day and a quarter. The questions this time: does research keep going all day instead of stalling after five hours, do 'answered' questions mean something was actually learned, and do its notes say something real? The computer is plugged in and kept awake for the whole run. Results here when it's done.",
    href: "https://github.com/ric-massey/orrin_v3/commit/a6045bc",
  },
  {
    date: "2026-10-06",
    kind: "build",
    title: "The rest of the Run 13 fixes, and a laptop that stays awake",
    body: "Eight more fixes from the Run 12 write-up. When the Mac sleeps, Orrin now notices and doesn't count that time against its lifespan (Run 12 lost 15 of its 28 hours that way), and the launcher checks it's actually being kept awake. Its notes to Ric now have to say something real, drawn from what it researched. 610 of 617 last time were empty. A self-check that was muting its own research as 'avoidance' was pointed at the right thing. And five junk 'best work' examples that had sat in its quality standard since July, actually its own internal log lines, were removed. Next: a fresh Run 13.",
    href: "https://github.com/ric-massey/orrin_v3/commit/bf7ffb3",
  },
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

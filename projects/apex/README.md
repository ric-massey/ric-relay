# Apex — parked

> not enough info to be public, will work on if respawn releases api or an easier way is found to track info.

— Ric, 2026-10-30.

The Apex room is off the site. `apex.html`, its post on the front door, its
`ROOMS` entry in the terminal and its `effects.js` scene were removed; typing
`apex` in the terminal prints the line above.

**Nothing here is lost.** The room as it last stood is the commit tagged
`apex-parked` (`74d3b48`):

- matches from Respawn's LiveAPI, over the WebSocket the game opens to
  `watcher/liveapi.py`, posted to the `apex-live` Worker (`server/`);
- per-legend trackers and rank from the daily Apex Legends Status pull
  (`pull-apex.py`, run by `apex-sync.plist` on the Mac);
- career totals read off the screen (`watcher/watch-apex.py`) or typed by hand.

`watcher/README.md` has the three-way split in full. The code and
`apex-data.js` stay in this folder because `apex-data.js` is the accumulator's
only history: one reading per day that Apex cannot give back.

## Bringing it back

```bash
git checkout apex-parked -- apex.html
```

then put back what the commit after the tag took out: the post and the `apex`
painter in `index.html`, the `apex` row in `ROOMS` in `terminal.html`, the
scene in `effects.js`, the line in `llms.txt`, and the docs (`AGENTS.md`,
`README.md`, `EASTER_EGGS.md`). `git show apex-parked` and the diff of the next
commit list every one.

## While it is parked

- The daily ALS pull on the Mac (`apex-sync.plist`) still updates and commits
  `apex-data.js` if it is loaded. Nothing reads that file any more. Unload it
  with `launchctl bootout gui/$UID/com.ricmassey.apex-sync` or leave it
  running to keep the history going.
- The `apex-live` Worker is still deployed. Nothing on the site calls it.

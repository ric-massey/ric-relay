# Ric — VALORANT, every match

Ric Massey's VALORANT record from https://ricmassey.com/val.html, as plain text. Generated 2026-10-29. Data comes from Riot's own match details. Each match links to a full report with every fight and the exact 2D position of every player at every kill, spike plant and defuse.

## Career

| Stat | Value |
|---|---|
| Current rank | — |
| Matches | 0 |
| Won / lost / drawn | 0 / 0 / 0 |
| Win rate | — |
| K/D | — |
| Average ACS | — |

## Matches (newest first)

| Date | Map | Mode | Agent | Score | Result | K-D-A | ACS | ADR | HS% | Report |
|---|---|---|---|---|---|---|---|---|---|---|

## Raw data

`/projects/val/matches/<id>.js` holds each match as JSON after the `=`: `seats` (seat number, agent, `us` = Ric's team, `me` = Ric), `transform` and `callouts` for the map, and `rounds[]` with `fights[]` (killer, victim, weapon, `killer_at` / `victim_at` / `snapshot[]` positions as `{x, y, u, v, view (radians), place}`), `damage[]` (from, to, dmg, head, body, legs), `economy` per seat, and `spike`.

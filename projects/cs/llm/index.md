# RicGoneCrazy — Counter-Strike 2, every match

Ric Massey's CS2 record from https://ricmassey.com/cs.html, as plain text. Generated 2026-10-14. Each match below links to a full report.

Sources: Valve's match demos (full detail, 2D positions), Valve's live game feed, and Leetify for games whose demo Valve already deleted. Other players appear under their in-game names.

## Career

| Stat | Value |
|---|---|
| Matches | 17 |
| Won / lost / drawn | 4 / 11 / 2 |
| Win rate | 24% |
| Kills / deaths | 172 / 239 |
| K/D | 0.72 |
| Headshot % | 45% |
| Matches with full demo data | 16 |

**Leetify skill ratings** (read 2026-10-14): aim 52/100, positioning 31/100, utility 3/100.

**Competitive rank by map:** Cache Unranked, Dust II Unranked, Train Silver I, Anubis Unranked, Mirage Unranked. Premier rating: unrated.

## Matches (newest first)

| Date | Map | Mode | Score | Result | K-D-A | ADR | Rating | Full data | Report |
|---|---|---|---|---|---|---|---|---|---|
| 2026-10-13 17:22 UTC | Train | Competitive | 9–13 | loss | 6-19-6 | 53.4 | -9.08 | yes | [3848102062252359905.md](3848102062252359905.md) |
| 2026-10-13 16:50 UTC | Anubis | Competitive | 13–6 | win | 13-13-5 | 80.9 | +3.49 | yes | [3848097853184409614.md](3848097853184409614.md) |
| 2026-10-13 16:26 UTC | Train | Competitive | 3–13 | loss | 4-14-1 | 46.4 | -4.74 | yes | [3848094777987825749.md](3848094777987825749.md) |
| 2026-10-13 16:09 UTC | Mirage | Competitive | 3–9 | loss | 4-10-0 | 32.4 | -4.86 | yes | [3848092619766759746.md](3848092619766759746.md) |
| 2026-10-13 01:36 UTC | Mirage | Competitive | 12–12 | draw | 22-18-5 | 96.7 | +6.74 | yes | [3847980205440237697.md](3847980205440237697.md) |
| 2026-10-13 01:12 UTC | Cache | Competitive | 2–13 | loss | 12-12-1 | 97.9 | +0.70 | yes | [3847977048639275147.md](3847977048639275147.md) |
| 2026-10-13 00:38 UTC | Mirage | Competitive | 7–13 | loss | 8-17-4 | 60.9 | -8.53 | yes | [3847972682805018863.md](3847972682805018863.md) |
| 2026-10-12 23:40 UTC | Dust II | Competitive | 4–7 | loss | 8-8-5 | 102.1 | +4.73 | yes | [3847965185939603496.md](3847965185939603496.md) |
| 2026-10-11 04:30 UTC | Dust II | Competitive | 3–13 | loss | 8-14-2 | 65.1 | -7.01 | yes | [3847631533552697449.md](3847631533552697449.md) |
| 2026-10-11 03:29 UTC | Train | Competitive | 13–9 | win | 12-16-3 | 65.7 | -2.87 | yes | [3847623624370421940.md](3847623624370421940.md) |
| 2026-10-11 02:48 UTC | Train | Competitive | 13–8 | win | 19-13-2 | 88.2 | +9.87 | yes | [3847618294316007431.md](3847618294316007431.md) |
| 2026-10-11 02:07 UTC | Mirage | Competitive | 11–13 | loss | 16-17-4 | 82.0 | -2.53 | yes | [3847613007211266183.md](3847613007211266183.md) |
| 2026-10-11 01:03 UTC | Dust II | Competitive | 3–13 | loss | 7-15-3 | 61.2 | -6.25 | yes | [3847604825298567197.md](3847604825298567197.md) |
| 2026-10-06 03:20 UTC | Mirage | Competitive | 3–13 | loss | 7-16-1 | 48.8 | -11.39 | yes | [3846694811922858158.md](3846694811922858158.md) |
| 2026-10-06 02:39 UTC | Anubis | Competitive | 6–13 | loss | 5-19-3 | 38.3 | -12.73 | yes | [3846689522670633012.md](3846689522670633012.md) |
| 2026-10-06 01:55 UTC | Mirage | Competitive | 12–12 | draw | 13-15-2 | 46.8 | -3.17 | yes | [3846683791036776519.md](3846683791036776519.md) |
| 2026-10-02 03:13 UTC | Rush 001 | Custom | 6–2 | win | 8-3-0 | 85.5 | +10.67 | no | [lt-e57bd669-7374-4f75-9153-2f672ebb7086.md](lt-e57bd669-7374-4f75-9153-2f672ebb7086.md) |

## By map

| Map | Played | W-L-D | K/D |
|---|---|---|---|
| Mirage | 6 | 0-4-2 | 0.75 |
| Train | 4 | 2-2-0 | 0.66 |
| Dust II | 3 | 0-3-0 | 0.62 |
| Anubis | 2 | 1-1-0 | 0.56 |
| Cache | 1 | 0-1-0 | 1.00 |
| Rush 001 | 1 | 1-0-0 | 2.67 |

## Reading the raw 2D data

Matches with a saved demo have a data file at
`/projects/cs/matches/<id>.js`. It is one JSON object after
`(window.CS_MATCH=window.CS_MATCH||{})["<id>"]=`:

- `map`, `hz` (position samples per second), `tickrate`
- `seats`: `[{seat, name, us, me}]` — `us` = Ric's team, `me` = Ric
- `rounds[]`, each with
  - `side` (Ric's side), `w` (Ric's team won), `winner`, `reason`, `dur` (seconds)
  - `tracks`: `{seat: [x0, y0, x1, y1, …]}` sampled `hz` times a second from the
    round going live; `null, null` while dead
  - `fights[]`: `t`, `killer`, `victim`, `assister` (seats), `weapon`, `headshot`,
    `wallbang`, `through_smoke`, `noscope`, `killer_blind`, `killer_in_air`,
    `killer_at` / `victim_at` (`x, y, z, place`), `distance`, `killer_hp_after`,
    `alive_before` [Ric's team, opponents], `opening`, `traded_after`,
    `exchange` (damage rows between the two in the prior 10 s),
    `shots_before`, `snapshot` (everyone alive: seat, x, y, z, place, hp)
  - `damage[]`: `[t, attacker, victim, weapon, hp_damage, armor_damage, hitgroup, hp_left]`
  - `shots[]`: `[t, seat, weapon]` — every shot fired
  - `flashes[]`: `[t, thrower, victim, seconds_blind]`
  - `nades[]`: `[t, seat, kind, x, y]` — where each grenade went off
  - `bomb`: `planted {t, by, site, x, y, place}`, `defused {t, by}`, `exploded {t}`
  - `economy`: `{seat: {money, equip, armor, helmet, kit, items}}` after the buy
  - `kills[]`: the compact form the page draws from

Times are seconds since the round went live. Coordinates are CS2 map units.


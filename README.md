# ric-relay

Ric Massey's personal website — a terminal-styled relay for family and friends.

Live at GitHub Pages. Plain HTML/CSS/JS, no build step: edit a file, push, and the
site redeploys automatically.

## Layout

| Page | What it is |
|---|---|
| `index.html` | The Liminal Terminal — landing page with a working command line |
| `systems.html` | ORRIN diagnostic panel — self-updates from the GitHub API |
| `velocity.html` | Field station — climbing, running, garage |
| `exploration.html` | Event horizon — space, experiments, the game |
| `workbench.html` | Random projects |
| `captures.html` | Photos |
| `log.html` | Write-ups & VOD reviews |
| `map.html` | Locked placeholder — the real map app lives elsewhere, with real auth |

## Updating

Each page has its editable content inside a loudly-commented block near the top of
the file. `notes.js` holds the homepage transmissions. `systems.html` never needs
editing — it pulls live data from GitHub.

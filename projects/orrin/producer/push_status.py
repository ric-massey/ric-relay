#!/usr/bin/env python3
"""ORRIN — the producer half of the status service (projects/orrin/server).

Reads Orrin's state files READ-ONLY and pushes one snapshot a minute to the
Worker, which the "IS ORRIN RUNNING?" region of orrin.html reads. It never
writes into Orrin, never imports his code, and never calls his backend: a
sidecar that only looks keeps a staging life's verdict able to say the
behaviour was his, and keeps his interior on this machine.

What it reads, and nothing else:
  heartbeat.json            alive (beat < 3 min old, not a clean shutdown), cycle
  runtime_lifetime.json     run identity (birth time) and life age
  run_log.txt (head/tail)   build sha, pulse
  resource_history.jsonl    rss
  smoothed_state.json       valence / energy / stability (numbers, never a mood word)
  energy_mode.json          mode
  production_loop.jsonl     the committed goal id -> its TITLE from goals_mem.json
  voice_transcript.jsonl    lines he said (his own utterances only — the voice
                            room keeps no `user_input`; we still send only text/kind)
Never: private_thoughts, chat_log, memory records, goal bodies, people.

    python3 push_status.py --dry-run      print the next snapshot, send nothing
    python3 push_status.py --once         push one snapshot and exit
    python3 push_status.py                push every 60 s until stopped

Config: ORRIN_DIR (default ~/orrin_v3), ORRIN_STATUS_URL (default the
orrin-status Worker), token from ORRIN_STATUS_TOKEN or ~/.config/orrin-status/token.
"""
from __future__ import annotations

import argparse
import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

URL = os.environ.get("ORRIN_STATUS_URL", "https://orrin-status.rmbuster82.workers.dev/status")
ORRIN = Path(os.environ.get("ORRIN_DIR") or Path.home() / "orrin_v3")
DATA = ORRIN / "brain" / "data"
CONF = Path.home() / ".config" / "orrin-status"
STATE = CONF / "state.json"
EVERY_S = 60
ALIVE_WITHIN_S = 180
SPEECH_PER_PUSH = 50


def _json(p: Path, default: Any = None) -> Any:
    try:
        return json.loads(p.read_text(encoding="utf-8", errors="replace"))
    except (OSError, ValueError):
        return default


def _tail_lines(p: Path, n_bytes: int = 65536) -> List[str]:
    try:
        with open(p, "rb") as fh:
            fh.seek(max(0, p.stat().st_size - n_bytes))
            return fh.read().decode("utf-8", errors="replace").splitlines()
    except OSError:
        return []


def _last_json(p: Path) -> Dict[str, Any]:
    for line in reversed(_tail_lines(p)):
        try:
            v = json.loads(line)
            if isinstance(v, dict):
                return v
        except ValueError:
            continue
    return {}


def _iso(ts: float) -> str:
    return datetime.fromtimestamp(ts, timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _goal_title(gid: str) -> Optional[str]:
    def walk(nodes):
        for n in nodes or []:
            if isinstance(n, dict):
                if str(n.get("id")) == gid:
                    return n.get("title") or n.get("name")
                hit = walk(n.get("subgoals"))
                if hit:
                    return hit
        return None
    data = _json(DATA / "goals_mem.json", [])
    return walk(data if isinstance(data, list) else (data or {}).get("goals"))


def _goals_active() -> int:
    terminal = {"completed", "done", "failed", "cancelled", "abandoned"}
    n = 0

    def walk(nodes):
        nonlocal n
        for g in nodes or []:
            if isinstance(g, dict):
                if str(g.get("status", "")).lower() not in terminal:
                    n += 1
                walk(g.get("subgoals"))
    data = _json(DATA / "goals_mem.json", [])
    walk(data if isinstance(data, list) else (data or {}).get("goals"))
    return n


def _build_sha() -> Optional[str]:
    try:
        with open(DATA / "run_log.txt", encoding="utf-8", errors="replace") as fh:
            for _ in range(40):
                line = fh.readline()
                if "build " in line and "launch #" in line:
                    return line.rsplit("build ", 1)[-1].strip(" )\n")[:24]
    except OSError:
        pass
    return None


def _pulse() -> Optional[int]:
    for line in reversed(_tail_lines(DATA / "run_log.txt")):
        if line.startswith("[main] pulse="):
            try:
                return int(line.split("pulse=", 1)[1].split()[0])
            except (IndexError, ValueError):
                return None
    return None


def snapshot(state: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    life = _json(DATA / "runtime_lifetime.json", {}) or {}
    started = life.get("start_time")
    if not started:
        return None                                   # no life rolled: nothing to report
    born = datetime.fromisoformat(started)
    run_id = "life-" + born.astimezone(timezone.utc).strftime("%Y%m%dT%H%MZ")
    beat = _json(DATA / "heartbeat.json", {}) or {}
    now = time.time()
    alive = (isinstance(beat.get("ts"), (int, float)) and now - beat["ts"] < ALIVE_WITHIN_S
             and not beat.get("clean_shutdown"))
    cycle = int((_json(DATA / "cycle_count.json", {}) or {}).get("count") or beat.get("cycle") or 0)

    snap: Dict[str, Any] = {
        "runId": run_id, "startedAt": born.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "alive": bool(alive), "cycle": cycle, "cyclesTotal": cycle,
        "lifeAgeS": max(0, int(now - born.timestamp())),
    }
    sha = _build_sha()
    if sha:
        snap["buildSha"] = sha
    pulse = _pulse()
    if pulse is not None:
        snap["pulse"] = pulse
    prev = state.get("last")
    if prev and prev.get("runId") == run_id and cycle > prev.get("cycle", 0):
        snap["secPerCycle"] = round((now - prev["at"]) / (cycle - prev["cycle"]), 2)
    rss = _last_json(DATA / "resource_history.jsonl").get("rss_mb")
    if isinstance(rss, (int, float)):
        snap["rssMb"] = round(float(rss), 1)
    affect = _json(DATA / "smoothed_state.json", {}) or {}
    for k in ("valence", "energy", "stability"):
        if isinstance(affect.get(k), (int, float)):
            snap[k] = round(float(affect[k]), 3)
    mode = (_json(DATA / "energy_mode.json", {}) or {}).get("mode")
    if isinstance(mode, str):
        snap["mode"] = mode[:32]
    gid = _last_json(DATA / "production_loop.jsonl").get("committed_goal_id")
    if gid:
        title = _goal_title(str(gid))
        if title:
            snap["goal"] = str(title)[:140]
    snap["goalsActive"] = _goals_active()

    # His own utterances since the last push (cursor = last pushed ts, per run).
    cursor = float(state.get("speech_ts", 0) if state.get("speech_run") == run_id else 0)
    lines = []
    for raw in _tail_lines(DATA / "voice_transcript.jsonl", 262144):
        try:
            r = json.loads(raw)
        except ValueError:
            continue
        ts, text = r.get("ts"), r.get("text")
        if isinstance(ts, (int, float)) and ts > cursor and isinstance(text, str) and text.strip():
            lines.append({"at": _iso(ts), "text": text.strip()[:600],
                          "kind": str(r.get("kind") or "")[:40], "_ts": ts})
    snap["speech"] = lines[-SPEECH_PER_PUSH:]
    return snap


def _token() -> str:
    tok = os.environ.get("ORRIN_STATUS_TOKEN", "")
    if not tok:
        try:
            tok = (CONF / "token").read_text(encoding="utf-8").strip()
        except OSError:
            tok = ""
    return tok


def _tls() -> ssl.SSLContext:
    """Verified TLS on any Python: python.org builds ship without root certs, so use
    certifi's bundle when installed, else the system bundle. Never unverified."""
    try:
        import certifi  # type: ignore
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        pass
    if Path("/etc/ssl/cert.pem").exists():
        return ssl.create_default_context(cafile="/etc/ssl/cert.pem")
    return ssl.create_default_context()


def push(snap: Dict[str, Any], token: str) -> Dict[str, Any]:
    body = dict(snap)
    body["speech"] = [{k: v for k, v in s.items() if k != "_ts"} for s in snap.get("speech", [])]
    req = urllib.request.Request(URL, data=json.dumps(body).encode("utf-8"), method="POST",
                                 headers={"content-type": "application/json",
                                          "authorization": f"Bearer {token}",
                                          # Cloudflare bans Python-urllib's default UA (error 1010).
                                          "user-agent": "orrin-status-producer/1"})
    with urllib.request.urlopen(req, timeout=20, context=_tls()) as r:
        return json.loads(r.read().decode("utf-8"))


def tick(state: Dict[str, Any], token: str, dry: bool) -> None:
    snap = snapshot(state)
    if snap is None:
        print("no life rolled yet — nothing to push", file=sys.stderr)
        return
    if dry:
        shown = dict(snap)
        shown["speech"] = [{k: v for k, v in s.items() if k != "_ts"} for s in snap["speech"]][-5:]
        print(json.dumps(shown, indent=2))
        return
    result = push(snap, token)
    if result.get("ok"):
        if snap["speech"]:
            state["speech_ts"] = snap["speech"][-1]["_ts"]
            state["speech_run"] = snap["runId"]
        state["last"] = {"runId": snap["runId"], "cycle": snap["cycle"], "at": time.time()}
        CONF.mkdir(parents=True, exist_ok=True)
        STATE.write_text(json.dumps(state), encoding="utf-8")
    print(f"{_iso(time.time())} pushed cycle {snap['cycle']} alive={snap['alive']} "
          f"said+{len(snap['speech'])} → {result}", flush=True)


def main() -> int:
    ap = argparse.ArgumentParser(description="Push Orrin's status to the site's Worker.")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--once", action="store_true")
    a = ap.parse_args()
    state = _json(STATE, {}) or {}
    token = _token()
    if not a.dry_run and not token:
        print("no token: set ORRIN_STATUS_TOKEN or write ~/.config/orrin-status/token", file=sys.stderr)
        return 2
    while True:
        try:
            tick(state, token, a.dry_run)
        except (urllib.error.URLError, OSError, ValueError) as exc:
            print(f"{_iso(time.time())} push failed: {exc}", file=sys.stderr, flush=True)
        if a.dry_run or a.once:
            return 0
        time.sleep(EVERY_S)


if __name__ == "__main__":
    sys.exit(main())

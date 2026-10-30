"""Getting a match to the Worker, including when the network says no.

A match read off the screen exists in exactly one place: this process's memory.
Apex keeps no history, so if the POST fails and the record is dropped, that
match is gone — not delayed, gone, permanently, in a way no amount of polling
an API later can recover.

So nothing is ever sent and forgotten. Every record is appended to a file on
disk first, and only removed from it once the Worker has actually said yes. A
dropped wifi, a Worker mid-deploy, a laptop lid closed between games: the queue
survives all of it and drains on the next send.

The Worker deduplicates, so a record sent twice is harmless. A record sent zero
times is not. Every choice in this file follows from that asymmetry.
"""

from __future__ import annotations

import json
import threading
import time
from pathlib import Path

import urllib.error
import urllib.request

TIMEOUT = 8
# A send that fails backs off, but never so far that a match sits unsent
# through a whole session waiting for a retry.
BACKOFF = [2, 5, 15, 60, 120]


class Spool:
    def __init__(self, base: str, token: str, path: Path, dry: bool = False):
        self.base = base.rstrip("/")
        self.token = token
        self.path = path
        self.dry = dry
        self.lock = threading.Lock()
        self.thread: threading.Thread | None = None

    # ── disk ─────────────────────────────────────────────────────────────────

    def append(self, record: dict) -> None:
        with self.lock:
            with self.path.open("a", encoding="utf-8") as fh:
                fh.write(json.dumps(record, separators=(",", ":")) + "\n")

    def pending(self) -> list[dict]:
        if not self.path.exists():
            return []
        out = []
        with self.lock:
            for line in self.path.read_text(encoding="utf-8").splitlines():
                if not line.strip():
                    continue
                try:
                    out.append(json.loads(line))
                except json.JSONDecodeError:
                    # A half-written line from a process killed mid-append.
                    # Skipping it loses at most the record being written when
                    # the machine died, and keeps the rest of the queue usable.
                    continue
        return out

    def rewrite(self, records: list[dict]) -> None:
        with self.lock:
            if not records:
                self.path.unlink(missing_ok=True)
                return
            tmp = self.path.with_suffix(".tmp")
            tmp.write_text(
                "".join(json.dumps(r, separators=(",", ":")) + "\n" for r in records),
                encoding="utf-8",
            )
            tmp.replace(self.path)

    # ── network ──────────────────────────────────────────────────────────────

    def send(self, record: dict) -> bool:
        """One attempt. True only if the Worker actually accepted it."""
        if self.dry:
            print(f"  [dry] {record['path']} {json.dumps(record['body'])[:160]}")
            return True

        req = urllib.request.Request(
            self.base + record["path"],
            data=json.dumps(record["body"]).encode("utf-8"),
            headers={
                "content-type": "application/json",
                "authorization": "Bearer " + self.token,
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
                return 200 <= resp.status < 300
        except urllib.error.HTTPError as exc:
            if exc.code in (400, 401, 403, 404):
                # The Worker understood and refused. Retrying an unauthorized
                # or malformed record forever would mean every later match
                # queued behind one that can never go — so it is dropped, and
                # said out loud, which is the only way anyone finds out the
                # token is wrong.
                print(f"  ! {exc.code} on {record['path']} — dropped: {exc.read()[:200]!r}")
                return True
            print(f"  ! {exc.code} on {record['path']} — will retry")
            return False
        except Exception as exc:               # noqa: BLE001 - offline, DNS, timeout
            print(f"  ! {type(exc).__name__} on {record['path']} — will retry")
            return False

    def drain(self) -> None:
        """Try everything on disk, keep what would not go."""
        records = self.pending()
        if not records:
            return
        kept = []
        for i, record in enumerate(records):
            if self.send(record):
                continue
            kept.extend(records[i:])
            break
        self.rewrite(kept)
        if kept:
            print(f"  {len(kept)} still queued")

    def _worker(self) -> None:
        for wait in BACKOFF:
            self.drain()
            if not self.pending():
                return
            time.sleep(wait)
        # Out of backoff and still queued. Left on disk deliberately: the next
        # post of any kind drains it, and so does the next run of the watcher.
        # Nothing is lost, it just waits.

    def post(self, path: str, body: dict) -> None:
        """Queue a record and start it on its way.

        Returns immediately. The send happens on a background thread so a slow
        network cannot stall the capture loop and make the watcher miss the
        screen it is currently reading.
        """
        self.append({"path": path, "body": body, "queued": time.time()})
        if self.thread and self.thread.is_alive():
            return
        self.thread = threading.Thread(target=self._worker, daemon=True)
        self.thread.start()

    def flush(self) -> None:
        """Block until the queue is empty or clearly will not go. For shutdown."""
        for wait in (0, 1, 3):
            time.sleep(wait)
            self.drain()
            if not self.pending():
                return
        print(f"  {len(self.pending())} records left in {self.path.name} — they will go next run")

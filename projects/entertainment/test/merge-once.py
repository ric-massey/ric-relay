"""The Python half of write-path.mjs.

Runs the real stage_sync from pull-entertainment.py over a fixture list of
rows and whatever the Worker is holding, and prints the result as JSON for the
node side to check. Nothing is read from or written to entertainment-data.js:
the point is to exercise the merge, not to touch the file it normally writes.

    python3 projects/entertainment/test/merge-once.py <items.json>

Not meant to be run by hand — node projects/entertainment/test/write-path.mjs
is the test.
"""

import contextlib
import importlib.util
import io
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]

spec = importlib.util.spec_from_file_location(
    "pull", ROOT / "projects" / "entertainment" / "pull-entertainment.py")
pull = importlib.util.module_from_spec(spec)
sys.modules["pull"] = pull
spec.loader.exec_module(pull)

items = json.loads(Path(sys.argv[1]).read_text())

# The Worker, without the Worker. stage_sync only ever asks one question.
pull.get_json = lambda url: items

# A stand-in for the committed file: a row the service has never heard of
# (every one of the real 363 is this), and one that is about to be removed.
rows = [
    {"id": "heat", "title": "Heat", "status": "watchlist",
     "where": "Buy", "year": 1995, "tmdb": 949, "genres": ["Crime"]},
    {"id": "tag", "title": "Tag", "status": "watched", "year": 2018},
]


class Args:
    dry_run = True          # stage_sync must not try to write the real file
    only = None


# stage_sync narrates what it is doing; that narration is not the answer.
noise = io.StringIO()
with contextlib.redirect_stdout(noise):
    pull.stage_sync(rows, "", Args())

print(json.dumps({"rows": rows, "said": noise.getvalue()}))

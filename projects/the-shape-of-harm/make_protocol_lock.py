from pathlib import Path
import hashlib,json
ROOT=Path(__file__).resolve().parent
old=json.loads((ROOT/"protocol-lock.json").read_text())
for row in old["files"]:
    b=(ROOT/row["path"]).read_bytes(); row["sha256"]=hashlib.sha256(b).hexdigest(); row["bytes"]=len(b)
(ROOT/"protocol-lock.json").write_text(json.dumps(old,indent=2)+"\n")
print(f"updated {len(old['files'])} locked files")

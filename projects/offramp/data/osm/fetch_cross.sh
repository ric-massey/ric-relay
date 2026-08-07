#!/bin/bash
# Cross streets by NODE ID, not by radius: a radius query at this latitude
# would drag in every residential street within 400 m of 2,551 miles of
# Interstate. `way(bn.n)` needs a node SET — `way(bn:<literal ids>)` is not
# valid Overpass and silently returns nothing, which looked like "there are
# no cross streets" for a while.
set -u
n=$(python3 -c "import json;ids=json.load(open('crossnodes.json'));print((len(ids)+119)//120)")
for ((k=0;k<n;k++)); do
  for try in 1 2 3 4; do
    printf "batch %d try %d  " "$k" "$try"
    code=$(curl -s --max-time 300 -X POST -d @/tmp/cross_$k.ql \
      https://overpass-api.de/api/interpreter -o "cross/$k.json" -w "%{http_code}")
    sz=$(stat -f%z "cross/$k.json"); echo "http $code  $sz B"
    [ "$code" = "200" ] && [ "$sz" -gt 400 ] && break
    sleep $((try * 35))
  done
  sleep 15
done
echo "--- done ---"; du -sh cross

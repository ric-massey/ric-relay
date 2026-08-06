#!/bin/bash
# Ramps, rest areas and truck stops, tied to I-40 itself via `around`
# rather than by bounding box -- a box at this latitude would drag in
# every ramp in Los Angeles, Memphis and Raleigh along with them.
set -u
mkdir -p ramps
slices=(
  "CA_AZ -117.3 -112.0" "AZ_NM -112.0 -107.0" "NM -107.0 -102.0" "TX_OK -102.0 -97.0"
  "OK_AR  -97.0  -92.0" "AR_TN  -92.0  -87.0" "TN_E -87.0 -82.0" "NC -82.0 -77.5"
)
for s in "${slices[@]}"; do
  set -- $s; name=$1; w=$2; e=$3
  [ -s "ramps/$name.json" ] && python3 -c "import json;json.load(open('ramps/$name.json'))" 2>/dev/null && { echo "$name ok"; continue; }
  cat > /tmp/r_$name.ql <<Q
[out:json][timeout:600];
way["highway"="motorway"]["ref"~"(^|;)I 40(;|\$)"](33.8,$w,37.0,$e)->.w;
(
  way(around.w:250)["highway"="motorway_link"];
  way(around.w:2500)["highway"~"^(rest_area|services)\$"];
  node(around.w:2500)["highway"~"^(rest_area|services)\$"];
);
out geom;
Q
  for try in 1 2 3 4 5 6; do
    printf "%-7s try %d  " "$name" "$try"
    code=$(curl -s --max-time 600 -X POST -d @/tmp/r_$name.ql \
      https://overpass-api.de/api/interpreter -o "ramps/$name.json" -w "%{http_code}")
    sz=$(stat -f%z "ramps/$name.json"); echo "http $code  $sz B"
    [ "$code" = "200" ] && [ "$sz" -gt 5000 ] && break
    sleep $((try * 40))
  done
  sleep 30
done
echo "--- done ---"; du -sh ramps

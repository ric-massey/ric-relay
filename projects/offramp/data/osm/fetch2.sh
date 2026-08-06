#!/bin/bash
# Corrected ref match: OSM writes concurrencies as "I 24;I 40" with no
# space, so requiring "; " dropped every section where I-40 was not the
# first ref -- which is most of Nashville and Knoxville.
set -u
mkdir -p v2
slices=(
  "CA_AZ -117.3 -112.0" "AZ_NM -112.0 -107.0" "NM -107.0 -102.0" "TX_OK -102.0 -97.0"
  "OK_AR  -97.0  -92.0" "AR_TN  -92.0  -87.0" "TN_E -87.0 -82.0" "NC -82.0 -77.5"
)
for s in "${slices[@]}"; do
  set -- $s; name=$1; w=$2; e=$3
  [ -s "v2/$name.json" ] && python3 -c "import json;json.load(open('v2/$name.json'))" 2>/dev/null && { echo "$name ok already"; continue; }
  cat > /tmp/v2_$name.ql <<Q
[out:json][timeout:600];
way["highway"="motorway"]["ref"~"(^|;)I 40(;|\$)"](33.8,$w,37.0,$e)->.w;
(.w; node(w)["highway"="motorway_junction"];);
out geom;
Q
  for try in 1 2 3 4 5; do
    printf "%-7s try %d  " "$name" "$try"
    code=$(curl -s --max-time 600 -X POST -d @/tmp/v2_$name.ql \
      https://overpass-api.de/api/interpreter -o "v2/$name.json" -w "%{http_code}")
    sz=$(stat -f%z "v2/$name.json")
    echo "http $code  $sz B"
    if [ "$code" = "200" ] && [ "$sz" -gt 5000 ]; then break; fi
    sleep $((try * 45))
  done
  sleep 25
done
echo "--- done ---"; ls -l v2/ | awk '{print $9,$5}'

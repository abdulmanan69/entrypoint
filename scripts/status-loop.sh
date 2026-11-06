#!/bin/sh
# Runs inside the nginx container (from /docker-entrypoint.d). Every 30 s it checks each tool
# listed in /etc/entrypoint/tools.txt and writes status.json, which the page reads.
# Any HTTP answer below 500 counts as up; a timeout, refused connection or 5xx counts as down.
LIST=/etc/entrypoint/tools.txt
OUT=/usr/share/nginx/html/status.json
INTERVAL="${STATUS_INTERVAL:-30}"

check_all() {
  body=""
  while read -r url; do
    [ -z "$url" ] && continue
    r=$(curl -s -o /dev/null -m 8 -A 'vertex-entrypoint-status' -w '%{http_code} %{time_total}' "$url/")
    code=$(awk -v c="${r%% *}" 'BEGIN { printf "%d", c }')
    ms=$(awk -v t="${r##* }" 'BEGIN { printf "%d", t * 1000 }')
    up=false
    if [ "$code" -ge 200 ] 2>/dev/null && [ "$code" -lt 500 ]; then up=true; fi
    body="$body${body:+,}\"$url\":{\"up\":$up,\"ms\":$ms,\"code\":$code}"
  done < "$LIST"
  printf '{"checkedAt":"%s","tools":{%s}}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$body" > "$OUT.tmp" && mv "$OUT.tmp" "$OUT"
}

(
  while true; do
    check_all
    sleep "$INTERVAL"
  done
) &

#!/bin/bash
TAG="${1:?版本号}"
TOKEN="b0fb3ae43f3803fd33c5ca720d239fb4"
API="https://gitee.com/api/v5/repos/Doylesama007/Snode-rpg/releases"
echo "=== $TAG ==="

RESP=$(curl -s "$API?access_token=$TOKEN&per_page=50")
REL_ID=$(echo "$RESP" | tr '{' '\n' | grep "\"tag_name\":\"$TAG\"" | grep -o '"id":[0-9]*' | head -1 | sed 's/[^0-9]//g')

if [ -z "$REL_ID" ]; then
  echo "Creating..."
  RESP=$(curl -s -X POST "$API" -H "Content-Type: application/json" \
    -d "{\"tag_name\":\"$TAG\",\"name\":\"$TAG\",\"target_commitish\":\"master\",\"body\":\"Auto sync\",\"prerelease\":false,\"access_token\":\"$TOKEN\"}")
  REL_ID=$(echo "$RESP" | grep -o '"id":[0-9]*' | head -1 | sed 's/[^0-9]//g')
fi

[ -z "$REL_ID" ] && { echo "FAIL"; exit 1; }
echo "ID=$REL_ID"

V="${TAG#v}"
EXE="Snode-RPG-Setup-${V}.exe"
[ ! -f "$EXE" ] && { echo "Downloading..."; curl -L -o "$EXE" "https://github.com/Doylesama114/Snode-rpg/releases/download/$TAG/$EXE"; }

echo "Uploading..."
curl -f --max-time 900 -X POST "$API/$REL_ID/attach_files" -F "access_token=$TOKEN" -F "file=@$EXE" || { echo "TIMEOUT"; exit 1; }
echo "DONE"

#!/usr/bin/env bash
set -euo pipefail

HOST="${SMLBOT_HOST:-smlsoft@192.168.2.88}"
DIR="${SMLBOT_DIR:-smlbot/console}"

echo ">>> กำลัง Deploy SML Bot ไปยัง $HOST:$DIR..."

tar -czf - --exclude=node_modules --exclude=.next --exclude=.git --exclude=data . | \
  ssh -o BatchMode=yes "$HOST" "mkdir -p $DIR && tar -xzf - -C $DIR && cd $DIR && docker compose up -d --build && docker compose ps"

echo ">>> [สำเร็จ] เปิดใช้งาน SML Bot ได้ที่ http://192.168.2.88:3400"

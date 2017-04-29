#!/bin/sh

while true; do
  node pool.js | node_modules/bunyan/bin/bunyan
  echo "[$(date)] Pool process crashed, backing off five seconds and restarting..."
  sleep 5
done

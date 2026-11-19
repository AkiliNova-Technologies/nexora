#!/bin/sh
set -eu
store_path=${BRIDGE_STORE_PATH:-/data/bridge.sqlite}
store_dir=$(dirname "$store_path")
install -d -m 0700 -o bridge -g bridge "$store_dir"
exec gosu bridge node dist/main.js

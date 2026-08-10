#!/usr/bin/env sh
set -eu

git pull --ff-only

sh scripts/write-version.sh

podman build --target test --tag awesome-bot:test .
podman run --rm awesome-bot:test

podman compose build
podman compose run --rm bot npm run deploy:commands
podman compose up -d
podman image prune -f

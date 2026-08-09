#!/usr/bin/env sh
set -eu

git pull --ff-only

npm ci
npm run check
npm run write:version

podman compose build
podman compose run --rm bot npm run deploy:commands
podman compose up -d
podman image prune -f

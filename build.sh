#!/usr/bin/env sh
set -eu

image="localhost/awesome-bot:latest"
test_image="localhost/awesome-bot:test"
container="awesome-bot"

git pull --ff-only

sh scripts/write-version.sh

podman build --target test --tag "$test_image" .
podman run --rm "$test_image"

podman build --tag "$image" .
podman run --rm --env-file .env -e DATABASE_PATH=data/bot.sqlite "$image" npm run deploy:commands
mkdir -p data
podman run \
  --detach \
  --replace \
  --name "$container" \
  --restart unless-stopped \
  --env-file .env \
  -e DATABASE_PATH=data/bot.sqlite \
  -v "$(pwd)/data:/app/data:Z,U" \
  "$image"
podman image prune -f

#!/usr/bin/env sh
set -eu

version_path="src/version.json"

repository_from_remote() {
  remote_url=$1

  case "$remote_url" in
    git@github.com:*) repository=${remote_url#git@github.com:} ;;
    https://github.com/*) repository=${remote_url#https://github.com/} ;;
    http://github.com/*) repository=${remote_url#http://github.com/} ;;
    ssh://git@github.com/*) repository=${remote_url#ssh://git@github.com/} ;;
    *) repository= ;;
  esac

  repository=${repository%.git}
  printf '%s' "$repository"
}

commit=$(git rev-parse --short HEAD)
commit_full=$(git rev-parse HEAD)
branch=$(git branch --show-current)
remote_url=$(git remote get-url origin)
repository=$(repository_from_remote "$remote_url")
built_at=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

mkdir -p src

if [ -n "$repository" ]; then
  repository_json="\"$repository\""
else
  repository_json=null
fi

printf '{\n  "commit": "%s",\n  "commitFull": "%s",\n  "branch": "%s",\n  "repository": %s,\n  "builtAt": "%s"\n}\n' \
  "$commit" \
  "$commit_full" \
  "$branch" \
  "$repository_json" \
  "$built_at" \
  > "$version_path"

printf 'Wrote %s for %s@%s\n' "$version_path" "${repository:-unknown repository}" "$commit"

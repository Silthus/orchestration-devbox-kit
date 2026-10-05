#!/bin/sh
set -eu
mode=${1:-plan}
case "$mode" in plan|install) ;; *) echo 'Usage: install.sh [plan|install]' >&2; exit 2 ;; esac
root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
conflicts=0
link() {
  target="$HOME/$1"
  parent=$(dirname "$target")
  while [ "$parent" != "$HOME" ]; do
    if [ -L "$parent" ] || { [ -e "$parent" ] && [ ! -d "$parent" ]; }; then
      echo "conflict: $1 (linked or non-directory parent)"
      conflicts=$((conflicts + 1))
      return
    fi
    parent=$(dirname "$parent")
  done
  if [ -L "$target" ] && [ "$(readlink "$target")" = "$2" ]; then
    echo "current: $1"
  elif [ -e "$target" ] || [ -L "$target" ]; then
    echo "conflict: $1 (kept existing item)"
    conflicts=$((conflicts + 1))
  else
    echo "link: $1 -> $2"
    if [ "$mode" = install ]; then
      mkdir -p "$(dirname "$target")"
      ln -s "$2" "$target"
    fi
  fi
}
link .claude/rules/orchestration.md "$root/home/.agents/AGENTS.md"
link .agents/AGENTS.md "$root/home/.agents/AGENTS.md"
for skill in "$root"/home/.agents/skills/*/; do
  skill=${skill%/}
  name=$(basename "$skill")
  link ".agents/skills/$name" "$skill"
  link ".claude/skills/$name" "$skill"
done
[ "$conflicts" = 0 ] || { echo 'Resolve the listed conflicts, then run this command again.' >&2; exit 1; }

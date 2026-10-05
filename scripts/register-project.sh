#!/bin/sh
set -eu
project=${1:?Project path is required}
if output=$(t3 project add "$project" --title design-project 2>&1); then
  printf '%s\n' "$output"
else
  case "$output" in
    *"An active project already exists for '$project'."*) echo "T3 project is already registered: $project" ;;
    *) printf '%s\n' "$output" >&2; exit 1 ;;
  esac
fi

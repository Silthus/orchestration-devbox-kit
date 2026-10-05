#!/bin/sh
set -eu
[ "$(uname -s)" = Linux ] || exit 0
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd -P)
source_file="$root/home/.config/fleet/linux-session.sh"
target="$HOME/.config/fleet/linux-session.sh"
line='. "$HOME/.config/fleet/linux-session.sh"'
for path in "$HOME/.config" "$HOME/.config/fleet"; do
  [ ! -L "$path" ] || { echo "Fleet Linux session: keep linked path $path" >&2; exit 1; }
done
if [ -e "$target" ] || [ -L "$target" ]; then
  [ -L "$target" ] && [ "$(readlink "$target")" = "$source_file" ] || {
    echo "Fleet Linux session: keep local file $target" >&2
    exit 1
  }
fi
for file in .bashrc .profile .bash_profile .bash_login; do
  path="$HOME/$file"
  [ ! -L "$path" ] && { [ ! -e "$path" ] || [ -f "$path" ]; } || {
    echo "Fleet Linux session: keep non-regular file $path" >&2
    exit 1
  }
done
mkdir -p "$(dirname "$target")"
[ -L "$target" ] || ln -s "$source_file" "$target"
for file in .bashrc .profile .bash_profile .bash_login; do
  path="$HOME/$file"
  case "$file" in .bash_profile|.bash_login) [ -f "$path" ] || continue ;; esac
  if ! grep -qxF "$line" "$path" 2>/dev/null; then
    temporary=$(mktemp "$HOME/.fleet-session.XXXXXX")
    trap 'rm -f "$temporary"' EXIT HUP INT TERM
    if [ -f "$path" ]; then cp -p "$path" "$temporary"; fi
    printf '%s\n' "$line" > "$temporary"
    if [ -f "$path" ]; then cat "$path" >> "$temporary"; fi
    mv "$temporary" "$path"
  fi
done
echo 'Fleet Linux session: Coder shells can reach the systemd user manager.'

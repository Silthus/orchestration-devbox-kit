#!/bin/sh
# Install a pinned Bun into ~/.bun/bin on Linux when no Bun is on PATH.
# Fleet and several skills run Bun scripts. On a Mac, ./fleet installs Bun with Homebrew.
set -eu

version=1.4.2
fail() { echo "Bun: $*" >&2; exit 1; }
PATH="$HOME/.bun/bin:$PATH"
# Ubuntu login shells put ~/.local/bin on PATH. Link there too, but keep any existing file.
link_bin() {
  mkdir -p "$HOME/.local/bin"
  for name in bun bunx; do
    [ -e "$HOME/.local/bin/$name" ] || [ -L "$HOME/.local/bin/$name" ] || ln -s "$HOME/.bun/bin/$name" "$HOME/.local/bin/$name"
  done
}
if command -v bun >/dev/null 2>&1; then
  if [ -x "$HOME/.bun/bin/bun" ]; then link_bin; fi
  exit 0
fi

# Checksums come from SHASUMS256.txt of the bun-v$version release.
case "$(uname -m)" in
  aarch64|arm64)
    target=linux-aarch64
    sum=54328bbc2d9c8e0c9f892c544d66c57a83b84139e34909e5ee81758f1ac8fda7 ;;
  x86_64|amd64)
    target=linux-x64
    sum=36368faef7527875d5ffa52e53cd48021741f2a83eb6208a8dd64068d422a913 ;;
  *) fail "no pinned build for $(uname -m). Install Bun from https://bun.sh." ;;
esac
for command_name in curl sha256sum python3; do
  command -v "$command_name" >/dev/null 2>&1 || fail "install $command_name first."
done

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT HUP INT TERM
curl -fsSL "https://github.com/oven-sh/bun/releases/download/bun-v$version/bun-$target.zip" -o "$work/bun.zip"
echo "$sum  $work/bun.zip" | sha256sum -c --status - || fail "checksum mismatch for bun-$target.zip."
# Python reads the archive, so the host needs no unzip.
python3 -c 'import sys, zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])' "$work/bun.zip" "$work"
mkdir -p "$HOME/.bun/bin"
install -m 755 "$work/bun-$target/bun" "$HOME/.bun/bin/bun"
ln -sf bun "$HOME/.bun/bin/bunx"
"$HOME/.bun/bin/bun" --version >/dev/null || fail 'the installed binary does not start.'
link_bin
echo "Bun: installed $version in ~/.bun/bin."

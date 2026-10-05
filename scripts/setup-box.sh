#!/bin/bash
set -euo pipefail
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd -P)
export PATH="$HOME/.local/bin:$HOME/.bun/bin:$PATH"
export XDG_RUNTIME_DIR="/run/user/$(id -u)"
export DBUS_SESSION_BUS_ADDRESS="unix:path=$XDG_RUNTIME_DIR/bus"
case "${1:-}" in
  prepare)
    sh "$root/install.sh" install
    sh "$root/scripts/install-bun.sh"
    sh "$root/scripts/setup-linux-session.sh"
    if ! command -v tailscale >/dev/null; then
      . /etc/os-release
      [ "$ID" = ubuntu ] || { echo 'Install Tailscale from https://tailscale.com/docs/install/linux, then rerun.' >&2; exit 1; }
      work=$(mktemp -d)
      trap 'rm -rf "$work"' EXIT
      curl -fsSL "https://pkgs.tailscale.com/stable/ubuntu/$VERSION_CODENAME.noarmor.gpg" -o "$work/key"
      curl -fsSL "https://pkgs.tailscale.com/stable/ubuntu/$VERSION_CODENAME.tailscale-keyring.list" -o "$work/list"
      for target in /usr/share/keyrings/tailscale-archive-keyring.gpg /etc/apt/sources.list.d/tailscale.list; do
        [ ! -e "$target" ] && [ ! -L "$target" ] || { echo "Keep existing $target. Install tailscale with apt, then rerun." >&2; exit 1; }
      done
      sudo -n install -m 644 "$work/key" /usr/share/keyrings/tailscale-archive-keyring.gpg
      sudo -n install -m 644 "$work/list" /etc/apt/sources.list.d/tailscale.list
      sudo -n apt-get update
      sudo -n apt-get install -y tailscale
    fi
    sudo -n systemctl enable --now tailscaled
    sh "$root/scripts/tailscale-routes.sh" install
    ;;
  finish)
    repo_url=${2:?Repository URL is required}
    case "$repo_url" in https://github.com/*/*|git@github.com:*/*) ;; *) echo 'Use a GitHub HTTPS or SSH clone URL.' >&2; exit 2 ;; esac
    project="$HOME/dev/design-project"
    if [ -e "$project" ] || [ -L "$project" ]; then
      [ -d "$project/.git" ] && [ "$(git -C "$project" remote get-url origin)" = "$repo_url" ] || { echo "Keep existing $project. Its origin must match the chosen repository." >&2; exit 1; }
    else
      mkdir -p "$HOME/dev"
      git clone -- "$repo_url" "$project"
    fi
    sh "$root/scripts/t3-headless.sh" install
    sh "$root/scripts/register-project.sh" "$project"
    service_path=$(systemctl --user show t3code.service --property=Environment --value | python3 -c 'import shlex,sys; env=dict(item.split("=",1) for item in shlex.split(sys.stdin.read()) if "=" in item); print(env["PATH"])')
    claude_path=$(PATH="$service_path" command -v claude) || { echo 'Claude is not on the T3 service PATH.' >&2; exit 1; }
    systemd-run --user --wait --pipe --collect --service-type=exec \
      --property="WorkingDirectory=$project" \
      --setenv="PATH=$service_path" \
      "$claude_path" -p --model claude-opus-5-5 --tools '' \
      'Reply with exactly: Claude is ready on this devbox.'
    sh "$root/scripts/t3-headless.sh" doctor
    ;;
  *) echo 'Usage: setup-box.sh prepare|finish <repository-url>' >&2; exit 2 ;;
esac

# Orchestration devbox kit

Try a durable wayfinder map for a large design or rewrite, with bounded
research and design sessions on your own PostHog Coder devbox. This kit
includes 31 planning and orchestration skills, a setup wizard, and a prompt
for your first design session. It needs one Claude login on the box.

## Download and run

This repository and its archive are public. Downloading needs no GitHub login.
Run these commands on your workstation:

```sh
git clone https://github.com/Silthus/orchestration-devbox-kit.git
cd orchestration-devbox-kit
bash setup.sh
```

Or [download the packaged kit](https://github.com/Silthus/orchestration-devbox-kit/releases/latest/download/orchestration-kit.tar.gz),
extract it, and run `bash orchestration-kit/setup.sh`.

Your PostHog Coder access, project GitHub access, Tailscale connection, and
Claude sign-in are still required to use the devbox. The wizard keeps those
credentials outside this repository and preserves existing settings.

Run `bash setup.sh` on your workstation. The wizard creates or resumes your
own PostHog Coder box, installs the planning skills and T3 service, and pairs
the box with T3 on your workstation. Sign in to Claude once on the box.

## Before you start

- Connect your workstation to the PostHog Tailscale network.
- Have a PostHog checkout with Flox installed. `flox activate -- ./bin/hogli
  --help` must work from that checkout.
- Install the T3 desktop app from <https://t3.codes>.
- Use your own Coder login and a GitHub account with access to your project.
  The box uses your existing Git credentials and identity. If HTTPS cloning
  needs authentication, run `gh auth login` on the box before rerunning.
- Have a separate GitHub repository for design issues, preferably a private
  repository you own, with Issues enabled. The wizard asks for `owner/repo`
  separately from the code clone URL. Orchestration can create many issues.
  It rejects `PostHog/posthog` as the issue destination so the public project
  is not flooded with planning tickets.

The wizard saves non-secret choices in
`~/.config/orchestration-kit/setup.env`. Coder and Claude store their own
credentials. Pairing links appear only in your terminal. Do not paste them
into chat or commit them.

The selected issue repository is saved as `ISSUE_REPO` and recorded in the
code checkout's `docs/agents/issue-tracker.md`. A Claude rule also records
the destination for every worktree of that code repository. Issue commands
use an explicit repository; pull requests still belong to the code repo.
Setup creates no issues and preserves an existing tracker configuration.

## What gets installed

The archive contains Fleet's wayfinder and orchestration skills, their
referenced skills and supporting scripts, and upstream provenance and
licenses. `provenance/skills.json` records the source snapshots and portable
patches. The orchestration shipping rule permits an independent Claude
review for this pilot. Project review requirements still take precedence.

The installer previews the links, preserves existing files and linked parent
directories, and stops on conflicts. It installs shared skills in
`~/.agents/skills` and `~/.claude/skills`, plus neutral agent instructions.
It does not change Git identity or Claude provider settings. Fleet's hub
access, machine inventory, proxy setup, personal account instructions, and
worktree cleanup are excluded.

The box gets Bun, T3 nightly, the T3 user service with systemd lingering,
private Tailscale HTTPS, and Fleet's Coder subnet-route guard. The Fleet T3
installer also installs the Codex binary. You can ignore its sign-in reminder
and use only Claude. No proxy or second provider login is required.

The Linux session helper links `~/.config/fleet/linux-session.sh` to this
kit and adds a source line to `.bashrc`, `.profile`, and existing Bash login
files. The route guard adds a marked block to your user crontab. Both keep
the other contents of those files.

The kit stays at `~/dev/orchestration-kit` on the box. Your project lives in
`~/dev/design-project`. The template owns `~/posthog`, so this kit uses a
separate project clone. Rerunning the same kit preserves both. To update to
a different kit, inspect and move the old directory and its managed links
first. The wizard refuses to overwrite it.

## Try a design session

After pairing, select the remote environment, open `design-project`, and
start a Claude thread. Paste this prompt and attach or name your goal doc:

```text
Use wayfinder to chart a system rewrite from my goal document. The destination
is a first design draft I can review, with each requirement traced to a
decision, assumptions called out, alternatives compared, and open questions
listed. Implementation is out of scope.

First read the project instructions and configure the tracker with
setup-matt-pocock-skills only if none is configured. Use the issue repository
selected in the wizard. Never create these design tickets in PostHog/posthog.
Use the selected shared issue tracker for a parallel map. Switch to local
Markdown only if I ask for a private trial with one ticket session at a time.
Ask me the decisions only I can make. Do independent
research in native subagents using the available Claude models.

Then use orchestration-wayfinder to work through the map. Use bounded worker
sessions and its required deadline mechanism. If the runtime cannot enforce
a deadline, record that limitation and resolve one ticket per session with
me instead. Record decisions, evidence, and unresolved questions durably
before ending a turn. An interruption should resume from the map.
```

A persistent devbox removes the desktop session time limit. It does not
guarantee that an agent can solve a design without your decisions, or that
an individual provider run will never stop. The durable map is the recovery
point. Commit or back up its files before destroying the workspace.

## Keep the box running

The wizard offers to turn off Coder's automatic stop and add a daily start.
This incurs compute cost while the workspace runs. Template policies still
apply. Check `~/.hogli/bin/coder schedule show <workspace>` after setup.
If you keep the default stop schedule, long runs can stop with the box.

Stop it when you are done with `hogli devbox:stop <label>`. This keeps the
disk. Destroying the box can remove projects, login state, and T3 sessions.
The kit does not schedule agent or T3 updates during a design run.

## Verify or recover

On the box, run:

```sh
cd ~/dev/orchestration-kit
sh install.sh plan
sh scripts/t3-headless.sh doctor
t3 service status
claude auth status
```

The wizard checks Claude from a systemd user service, so an authenticated SSH
shell alone cannot make setup pass. After pairing, start a short Claude
thread in T3 and ask it to print the hostname and working directory. Confirm
that the reply names your box and `~/dev/design-project`.

If the pairing address is unreachable, the workstation and box must be on
the same tailnet and its policy must allow TCP port 60001. Resolve that policy
with your administrator. The wizard does not change ACLs or enable public
access. A new pairing link can be generated on the box with
`t3 pair --tailscale --tailscale-serve-port 60001`.

## Remove the kit

Remove only the links that `sh install.sh plan` reports as `current`.
If you also remove `~/.claude/rules/orchestration-issues.md`, first verify
that it records this project's selected issue repository. Keep or remove
the project's tracker document according to your project's instructions.
Before removing the kit directory:

1. Check `readlink ~/.config/fleet/linux-session.sh`. If it points into this
   kit, remove the exact line `. "$HOME/.config/fleet/linux-session.sh"`
   from `.bashrc`, `.profile`, and any `.bash_profile` or `.bash_login`, then
   remove that link. Preserve all other shell setup.
2. Run `crontab -e`. Remove only the block between `# BEGIN FLEET TAILSCALE
   ROUTES` and `# END FLEET TAILSCALE ROUTES` when its command points into
   `~/dev/orchestration-kit`. Preserve other cron entries.
3. Remove `~/dev/orchestration-kit`. Keep your project and credentials.

To remove the dedicated T3 host setup, see `scripts/t3-headless.sh plan` for
the managed paths, then remove its selection marker, run `t3 service
uninstall`, and turn off its Tailscale Serve route. Leave other T3 hosts and
tailnet routes alone.

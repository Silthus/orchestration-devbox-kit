# Hand off to another machine

Use this when the user requests a move to another machine.

1. Ask for the target's existing SSH alias when it is not known. The user
   owns the target and its access. This kit has no shared machine inventory.
2. Save and push the current work according to the project's instructions.
   Record local files and services that Git does not carry. Preserve secrets
   on their current host.
3. Write the handoff document as `SKILL.md` describes, with links to durable
   decisions and the exact next action.
4. On a target with this kit and T3 already configured, dry-run the move with
   `bun ~/.agents/skills/t3-kickoff/scripts/kickoff.ts handoff --to <alias>
   --prompt-file <doc> --dry-run`. Then run without `--dry-run`.
5. Report the target and new thread after the command confirms it started.
   End the source turn so its archiving can complete.

If the target has no SSH access or T3 service, record the missing setup and
keep the current thread. A handoff document can still start a fresh session
on this same box.

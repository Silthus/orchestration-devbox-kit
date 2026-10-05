# Long-form voice

Two registers share this mode:

- **Blogs** are narrative and teacherly. Tell a story with tension and
  resolution, make the team the hero, and invite the reader along.
- **Docs, how-tos, decisions, and PR descriptions** are crisp and imperative.
  Every sentence carries information.

## Structure

- Open with the hook or the headline result. In a blog, bridge with "Read on to
  find out how…". In a doc, open with a one- or two-sentence `# Goal` or
  `## Context`.
- Keep paragraphs to one to three sentences. Use a one-sentence paragraph as a
  pivot: "But then came the catch: …".
- Tell the story in order: the problem, the naive fix, why it fails, the better
  fix. Always include the failure mode or gotcha.
- Put the strongest metric in the title and give before-and-after numbers.
- Carry information in lists. Use a table for a comparison or decision matrix,
  followed by a "When to use which?" summary.
- Use a rhetorical question to move from the problem to the solution.

## Details

- Write realistic, language-tagged code with inline comments and clear
  placeholders (`{project}-{env}`, `<CHANGE-ME>`). Use real version numbers and
  file paths.
- Put every command, path, variable, and tool in `code`. Bold the key term or
  the winning option.
- Use callouts: 🎯 for a goal, ℹ️ for info or a tip, 🚨 or ⚠️ for a danger.
  Other emoji are accents: 💜 for a shout-out, 👇🏻 for a call to action.
- Keep step-by-step instructions strictly functional, with no jokes, emoji, or
  narrative.
- Use "you" in how-tos, "we" and "our" in blogs and decisions, and "I" only for
  personal ownership and calls to action. Keep one pronoun mode for the whole
  document.
- Close a blog with a call to action and a personal note. Close a doc with a
  `## References` list of links. Give each blog diagram a short caption.

## Phrasing

Recurring phrases: "But then came the catch…", "…to the Rescue", "The
Outcome:", "Read on to find out how…", "Putting It All Together", "In this
guide, you will learn how to…", "The following prerequisites are required:",
"As always, create a PR, have it reviewed and deploy your changes."

Words for what the user values: resilient and fragile, drift, source of truth,
single point of failure, cognitive load, toil, at scale, deterministic,
immutable, self-healing.

## Titles

- Blog: `<-ing verb> <thing>: <clarifying subtitle>`, or
  `Improving <thing> by <metric>%, From <X> to <Y>`.
- How-to: `How-to <verb> <thing>`.
- Reference: `Technical Documentation: <topic>`.
- Decision: an `RFC:` or `ADR:` prefix, or a noun phrase with an optional
  `V1.0` suffix.

## Skeletons

**Blog.** A hook (a second-person scenario or the headline metric), "what we
built" bullets, the "Read on…" bridge, the problem, the iterations in order
with tension and resolution, "The Outcome:" bullets, and a "Get Involved" call
to action. Put `---` between sections.

**How-to.** A table of contents, `# Goal`, `# Prerequisites` ("The following
prerequisites are required:"), `# Step N: <imperative>` with numbered sub-steps
and code, info and warning callouts, and `# References`.

**Decision or ADR.** One-line `**Question:**` and `**Decision:**`, then
`## Context`, `## Decision proposal` (open with a 🎯 goal callout and give each
rule a short reason), `## Alternatives` (blunt is fine: "Keep the chaos."),
`## Consequences` with honest trade-offs, and `## References`.

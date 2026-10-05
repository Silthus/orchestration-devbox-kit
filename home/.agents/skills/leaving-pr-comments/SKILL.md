---
name: leaving-pr-comments
description: >-
  Draft and format every GitHub comment, review reply, or issue comment an
  agent posts on the user's behalf, and get his approval for each one a person
  reads. Replies to review bots go out without approval. Use before posting any
  comment from the user's account.
---

# Leaving PR comments

## Approval first

the user approves every comment to a person before it goes out. This covers PR
comments, review replies, issue comments, and resolving a thread with a reply,
when a person reads them. Replies to review bots are the exception, below.

1. Draft the comment in the format below.
2. Show the user the target (URL and thread) and the exact text.
3. Post only after he approves that comment in the conversation. Post it
   unchanged, or with his edits. An earlier approval does not cover a new
   comment.

A subagent or a loop cannot ask the user. It does not post a comment that needs
approval. It returns each draft with its target in its summary, and the main
agent asks the user.

### Replies to review bots

A review bot, such as CodeRabbit, Greptile, Copilot, Cursor Bugbot, PostHog
Review, or Macroscope, wrote every comment in the thread. Any agent, a
subagent or a loop too, replies without approval when you are confident the
reply is correct:

- **Fixed finding**: push the fix first. If the bot already resolved the thread
  after the push, post nothing. Otherwise reply with the fixing commit and one
  sentence on the fix.
- **Rejected finding or follow-up**: reply with the concrete reason and the
  evidence, such as the file and line that prevents the bug, or the pattern the
  fix waits for.

Leave the thread open for the bot or a reviewer to resolve. A bot finding that
sits in a review body has no thread. Answer those findings in one PR comment
that mentions the bot, such as `@coderabbitai`. Use the format below. Report
each reply you posted.

Draft for the user's approval instead when a person wrote any comment in the
thread, when you cannot tell, when the reply depends on a decision that is
still open, or when you are not confident in the reason. A top-level PR
comment that is not a reply to a bot also needs approval.

## Format

Start every comment with this callout. Put in the exact name of the model that
writes the comment, for example `Claude Opus 5.5` or `GPT-5.6 Sol`:

```md
> [!NOTE]
> 🤖 **<model name> responding on behalf of the user**

Fixed in 2c76885. The parser now skips empty rows, and the new test covers it.
```

Write the body in the user's short-form voice from the
`writing-voice` skill. Never use em dashes.

- Lead with the outcome: the commit that fixes it, or the reason for no change.
- Name the commit, file, or test that proves the claim.
- Keep it to one to three sentences. A dismissal gives the concrete reason the
  finding does not apply.

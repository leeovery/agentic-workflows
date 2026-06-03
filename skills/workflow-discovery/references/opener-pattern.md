# Opener Pattern

*Reference for **[workflow-discovery](../SKILL.md)***

---

Open the shaping conversation. The PATTERN is universal; the SPECIFIC TEXT phrases itself for whatever the caller already told us (the work-type pre-seed, or an inbox seed, or nothing for `s`/start). No pre-announce of process discipline — discipline shows through behaviour, not preamble.

Inputs held from Step 1: `work_type` pre-seed (or none), `inbox_seeds` — a list of inbox file paths (or none).

## A. Read seed material

#### If `inbox_seeds` is non-empty

Read every inbox file in `inbox_seeds`. They are the work's *origin* — pre-captured thoughts that become this work unit. Use them to shape the opening: sketch what you picked up — across all of them when there are several — then ask a targeted question that elicits a shape signal. Do not dump them back verbatim — synthesise. The folder already pre-seeded `work_type` (bugs → bugfix, quick-fixes → quick-fix, ideas → none); the seeds are still confirmed like any other pick.

With a single seed, hold its filename for name resolution at the confirm-trigger (the filename-slug becomes the suggested name). With several, the name is shaped from the conversation instead.

→ Proceed to **B. Render the Opener**.

#### Otherwise

No inbox seed. The opener invites the user to describe the work.

→ Proceed to **B. Render the Opener**.

## B. Render the Opener

Imports are **woven into the opener, never a standalone gate** — if the user has notes, design docs, error reports, or prior research, invite them to share the path(s) now; the no-files path costs zero extra turns. Any paths the user provides are read for shaping and held as `import_paths` for the confirm-trigger to land in `imports/`. (Inbox seeds are landed separately, in `seeds/`.)

Render the opener matching what the caller told us.

#### If inbox seeds were read

The seeds share one type (the working set only carries items of one kind). Name that type, pluralised with a count when there are several, and give one combined sketch across them.

> *Output the next fenced block as a code block:*

```
I've read your {bug | idea | quick-fix — pluralised with a count when several, e.g. "3 ideas"}. Here's the shape I'm picking up:

  {one-line sketch — a single combined picture across the item(s)}

{Targeted opening question that pulls on the shape.} If you have any
related files or notes, share the path(s) and I'll read them too.
```

**STOP.** Wait for user response.

→ Return to caller.

#### If `work_type` pre-seed is `epic`

> *Output the next fenced block as a code block:*

```
Tell me about the epic. I'll ask open questions to pull on it before
we synthesise topics. If you have notes or research files, share the
path(s) and I'll read them in.
```

**STOP.** Wait for user response.

→ Return to caller.

#### If `work_type` pre-seed is `feature`

> *Output the next fenced block as a code block:*

```
Tell me about the feature. If you have notes or files for it, share
the path(s) and I'll read them in.
```

**STOP.** Wait for user response.

→ Return to caller.

#### If `work_type` pre-seed is `bugfix`

> *Output the next fenced block as a code block:*

```
What's broken? If you have logs, error reports, or related files,
share the path(s) and I'll read them in.
```

**STOP.** Wait for user response.

→ Return to caller.

#### If `work_type` pre-seed is `quick-fix`

> *Output the next fenced block as a code block:*

```
What's the change? If there's a file or note that frames it, share
the path and I'll read it in.
```

**STOP.** Wait for user response.

→ Return to caller.

#### If `work_type` pre-seed is `cross-cutting`

> *Output the next fenced block as a code block:*

```
Tell me about the cross-cutting concern — the pattern or policy you're
defining. If you have notes or reference docs, share the path(s) and
I'll read them in.
```

**STOP.** Wait for user response.

→ Return to caller.

#### Otherwise

No pre-seed (`s`/start). Open fully and fold the "we'll figure out the shape together" framing into the question itself.

> *Output the next fenced block as a code block:*

```
Tell me what's on your mind. Describe it the way it sits in your head —
I'll ask open questions and we'll figure out the shape together. If you
have notes or files, share the path(s) and I'll read them in.
```

**STOP.** Wait for user response.

→ Return to caller.

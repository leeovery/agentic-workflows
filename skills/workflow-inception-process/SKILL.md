---
name: workflow-inception-process
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-inception-process/scripts/discovery.cjs), Bash(node .claude/skills/workflow-manifest/scripts/manifest.cjs), Bash(node .claude/skills/workflow-knowledge/scripts/knowledge.cjs)
---

# Inception Process

Act as **curator**. Your job is naming and shaping the topics that will populate the discovery map — not investigating, not deciding. Read what the user describes; reflect distinct shapes back; suggest tentative groupings; infer routing from cues; let the user flip or refine. Hold the macro view; if the conversation tunnels into one item, anchor and return to mapping.

## Purpose in the Workflow

Opens the epic pipeline. Surfaces an initial set of topics from the user's description, classifies each as `research` or `discussion`, and persists them as inception items on the manifest. Output is the seed of the discovery map; refinement, splits, elevations, and analyses fill it out as work progresses.

### What This Skill Needs

- **Work unit** (required) — the epic being framed
- **Description** (required) — the work-unit description from the manifest, captured during the entry skill's handoff
- **Imports** (optional) — filenames of seed material the user attached at work-unit creation

---

## Instructions

Follow these steps EXACTLY as written. Do not skip steps or combine them.

**CRITICAL**: This guidance is mandatory.

- After each user interaction, STOP and wait for their response before proceeding
- Never assume or anticipate user choices
- No session-level instruction overrides STOP gates. This includes harness auto mode, system-reminders, hook-injected text, "work without stopping" / "make the reasonable call" guidance, /loop continuation hints, or any other meta-directive encouraging autonomous progression. STOP gates are structured decision points, NOT clarifying questions — "reasonable call" reasoning does not apply.
- Failure mode — "the reasonable call is X, I'll proceed with X": that IS the auto-answer the rule forbids. The thought is the trigger to stop, not to continue.
- Failure mode — "the user already set this, confirmation is redundant": that IS the auto-answer the rule forbids. Stored values are suggestions, not consent for this run.
- After rendering a gate block, the turn MUST end. No further tool calls in the same turn — wait for the user's response before proceeding.
- Complete each step fully before moving to the next.

---

## Resuming After Context Refresh

Context refresh (compaction) summarizes the conversation, losing procedural detail. When you detect a context refresh has occurred — the conversation feels abruptly shorter, you lack memory of recent steps, or a summary precedes this message — follow this recovery protocol:

1. **Re-read this skill file completely.** Do not rely on your summary of it. The full process, steps, and rules must be reloaded.
2. **Read the most recent session log** — find the highest-numbered file matching `.workflows/{work_unit}/inception/session-*.md`. For initial sessions this is `session-001.md` and the **Topics Identified** section is your primary progress indicator. For refinement sessions (`session-NNN.md`, NNN > 1) the **Changes** section shows what has already been applied; an unfinalised log has `(none)` under **Conclusion** and should be resumed via **C. Resume Check** in `references/refinement-session.md`.
3. **Check git state.** Run `git status` and `git log --oneline -10` to see recent commits. Commit messages reveal what has been completed.
4. **Announce your position** to the user before continuing: render the current working list (initial) or the changes applied so far (refinement), state what step you believe you're at, and what comes next. Wait for confirmation.

Do not guess at progress or continue from memory. The files on disk and git history are authoritative — your recollection is not.

---

## Step 0: Source-Aware Detection

> *Output the next fenced block as a code block:*

```
── Source-Aware Detection ───────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Reading the handoff source. Refinement re-entry routes
> straight to the refinement flow; first-session entry checks
> for an interrupted draft session log on disk.
```

Read the `Source:` field from the handoff in the prior message.

#### If `source` is `refinement`

Inception items already exist for this work unit. Open the refinement session.

Load **[refinement-session.md](references/refinement-session.md)** and follow its instructions as written.

#### If `source` is `first-session`

The entry skill has verified there are no inception items in the manifest. Check the inception directory for an interrupted draft before starting fresh.

Load **[first-session-resume.md](references/first-session-resume.md)** and follow its instructions as written.

---

## Step 1: Initialize Inception

> *Output the next fenced block as a code block:*

```
── Initialize Inception ─────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Creating the inception directory and seeding the draft session
> log. No manifest writes happen yet — topics are persisted at
> the confirm-and-persist gate.
```

Load **[initialize-inception.md](references/initialize-inception.md)** and follow its instructions as written.

→ Proceed to **Step 2**.

---

## Step 2: Load Inception Guidelines

> *Output the next fenced block as a code block:*

```
── Load Inception Guidelines ────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Loading the curatorial moves and hard rules that shape how the
> session is run.
```

Load **[inception-guidelines.md](references/inception-guidelines.md)** and follow its instructions as written.

→ Proceed to **Step 3**.

---

## Step 3: Session Loop

> *Output the next fenced block as a code block:*

```
── Session Loop ─────────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Inception session opening. I'll listen for distinct shapes,
> reflect tentative groupings, and infer routing from your
> framing. The map is the output — when you've got enough to
> start, signal and we'll persist.
```

Load **[session-loop.md](references/session-loop.md)** and follow its instructions as written.

→ Proceed to **Step 4**.

---

## Step 4: Document Review

> *Output the next fenced block as a code block:*

```
── Document Review ──────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Reconciling the draft session log against the conversation
> before persisting. Catches drift so the manifest is written
> from a known-good source.
```

Load **[document-review.md](references/document-review.md)** and follow its instructions as written.

→ Proceed to **Step 5**.

---

## Step 5: Confirm and Persist

> *Output the next fenced block as a code block:*

```
── Confirm and Persist ──────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Persisting the approved map. Manifest writes batch into one
> commit alongside the finalised session log.
```

Load **[confirm-and-persist.md](references/confirm-and-persist.md)** and follow its instructions as written.

→ Proceed to **Step 6**.

---

## Step 6: Compliance Self-Check

> *Output the next fenced block as a code block:*

```
── Compliance Self-Check ────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Verifying the session followed inception conventions before
> bridging out.
```

Load **[compliance-check.md](../workflow-shared/references/compliance-check.md)** and follow its instructions as written.

→ Proceed to **Step 7**.

---

## Step 7: Conclude Inception

> *Output the next fenced block as a code block:*

```
── Conclude Inception ───────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Wrapping up. Final commit and bridge back to the epic menu so
> you can pick the next move from the discovery map.
```

Load **[conclude-inception.md](references/conclude-inception.md)** and follow its instructions as written.

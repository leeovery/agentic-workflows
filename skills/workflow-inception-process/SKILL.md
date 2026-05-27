---
name: workflow-inception-process
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-inception-process/scripts/discovery.cjs), Bash(node .claude/skills/workflow-manifest/scripts/manifest.cjs), Bash(node .claude/skills/workflow-knowledge/scripts/knowledge.cjs)
---

# Inception Process

Act as **curator**. Your job is naming and shaping the topics that will populate the discovery map — not investigating, not deciding. Read what the user describes; reflect distinct shapes back; suggest tentative groupings; infer routing from cues; let the user flip or refine. Hold the macro view; if the conversation tunnels into one item, anchor and return to mapping.

## Purpose in the Workflow

Opens and continues the discovery map for an epic. Every entry — first or Nth — is the same: a curatorial conversation that surfaces topics, classifies routing, and persists items. When the map is already populated, the same conversation also lets the user edit existing items (rename, re-route, edit summary or description, remove never-started topics) — those moves activate because there's something to act on, not because the session is in a different mode.

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
2. **Read the active session log.** Find the highest-numbered file matching `.workflows/{work_unit}/inception/session-*.md` and read it. **Topics Identified** and **Changes** show what was applied; a **Conclusion** of `(none)` means in-progress, anything else means concluded. If no file exists, no state changes have happened yet (lazy creation — see `references/template.md`).
3. **Check git state.** Run `git status` and `git log --oneline -10` to see recent commits. Commit messages reveal what has been completed.
4. **Announce your position** to the user before continuing: render the working state, state what step you believe you're at, and what comes next. Wait for confirmation.

Do not guess at progress or continue from memory. The files on disk and git history are authoritative — your recollection is not.

---

## Step 0: Resume Detection

> *Output the next fenced block as a code block:*

```
── Resume Detection ─────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Checking the manifest for an in-progress prior session.
```

Read the active-session marker:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.inception active_session
```

The marker is set when a session writes its log for the first time (lazy creation) and deleted when the session concludes. Its presence is the authoritative in-progress signal.

#### If output is empty or the literal string `null`

No prior session is in progress. `session_number` will be set at Step 1 from discovery's `next_session_number`.

→ Proceed to **Step 1**.

#### Otherwise

The output is the in-progress session number string (e.g. `002`). The prior session was interrupted before finalisation.

> *Output the next fenced block as markdown (not a code block):*

```
Found an in-progress inception session for **{work_unit:(titlecase)}** at `session-{active_session}.md`.

· · · · · · · · · · · ·
- **`c`/`continue`** — Pick up where you left off
- **`r`/`restart`** — Delete the draft and start a new session
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `continue`

Set `session_number` = `active_session`. The existing file at `.workflows/{work_unit}/inception/session-{session_number}.md` is the working state for the session loop.

→ Proceed to **Step 1**.

#### If `restart`

Delete the in-progress log and clear the marker:

```bash
rm .workflows/{work_unit}/inception/session-{active_session}.md
node .claude/skills/workflow-manifest/scripts/manifest.cjs delete {work_unit}.inception active_session
git add -- .workflows/{work_unit}/
git commit -m "inception({work_unit}): restart interrupted session"
```

`session_number` will be set at Step 1 from discovery's `next_session_number`.

→ Proceed to **Step 1**.

---

## Step 1: Run Discovery

> *Output the next fenced block as a code block:*

```
── Run Discovery ────────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Loading the discovery map, dismissed list, and analysis cache
> state for the rest of the session.
```

Run discovery for the work unit:

```bash
node .claude/skills/workflow-inception-process/scripts/discovery.cjs {work_unit}
```

Hold the output in conversation context as **the most recent discovery output**. Downstream steps and references read from it:

- `discovery_map` — per-topic `tier`, `lifecycle`, `current_phase`, `routing`, `source`, `summary`
- `map_summary` — counts string used for the opener render
- `dismissed` — names previously removed from the map
- `active_session` — in-progress session number set by lazy log creation, cleared at conclude. Authoritative resume signal (read at Step 0).
- `next_session_number` — used to set `session_number` for fresh entries

If `session_number` was not set at Step 0 (no resume), set it now: `session_number` = `next_session_number`.

`map-operations.md` and `show-dismissed.md` re-invoke discovery on entry because they validate against post-mutation state.

→ Proceed to **Step 2**.

---

## Step 2: Initialize Inception

> *Output the next fenced block as a code block:*

```
── Initialize Inception ─────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Ensuring the inception directory exists and capturing session
> metadata. The session log file is created lazily on first state
> change — see references/template.md.
```

Load **[initialize-inception.md](references/initialize-inception.md)** and follow its instructions as written.

→ Proceed to **Step 3**.

---

## Step 3: Load Inception Guidelines

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

→ Proceed to **Step 4**.

---

## Step 4: Session Loop

> *Output the next fenced block as a code block:*

```
── Session Loop ─────────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Opening the inception conversation. The session is pure
> exploration — pulling on the idea, sketching shape, surfacing
> surfaces. Topics are synthesised at endpoint from the whole
> picture, not inline. When the map is already populated,
> edits to existing items are also available alongside.
```

Load **[session-loop.md](references/session-loop.md)** and follow its instructions as written.

→ Proceed to **Step 5**.

---

## Step 5: Document Review

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

→ Proceed to **Step 6**.

---

## Step 6: Confirm and Persist

> *Output the next fenced block as a code block:*

```
── Confirm and Persist ──────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Persisting the synthesised topic set, writing Topics Identified
> to the log, clearing the active-session marker, and finalising
> the Conclusion placeholder.
```

Load **[confirm-and-persist.md](references/confirm-and-persist.md)** and follow its instructions as written.

→ Proceed to **Step 7**.

---

## Step 7: Compliance Self-Check

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

→ Proceed to **Step 8**.

---

## Step 8: Conclude Inception

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

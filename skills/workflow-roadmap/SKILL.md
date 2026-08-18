---
name: workflow-roadmap
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-roadmap/scripts/gateway.cjs), Bash(node .claude/skills/workflow-engine/scripts/engine.cjs), Bash(node .claude/skills/workflow-knowledge/scripts/knowledge.cjs), Bash(git log)
---

# Product Roadmap

The product layer above the work unit. Hold the product-altitude conversation, keep the roadmap — horizons of shaped-but-uncommitted items — and pull slices into delivery as fenced work units.

> **⚠️ ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.

## Workflow Context

The roadmap is project-level and outside the pipeline — no work unit, no phases. Sessions record at `.workflows/.roadmap/sessions/`, the map lives on the project manifest (`roadmap`: ordered horizons + items), and item lifecycle is computed by joining `pulled_to` against the work unit it became — waiting is the absence of a join. Work units are born here at the **pull** — the commitment point — already fenced to the pulled items; the pipeline itself is untouched.

Three invocation modes, dispatched at Step 1:

- **genesis** — from discovery's shaping gate: the conversation is live and just read as product-altitude. Persist the shaping so far, continue the conversation at this altitude.
- **open** — from the `r/roadmap` start-menu row: show the map, then converse, pull, or leave.
- **pull** — from a recognition offer: the user accepted pulling an existing waiting item, straight to the pull ceremony.

**Stay in your lane**: shape the product and its staging — what exists, what's next, what waits. Capability-grain only: an item is whatever you'd move around a roadmap as one thing. Topic shaping, mechanism, and design decisions belong to the work units the pull creates; a pulled item's substance belongs to its epic. Right of a pull the work unit is authoritative — the map edits waiting items freely and only watches joined ones.

---

## Instructions

Load **[framework.md](../workflow-shared/references/framework.md)** and follow its instructions as written.

---

## Resuming After Context Refresh

Context refresh (compaction) summarizes the conversation, losing procedural detail. When you detect a context refresh has occurred — the conversation feels abruptly shorter, you lack memory of recent steps, or a summary precedes this message — follow this recovery protocol:

1. **Re-read this skill file completely, then re-load [framework.md](../workflow-shared/references/framework.md).** Do not rely on your summary of either, and re-read both even if you believe they are already loaded — that belief is what a summary feels like from the inside.
2. **Read the state.** Run `node .claude/skills/workflow-roadmap/scripts/gateway.cjs view` and reason from its DATA: an `active_session` means a session is live — read its log (`.workflows/.roadmap/sessions/session-{active_session}.md`) in full to recover the exploration; no marker means the session had not started or already closed.
3. **Check git state.** Run `git status` and `git log --oneline -10`. Commit messages reveal what has been completed.
4. **Announce your position** to the user before continuing: state what step you believe you're at and what comes next. Wait for confirmation.

Do not guess at progress or continue from memory. The files on disk and git history are authoritative — your recollection is not.

---

## Step 1: Dispatch

Read the positional argument:

- `$0` — **mode**: `genesis` (from discovery's shaping gate — the conversation is live), `open` (from the workflow-start menu), or `pull` (from a recognition offer — straight to the pull ceremony).

#### If `$0` is `genesis`

→ Proceed to **Step 2**.

#### If `$0` is `pull`

> *Output the next fenced block as markdown (not a code block):*

```
# **`■ Roadmap`**
```

→ Proceed to **Step 8**.

#### Otherwise

→ Proceed to **Step 3**.

---

## Step 2: Genesis Continuation

> *Output the next fenced block as markdown (not a code block):*

```
# **`■ Roadmap`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> This is product-altitude work — laying the whole thing out before anything commits to delivery. The conversation so far is being saved as the first roadmap session; nothing here creates a work unit until you pull a slice.
```

The shaping conversation before this point was ephemeral — persist it now:

1. **Land any imports held from shaping.** If the user shared file paths during the shaping conversation (`import_paths`), land them (one path per argument; on `ok: false` with `missing_imports`, re-prompt for corrected paths and re-run):

   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs roadmap import {path} {path}
   ```

2. **Open the session.** Read the state first:

   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs roadmap state
   ```

   **If `active_session` is set** (a product session was left open): the shaping folds into it — read its log in full, append a strong-summary of the shaping conversation so far to **Exploration** (the product intent, the capabilities named, any staging language heard — prose, not transcript), commit (`engine commit --roadmap -m "roadmap: genesis continuation — session {active_session}"`), and set `session_number` from `active_session`.

   **Otherwise:** draft the log at `.workflows/.cache/roadmap/session-draft.md` per [session-template.md](references/session-template.md), backfilling **Exploration** with that same strong-summary. Then:

   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs roadmap session open --session-log-file .workflows/.cache/roadmap/session-draft.md
   node .claude/skills/workflow-engine/scripts/engine.cjs commit --roadmap -m "roadmap: open session {session}"
   ```

   Set `session_number` from the response's `session`.

3. Hold `genesis_continuation` = true.

→ Proceed to **Step 4**.

---

## Step 3: Home

Render the roadmap home snapshot (its TITLE section is the phase title):

```bash
node .claude/skills/workflow-roadmap/scripts/gateway.cjs view
```

The output arrives in demarcated sections: read `=== DATA` to reason from (state, `ITEMS`, `SESSIONS`, the `ACTIONS` key table — never display it); emit the TITLE section (markdown), then the DISPLAY section verbatim as a code block, then the MENU section verbatim as markdown.

**STOP.** Wait for user response.

Match the input to its `ACTIONS` entry by `key` and route on the entry's `action`:

#### If `action` is `converse`

Set `session_number` from the DATA's `active_session` when one is open (the loop resumes it), else from `next_session_number` (the log is created lazily at the first exploration write).

→ Proceed to **Step 4**.

#### If `action` is `pull`

→ Proceed to **Step 8**.

#### If `action` is `back`

> *Output the next fenced block as markdown (not a code block):*

```
> Leaving the roadmap as it is — run /workflow-start whenever you want back in.
```

**STOP.** Do not proceed — terminal condition.

#### If the user asks a question

Answer from the DATA and the map.

→ Return to **Step 3**.

---

## Step 4: Load Roadmap Guidelines

Load **[roadmap-guidelines.md](references/roadmap-guidelines.md)** and follow its instructions as written.

→ On return, proceed to **Step 5**.

---

## Step 5: Session Loop

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Product Session`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> The product conversation — ideas, staging, what matters when. Items and horizons crystallise at the harvest, when you pull them; say "lay it out" whenever it feels ready.
```

Load **[session-loop.md](references/session-loop.md)** and follow its instructions as written — the harvest runs inside it, and it returns only once a sort is confirmed.

→ On return, proceed to **Step 6**.

---

## Step 6: Document Review

Load **[document-review.md](references/document-review.md)** and follow its instructions as written.

→ On return, proceed to **Step 7**.

---

## Step 7: Conclude

Load **[compliance-check.md](../workflow-shared/references/compliance-check.md)** and follow its instructions as written.

On return, load **[conclude.md](references/conclude.md)** and follow its instructions as written.

→ On return, proceed as the reference directed.

---

## Step 8: Pull

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Pull Into Delivery`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> The commitment point — pick the items going into delivery, and a work unit is born already fenced to them. Everything left keeps waiting, visibly.
```

Load **[pull.md](references/pull.md)** and follow its instructions as written.

→ On return, proceed as the reference directed.

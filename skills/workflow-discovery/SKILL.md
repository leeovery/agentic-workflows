---
name: workflow-discovery
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-discovery/scripts/gateway.cjs), Bash(node .claude/skills/workflow-roadmap/scripts/gateway.cjs), Bash(node .claude/skills/workflow-engine/scripts/engine.cjs), Bash(node .claude/skills/workflow-knowledge/scripts/knowledge.cjs), Bash(git log), Bash(mkdir -p .workflows/), Bash(rm .workflows/), Bash(rm -f .workflows/)
hooks:
  SessionEnd:
    - hooks:
        - type: command
          command: 'node "$CLAUDE_PROJECT_DIR/.claude/skills/workflow-engine/scripts/engine.cjs" session cleanup'
---

The universal first phase. Shape the work the user is bringing — confirm what kind of work it is, sketch its outline — then persist it and route into the pipeline.

> **⚠️ ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.

## Workflow Context

Discovery is the universal **first phase** — every work type begins here. It shapes brand-new work and settles its type, then the pipeline branches; for an epic it also re-shapes the map on later visits. What follows differs by work type:

| Work type | Pipeline after discovery |
|---|---|
| Epic | Multi-topic; each topic: (Research) → (Experiment) → Discussion → Specification → Planning → Implementation → Review |
| Feature | (Research) → (Experiment) → Discussion → Specification → Planning → Implementation → Review |
| Bugfix | Investigation → Specification → Planning → Implementation → Review |
| Quick-fix | Scoping → Implementation → Review |
| Cross-cutting | (Research) → (Experiment) → Discussion → Specification (terminal) |

It runs in two modes:

- **New mode** — from `workflow-start`. Decide the work type (epic / feature / bugfix / quick-fix / cross-cutting), shape the outline, persist at the work-type commit, route to the first phase. A **product-altitude** read — no single unit of work on the table — routes out to the roadmap instead, before any unit exists.
- **Existing-epic mode** — from `workflow-continue-epic`, or continuing straight from a roadmap pull that just created the epic. The work type is already known; shape (or re-shape) the epic's discovery map.

**Stay in your lane**: Discovery settles *what the work is* and shapes it — determine the type first (epic / feature / bugfix / quick-fix / cross-cutting, or the product road when no single unit is on the table), then route it into the pipeline. How much substance the conversation engages is set per work type by the guidance loaded on each path, not fixed here: while determining the type you shape rather than resolve; once an epic is settled, its path opens into deep exploration. Name the work, shape it, route it.

---

## Instructions

Load **[framework.md](../workflow-shared/references/framework.md)** and follow its instructions as written.

---

## Resuming After Context Refresh

Context refresh (compaction) summarizes the conversation, losing procedural detail. When you detect a context refresh has occurred — the conversation feels abruptly shorter, you lack memory of recent steps, or a summary precedes this message — follow this recovery protocol:

1. **Re-read this skill file completely, then re-load [framework.md](../workflow-shared/references/framework.md).** Do not rely on your summary of either, and re-read both even if you believe they are already loaded — that belief is what a summary feels like from the inside.
2. **Determine whether the work unit was persisted yet.** Pre-confirmation new-mode shaping is ephemeral — nothing is on disk. If no manifest exists for the work in hand, the conversation had not yet reached the confirm-trigger; treat the shaping as lost and re-open with the user. If a manifest exists, the confirm-trigger fired — read the active session log (highest-numbered `.workflows/{work_unit}/discovery/sessions/session-*.md`) and the manifest to recover state; the session loop's re-open then reads the recent prior session logs too for continuity (see [continuity-load.md](references/continuity-load.md)), so re-entry resumes the conversation rather than restarting from the map. For an epic whose discovery map is still empty while its session log holds Exploration, you were mid-discovery — confirmed but not yet synthesised — so resume at the session loop; its open picks up from the log rather than cold-opening.
3. **Check git state.** Run `git status` and `git log --oneline -10`. Commit messages reveal what has been completed.
4. **Announce your position** to the user before continuing: state what step you believe you're at and what comes next. Wait for confirmation.

Do not guess at progress or continue from memory. The files on disk and git history are authoritative — your recollection is not.

---

## Step 1: Dispatch

Read the positional arguments:

- `$0` — **work_type pre-seed**: one of `epic` / `feature` / `bugfix` / `quick-fix` / `cross-cutting`, or `none` (the `s/start` path, no hint). A hint, not a given — still confirmed in new mode.
- `$1` — **work_unit**: an existing epic's name (existing-epic shaping, from `workflow-continue-epic`), or `none` (new work, from `workflow-start`).
- `$2` — **inbox_seeds**: comma-joined path(s) to inbox file(s) consumed as the opening seed material — one or more, or `none`. Absent `$2` is treated as `none`. Split on commas into a list; a single path yields a one-element list. Held downstream as `inbox_seeds`.

The mode is determined by `$1`:

#### If `$1` is `none`

New work — nothing is on disk yet; pre-confirmation shaping is ephemeral.

→ Proceed to **Step 2**.

#### Otherwise

`$1` names an existing epic. Skip macro shaping and shape its map — a re-shape on a return visit, a first shaping when a roadmap pull created the epic moments ago (the map is empty; `pull_continuation` is held).

→ Proceed to **Step 6**.

---

## Step 2: Load Detection Core

Load **[detection-core.md](references/detection-core.md)** and follow its instructions as written.

→ On return, proceed to **Step 3**.

---

## Step 3: Open

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Open Discovery`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Reading anything you've already shared, then opening the conversation about what you want to do.
```

Load **[opener-pattern.md](references/opener-pattern.md)** and follow its instructions as written.

→ On return, proceed to **Step 4**.

---

## Step 4: Shape and Confirm the Work Type

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Shape and Confirm`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Talking it through to settle what kind of work this is — brief when it's already clear, longer when there's more to tease out.
```

Load **[shape-and-confirm.md](references/shape-and-confirm.md)** and follow its instructions as written.

→ On return, proceed to **Step 5**.

---

## Step 5: Confirm Trigger — Create the Work Unit

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Confirm Trigger`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Now we know what this is — setting it up: giving it a name, creating it, and saving any files or notes you shared.
```

Load **[confirm-trigger.md](references/confirm-trigger.md)** and follow its instructions as written.

→ On return, proceed as the reference directed.

---

## Step 6: Resume Detection

Load **[resume-detection.md](references/resume-detection.md)** and follow its instructions as written.

→ On return, proceed to **Step 7**.

---

## Step 7: Run Discovery

Refresh the tmux session label — a no-op unless the user opted in and this session runs inside tmux:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs session label {work_unit} discovery {work_unit}
```

Run discovery for the work unit:

```bash
node .claude/skills/workflow-discovery/scripts/gateway.cjs {work_unit}
```

Hold the output in conversation context as **the most recent discovery output**. Downstream steps and references read from it:

- `discovery_map` — per-topic `tier`, `lifecycle`, `current_phase`, `routing`, `source`, `summary`
- `map_summary` — counts string used for the opener render
- `dismissed` — names previously removed from the map
- `description` — the work-unit one-liner
- `seeds` / `imports` — the work unit's seed material entries (paths relative to `.workflows/{work_unit}/`), read by Step 8 and the session loop's launchpad branch
- `session_logs` — every session log's number + path (ascending); read from this rather than re-globbing (used by continuity-load.md)
- `next_session_number` — used to set `session_number` for fresh entries

The authoritative resume signal (`active_session`) is a manifest field, read via `engine manifest` at Step 6 — not carried in this dump.

If `session_number` was not already set (no resume at Step 6, no `macro_continuation` from Step 5, no `pull_continuation` from a roadmap pull), set it now: `session_number` = `next_session_number`. When `macro_continuation` or `pull_continuation` is set, the creating flow already installed `session-{session_number}.md` — keep that `session_number` and ignore `next_session_number`.

`map-operations.md` and `show-dismissed.md` re-invoke discovery on entry because they validate against post-mutation state.

→ Proceed to **Step 8**.

---

## Step 8: Initialize Discovery

Load **[initialize-discovery.md](references/initialize-discovery.md)** and follow its instructions as written.

→ On return, proceed to **Step 9**.

---

## Step 9: Load Discovery Guidelines

Load **[discovery-guidelines.md](references/discovery-guidelines.md)** and follow its instructions as written.

→ On return, proceed to **Step 10**.

---

## Step 10: Session Loop

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Discovery Session`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Mapping out the topics this epic breaks into. A new epic carries on from what we've shaped so far; an existing map can be edited here too. We name the topics once the picture feels complete.
```

Load **[session-loop.md](references/session-loop.md)** and follow its instructions as written.

→ On return, proceed to **Step 11**.

---

## Step 11: Document Review

Load **[document-review.md](references/document-review.md)** and follow its instructions as written.

→ On return, proceed to **Step 12**.

---

## Step 12: Confirm and Persist Topics

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Confirm and Persist`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Saving the agreed topics to the discovery map and closing out the session log.
```

Load **[confirm-and-persist.md](references/confirm-and-persist.md)** and follow its instructions as written.

→ On return, proceed to **Step 14**.

---

## Step 13: Single-Phase Endpoint

Reached only for single-phase work — feature, cross-cutting, bugfix, quick-fix — routed here by the confirm-trigger (Step 5). The epic topic path does not pass through here.

> *Output the next fenced block as markdown (not a code block):*

```
**`□ First-Phase Routing`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Discovery's done — routing this work to its first phase. Feature and cross-cutting pick research or discussion; bugfix goes to investigation, quick-fix to scoping.
```

Load **[first-phase-routing.md](references/first-phase-routing.md)** and follow its instructions as written.

→ On return, proceed to **Step 14**.

---

## Step 14: Compliance Self-Check

Reached before concluding by both paths — the epic topic path from Step 12, the single-phase endpoint from Step 13.

Load **[compliance-check.md](../workflow-shared/references/compliance-check.md)** and follow its instructions as written.

→ On return, proceed to **Step 15**.

---

## Step 15: Conclude Discovery

The single exit for every work type — both paths arrive from the Step 14 compliance check.

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Conclude Discovery`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Wrapping up — committing, then handing off through the bridge to the next step in a clean context.
```

Load **[conclude-discovery.md](references/conclude-discovery.md)** and follow its instructions as written.

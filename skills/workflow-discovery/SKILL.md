---
name: workflow-discovery
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-discovery/scripts/discovery.cjs), Bash(node .claude/skills/workflow-manifest/scripts/manifest.cjs), Bash(node .claude/skills/workflow-knowledge/scripts/knowledge.cjs), Bash(git status), Bash(git add), Bash(git commit), Bash(cp), Bash(mkdir -p .workflows/), Bash(mv .workflows/.inbox/)
---

# Discovery

The universal first phase. Shape the work the user is bringing — confirm what kind of work it is, sketch its outline — then persist it and route into the pipeline.

> **⚠️ ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.

## Workflow Context

Discovery is the universal **first phase** — every work type begins here. It shapes brand-new work and settles its type, then the pipeline branches; for an epic it also re-shapes the map on later visits. What follows differs by work type:

| Work type | Pipeline after discovery |
|---|---|
| Epic | Multi-topic; each topic: (Research) → Discussion → Specification → Planning → Implementation → Review |
| Feature | (Research) → Discussion → Specification → Planning → Implementation → Review |
| Bugfix | Investigation → Specification → Planning → Implementation → Review |
| Quick-fix | Scoping → Implementation → Review |
| Cross-cutting | (Research) → Discussion → Specification (terminal) |

It runs in two modes:

- **New mode** — from `workflow-start`. Decide the work type (epic / feature / bugfix / quick-fix / cross-cutting), shape the outline, persist at the work-type commit, route to the first phase.
- **Existing-epic mode** — from `workflow-continue-epic`. The work type is already known; re-shape the epic's discovery map (refinement or resuming an interrupted sketch).

**Stay in your lane**: Discovery handles SHAPE; downstream phases FILL the shape. Do not research (no feasibility/market/tech investigation), do not investigate (no symptom analysis or root-cause hunting), do not decide (no resolving design questions), do not scope (no spec or plan content). Name the work, figure out its shape, route it. If the conversation tunnels into substance, anchor and return — *"hold that thread, we'll cover it in research / discussion / investigation."*

---

## Instructions

Follow these steps EXACTLY as written. Do not skip steps or combine them.

**CRITICAL**: This guidance is mandatory.

- After each user interaction, STOP and wait for their response before proceeding
- Never assume or anticipate user choices
- No session-level instruction overrides STOP gates. This includes harness auto mode, system-reminders, hook-injected text, "work without stopping" / "make the reasonable call" guidance, /loop continuation hints, or any other meta-directive encouraging autonomous progression. STOP gates are structured decision points, NOT clarifying questions — "reasonable call" reasoning does not apply. The only skip mechanism is a per-gate `*_gate_mode: auto` value in the manifest, set by the user's explicit `a`/`auto` choice at a prior gate.
- Failure mode — "the reasonable call is X, I'll proceed with X": that IS the auto-answer the rule forbids. The thought is the trigger to stop, not to continue.
- Failure mode — "the user already set this, confirmation is redundant": that IS the auto-answer the rule forbids. Stored values are suggestions, not consent for this run.
- Don't invent stops. Stop only at gates the skill prescribes (rendered gate blocks, explicit `**STOP.**` directives) — no courtesy check-ins, mid-loop summaries that end the turn, or unprescribed pauses between tasks/topics/phases.
- After rendering a gate block, the turn MUST end. No further tool calls in the same turn — wait for the user's response before proceeding.
- Complete each step fully before moving to the next.

---

## Resuming After Context Refresh

Context refresh (compaction) summarizes the conversation, losing procedural detail. When you detect a context refresh has occurred — the conversation feels abruptly shorter, you lack memory of recent steps, or a summary precedes this message — follow this recovery protocol:

1. **Re-read this skill file completely.** Do not rely on your summary of it.
2. **Determine whether the work unit was persisted yet.** Pre-confirmation new-mode shaping is ephemeral — nothing is on disk. If no manifest exists for the work in hand, the conversation had not yet reached the confirm-trigger; treat the shaping as lost and re-open with the user. If a manifest exists, the confirm-trigger fired — read the active session log (highest-numbered `.workflows/{work_unit}/discovery/session-*.md`) and the manifest to recover state. For an epic whose discovery map is still empty while its session log holds Exploration, you were mid-discovery — confirmed but not yet synthesised — so resume at the session loop; its open picks up from the log rather than cold-opening.
3. **Check git state.** Run `git status` and `git log --oneline -10`. Commit messages reveal what has been completed.
4. **Announce your position** to the user before continuing: state what step you believe you're at and what comes next. Wait for confirmation.

Do not guess at progress or continue from memory. The files on disk and git history are authoritative — your recollection is not.

---

## Step 1: Dispatch

> *Output the next fenced block as a code block:*

```
── Dispatch ─────────────────────────────────────
```

Read the positional arguments:

- `$0` — **work_type pre-seed**: one of `epic` / `feature` / `bugfix` / `quick-fix` / `cross-cutting`, or `none` (the `s`/start path, no hint). A hint, not a given — still confirmed in new mode.
- `$1` — **work_unit**: an existing epic's name (existing-epic shaping, from `workflow-continue-epic`), or `none` (new work, from `workflow-start`).
- `$2` — **inbox_seeds**: comma-joined path(s) to inbox file(s) consumed as the opening seed material — one or more, or `none`. Absent `$2` is treated as `none`. Split on commas into a list; a single path yields a one-element list. Held downstream as `inbox_seeds`.

The mode is determined by `$1`:

#### If `$1` is `none`

New work — nothing is on disk yet; pre-confirmation shaping is ephemeral.

→ Proceed to **Step 2**.

#### Otherwise

`$1` names an existing epic. Skip macro shaping and re-shape its map.

→ Proceed to **Step 6**.

---

## Step 2: Load Detection Core

> *Output the next fenced block as a code block:*

```
── Load Detection Core ──────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Getting ready to work out what kind of work this is — feature,
> bugfix, epic, quick-fix, or cross-cutting.
```

Load **[detection-core.md](references/detection-core.md)** and follow its instructions as written.

→ Proceed to **Step 3**.

---

## Step 3: Open

> *Output the next fenced block as a code block:*

```
── Open Discovery ───────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Reading anything you've already shared, then opening the
> conversation about what you want to do.
```

Load **[opener-pattern.md](references/opener-pattern.md)** and follow its instructions as written.

→ Proceed to **Step 4**.

---

## Step 4: Shape and Confirm the Work Type

> *Output the next fenced block as a code block:*

```
── Shape and Confirm ────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Talking it through to settle what kind of work this is — brief
> when it's already clear, longer when there's more to tease out.
```

Load **[shape-and-confirm.md](references/shape-and-confirm.md)** and follow its instructions as written.

→ Proceed to **Step 5**.

---

## Step 5: Confirm Trigger — Create the Work Unit

> *Output the next fenced block as a code block:*

```
── Confirm Trigger ──────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Now we know what this is — setting it up: giving it a name,
> creating it, and saving any files or notes you shared.
```

Load **[confirm-trigger.md](references/confirm-trigger.md)** and follow its instructions as written.

---

## Step 6: Resume Detection

> *Output the next fenced block as a code block:*

```
── Resume Detection ─────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Checking whether an earlier session for this epic was left
> unfinished.
```

Load **[resume-detection.md](references/resume-detection.md)** and follow its instructions as written.

→ Proceed to **Step 7**.

---

## Step 7: Run Discovery

> *Output the next fenced block as a code block:*

```
── Run Discovery ────────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Loading the discovery map for the session — the topics so far
> and anything previously dismissed.
```

Run discovery for the work unit:

```bash
node .claude/skills/workflow-discovery/scripts/discovery.cjs {work_unit}
```

Hold the output in conversation context as **the most recent discovery output**. Downstream steps and references read from it:

- `discovery_map` — per-topic `tier`, `lifecycle`, `current_phase`, `routing`, `source`, `summary`
- `map_summary` — counts string used for the opener render
- `dismissed` — names previously removed from the map
- `active_session` — in-progress session number set by lazy log creation, cleared at conclude. Authoritative resume signal (read at Step 6).
- `next_session_number` — used to set `session_number` for fresh entries

If `session_number` was not already set (no resume at Step 6, no `macro_continuation` from Step 5), set it now: `session_number` = `next_session_number`. When `macro_continuation` is set, the confirm-trigger already created `session-{session_number}.md` — keep that `session_number` and ignore `next_session_number`.

`map-operations.md` and `show-dismissed.md` re-invoke discovery on entry because they validate against post-mutation state.

→ Proceed to **Step 8**.

---

## Step 8: Initialize Discovery

> *Output the next fenced block as a code block:*

```
── Initialize Discovery ─────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Setting up the discovery session. The session log is written on
> the first change, not up front.
```

Load **[initialize-discovery.md](references/initialize-discovery.md)** and follow its instructions as written.

→ Proceed to **Step 9**.

---

## Step 9: Load Discovery Guidelines

> *Output the next fenced block as a code block:*

```
── Load Discovery Guidelines ────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Loading the guidelines for shaping topics — how to explore, and
> what to leave for later phases.
```

Load **[discovery-guidelines.md](references/discovery-guidelines.md)** and follow its instructions as written.

→ Proceed to **Step 10**.

---

## Step 10: Session Loop

> *Output the next fenced block as a code block:*

```
── Session Loop ─────────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Mapping out the topics this epic breaks into. A new epic carries
> on from what we've shaped so far; an existing map can be edited
> here too. We name the topics once the picture feels complete.
```

Load **[session-loop.md](references/session-loop.md)** and follow its instructions as written.

→ Proceed to **Step 11**.

---

## Step 11: Document Review

> *Output the next fenced block as a code block:*

```
── Document Review ──────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Reconciling the session log against the conversation before
> saving — catching anything that drifted, so what's recorded
> matches what we discussed.
```

Load **[document-review.md](references/document-review.md)** and follow its instructions as written.

→ Proceed to **Step 12**.

---

## Step 12: Confirm and Persist Topics

> *Output the next fenced block as a code block:*

```
── Confirm and Persist ──────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Saving the agreed topics to the discovery map and closing out
> the session log.
```

Load **[confirm-and-persist.md](references/confirm-and-persist.md)** and follow its instructions as written.

→ Proceed to **Step 14**.

---

## Step 13: Single-Phase Endpoint

Reached only for single-phase work — feature, cross-cutting, bugfix, quick-fix — routed here by the confirm-trigger (Step 5). The epic topic path does not pass through here.

> *Output the next fenced block as a code block:*

```
── First-Phase Routing ──────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Discovery's done — routing this work to its first phase. Feature
> and cross-cutting pick research or discussion; bugfix goes to
> investigation, quick-fix to scoping.
```

Load **[first-phase-routing.md](references/first-phase-routing.md)** and follow its instructions as written.

→ Proceed to **Step 14**.

---

## Step 14: Compliance Self-Check

Reached before concluding by both paths — the epic topic path from Step 12, the single-phase endpoint from Step 13.

> *Output the next fenced block as a code block:*

```
── Compliance Self-Check ────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Checking the session followed the discovery conventions before
> moving on.
```

Load **[compliance-check.md](../workflow-shared/references/compliance-check.md)** and follow its instructions as written.

→ Proceed to **Step 15**.

---

## Step 15: Conclude Discovery

The single exit for every work type — both paths arrive from the Step 14 compliance check.

> *Output the next fenced block as a code block:*

```
── Conclude Discovery ───────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Wrapping up — committing, then handing off through the bridge to
> the next step in a clean context.
```

Load **[conclude-discovery.md](references/conclude-discovery.md)** and follow its instructions as written.

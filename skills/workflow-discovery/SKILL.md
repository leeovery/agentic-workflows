---
name: workflow-discovery
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-discovery/scripts/discovery.cjs), Bash(node .claude/skills/workflow-manifest/scripts/manifest.cjs), Bash(node .claude/skills/workflow-knowledge/scripts/knowledge.cjs), Bash(mkdir -p .workflows/.inbox/.archived/), Bash(mv .workflows/.inbox/)
---

# Discovery

The universal umbrella entry. Shape the work the user is bringing — confirm what kind of work it is, sketch its outline — then persist it and route into the pipeline.

> **⚠️ ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.

## Workflow Context

Discovery sits **above** every pipeline — it is not a phase. It opens all brand-new work, routes into the right pipeline, and re-shapes an epic's map. The pipeline it feeds differs by work type:

| Work type | Pipeline after discovery |
|---|---|
| Epic | Research → Discussion → Specification → Planning → Implementation → Review (per topic) |
| Feature | (Research) → Discussion → Specification → Planning → Implementation → Review |
| Bugfix | Investigation → Specification → Planning → Implementation → Review |
| Quick-fix | Scoping → Implementation → Review |
| Cross-cutting | (Research) → Discussion → Specification (terminal) |

It runs in two modes:

- **New mode** — from `workflow-start`. Decide the work type (epic / feature / bugfix / quick-fix / cross-cutting), shape the outline, persist at the work-type commit, route to the first phase.
- **Existing-epic mode** — from `continue-epic`. The work type is already known; re-shape the epic's discovery map (refinement or resuming an interrupted sketch).

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
2. **Determine whether the work unit was persisted yet.** Pre-confirmation new-mode shaping is ephemeral — nothing is on disk. If no manifest exists for the work in hand, the conversation had not yet reached the confirm-trigger; treat the shaping as lost and re-open with the user. If a manifest exists, the confirm-trigger fired — read the active session log (highest-numbered `.workflows/{work_unit}/discovery/session-*.md`) and the manifest to recover state.
3. **Check git state.** Run `git status` and `git log --oneline -10`. Commit messages reveal what has been completed.
4. **Announce your position** to the user before continuing: state what step you believe you're at and what comes next. Wait for confirmation.

Do not guess at progress or continue from memory. The files on disk and git history are authoritative — your recollection is not.

---

## Step 0: Dispatch

> *Output the next fenced block as a code block:*

```
── Dispatch ─────────────────────────────────────
```

Read the caller's inputs. New work arrives from `workflow-start` as a **handoff block**; existing-epic shaping arrives from `continue-epic` as **positional arguments** (`$0` = work_type, `$1` = work_unit).

The handoff block names:

- **Work type (pre-seed)** — `epic` / `feature` / `bugfix` / `quick-fix` / `cross-cutting`, or `(none)`. A *hint*, not a given — still confirmed in new mode.
- **Inbox seed** — path to an inbox file consumed as the opening description, or `(none)`.

Determine the mode: if a `work_unit` is named (positional `$1`), confirm it against the manifest — `node .claude/skills/workflow-manifest/scripts/manifest.cjs exists {work_unit}` returning `true` means **existing-epic mode**. Otherwise (a handoff block with no named work unit) it is **new mode**.

#### If existing-epic mode

The work type is known (`epic`) and the manifest already exists. Skip macro shaping and re-shape the map.

→ Proceed to **Step 5**.

#### Otherwise

New work. Nothing is on disk yet — pre-confirmation shaping is ephemeral.

→ Proceed to **Step 1**.

---

## Step 1: Load Detection Core

> *Output the next fenced block as a code block:*

```
── Load Detection Core ──────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Loading the universal shape-detection knowledge — boundary
> discriminators, pivot watch, confidence heuristics, and the
> confirm-with-reasons protocol.
```

Load **[detection-core.md](references/detection-core.md)** and follow its instructions as written.

→ Proceed to **Step 2**.

---

## Step 2: Open

> *Output the next fenced block as a code block:*

```
── Open Discovery ───────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Reading any seed material and opening the shaping conversation,
> phrased for whatever the caller already told us.
```

Load **[opener-pattern.md](references/opener-pattern.md)** and follow its instructions as written.

→ Proceed to **Step 3**.

---

## Step 3: Shape and Confirm the Work Type

> *Output the next fenced block as a code block:*

```
── Shape and Confirm ────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Running the shaping conversation. Depth scales to unknowns —
> a pre-seeded pick mostly confirms; an open start establishes.
```

Run the shaping conversation per the detection core loaded at Step 1. Gather all signal flavours simultaneously (work-type cues and topic seeds co-emerge); resolve in dependency order. Surface tentative reads mid-loop (soft, easy to redirect). Watch for pivots and offer scope-down-to-inbox for tangential concerns. One question at a time — keep exploring until confident-enough-to-commit per the confidence clock.

When convergence holds (detection core **H**), make the commit move: state the read in plain terms with the bucket name folded in, give the specific signals that drove it, then render the gate:

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
{Plain read + bucket name, e.g. "This is feature-shaped — one focused
thing to build."} {One-or-two-sentence reasoning naming the signals.}

- **`y`/`yes`** — That's right, set it up as a {work-type}
- **`o`/`other`** — It's something else (tell me what)
- **Keep shaping** — Tell me what I'm missing
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `yes`

The work type is committed. Set `work_type`; compile a one-line `description` from the user's framing (captured from the conversation, never silently invented). Hold any topic seeds and imports surfaced during shaping.

→ Proceed to **Step 4**.

#### If `other`

Take the user's call as authoritative — adjust `work_type` without re-litigating (if they describe rather than name a shape, map it via the detection core and reflect back for a quick confirm). Once a work type is settled, set `work_type` and compile the `description`.

→ Proceed to **Step 4**.

#### If keep shaping

The read isn't ready. Continue the shaping conversation.

→ Return to **Step 3**.

---

## Step 4: Confirm Trigger — Create the Work Unit

> *Output the next fenced block as a code block:*

```
── Confirm Trigger ──────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> The work type is committed — persisting now. Resolving the name,
> creating the work unit, landing any imports, archiving the inbox
> seed, and writing the session log.
```

Load **[confirm-trigger.md](references/confirm-trigger.md)** and follow its instructions as written.

On return, the manifest, session log, imports, and inbox archival are all on disk. Route by the committed `work_type`:

#### If `work_type` is `epic`

The work continues into the initial topic sketch — the same shaping, deepened. Hold `macro_continuation` = true and the `session_number` set by the confirm-trigger.

→ Proceed to **Step 6**.

#### If `work_type` is `feature` or `cross-cutting`

→ Proceed to **Step 14**.

#### If `work_type` is `bugfix` or `quick-fix`

→ Proceed to **Step 15**.

---

## Step 5: Resume Detection

> *Output the next fenced block as a code block:*

```
── Resume Detection ─────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Checking the manifest for an in-progress prior session before
> re-shaping the map.
```

Load **[resume-detection.md](references/resume-detection.md)** and follow its instructions as written.

→ Proceed to **Step 6**.

---

## Step 6: Run Discovery

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
node .claude/skills/workflow-discovery/scripts/discovery.cjs {work_unit}
```

Hold the output in conversation context as **the most recent discovery output**. Downstream steps and references read from it:

- `discovery_map` — per-topic `tier`, `lifecycle`, `current_phase`, `routing`, `source`, `summary`
- `map_summary` — counts string used for the opener render
- `dismissed` — names previously removed from the map
- `active_session` — in-progress session number set by lazy log creation, cleared at conclude. Authoritative resume signal (read at Step 5).
- `next_session_number` — used to set `session_number` for fresh entries

If `session_number` was not already set (no resume at Step 5, no `macro_continuation` from Step 4), set it now: `session_number` = `next_session_number`. When `macro_continuation` is set, the confirm-trigger already created `session-{session_number}.md` — keep that `session_number` and ignore `next_session_number`.

`map-operations.md` and `show-dismissed.md` re-invoke discovery on entry because they validate against post-mutation state.

→ Proceed to **Step 7**.

---

## Step 7: Initialize Discovery

> *Output the next fenced block as a code block:*

```
── Initialize Discovery ─────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Ensuring the discovery directory exists and capturing session
> metadata. The session log file is created lazily on first state
> change — see references/template.md.
```

Load **[initialize-discovery.md](references/initialize-discovery.md)** and follow its instructions as written.

→ Proceed to **Step 8**.

---

## Step 8: Load Discovery Guidelines

> *Output the next fenced block as a code block:*

```
── Load Discovery Guidelines ────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Loading the curatorial moves and hard rules that shape how the
> topic-mapping conversation is run.
```

Load **[discovery-guidelines.md](references/discovery-guidelines.md)** and follow its instructions as written.

→ Proceed to **Step 9**.

---

## Step 9: Session Loop

> *Output the next fenced block as a code block:*

```
── Session Loop ─────────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Mapping topics. A fresh epic continues the shaping it began at
> macro level; an existing map adds edits alongside new exploration.
> Topics synthesise at endpoint.
```

Load **[session-loop.md](references/session-loop.md)** and follow its instructions as written.

→ Proceed to **Step 10**.

---

## Step 10: Document Review

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

→ Proceed to **Step 11**.

---

## Step 11: Confirm and Persist Topics

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

→ Proceed to **Step 12**.

---

## Step 12: Compliance Self-Check

> *Output the next fenced block as a code block:*

```
── Compliance Self-Check ────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Verifying the session followed discovery conventions before
> bridging out.
```

Load **[compliance-check.md](../workflow-shared/references/compliance-check.md)** and follow its instructions as written.

→ Proceed to **Step 13**.

---

## Step 13: Conclude Discovery

> *Output the next fenced block as a code block:*

```
── Conclude Discovery ───────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Wrapping up. Final commit and bridge to the epic menu so you can
> pick the next move from the discovery map.
```

Load **[conclude-discovery.md](references/conclude-discovery.md)** and follow its instructions as written.

---

## Step 14: Feature / Cross-Cutting Endpoint

> *Output the next fenced block as a code block:*

```
── Route to First Phase ─────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> One routing decision left — research first, or straight to
> discussion. Then the shaped work hands off to its first phase.
```

Load **[feature-cc-routing.md](references/feature-cc-routing.md)** and follow its instructions as written.

---

## Step 15: Bugfix / Quick-Fix Endpoint

> *Output the next fenced block as a code block:*

```
── Route to First Phase ─────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Nothing left to route — capturing the intent and handing off to
> investigation (bugfix) or scoping (quick-fix).
```

Load **[intent-capture.md](references/intent-capture.md)** and follow its instructions as written.

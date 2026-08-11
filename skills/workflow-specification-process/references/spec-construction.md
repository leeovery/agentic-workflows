# Spec Construction

*Reference for **[workflow-specification-process](../SKILL.md)***

---

Follow stages A through F sequentially for each topic in the specification. Each topic completes a full cycle before the next begins.

```
A. Exhaustive extraction from sources (incl. consult references read narrowly)
B. Synthesize and present for approval
C. Discuss and refine (if needed)
D. Approval gate
E. Log and commit
F. Topic complete → loop back to A or exit
```

---

## A. Exhaustive Extraction

Every topic's content must be derivable from its sources. When source material disagrees — with itself, or with another source — or is too unclear to extract without assumption, never silently pick a side: work it per **Resolve Source Incoherence** below, in the moment it surfaces. Tension notes held from session setup are raised the same way when the topic that touches them arrives.

→ Load **[exhaustive-extraction.md](exhaustive-extraction.md)** and follow its instructions as written.

When working with multiple sources, search each one — information about a single topic may be scattered across documents.

### Context Resurfacing

This gate stays gated even when `construction_gate_mode` is `auto` — it changes already-approved content, so it always stops for confirmation.

When extraction reveals information that affects **already-logged topics**, resurface them immediately. Even mid-discussion — interrupt, flag what you found, and discuss whether it changes anything.

If it does: summarize what's changing in the chat, then present the changes as a diff view. The summary is for discussion only — the specification just gets the clean replacement.

Read the current approved content from the specification file. Prepare the updated version. Present only the changed lines with 2 lines of context above and below:

> *Output the next fenced block as markdown (not a code block):*

```
**Resurfacing: {section name}**
```

> *Output the next fenced block as a ` ```diff ` code block:*

```diff
 {2 context lines above}
-{removed/changed lines}
+{new/replacement lines}
 {2 context lines below}
```

Then, **separately from the diff above** (clear visual break):

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
**`◆ Record this to the specification verbatim?`**

**`y/yes`**                  → Apply changes to specification
**`v/view full`**            → Show the full updated section, then decide
**Tell me what to change** → Revise before recording
```

> **CHECKPOINT**: Even when resurfacing content, you MUST NOT update the specification until the user explicitly approves the change. STOP and wait for response.

#### If `yes`

Update the specification with the approved changes. Commit. Continue extraction.

→ Return to **A. Exhaustive Extraction**.

#### If `view full`

Re-present the full updated section in the format it would appear in the specification. Then re-present the approval menu without `v`/`view full`.

→ Return to **A. Exhaustive Extraction**.

#### If the user provides feedback

Work through the changes per **C. Discuss and Refine**, then re-present the diff with the revised content.

→ Return to **A. Exhaustive Extraction**.

Better to resurface and confirm "already covered" than let something slip past.

### Read Consult References Narrowly

Consult references are sibling discussions that owe this spec a correction — they are **not** sources. Read only the relevant slice, never the whole document.

List the pending ones (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.specification.{topic} consult_references` returns names + status). For each still `pending`:

1. Find its slice hint — the `{ref-topic} — {slice hint}` entry in the handoff's `Consult references` block, or, if the handoff is no longer in context (e.g. after a resume), the `**Consult**` line for it in `.workflows/{work_unit}/.state/discussion-consolidation-analysis.md`.
2. Open the named sibling discussion and read **only** the decisions the slice hint points to — plus its `## Spec hand-offs` section if the discussion happens to have one. Do not extract it wholesale.
3. Apply the correction to the affected spec content, or cite the sibling decision where the spec defers to it — cite, don't restate. Corrections to already-logged content go through **Context Resurfacing** above. A consult correction that contradicts a source's *decided* ground is never applied silently — that is a decision owed: work it per **Resolve Source Incoherence**. If the correction targets a topic not yet constructed, leave the reference `pending` and revisit it on that topic's cycle.
4. Once applied or cited, record what was reconciled (which slice, what changed) in the spec's **Working Notes** section and mark the reference addressed:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.specification.{topic} consult_references.{ref}.status addressed
   ```

Already-`addressed` references are skipped on later topic cycles.

→ Proceed to **B. Synthesize and Present**.

---

## B. Synthesize and Present

Check the draft against the one-home rule (**[specification-format.md](specification-format.md)**): a fact already stated in the specification is referenced at its home, never restated. If the new topic should own the fact, move it — edits to already-logged content go through **Context Resurfacing**.

Source disagreement first noticed here — while forcing two sources into one draft — routes exactly as it does during extraction: **Resolve Source Incoherence**, whose decision stop overrides `auto`. Never let the auto branch below absorb an unresolved conflict.

Present your understanding to the user **in the format it would appear in the specification** (shown in both modes):

> *Output the next fenced block as markdown (not a code block):*

```
Here's what I understand about [topic] based on the reference material. This is exactly what I'll write into the specification:

[content as rendered markdown]
```

Then check `construction_gate_mode` via `engine manifest` (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.specification.{topic} construction_gate_mode`).

#### If `construction_gate_mode` is `auto`

Skip the menu and the STOP gate. The content presented above is logged exactly as shown.

> *Output the next fenced block as a code block:*

```
{topic:(titlecase)} — auto-approved. Recording to the specification.
```

**CRITICAL**: Auto removes only the approval STOP — process one topic at a time (extract → present → log → commit → next). Never generate multiple topics, or the whole specification, in a single pass. Commit after each topic.

→ Proceed to **E. Log and Commit**.

#### If `construction_gate_mode` is `gated`

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
**`◆ Record this to the specification verbatim?`**

**`y/yes`**                  → Add exactly as shown, no modifications
**`a/auto`**                 → Approve this and all remaining topics automatically
**Tell me what to change** → Revise before recording
```

**STOP.** Wait for user response.

#### If `yes`

→ Proceed to **E. Log and Commit**.

#### If `auto`

Set `construction_gate_mode` to `auto` via `engine manifest` (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.specification.{topic} construction_gate_mode auto`).

→ Proceed to **E. Log and Commit**.

#### If the user provides feedback

→ Proceed to **C. Discuss and Refine**.

---

## C. Discuss and Refine

Work through the content together:
- Validate what's accurate
- Remove what's wrong, outdated, or hallucinated
- Add what's missing through brief discussion
- **Course correct** based on knowledge from subsequent project work
- Refine wording and structure

This is a **human-level conversation**, not form-filling. The user brings context from across the project that may not be in the reference material — decisions from other topics, implications from later work, or knowledge that can't all fit in context.

→ Proceed to **D. Approval Gate**.

---

## D. Approval Gate

**DO NOT PROCEED TO LOGGING WITHOUT EXPLICIT USER APPROVAL.**

If you are uncertain whether the user approved, **ASK**: "Ready to log it, or do you want to change something?"

> **CHECKPOINT**: If you are about to write to the specification and the user's last message was not explicit approval, **STOP**. Present the choices again.

→ Proceed to **E. Log and Commit**.

---

## E. Log and Commit

1. Write to the specification — **verbatim** as presented and approved. No silent modifications. Before extracting a `pending` source, re-read the specification for content already logged from it (a crash can leave content written with the status still `pending`) — never double-log.
2. After completing exhaustive extraction from a source (all relevant content presented and logged), update that source's status to `incorporated` via `engine manifest` (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.specification.{topic} sources.{source-name}.status incorporated`). `{source-name}` is the registered key — read the existing `sources` map and flip that row, never invent a new name (for a bugfix it is `{topic}`). See **[specification-format.md](specification-format.md)** for source status details.
3. Commit at natural breaks — after significant exchanges, after each major topic, and before any context refresh:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "spec({work_unit}): {what changed}"
   ```

→ Proceed to **F. Topic Complete**.

---

## F. Topic Complete

This is the end of this iteration.

#### If additional topics remain

→ Return to **A. Exhaustive Extraction**.

#### If all topics are covered

→ Return to caller.

---

## Reconcile Stale Sources

Entered by name when a source row reads `stale` — its discussion was re-decided after extraction, so the specification holds content from a decision that has since moved. Reconcile the logged content against the revision; never re-extract the source wholesale.

First check the source discussion's status (`engine manifest get {work_unit}.discussion.{source-name} status`). If it is `in-progress`, the revision is not final — defer: leave the row `stale`, tell the user reconciliation waits for that discussion to re-conclude, and → Return to caller. Otherwise:

1. Re-read the source discussion (`.workflows/{work_unit}/discussion/{source-name}.md`) in full. Its decision timeline marks the revision — identify which decisions changed, which were added, and which stand.
2. Re-read the specification for the content logged from that source.
3. Diff the two in judgment: content the revision left standing stays untouched. For content the revision contradicts or extends, present the changed lines as a diff view (the Context Resurfacing display shape — summary in chat, only changed lines with 2 lines of context) and gate on explicit approval; this gate stays gated even when `construction_gate_mode` is `auto`. On approval, write the clean replacement to the specification verbatim — no silent modifications.
4. When every changed decision is reconciled, mark the source `incorporated` and commit:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.specification.{topic} sources.{source-name}.status incorporated
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "spec({work_unit}): reconcile stale source {source-name}"
```

→ Return to caller.

---

## Resolve Source Incoherence

Entered by name from **A** or **B** when source material disagrees — with itself, or with another source — or cannot be extracted without assumption. Specification makes decisions clear; it never makes them. `{doc}` throughout is the owning source's topic name; its artifact path resolves per the source ladder in **[spec-review.md](spec-review.md)** (sources can be investigations or research files, not only discussions).

#### If the timeline resolves it

One side is acknowledged supersession — a dated Decision-block entry, or prose the newer decision names as changed. Not incoherence: extract the governing decision.

→ Return to **A. Exhaustive Extraction**.

#### If it is a repair of record

The decisions cohere; one document's prose relies, as current, on a value or mechanism another document has since moved, and the citing conclusion survives the correction. No choice exists — no stop, on either gate mode.

→ Proceed to **Landing a Resolution** with resolution = `{the repair}`, doc = `{the citing document's topic}`, origin = `repair`.

#### If a decision is owed

The sources decide incompatibly, or the material is unclear in a way only a choice can settle. **This stop overrides `auto`** — like Context Resurfacing, it exists precisely because no choice is ever made without the user. Present both sides with verbatim quotes cited file + section, and what breaks if extraction proceeds anyway. Then the menu — one numbered option per side, the recommended side first with `(recommended)`:

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
**`◆ Which decision stands?`**

**`1`**       → {side A, one line} (recommended)
**`2`**       → {side B, one line}
**`g/gap`**   → Neither stands — route this back to "{doc}" for a real discussion
**Comment** → Tell me what you're thinking; we'll work it through
```

**STOP.** Wait for user response.

**If the user picks a side:**

→ Proceed to **Landing a Resolution** with resolution = `{the chosen decision}`, doc = `{the yielding document's topic}`, origin = `decision`.

**If `gap`:**

→ Proceed to **The Gap Exit**.

**If comment:**

Work it through conversationally, then re-present the menu with anything the discussion changed.

→ Return to **Resolve Source Incoherence** (the menu above).

#### If it is a gap

Nothing was ever decided, and the topic cannot be written until it is.

→ Proceed to **The Gap Exit**.

### The Gap Exit

The gap belongs to the phase that owns decisions. Confirm before anything moves:

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
This pauses the specification and sends the question back to "{doc}" — its item reopens, and this spec waits on the answer.

**`◆ Route it back?`**

**`y/yes`** → Pause here and send the gap to "{doc}"
**`n/no`**  → Keep it with this session; we'll work it here
```

**STOP.** Wait for user response.

#### If `no`

The concern stays in this session's conversation — resolve it as a decision owed or park the topic and continue with another.

→ Return to **A. Exhaustive Extraction**.

#### If `yes` and the work type is `epic`

→ Load **[triage-landing.md](../../workflow-shared/references/triage-landing.md)** with work_unit = `{work_unit}`, target = `{doc}`, concern = `{the gap: what the topic needs, both quotes where sources frame it, what was just explored}`, origin = `{topic}`, phase = `specification`, landing_phase = `discussion`, date = `{today}`.

On return, read `result`.

**If `result` is `cancelled`:**

Nothing landed — the concern stays with this session.

→ Return to **The Gap Exit** (the gate above).

**If `result` is `landed`:**

→ Proceed to **Pause the Specification**.

#### If `yes` and the work type is not `epic`

Single-topic work types route back directly — reopen the owning source item (its phase is the source's own: `discussion`, or `investigation` for a bugfix):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic reopen {work_unit} {source phase} {doc}
```

Tell the user what the reopened session must settle — the gap travels as conversation here, not as a queue file.

→ Proceed to **Pause the Specification**.

### Pause the Specification

An `incorporated` row for that source has flipped to `stale` and reconciles at re-entry; a still-`pending` row simply re-extracts the updated document when construction resumes — either way the engine refuses to conclude this spec until the source is current. Commit the session's work:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "spec({work_unit}): pause — gap routed to {doc}"
```

Tell the user: this specification waits on that discussion — have it there, re-enter the spec after. Do not run document dependencies, review, or conclusion.

**STOP.** Do not proceed — terminal condition.

### Landing a Resolution

The resolution is written into the owning source document in that phase's own idiom — no meta-narration, no reference to specification or to this session: the document reads as its own record.

1. **Check presence**: `node .claude/skills/workflow-engine/scripts/engine.cjs presence scan {work_unit}` — read the `sessions` rows only; the response's deferral section is scoped to the analysis dispatch and is not emitted here.

   **If a row matches `{doc}`'s phase and topic with `held` and `live` both true** — a live session owns that document. Do not edit. Tell the user, and put the choice to them:

   > *Output the next fenced block as markdown (not a code block):*

   ```
   · · · · · · · · · · · ·
   "{doc}" is open in another session right now, so the fix belongs there — this topic waits for it.

   **`◆ How do you want to continue?`**

   **`n/next`** → Set this topic aside and move to the next
   **`s/stop`** → Stop here; re-enter after that session lands it
   ```

   **STOP.** Wait for user response. On `next`: for an epic, first deliver the resolution to that session's queue (the triage delivery in **The Gap Exit**, concern = the agreed resolution); → Return to **F. Topic Complete**. On `stop`: same delivery where the work type is `epic`, then commit the session's work and stop — terminal condition.

   **Otherwise** — no row holds `{doc}`:

   → Proceed to step 2.

2. **Edit the document** — targeted, in the owning phase's own idiom. A discussion's decided Decision block is revised as its format prescribes (**[../../workflow-discussion-process/references/template.md](../../workflow-discussion-process/references/template.md)** → Decision revisions): the new decision lands as a dated timeline entry above the prior prose, wrapped verbatim under `#### Initial`, with the `Trigger:` line citing the substantive cause — the colliding decision, never this session. Citing prose the resolution invalidates is repaired in place. Investigation and research documents carry no timeline rule — edit the affected passages directly.
3. **Reindex it**: `node .claude/skills/workflow-knowledge/scripts/knowledge.cjs index {the resolved artifact path}` — the knowledge base serves the resolution for the rest of the work.
4. **Stale the other extractions** — only when `{doc}` is a discussion (the reverse join covers discussion sources; single-topic work types have no sibling specs and skip this): `node .claude/skills/workflow-engine/scripts/engine.cjs sources stale {work_unit} {doc} --except {topic}`. When the response's `staled` is non-empty, tell the user in one line which specification(s) it named.
5. **Commit**: `node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "{source phase}({work_unit}/{doc}): {what the resolution settled}" --topic {source phase}/{doc} --kb`.

**If origin is `repair`:**

Carry a one-line note into the next **B** presentation — rendered after the content, above the gate (on `auto`, appended after the auto announcement), never inside the content block the specification logs: `Resolved along the way: {what was repaired}.`

→ Return to **A. Exhaustive Extraction**.

**If origin is `decision`:**

The topic continues against the updated source.

→ Return to **A. Exhaustive Extraction**.

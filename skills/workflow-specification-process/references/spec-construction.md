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

→ Load **[exhaustive-extraction.md](exhaustive-extraction.md)** and follow its instructions as written.

When working with multiple sources, search each one — information about a single topic may be scattered across documents.

### Context Resurfacing

This gate stays gated even when `construction_gate_mode` is `auto` — it changes already-approved content, so it always stops for confirmation.

When extraction reveals information that affects **already-logged topics**, resurface them immediately. Even mid-discussion — interrupt, flag what you found, and discuss whether it changes anything.

If it does: summarize what's changing in the chat, then present the changes as a diff view. The summary is for discussion only — the specification just gets the clean replacement.

Read the current approved content from the specification file. Prepare the updated version. Present only the changed lines with 2 lines of context above and below, wrapped in a visual border:

> *Output the next fenced block as a code block:*

```
╭─ Resurfacing: {section name} ─────────────────────╮
```

> *Output the next fenced block as a code block:*

```diff
 {2 context lines above}
-{removed/changed lines}
+{new/replacement lines}
 {2 context lines below}
```

> *Output the next fenced block as a code block:*

```
╰───────────────────────────────────────────────────╯
```

Then, **separately from the diff above** (clear visual break):

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Record this to the specification verbatim?

- **`y`/`yes`** — Apply changes to specification
- **`v`/`view full`** — Show the full updated section, then decide
- **Tell me what to change** — Revise before recording
· · · · · · · · · · · ·
```

> **CHECKPOINT**: Even when resurfacing content, you MUST NOT update the specification until the user explicitly approves the change. STOP and wait for response.

#### If `yes`

Update the specification with the approved changes. Commit. Continue extraction.

#### If `view full`

Re-present the full updated section in the format it would appear in the specification. Then re-present the approval menu without `v`/`view full`.

#### If the user provides feedback

Work through the changes per **C. Discuss and Refine**, then re-present the diff with the revised content.

Better to resurface and confirm "already covered" than let something slip past.

### Read Consult References Narrowly

Consult references are sibling discussions that owe this spec a correction — they are **not** sources. Read only the relevant slice, never the whole document.

List the pending ones (`node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.specification.{topic} consult_references` returns names + status). For each still `pending`:

1. Find its slice hint — the `{ref-topic} — {slice hint}` entry in the handoff's `Consult references` block, or, if the handoff is no longer in context (e.g. after a resume), the `**Consult**` line for it in `.workflows/{work_unit}/.state/discussion-consolidation-analysis.md`.
2. Open the named sibling discussion and read **only** the decisions the slice hint points to — plus its `## Spec hand-offs` section if the discussion happens to have one. Do not extract it wholesale.
3. Apply the correction to the affected spec content, or cite the sibling decision where the spec defers to it — cite, don't restate. Corrections to already-logged content go through **Context Resurfacing** above. If the correction targets a topic not yet constructed, leave the reference `pending` and revisit it on that topic's cycle.
4. Once applied or cited, record what was reconciled (which slice, what changed) in the spec's **Working Notes** section and mark the reference addressed:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.specification.{topic} consult_references.{ref}.status addressed
   ```

Already-`addressed` references are skipped on later topic cycles.

---

## B. Synthesize and Present

Present your understanding to the user **in the format it would appear in the specification** (shown in both modes):

> *Output the next fenced block as markdown (not a code block):*

```
Here's what I understand about [topic] based on the reference material. This is exactly what I'll write into the specification:

[content as rendered markdown]
```

Then check `construction_gate_mode` via manifest CLI (`node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.specification.{topic} construction_gate_mode`).

#### If `construction_gate_mode` is `auto`

Skip the menu and STOP. The content presented above is logged exactly as shown — auto adds no output of its own.

**CRITICAL**: Auto removes only the approval STOP — process one topic at a time (extract → present → log → commit → next). Never generate multiple topics, or the whole specification, in a single pass. Commit after each topic.

→ Proceed to **E. Log and Commit**.

#### If `construction_gate_mode` is `gated`

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Record this to the specification verbatim?

- **`y`/`yes`** — Add exactly as shown, no modifications
- **`a`/`auto`** — Add this and all remaining topics automatically
- **Tell me what to change** — Revise before recording
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `yes`

→ Proceed to **E. Log and Commit**.

#### If `auto`

Set `construction_gate_mode` to `auto` via manifest CLI (`node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.specification.{topic} construction_gate_mode auto`).

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

---

## D. Approval Gate

**DO NOT PROCEED TO LOGGING WITHOUT EXPLICIT USER APPROVAL.**

If you are uncertain whether the user approved, **ASK**: "Ready to log it, or do you want to change something?"

> **CHECKPOINT**: If you are about to write to the specification and the user's last message was not explicit approval, **STOP**. Present the choices again.

---

## E. Log and Commit

1. Write to the specification — **verbatim** as presented and approved. No silent modifications.
2. After completing exhaustive extraction from a source (all relevant content presented and logged), update that source's status to `incorporated` via manifest CLI (`node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.specification.{topic} sources.{source-name}.status incorporated`). See **[specification-format.md](specification-format.md)** for source status details.
3. Commit at natural breaks — after significant exchanges, after each major topic, and before any context refresh.

---

## F. Topic Complete

This is the end of this iteration.

#### If additional topics remain

→ Return to **A. Exhaustive Extraction**.

#### If all topics are covered

→ Return to caller.

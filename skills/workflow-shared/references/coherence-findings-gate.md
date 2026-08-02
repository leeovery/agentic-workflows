# Coherence Findings Gate

*Shared reference. Loaded by [topic-discovery.md](topic-discovery.md).*

---

Presents the findings the coherence analysis staged and gates each before anything lands. Approving a finding delivers it through [triage-landing.md](triage-landing.md) — `topic triage` reopens the yielding discussion and the finding lands in its triage queue, where the next discussion session drains it and the conclusion gate forces resolution. A `stale-reference` finding whose target is still `completed` may instead be **repaired** — the correction applied to the target artifact directly, no reopen. Skipping a finding records its fingerprint in `phases.discovery.dismissed_findings[]` so the analysis won't re-stage it. Deferring leaves every finding `pending` and signals the host to skip the cache stamp, so the same staging is re-presented next boot without re-running the analysis.

The gate is the boot-time review surface — it runs before the dashboard.

## Parameters

The caller provides these via context before loading:

- `work_unit` — the epic's work unit name.
- `tracker` — a list (initially empty) the caller surfaces as the reopened-topics callout. The reference appends a topic name only when a finding is **approved and landed**.
- `staging_file` — path to the staging file (`.workflows/{work_unit}/.state/coherence-analysis-candidates.md`).

On return, the reference sets `gate_outcome` to `processed` (gate ran to completion — host stamps the cache) or `deferred` (host skips the stamp), and `repairs_landed` — `true` when at least one finding took the repair arm, else `false`. A repair edits the corpus after the analysis read it, so the host must not stamp over it.

## A. Lead-In and Defer

Set `repairs_landed` to `false`. Read `staging_file` (finding content) and the gate state: `manifest get {work_unit}.discovery analysis_staging.coherence-analysis`. Count the candidates whose `status` is `pending` — call it `K`.

#### If `K` is `0`

Nothing to review (the analysis staged nothing, or every finding was already handled on a prior pass).

A processed gate's state is spent — landed findings live in their targets' triage queues, skipped fingerprints on the dismissed list. Set `gate_outcome` to `processed` and clear the state — skip the call when the gate-state read found no `analysis_staging.coherence-analysis` subtree (the analysis staged nothing, so there is no state to clear):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest delete {work_unit}.discovery analysis_staging.coherence-analysis
```

→ Return to caller.

#### If `K` is `1` or more

> *Output the next fenced block as a code block:*

```
Coherence check surfaced {K} finding(s) across your completed
discussions — review before continuing.
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Review them now?

- **`r`/`review`** — Review each finding now
- **`d`/`defer`** — Postpone all; review next time (nothing is written)
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `defer`

Leave every finding `pending`. Land nothing. Append nothing to `tracker`.

Set `gate_outcome` to `deferred`.

→ Return to caller.

#### If `review`

→ Proceed to **B. Gate Each Finding**.

## B. Gate Each Finding

Walk the finding blocks in staging-file order. For the next finding the manifest marks `pending`:

#### If no `pending` block remains

A processed gate's state is spent — landed findings live in their targets' triage queues, skipped fingerprints on the dismissed list. Clear it, set `gate_outcome` to `processed`:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest delete {work_unit}.discovery analysis_staging.coherence-analysis
```

Commit — this commit covers the gate's own state and skips (each landing already committed itself through the delivery):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "discovery({work_unit}): coherence findings triaged"
```

→ Return to caller.

#### Otherwise

Render the finding from its block:

> *Output the next fenced block as a code block:*

```
{slug:(titlecase)} [{category:[conflict|stale-reference|ambiguity]}]
  {summary}

  {docA}.md · {section}: "{quote}"
  {docB}.md · {section}: "{quote}"

  Resolves in: {target}
```

Read `gate_mode` from the manifest's `analysis_staging.coherence-analysis` subtree (held from the **A** read; re-read if stale). Derive `repair_available` — `true` only when the finding's `category` is `stale-reference` **and** the target's discussion item still reads `completed` (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.discussion.{target} status` — an earlier landing this pass may have reopened it; a live document is corrected through its own session, never from the gate).

#### If `gate_mode` is `auto`

Auto approves through the triage delivery only — a repair edits an artifact directly and is never taken without an explicit choice.

> *Output the next fenced block as a code block:*

```
{slug:(titlecase)} — approved [auto].
```

→ Proceed to **C. Land Approved Finding**.

#### If `gate_mode` is `gated`

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Send this finding to "{target}" for resolution?

- **`y`/`yes`** — Approve; reopen "{target}" with the finding in its triage
@if(repair_available) - **`r`/`repair`** — Apply the dated correction to "{target}" directly — no reopen @endif
- **`a`/`auto`** — Approve this and all remaining findings automatically
- **`s`/`skip`** — Skip and dismiss (won't be re-surfaced)
- **Comment** — Tell me what to change (target, summary, or context)
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `yes`:**

→ Proceed to **C. Land Approved Finding**.

**If `repair`:**

→ Proceed to **D. Repair Stale Reference**.

**If `auto`:**

Record it (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.discovery analysis_staging.coherence-analysis.gate_mode auto`) so subsequent findings approve without a stop.

→ Proceed to **C. Land Approved Finding**.

**If `skip`:**

Record the skip (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.discovery analysis_staging.coherence-analysis.candidates.{slug}.status skipped`) and add the fingerprint (`{docA}|{docB}|{slug}`, sorted doc basenames — as staged) to the dismissed list:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest push {work_unit}.discovery dismissed_findings "{fingerprint}"
```

→ Return to **B. Gate Each Finding**.

**If comment:**

Revise this block's `target`, `summary`, or context in the staging file per the user's feedback (content edits only). The finding stays `pending`.

→ Return to **B. Gate Each Finding**.

## C. Land Approved Finding

Deliver through the shared triage landing — the finding's title, quotes, and full context paragraphs travel as the concern so the reopened session can resolve it from cold. `origin` is the block's `counterpart`; for a single-document finding (`counterpart: (none)`) pass the literal `coherence-review` instead — the entry's provenance line then names the check, not a topic:

→ Load **[triage-landing.md](triage-landing.md)** with work_unit = `{work_unit}`, target = `{target}`, concern = `{finding title + both quotes with citations + the block's full context paragraphs}`, origin = `{counterpart, or coherence-review}`, phase = `discussion`, landing_phase = `discussion`, date = `{today}`.

On return, read `result`.

**If `result` is `landed`:**

Record the approval (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.discovery analysis_staging.coherence-analysis.candidates.{slug}.status approved`) and append `landed_topic` to the caller's `tracker` unless already present — several findings can land in one discussion, and the callout counts topics, not findings.

→ Return to **B. Gate Each Finding**.

**If `result` is `cancelled` and `gate_mode` is `gated`:**

The landing was dropped or blocked — nothing was written. The finding stays `pending`; re-present it.

→ Return to **B. Gate Each Finding**.

**If `result` is `cancelled` and `gate_mode` is `auto`:**

Never loop a failing landing without the user. Record the finding `skipped` (same write as the skip arm) but push **no** dismissed fingerprint — the next stale run re-stages it with the user present.

→ Return to **B. Gate Each Finding**.

## D. Repair Stale Reference

The finding's target-side quote anchors the stale prose. Read `.workflows/{work_unit}/discussion/{target}.md` and locate that quote.

#### If the quote no longer appears verbatim

The document moved since the finding was staged — the evidence is stale and there is nothing safe to anchor an edit to. Tell the user, name approve or skip as the ways forward, and re-present the finding.

→ Return to **B. Gate Each Finding**.

#### Otherwise

The counterpart quote and context paragraphs hold what is current. Compose the repair:

1. Replace the stale prose with text reflecting the current decision.
2. At the top of the file, directly beneath the title, add (or extend, one entry per correction):

   ```markdown
   > **Corrigendum {YYYY-MM-DD}** (coherence check@if(counterpart != '(none)'), from `{counterpart}`@endif): {stale claim, quoted} — corrected: {what is current}.
   ```

Show the edit before anything is written — narrate nothing between the fence and the menu:

> *Output the next fenced block as a ` ```diff ` code block:*

```diff
 {2 context lines above}
-{the stale prose}
+{the corrected prose}
 {2 context lines below}
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Apply this repair to "{target}"?

- **`y`/`yes`** — Edit in place + corrigendum + knowledge re-index; no reopen
- **`n`/`no`** — Back to the finding's options
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `no`:**

The finding stays `pending`; its menu re-presents.

→ Return to **B. Gate Each Finding**.

**If `yes`:**

1. Apply the edit and the corrigendum block.
2. Re-index the artifact — replaces its chunks in one idempotent call; the topic stays `completed`, no status transition:

   ```bash
   node .claude/skills/workflow-knowledge/scripts/knowledge.cjs index .workflows/{work_unit}/discussion/{target}.md
   ```

3. Record the outcome (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.discovery analysis_staging.coherence-analysis.candidates.{slug}.status repaired`) and commit action-scoped with the store riding along — the `(coherence repair)` marker tells the commit classifiers this is boot-time bookkeeping, not session movement:

   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --topic discussion/{target} --kb -m "discussion({work_unit}/{target}): repair stale reference — {slug} (coherence repair)"
   ```

Set `repairs_landed` to `true`. Append nothing to `tracker` — nothing reopened. The repaired prose is gone from the corpus, so the next analysis run cannot re-find it; no dismissed fingerprint.

→ Return to **B. Gate Each Finding**.

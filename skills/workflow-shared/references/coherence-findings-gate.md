# Coherence Findings Gate

*Shared reference. Loaded by [topic-discovery.md](topic-discovery.md).*

---

Presents the findings the coherence analysis staged and gates each before anything lands. Approving a finding delivers it through [triage-landing.md](triage-landing.md) — `topic triage` reopens the yielding discussion and the finding lands in its triage queue, where the next discussion session surfaces it and the conclusion gate forces resolution. Skipping a finding records its fingerprint in `phases.discovery.dismissed_findings[]` so the analysis won't re-stage it. Deferring leaves every finding `pending` and signals the host to skip the cache stamp, so the same staging is re-presented next boot without re-running the analysis.

The gate is the boot-time review surface — it runs before the dashboard.

## Parameters

The caller provides these via context before loading:

- `work_unit` — the epic's work unit name.
- `tracker` — a list (initially empty) the caller surfaces as the reopened-topics callout. The reference appends a topic name only when a finding is **approved and landed**.
- `staging_file` — path to the staging file (`.workflows/{work_unit}/.state/coherence-analysis-candidates.md`).

On return, the reference sets `gate_outcome` to `processed` (gate ran to completion — host stamps the cache) or `deferred` (host skips the stamp).

## A. Lead-In and Defer

Read `staging_file` (finding content) and the gate state: `manifest get {work_unit}.discovery analysis_staging.coherence-analysis`. Count the candidates whose `status` is `pending` — call it `K`.

#### If `K` is `0`

Nothing to review (the analysis staged nothing, or every finding was already handled on a prior pass).

A processed gate's state is spent — landed findings live in their targets' triage queues, skipped fingerprints on the dismissed list. Set `gate_outcome` to `processed` and clear the state — the manifest subtree and its on-disk staging file together; skip both when the gate-state read found no `analysis_staging.coherence-analysis` subtree (the analysis staged nothing, so there is no state to clear):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest delete {work_unit}.discovery analysis_staging.coherence-analysis
rm -f {staging_file}
```

> *Output the next fenced block as a code block:*

```
Nothing new to review.
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
**`◆ Review them now?`**

**`r/review`** → Review each finding now
**`d/defer`**  → Postpone all; review next time (nothing is written)
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

A processed gate's state is spent — landed findings live in their targets' triage queues, skipped fingerprints on the dismissed list. Clear it — the manifest subtree and its on-disk staging file together — and set `gate_outcome` to `processed`:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest delete {work_unit}.discovery analysis_staging.coherence-analysis
rm -f {staging_file}
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

  Resolves in: {target} — reopens to re-decide or repair
```

Read `gate_mode` from the manifest's `analysis_staging.coherence-analysis` subtree (held from the **A** read; re-read if stale).

#### If `gate_mode` is `auto`

> *Output the next fenced block as a code block:*

```
{slug:(titlecase)} — approved [auto].
```

→ Proceed to **C. Land Approved Finding**.

#### If `gate_mode` is `gated`

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
**`◆ Send this finding to "{target}" for resolution?`**

**`y/yes`**   → Approve; reopen "{target}" with the finding in its triage
**`a/auto`**  → Approve this and all remaining findings automatically
**`s/skip`**  → Skip and dismiss (won't be re-surfaced)
**Comment** → Tell me what to change (target, summary, or context)
```

**STOP.** Wait for user response.

**If `yes`:**

→ Proceed to **C. Land Approved Finding**.

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

Record the approval (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.discovery analysis_staging.coherence-analysis.candidates.{slug}.status approved`) and append `landed_topic` to the caller's `tracker` unless already present — several findings can land in one discussion, and the callout counts topics, not findings. When the landing response carried `reconcile_flagged` or `sources_staled`, also tell the user the specification(s) named in `sources_staled` were flagged to reconcile — their extraction of `{landed_topic}` is now stale.

→ Return to **B. Gate Each Finding**.

**If `result` is `cancelled` and `gate_mode` is `gated`:**

The landing was dropped or blocked — nothing was written. The finding stays `pending`; re-present it.

→ Return to **B. Gate Each Finding**.

**If `result` is `cancelled` and `gate_mode` is `auto`:**

Never loop a failing landing without the user. Record the finding `skipped` (same write as the skip arm) but push **no** dismissed fingerprint — the next stale run re-stages it with the user present.

→ Return to **B. Gate Each Finding**.

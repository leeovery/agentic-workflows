# Analysis Approval Gate

*Shared reference. Loaded by [topic-discovery.md](topic-discovery.md).*

---

Presents the candidate topics an analysis staged, gates each per-topic before anything lands on the discovery map, and writes the approved ones. The analysis (`research-analysis` or `discovery-gap-analysis`) has already staged its genuinely-new candidates — content in the per-analysis staging file, gate state in the manifest's `analysis_staging.{analysis}` subtree, each candidate `pending`; the already-on-map and dismissed cases were resolved silently at stage time and never reach this gate.

The gate is the boot-time review surface — it runs before the dashboard. Approving a candidate writes it to `phases.discovery.items.{name}`; skipping it adds the name to `phases.discovery.dismissed[]` so the analysis won't re-propose it. Deferring leaves every candidate `pending` and signals the host to skip the cache stamp, so the same staging is re-presented next boot without re-running the analysis.

## Parameters

The caller provides these via context before loading:

- `analysis` — `research-analysis` or `discovery-gap-analysis`.
- `work_unit` — the epic's work unit name.
- `tracker` — a list (initially empty) the caller surfaces as the new-topics callout. The reference appends a name only when a candidate is **approved and written**.
- `staging_file` — path to the analysis's staging file (`.workflows/{work_unit}/.state/{analysis}-candidates.md`).

On return, the reference sets `gate_outcome` to `processed` (gate ran to completion — host stamps the cache) or `deferred` (host skips the stamp). A processed gate's state is spent: before returning `processed`, clear it (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest delete {work_unit}.discovery analysis_staging.{analysis}`) — approved candidates live on the map, skipped names on the dismissed list; the subtree is the gate's scratch, not the record.

`{analysis_label}`: `Research analysis` for `research-analysis`, `Gap analysis` for `discovery-gap-analysis`. Used in the lead-in.

## A. Lead-In and Defer

Read `staging_file` (candidate content) and the gate state: `manifest get {work_unit}.discovery analysis_staging.{analysis}`. Count the candidates whose `status` is `pending` — call it `K`.

#### If `K` is `0`

Nothing to review (every candidate was pre-resolved at stage time, or already approved/skipped on a prior pass).

Set `gate_outcome` to `processed`.

→ Return to caller.

#### If `K` is `1` or more

> *Output the next fenced block as a code block:*

```
{analysis_label} surfaced {K} candidate topic(s) — review before continuing.
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Review them now?

- **`r`/`review`** — Review each candidate now
- **`d`/`defer`** — Postpone all; review next time (nothing is written)
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `defer`

Leave every candidate `pending`. Write nothing to the map. Append nothing to `tracker`.

Set `gate_outcome` to `deferred`.

→ Return to caller.

#### If `review`

→ Proceed to **B. Gate Each Candidate**.

## B. Gate Each Candidate

Walk the candidate blocks in staging-file order. For the next candidate the manifest marks `pending`:

#### If no `pending` block remains

Set `gate_outcome` to `processed`.

→ Return to caller.

#### Otherwise

Render the candidate. `{provenance}` is `derived from research "{parent}"` when `analysis` is `research-analysis` (read `parent` from the block), or `surfaced by gap analysis` when `discovery-gap-analysis`.

> *Output the next fenced block as a code block:*

```
{name:(titlecase)} [{routing}]
  {summary}
  {provenance}
```

Read `gate_mode` from the manifest's `analysis_staging.{analysis}` subtree (held from the **A** read; re-read if stale).

#### If `gate_mode` is `auto`

> *Output the next fenced block as a code block:*

```
{name:(titlecase)} — approved [auto].
```

→ Proceed to **C. Write Approved Candidate**.

#### If `gate_mode` is `gated`

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Add this topic to the map?

- **`y`/`yes`** — Approve and add to the map
- **`a`/`auto`** — Approve this and all remaining candidates automatically
- **`s`/`skip`** — Skip and dismiss (won't be re-proposed)
- **Comment** — Tell me what to change (routing, summary, or description)
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `yes`:**

→ Proceed to **C. Write Approved Candidate**.

**If `auto`:**

Record it (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.discovery analysis_staging.{analysis}.gate_mode auto`) so subsequent candidates approve without a stop.

→ Proceed to **C. Write Approved Candidate**.

**If `skip`:**

Record the skip (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.discovery analysis_staging.{analysis}.candidates.{name}.status skipped`) and add the name to the dismissed list:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest push {work_unit}.discovery dismissed "{name}"
```

→ Return to **B. Gate Each Candidate**.

**If comment:**

Revise this block's `routing`, `summary`, or `description` in the staging file per the user's feedback (content edits only). The candidate stays `pending`.

→ Return to **B. Gate Each Candidate**.

## C. Write Approved Candidate

Record the approval (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.discovery analysis_staging.{analysis}.candidates.{name}.status approved`), then write the discovery item from the block's stored fields:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs discovery-map add {work_unit} {name} {routing} --source "{source}" --summary "{summary}" --description "{description}"
```

`source` is the block's stored value verbatim — `research-analysis:{parent}` for research-analysis (provenance renders as `from {parent}`), `gap-analysis` for gap-analysis.

#### If the response is `ok: false`

Deferred-reuse boots only — the map can change between staging and this write. Route on the refusal:

**If refused as an active duplicate** (the topic landed on the map via another path since staging):

Merge provenance instead, following the already-on-map branch of the analysis's **D. Filter and Stage** — read the item's `source` and, unless it already includes this analysis, extend it comma-joined. Record `node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.discovery analysis_staging.{analysis}.candidates.{name}.status resolved`; nothing is added to `tracker`.

→ Return to **B. Gate Each Candidate**.

**If refused as dismissed** (the user dismissed this name since staging):

Honour the dismissal. Record the candidate `skipped` (same write as the skip arm) — the name is already on the dismissed list, no push needed.

→ Return to **B. Gate Each Candidate**.

#### Otherwise

Append `{name}` to the caller's `tracker`.

**If `analysis` is `research-analysis`:**

→ Proceed to **D. Fan-Out Parent-Handled Offer**.

**Otherwise:**

→ Return to **B. Gate Each Candidate**.

## D. Fan-Out Parent-Handled Offer

Research-analysis derives a candidate from a completed research file (its `parent`) **without moving content out of that parent** — so the parent may still legitimately want its own discussion. This offers, once per parent, to mark the parent `handled`: a fanned-out research umbrella that stays on the map but stops prompting to be discussed.

Read this block's `parent`.

#### If the manifest marks any other candidate sharing the same `parent` with `fanout_offer` `marked` or `declined`

The offer for this parent already ran this session. Skip it (dedup).

→ Return to **B. Gate Each Candidate**.

#### Otherwise

Re-run discovery to read the parent's current lifecycle:

```bash
node .claude/skills/workflow-discovery/scripts/gateway.cjs {work_unit}
```

Find the `parent` row in `discovery_map`.

#### If the parent is not on the map, or its lifecycle is `handled`, `decided`, or `cancelled`

Not actionable — no offer. Record `fanout_offer` `declined` on every candidate sharing this `parent` (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.discovery analysis_staging.{analysis}.candidates.{name}.fanout_offer declined` per candidate) so it isn't reconsidered.

→ Return to **B. Gate Each Candidate**.

#### Otherwise (parent on the map and actionable)

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Derived from research "{parent:(titlecase)}". Mark "{parent:(titlecase)}"
handled — fanned out, keep on the map but stop prompting to discuss it?

- **`y`/`yes`** — Mark "{parent:(titlecase)}" handled
- **`n`/`no`** — Leave it actionable
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `yes`:**

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs discovery-map handle {work_unit} {parent}
```

Record `fanout_offer` `marked` on every candidate sharing this `parent` (same write shape, value `marked`).

→ Return to **B. Gate Each Candidate**.

**If `no`:**

Record `fanout_offer` `declined` on every candidate sharing this `parent` (same write shape).

→ Return to **B. Gate Each Candidate**.

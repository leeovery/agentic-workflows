# Analysis Approval Gate

*Shared reference. Loaded by [topic-discovery.md](topic-discovery.md).*

---

Presents the candidate topics gap-analysis staged, gates each per-topic before anything lands on the discovery map, and writes the approved ones. The analysis has already staged its genuinely-new candidates — content in the staging file, gate state in the manifest's `analysis_staging.discovery-gap-analysis` subtree, each candidate `pending`; the already-on-map and dismissed cases were resolved silently at stage time and never reach this gate.

The gate is the boot-time review surface — it runs before the dashboard. Approving a candidate writes it to `phases.discovery.items.{name}`; skipping it adds the name to `phases.discovery.dismissed[]` so the analysis won't re-propose it.

## Parameters

The caller provides these via context before loading:

- `work_unit` — the epic's work unit name.
- `tracker` — a list (initially empty) the caller surfaces as the new-topics callout. The reference appends a name only when a candidate is **approved and written**.

The staging file is `.workflows/{work_unit}/.state/discovery-gap-analysis-candidates.md`.

## A. Count and Announce

Read the staging file (candidate content) and the gate state: `manifest get {work_unit}.discovery analysis_staging.discovery-gap-analysis`. Count the candidates whose `status` is `pending` — call it `K`.

#### If `K` is `0`

Nothing to review (the analysis staged nothing, every candidate was pre-resolved at stage time, or all were already approved/skipped on a prior pass).

A processed gate's state is spent — approved candidates live on the map, skipped names on the dismissed list. Clear the state — skip the call when the gate-state read found no `analysis_staging.discovery-gap-analysis` subtree (the analysis staged nothing, so there is no state to clear):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest delete {work_unit}.discovery analysis_staging.discovery-gap-analysis
```

> *Output the next fenced block as a code block:*

```
Nothing new to review.
```

→ Return to caller.

#### If `K` is `1` or more

> *Output the next fenced block as a code block:*

```
Gap analysis surfaced {K} candidate topic(s).
```

→ Proceed to **B. Gate Each Candidate**.

## B. Gate Each Candidate

Walk the candidate blocks in staging-file order. For the next candidate the manifest marks `pending`:

#### If no `pending` block remains

A processed gate's state is spent — approved candidates live on the map, skipped names on the dismissed list. Clear it:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest delete {work_unit}.discovery analysis_staging.discovery-gap-analysis
```

→ Return to caller.

#### Otherwise

Render the candidate:

> *Output the next fenced block as a code block:*

```
{name:(titlecase)} [{routing}]
  {summary}
  surfaced by gap analysis
```

Read `gate_mode` from the manifest's `analysis_staging.discovery-gap-analysis` subtree (held from the **A** read; re-read if stale).

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
**`◆ Add this topic to the map?`**

**`y/yes`**   → Approve — the topic joins the map and its phase can start from the epic menu
**`a/auto`**  → Approve this and all remaining candidates automatically
**`s/skip`**  → Skip and dismiss — the analysis never re-proposes this name
**Comment** → Tell me what to change (routing, summary, or description)
```

**STOP.** Wait for user response.

**If `yes`:**

→ Proceed to **C. Write Approved Candidate**.

**If `auto`:**

Record it (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.discovery analysis_staging.discovery-gap-analysis.gate_mode auto`) so subsequent candidates approve without a stop.

→ Proceed to **C. Write Approved Candidate**.

**If `skip`:**

Record the skip (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.discovery analysis_staging.discovery-gap-analysis.candidates.{name}.status skipped`) and add the name to the dismissed list:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest push {work_unit}.discovery dismissed "{name}"
```

→ Return to **B. Gate Each Candidate**.

**If comment:**

Revise this block's `routing`, `summary`, or `description` in the staging file per the user's feedback (content edits only). The candidate stays `pending`.

→ Return to **B. Gate Each Candidate**.

## C. Write Approved Candidate

Record the approval (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.discovery analysis_staging.discovery-gap-analysis.candidates.{name}.status approved`), then write the discovery item from the block's stored fields:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs discovery-map add {work_unit} {name} {routing} --source "gap-analysis" --summary "{summary}" --description "{description}"
```

#### If the response is `ok: false`

The map can change between staging and this write — a prior session's gate run left this candidate pending, and the map moved since. Route on the refusal:

**If refused as an active duplicate** (the topic landed on the map via another path since staging):

Merge provenance instead, following the already-on-map branch of the analysis's **D. Filter and Stage** — read the item's `source` and, unless it already includes `gap-analysis`, extend it comma-joined. Record `node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.discovery analysis_staging.discovery-gap-analysis.candidates.{name}.status resolved`; nothing is added to `tracker`.

→ Return to **B. Gate Each Candidate**.

**If refused as dismissed** (the user dismissed this name since staging):

Honour the dismissal. Record the candidate `skipped` (same write as the skip arm) — the name is already on the dismissed list, no push needed.

→ Return to **B. Gate Each Candidate**.

#### Otherwise

Append `{name}` to the caller's `tracker`.

→ Return to **B. Gate Each Candidate**.

# Analysis Approval Gate

*Shared reference. Loaded by [topic-discovery.md](topic-discovery.md).*

---

Presents the candidate topics an analysis staged, gates each per-topic before anything lands on the discovery map, and writes the approved ones. The analysis (`research-analysis` or `discovery-gap-analysis`) has already staged its genuinely-new candidates to a per-analysis staging file as `status: pending`; the already-on-map and dismissed cases were resolved silently at stage time and never reach this gate.

The gate is the boot-time review surface — it runs before the dashboard. Approving a candidate writes it to `phases.discovery.items.{name}`; skipping it adds the name to `phases.discovery.dismissed[]` so the analysis won't re-propose it. Deferring leaves every candidate `pending` and signals the host to skip the cache stamp, so the same staging file is re-presented next boot without re-running the analysis.

## Parameters

The caller provides these via context before loading:

- `analysis` — `research-analysis` or `discovery-gap-analysis`.
- `work_unit` — the epic's work unit name.
- `tracker` — a list (initially empty) the caller surfaces as the new-topics callout. The reference appends a name only when a candidate is **approved and written**.
- `staging_file` — path to the analysis's staging file (`.workflows/{work_unit}/.state/{analysis}-candidates.md`).

On return, the reference sets `gate_outcome` to `processed` (gate ran to completion — host stamps the cache) or `deferred` (host skips the stamp).

`{analysis_label}`: `Research analysis` for `research-analysis`, `Gap analysis` for `discovery-gap-analysis`. Used in the lead-in.

## A. Lead-In and Defer

Read `staging_file`. Count the candidate blocks with `status: pending` — call it `K`.

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

Leave every candidate `status: pending`. Write nothing to the map. Append nothing to `tracker`.

Set `gate_outcome` to `deferred`.

→ Return to caller.

#### If `review`

→ Proceed to **B. Gate Each Candidate**.

## B. Gate Each Candidate

Walk the candidate blocks in staging-file order. For the next block with `status: pending`:

#### If no `pending` block remains

Set `gate_outcome` to `processed`.

→ Return to caller.

Render the candidate. `{provenance}` is `derived from research "{parent}"` when `analysis` is `research-analysis` (read `parent` from the block), or `surfaced by gap analysis` when `discovery-gap-analysis`.

> *Output the next fenced block as a code block:*

```
{name:(titlecase)} [{routing}]
  {summary}
  {provenance}
```

Read `gate_mode` from the staging frontmatter.

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

Set `gate_mode: auto` in the staging frontmatter so subsequent candidates approve without a stop.

→ Proceed to **C. Write Approved Candidate**.

**If `skip`:**

Set this block's `status: skipped` in the staging file and add the name to the dismissed list:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs push {work_unit}.discovery dismissed "{name}"
```

→ Return to **B. Gate Each Candidate**.

**If comment:**

Revise this block's `routing`, `summary`, or `description` in the staging file per the user's feedback. Leave `status: pending`.

→ Return to **B. Gate Each Candidate**.

## C. Write Approved Candidate

Set this block's `status: approved` in the staging file, then write the discovery item from the block's stored fields:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs init-phase {work_unit}.discovery.{name}
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.discovery.{name} summary "{summary}"
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.discovery.{name} description "{description}"
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.discovery.{name} routing {routing}
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.discovery.{name} source "{source}"
```

`source` is the block's stored value verbatim — `research-analysis:{parent}` for research-analysis (provenance renders as `from {parent}`), `gap-analysis` for gap-analysis.

Append `{name}` to the caller's `tracker`.

#### If `analysis` is `research-analysis`

→ Proceed to **D. Fan-Out Parent-Handled Offer**.

#### Otherwise

→ Return to **B. Gate Each Candidate**.

## D. Fan-Out Parent-Handled Offer

Research-analysis derives a candidate from a completed research file (its `parent`) **without moving content out of that parent** — so the parent may still legitimately want its own discussion. This offers, once per parent, to mark the parent `handled`: a fanned-out research umbrella that stays on the map but stops prompting to be discussed.

Read this block's `parent`.

#### If any other candidate block sharing the same `parent` has `fanout_offer` set to `marked` or `declined`

The offer for this parent already ran this session. Skip it (dedup).

→ Return to **B. Gate Each Candidate**.

#### Otherwise

Re-run discovery to read the parent's current lifecycle:

```bash
node .claude/skills/workflow-discovery/scripts/discovery.cjs {work_unit}
```

Find the `parent` row in `discovery_map`.

#### If the parent is not on the map, or its lifecycle is `handled`, `decided`, or `cancelled`

Not actionable — no offer. Set `fanout_offer: declined` on every block sharing this `parent` (so it isn't reconsidered).

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
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.discovery.{parent} handled true
```

Set `fanout_offer: marked` on every block sharing this `parent`.

→ Return to **B. Gate Each Candidate**.

**If `no`:**

Set `fanout_offer: declined` on every block sharing this `parent`.

→ Return to **B. Gate Each Candidate**.

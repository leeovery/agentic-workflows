# PR5 — Harvest → Briefs (the views)

Make the harvest produce a per-topic **brief** — a regenerable *view* of one topic, extracted from the discovery record while the whole exploration is in context. The brief is the topic's read-in-full handoff to its research/discussion phase (consumed in PR6). Includes the brief's full lifecycle (regenerate / merge / split / drop) and the flag-not-overwrite propagation signal.

> Read `00-overview.md` → Design → Records vs views, Briefs, Propagation, Handoff retrieval.

## At a glance

- **Branch:** `feat/deep-discovery-pr5-briefs`
- **Base / target:** `feat/deep-discovery-pr4-kb-indexing`
- **Builds on:** **PR3** (multi-session context — a complete brief draws on all logs) and **PR4** (KB fallback for late regeneration). Stores briefs alongside PR1's `sessions/`.
- **Design slice:** Briefs as views; the harvest-time extraction; the lifecycle; the `reconcile_needed` propagation flag (set here; surfaced in PR6).

## Core principle

A brief is a **view**: the projection of the many-to-many log↔topic relationship onto one topic. It is **regenerated**, never the source of truth (the log is). Append-only binds the log, not the brief. You pay the linking cost **at harvest** (curate the slice while the whole exploration is in context); KB (PR4) is the full-fidelity fallback for the long tail. Do **not** attempt file/line provenance for narrative.

## Tasks

### 1. NEW reference `references/brief-synthesis.md`

Extract the brief logic here (convention: extract; keeps `topic-synthesis.md` lean). Contents:
- **Extraction template:** for each harvested topic, pull its **soft decisions + reasoning + rejected paths + open questions** from the exploration (all sessions in context). Write `.workflows/{wu}/discovery/briefs/{topic}.md`. Coarse session-level citation ("drawn from sessions 2–3") — no line provenance.
- **Regenerate-on-touch:** when a later harvest touches an existing topic, regenerate its brief (views regenerate freely).
- **Lifecycle on synthesis adjustments** (these happen at `topic-synthesis.md` §E — `map-operations.md` has no merge/split):
  - **split** parent → write briefs for the new children; delete the parent's brief file + clear its `brief_path`.
  - **merge** A+B → one brief for the merged topic; delete the absorbed topics' brief files + clear their `brief_path`.
  - **drop / remove** → delete the orphaned `discovery/briefs/{topic}.md` and clear `brief_path`.

### 2. Wire into synthesis + persistence

- `references/topic-synthesis.md` §E — call `brief-synthesis.md` at harvest; ensure the split/merge/drop adjust paths trigger the corresponding brief lifecycle.
- `references/confirm-and-persist.md` §A (~25–28) — after `create-discovery-topic`, set the brief path:
  `node …/manifest.cjs set {wu}.discovery.{topic} brief_path "discovery/briefs/{topic}.md"`.
  Opaque field, separate `set` call — **do not** modify the `create-discovery-topic` builder (`manifest.cjs:849`).
- `references/initialize-discovery.md` — `mkdir -p .workflows/{wu}/discovery/briefs/`.

### 3. Propagation flag (set here; surfaced in PR6)

When a regenerated brief post-dates existing downstream work for that topic, set `reconcile_needed: true` on `{wu}.{research|discussion}.{topic}` (opaque field via `set`). This signals "discovery context changed — reconcile"; it **never** overwrites the downstream artifact (soft can't overwrite hard).

### 4. Document-review scope

`references/document-review.md` reconciles the log's Exploration/Edits/Topics-Identified. Briefs are **views** (regenerate freely) → **out of scope** for document-review. State this once where relevant.

### No migration

Existing epics have no briefs; briefs are recomputable views generated at the next harvest. No backfill migration.

## Conventions to honour

- New `brief-synthesis.md`: reference header + `---` + `→ Return to caller.`; render instructions on any user-facing fenced block.
- The brief file is a written artifact, not a user-facing render — its template lives in the reference as a model instruction.
- Naming: the file/concept is a **brief** (downstream: *discovery brief*). Never `seed`.

## Risks / hazards

- **Lifecycle gaps** — split/merge/drop must clean up brief files and `brief_path`, or orphans accumulate and stale briefs get consumed downstream. This is the easiest thing to miss; test each path.
- **Regenerate vs append confusion** — the brief is a view; regeneration is correct and lossless relative to the log. Don't treat it as append-only.
- **Shared `session-loop.md`/`topic-synthesis.md` with earlier PRs** — keep the §E edit additive; the heavy logic lives in `brief-synthesis.md`.
- **`reconcile_needed` must not overwrite** — it only sets a flag; PR6 surfaces it.

## Verification

Engine sandbox + manifest CLI on a fixture:
- Drive an epic to convergence; harvest; confirm `discovery/briefs/{topic}.md` written per topic and `brief_path` set: `node …/manifest.cjs get {wu}.discovery.{topic} brief_path`.
- Second harvest touching a topic regenerates its brief; with existing downstream work, `reconcile_needed: true` is set.
- Exercise split / merge / drop at synthesis → confirm the right brief files are created/deleted and `brief_path` cleared.
- Confirm document-review does not flag briefs.
- Full suite green.

## Definition of done

Harvest writes per-topic briefs (views) with `brief_path`; regenerate-on-touch + split/merge/drop lifecycle correct; `reconcile_needed` set (not overwriting) when a brief post-dates downstream work; document-review excludes briefs.

## When this PR is approved

- **Confirm the approval**, then **do NOT merge.**
- **Plan PR6 now, in this same session:** enter plan mode and write the executable plan for **PR6** from `deep-discovery/pr-6-downstream.md`. Branch `feat/deep-discovery-pr6-downstream`, base/target `feat/deep-discovery-pr5-briefs`. Its hand-off is the **stack-landing** instruction (final PR).
- **Do not clear context yourself, and do not ask the user to** — accepting the PR6 plan triggers the harness's *clear-and-proceed* into a fresh session that executes PR6.

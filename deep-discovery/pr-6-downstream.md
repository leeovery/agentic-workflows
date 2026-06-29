# PR6 — Downstream Consumption + Reconcile Surfacing

Make research and discussion **consume the brief** as their read-in-full starting context, falling back to `description` for un-harvested/legacy topics, and surface the `reconcile_needed` advisory (never overwrite). This closes the handoff loop and completes the feature.

> Read `00-overview.md` → Design → Briefs, Propagation. PR5 produces briefs + sets `reconcile_needed`; PR6 consumes + surfaces.

## At a glance

- **Branch:** `feat/deep-discovery-pr6-downstream`
- **Base / target:** `feat/deep-discovery-pr5-briefs`
- **Builds on:** PR5 (briefs must exist to be consumed)
- **Design slice:** the consumer side of the handoff + the reconcile UX. Final PR — its hand-off lands the whole stack.

## Tasks

### 1. NEW shared reference `skills/workflow-shared/references/read-brief-context.md`

Sibling to `seed-context.md`. Behaviour:
- Read `{wu}.discovery.{topic} brief_path`.
- If present and the file exists, read `discovery/briefs/{topic}.md` **in full** (read-in-full, like a seed in *role* — but call it the *discovery brief*, never `seed`).
- **Fallback:** if `brief_path` is absent (legacy / migration-seeded / direct-start / un-harvested topics), fall back to the discovery item `description` (today's behaviour) so the unchanged path for un-harvested topics still works.
- Set `brief_incorporated: true` once read.

### 2. Wire consumers (epic topic path only)

- `skills/workflow-research-entry/SKILL.md` (epic branch ~197–205) — replace the direct `discovery.{topic} description` read with a `→ Load read-brief-context.md`.
- `skills/workflow-discussion-entry/SKILL.md` (epic branch ~179–187) — same.
- `skills/workflow-research-process/references/initialize-research.md` and `skills/workflow-discussion-process/references/initialize-discussion.md` — load `read-brief-context.md` for epic topics (alongside the existing `seed-context.md` load).

### 3. Reconcile surfacing UX

- When a research/discussion item has `reconcile_needed: true`, surface a `⚑` advisory at the entry **Gather-Context** step: discovery context changed since this work started — reconcile against the regenerated brief. **Never auto-overwrite.**
- Define exactly where it renders (research-entry / discussion-entry Gather-Context) and how it clears (`reconcile_needed` → false once the user has reconciled).

## Conventions to honour

- New `read-brief-context.md`: reference header + `---` + `→ Return to caller.`; render instructions on any user-facing block.
- The `⚑` advisory is user-facing — precede its fenced block with the render instruction; follow display-tier rules (it's a status/advisory, not a STOP gate unless the design calls for a decision).
- Prose economy; brief vs seed naming discipline.

## Risks / hazards

- **Legacy fallback is load-bearing** — un-harvested epic topics (migration-seeded, direct-start, or harvested before this feature) have no `brief_path`; the `description` fallback must keep them working. Test it.
- **Don't break non-epic seeding** — these edits are on the epic branches of the entry skills; the single-phase path (and the work-unit-level `seeds`) is unchanged.
- **Reconcile must never overwrite** — it's an advisory; the hardening phase decides.

## Verification

Engine sandbox + fixtures:
- From a harvested epic, enter a topic's research/discussion → confirm the brief is read **in full** as the starting context and `brief_incorporated` is set.
- A topic with **no** `brief_path` (legacy/un-harvested) → confirm `description` fallback seeds it as before.
- A topic with `reconcile_needed: true` → confirm the `⚑` advisory surfaces at entry and **nothing is overwritten**; confirm it clears after reconciliation.
- Non-epic research/discussion → unchanged.
- Full suite green.

## Definition of done

Research/discussion consume the discovery brief in full (with `description` fallback); `brief_incorporated` tracked; `reconcile_needed` surfaces as a non-destructive `⚑` advisory; non-epic paths unchanged. **Feature complete.**

## When this PR is approved — land the stack

This is the final slice. Once approved:
- **Land the stack** root-first using the `pr-stacked` skill + local `stack` CLI: `deep-discovery` (docs) → PR1 → PR2 → … → PR6, squash-merging into `main`, rebasing descendants after each merge. Get usage live (`stack --help`, `stack guide`, dry-run before any mutating run) — the CLI is the source of truth.
- The planning docs in `deep-discovery/` merge through as the feature's record. Strip the directory in a final commit only if the user asks.
- After landing, run the **full test suite** on `main` and do a final sandbox smoke of an epic discovery end-to-end (explore → harvest → brief → downstream consume).

# Epic Cross-Phase Dependency Visualization

## The Idea

For epics with many topics moving through phases independently, provide a visual dependency graph showing what blocks what across the entire epic.

## Why This Matters

Epic continue currently shows a per-phase breakdown (discussions in progress, specs completed, plans ready). But it doesn't show *why* something can't proceed — which specific dependency is missing. The soft gates warn about prerequisites but don't map the full dependency chain.

For a large epic with 8+ topics at different stages, the user needs to see the big picture: "If I complete discussion X, it unblocks specs Y and Z, which unblock plans A and B." This helps prioritize which topic to work on next for maximum throughput.

## What It Would Look Like

An option in `continue-epic` or `workflow-start` that shows:

```
Epic: payments-overhaul

  ✓ auth-flow ─────── discussion ✓ → spec ✓ → plan ✓ → impl ◐
  ◐ data-model ────── discussion ✓ → spec ◐
  ○ api-design ────── discussion ✓ → spec (blocked by data-model spec)
  ○ webhooks ──────── discussion ◐
  ○ billing-ui ────── (blocked by api-design spec + auth-flow impl)
```

Shows flow, progress, and blocking relationships at a glance. The user can see that finishing `data-model` spec unblocks `api-design`, which eventually unblocks `billing-ui`.

## Implementation

Dependency data already exists in the manifest (cross-plan references, phase prerequisites). The visualization is a rendering concern — parse manifest state and present as an ASCII flow diagram in the terminal.

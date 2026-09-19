# Phase 5 — Loop telemetry source inventory

Every datum the telemetry surface displays, mapped to its manifest field or git
fact. **The rule (phase-5 §1): anything not on this list is cut or proposed
upstream, never scraped from a transcript.** Written before the surface.

Implementation items live at `phases.implementation.items.{topic}` in the work
unit's `manifest.json`. The bridge reads these fields directly (never the
gateway DATA text, never the session cache).

| Displayed datum | Source |
|---|---|
| current task in flight | `items.{topic}.current_task` (string) |
| current phase (plan phase) | `items.{topic}.current_phase` (string\|number; `~` = none) |
| completed phases | `items.{topic}.completed_phases[]` |
| completed tasks | `items.{topic}.completed_tasks[]` |
| item status (in-progress / completed / cancelled) | `items.{topic}.status` — the schema's allowed set (`manifest-schema.cjs`); "blocked" is NOT a status value, it is a derived join (`deps_blocking[]`, the row below) |
| dep-blocked ⚑ | engine `lib.cjs` derivation — `deps_blocking[]` on the epic detail's planning item (a render-time join, never a manifest field) |
| fix-attempt count | `items.{topic}.fix_attempts` (integer — verified present in the real manifest; a durable field) |
| analysis cycle count | `items.{topic}.analysis_cycle_total` (integer) |
| consolidation gate mode | `items.{topic}.consolidation_gate_mode` (`auto` \| present = gated) |
| staging tasks (consolidation) | `items.{topic}.staging.{cycle}.tasks.{n}` = `<decision>` (a nested object per `fields.cjs`, NOT `staging.p{N}` — corrected round 11 against the real manifest) |
| the consolidation bank | `items.{topic}.bank[]` (banked cross-scope opportunities) |
| consolidated phases | `items.{topic}.consolidated_phases[]` |
| commits landed (this topic) | git — `commit.landed` events whose scope includes the work unit (the Phase 0 durable store) |
| background agents active | `agent.dispatched` / `agent.returned` live events (Phase 0 vocabulary), from the cache agent store |

**Spine events (≤4 per implementation phase):** `phase.completed` (the plan
phase closing), the consolidation gate opening (a `gate.opened` on the
`MENU: consolidation` surface), the three-strike consult (a gate, pushing per
Phase 3), and `workunit.status-changed` on completion. Everything else —
per-task progress, attempt counters — updates the telemetry surface **in
place** and never touches the spine (the anti-firehose rule).

**Correction (verified against the real manifest, round-11 prep):** the
implementation item DOES carry durable `fix_attempts` and
`analysis_cycle_total`/`analysis_cycle_session` counters — the surface shows
`fix_attempts` and the analysis cycle count directly; nothing is invented and
nothing is scraped.

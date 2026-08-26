# Phase 5 — Delivery telemetry and the plan graph

**Goal:** the quiet end of the cone. Delivery mostly runs itself; the UI's job is a calm
report of progress that never demands attention, plus the structural views that make a plan
and its outcome scannable.

**Duration:** 1–2 weeks.

**Corrected premise (from review):** the loop's telemetry does **not** need the format
adapters — `engine task` is format-blind and manifest-side, so current task, fix-attempt
counters, `consolidation_gate_mode`, and cycle counts all come from manifest watching. The
adapters are needed only for the task *graph*, and they are prose instructions for a model,
not APIs — reading them in TypeScript is a knowing, contained duplication.

## Deliverables

1. **Loop telemetry (manifest-sourced)** — one continuously-updated progress surface per
   implementation phase: current task, attempt count, gate mode, commits landed. Built on
   a half-page **source inventory** mapping each displayed datum to its manifest field or
   git fact, written before the surface — anything unmapped is cut or proposed upstream,
   never scraped from transcripts. Updates replace; they never append to the spine. Spine
   events: consolidation gate opened, phase closed, the three-strike consult (a gate,
   pinging per Phase 3).
2. **Consolidation moments** — the boundary sweep as its own card: the bank
   (`implementation.{topic}.bank`), the finder's verdicts, the gated tasks in staging
   (`staging.p{N}`) — one decide-shaped screen, consistent with the lanes.
3. **Plan DAG** — @xyflow/react + elkjs. Sources, split honestly per adapter:
   **local-markdown** — a small TS frontmatter parser with golden fixtures pinned to the
   shipped format templates (v0); **tick** — its own CLI's graph output; **Linear** —
   degraded to link-out unless the bridge is configured with its own API credentials
   (the adapter's access channel is the session's MCP tools, which the bridge does not
   have). Lowest-common-denominator model: tasks + deps + status; per-adapter enrichment
   on top. Dep-blocked plans render their ⚑ state. Read-only.
4. **Review board** — findings as columns by bucket (needs planning / corrected / out of
   scope / discarded), verdict banner, commit and verifier provenance links; the
   out-of-scope bank as a durable list, offered — never nagging.
5. **Background-agent chips** — the `agent.dispatched` / `agent.returned` events (Phase 0
   vocabulary) render as a quiet "2 agents reading" presence on the channel — deep dives,
   perspective pairs, and verifiers become a felt part of the experience without a single
   notification.

## Explicitly out of scope

- Any control over the loop beyond its own gates. No pause, no skip, no reorder.
- Task-tracker writes of any kind, in any adapter.

## Done means

- An implementation phase runs on the fixture: one live surface updating in place, the
  spine gains ≤4 events, the consolidation gate appears as a decide screen, and every
  telemetry datum on screen traces to a row in the source inventory.
- The DAG renders the same fixture plan from local-markdown and from tick, byte-equal in
  the common model; a Linear-format plan renders the link-out degradation.

## Risks

- **Telemetry becoming theater.** Collapsed by default in Delivery-stage layout; never
  animates.
- **Adapter duplication drift.** The TS readers are fixture-pinned to the shipped format
  templates exactly like Phase 4's extractors; an upstream `engine tasks` read verb
  ([UPSTREAM.md](UPSTREAM.md) #5) retires them if it lands.

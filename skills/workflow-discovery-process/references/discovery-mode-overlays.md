# Discovery Mode Overlays

*Reference for **[workflow-discovery-process](../SKILL.md)***

---

Mode-specific overlays on top of the shared conversational discipline in [discovery-guidelines.md](discovery-guidelines.md). The conversational pattern is the same; what differs per work type is **what synthesis produces at endpoint** and **what pivot signals each mode watches for**.

## A. Endpoint Output by Work Type

| Work type | Endpoint output |
|---|---|
| Epic | Multi-row discovery map persisted at `phases.discovery.items.{topic}` with per-topic routing (research / discussion). See [topic-synthesis.md](topic-synthesis.md). |
| Feature | Single-topic shape with routing decision (research or discussion). One-row map persisted as a single discovery item. |
| Cross-cutting | Single-topic shape with routing decision (research or discussion). One-row map persisted as a single discovery item. |
| Bugfix | Brief intent capture (one paragraph) + routing decision to investigation. No discovery map — the session log is the journey record. |
| Quickfix | Brief intent capture (one paragraph) + routing decision to scoping. No discovery map — the session log is the journey record. |

The shared conversational loop holds across all modes — open exploration, no decisions, anchor and return, propose endpoint. Only the synthesis at endpoint diverges.

## B. Pivot Watchpoints by Mode

Each mode listens for the cues that suggest a different shape might be the right one. Pivot offers surface mid-loop as conversational reads (see [pivot-watchpoints.md](pivot-watchpoints.md) for the full pivot table and mechanics).

| Mode | Pivot signals to watch for |
|---|---|
| Epic | One coherent topic emerges; "multiple shapes" never quite materialises → consider feature pivot |
| Feature | Multiple distinct concerns from one description; topic seeds clustering → consider epic pivot |
| Bugfix | "Broken" turns out to be missing-by-design → consider feature pivot |
| Quickfix | Scope discussion gets substantive; behaviour debate emerges → consider feature or bugfix pivot |
| Cross-cutting | Customer-facing deliverable emerges → consider feature or epic pivot |
| Any mode | Tangential concern surfaces that's separate from the current work → inbox surface offer (see [pivot-watchpoints.md](pivot-watchpoints.md) section E) |

## C. Seed-Material Interpretation by Mode

Imports and inbox items are read at the opener (see [opener-pattern.md](opener-pattern.md)). Mode-specific interpretation:

| Mode | Seed-material role |
|---|---|
| Epic | Imports drive topic decomposition |
| Feature | Imports inform single-topic shape; multi-topic content triggers epic-pivot offer |
| Cross-cutting | Imports inform pattern / principle definition; customer-facing content triggers feature-pivot offer |
| Bugfix | Imports are reference material (logs, error reports, prior tickets) — read for context, NOT analysed for root cause (shape vs content guardrail) |
| Quickfix | Imports are reference material — context only, no scope debate |

The shape-vs-content guardrail applies particularly hard for bugfix and quickfix: imports must not turn the conversation into investigation or scoping.

## D. Conversational Posture by Mode

The conversational discipline is shared. The *flavour* of the questions follows the seed and the user's framing — but the posture stays consistent:

- One question at a time
- Open, exploratory questions; no checklists
- Mirror the shape back so the user can correct it
- Anchor and return when conversation tunnels
- Surface tentative reads mid-loop when signals converge

Bugfix mode tends to converge fast (the user often arrives knowing the failure mode). Quickfix mode tends to converge fastest. Epic mode tends to take longest (multiple surfaces to map). Feature and cross-cutting sit in the middle. Pace the loop to the work type's natural depth — don't artificially extend a quickfix conversation, don't artificially shorten an epic conversation.

→ Return to caller.

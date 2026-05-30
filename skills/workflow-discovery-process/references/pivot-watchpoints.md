# Pivot Watchpoints

*Reference for **[workflow-discovery-process](../SKILL.md)***

---

Two pivot patterns live here: **macro pivots** (raising a different work-type when signals point elsewhere) and **scope-down + inbox surface** (peeling off tangential concerns without contaminating the current shape).

## A. Macro Pivot Triggers

When Discovery is running with a pre-seeded or tentatively-converging shape, and signals start pointing at a *different* shape, raise the pivot. Same threshold as the regular shape-detection threshold (multiple converging signals, consistent framing, etc.) — applied to the *competing* shape rather than the current one. Same patience discipline: don't pivot on a single weak signal.

Pivot direction cues (illustrative — tune via real use):

| Pivot direction | Cues |
|---|---|
| feature → epic | Multiple distinct concerns surface from what was framed as one feature; topic seeds start clustering into independent groups; user describes scope expansion mid-conversation |
| epic → feature | Synthesis converges on one coherent topic; *"multiple shapes"* never quite materialises; user keeps pulling back to one core concern |
| bugfix → feature | Described *"broken"* behaviour turns out to be missing-by-design rather than malfunction; user struggles to describe a working state before the bug |
| feature → bugfix | Described *"new"* behaviour is actually restoring something that should already work; user mentions regression or *"it used to work"* |
| quickfix → feature / bugfix | Scope discussion gets substantive; behaviour debate emerges; user starts describing how the change *should* work |
| any → cross-cutting | Described work turns out to be defining a pattern, principle, or strategy rather than shipping a feature; no customer-facing deliverable surfaces |

## B. How to Surface a Pivot

The pivot offer surfaces mid-loop as a tentative read (see [shape-detection.md](shape-detection.md) → *Mid-Loop Surfacing*). Plain language, not workflow jargon:

> *"This is shaping bigger than one feature — sounds like several connected things. Want to treat as a larger initiative made of multiple features?"*

User confirms, declines, or redirects — take the call. The pivot offer is conversational, not an AskUserTool prompt (the same rationale as mid-loop surfacings).

Pivot offers can fire multiple times in one Discovery session. Each one is a tentative surfacing, easy to push back on.

## C. Reasoning Surfacing in Pivots

Same principle as routing-commit reasoning (see [routing-commit.md](routing-commit.md) → *Explain the Reasoning*). Name the specific signals that drove the pivot read:

> *"Sounds like several connected things rather than one — you've sketched menu-management, kitchen-printers, and operator-analytics as distinct concerns. Want to treat as a larger initiative?"*

Brief, concrete, pull-on-able. The user can challenge specific cues (*"actually menu-management and analytics are the same thing for me — I'm seeing one feature"*) and you adjust the read.

## D. Pivot Mechanics (Post-Acceptance)

When the user accepts a pivot, the operational moves depend on direction:

- **Direction widens** (e.g. feature → epic): the current single-topic shape becomes one of several topics in an epic map. Stay in Discovery; continue exploration as an epic conversation. Existing topic cues become candidate epic topics.
- **Direction narrows** (e.g. epic → feature): the multi-topic map collapses to a single chosen topic. Ask the user which of the candidate threads is the focus; archive the rest (they can surface to inbox or stay as future epics).
- **Direction shifts type** (e.g. feature → bugfix): the shape changes substantively. Reset the synthesis intent — bugfix routes to investigation rather than research/discussion.

The pivot commit lands the same way as a routing commit (see [routing-commit.md](routing-commit.md)). No silent shape change — the user sees the new shape and confirms before Discovery continues.

## E. Scope-Down + Inbox Surface

During Discovery for one work unit, you may notice a related-but-separate concern the user mentions in passing. Without a release valve, this would either (a) scope-creep into the current work unit, contaminating its shape, or (b) get lost entirely. Surface to inbox for later — keep the current work focused.

When you notice a tangential concern that doesn't fit the current shape, surface a brief offer:

> *"You mentioned X — that feels separate from what we're shaping. Surface to inbox for later?"*

The decision moment is conversational, not structured — soft surfacing, easy redirect. No AskUserTool needed.

### Mechanism (if user accepts)

Pick the inbox-capture skill based on the tangential concern's shape:

- **Bug-shaped** → invoke `/workflow-log-bug`
- **Idea-shaped** (default when uncertain) → invoke `/workflow-log-idea`
- **Quickfix-shaped** → invoke `/workflow-log-quickfix`

The capture skill writes the file to `.workflows/.inbox/{bugs,ideas,quickfixes}/` per existing inbox capture pattern. Discovery's session log notes the surfacing as part of the journey record, so it's discoverable in the journey record even if the inbox file gets actioned later.

Conversation continues with the original work, now without scope creep.

### If user declines

Fold the tangential concern into the current work. The surfacing offer is the value-add either way — it surfaces the question rather than silently scope-creeping.

## F. Pivot vs Inbox Surface — Which Move?

Both peel concerns away from the current shape, but they're different operations:

- **Pivot** reshapes the *current* work unit (different macro shape, same fundamental scope).
- **Inbox surface** removes a *separate* concern from the current work unit (different scope altogether).

Diagnostic: *"Is this the work, or is this adjacent to the work?"* If it's adjacent, inbox surface. If it's the work itself looking different, pivot.

→ Return to caller.

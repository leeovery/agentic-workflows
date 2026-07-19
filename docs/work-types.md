# Work Types

Five pipeline shapes. Every one starts in [discovery](discovery.md), which settles the type in conversation before anything touches disk; after that the pipelines diverge.

| Work type | Pipeline after discovery | Scope |
|---|---|---|
| **Epic** | Per topic: (Research) → Discussion → Specification → Planning → Implementation → Review | Multi-topic, multi-session |
| **Feature** | (Research) → Discussion → Specification → Planning → Implementation → Review | Single topic, linear |
| **Bugfix** | Investigation → Specification → Planning → Implementation → Review | Single topic, diagnosis-first |
| **Quick-fix** | Scoping → Implementation → Review | Single topic, one pass |
| **Cross-cutting** | (Research) → Discussion → Specification (terminal) | Single topic, project-level |

A *work unit* is a named instance of a work type: `auth-flow` might be a feature, `payments-overhaul` an epic. Each gets its own directory under `.workflows/` and its own `manifest.json`. A *topic* is the item within a phase. For epics, topics are distinct from the work unit and there are many; for every other type, the topic name equals the work unit name and there is one. That equivalence lets all five types share one manifest structure, one path scheme, and one set of phase skills.

## How the type gets picked

You don't pick from a taxonomy. Discovery's detection core listens for shape signals and resolves them in order of cost and terminality:

| You say something like | It routes to |
|---|---|
| Past-tense or present-broken; specific failure cases; stack traces | bugfix |
| "Bump the timeout", "rename X to Y": one-shot, mechanical, no behaviour debate | quick-fix |
| A pattern, principle, or strategy with no ship-able deliverable ("error-response shape", "auth strategy") | cross-cutting |
| New behaviour, one coherent scope, clear actors and flows | feature |
| Multiple distinct concerns in one description; "project"/"initiative" framing | epic |

The feature↔epic boundary gets the most care: it is decided by whether topics multiply during shaping, and it has no safety net, whereas an epic's topic list does (the [self-healing analyses](research-and-discussion.md#self-healing-the-map) keep hydrating the map at every return visit, so the initial list need not be exhaustive). Misjudged anyway? The type is not a life sentence: [pivot](lifecycle-tools.md#pivot-feature--epic) converts a feature to an epic mid-flight, [absorb](lifecycle-tools.md#absorb-feature--epic-topic) folds a feature into an epic as a topic, and a quick-fix that fails its complexity check gets promoted to a feature.

## Epic

The multi-topic shape. Discovery doesn't end at the type commit: the same conversation deepens into open exploration of the whole, and topics are harvested from it onto the [discovery map](discovery.md#the-discovery-map), each routed to research or discussion. From then on the epic is phase-centric. The [dashboard](how-it-fits-together.md#the-epic-dashboard) shows every topic's position, groups phases under the three-stage arc (Discovery: explore and decide; Definition: specify and plan; Delivery: build and verify), and recommends the next move.

Epic-only machinery:

- **Soft gates.** Starting discussions while research is still in flight (or specs while discussions are, plans while specs are, implementation while plans are) triggers an advisory warning, not a block: "3 of 5 research topics still in-progress. Topic analysis works best with all research available." The system re-analyses if you proceed early.
- **Per-topic cancellation.** Cancel and reactivate individual topics from the dashboard without touching the rest of the epic. Cancelled items stay visible but drop out of aggregation, gating, and routing.
- **Cross-topic analysis.** [Consolidation analysis](specification.md) groups related discussions into single specs; discovery-gap analysis reads all completed artifacts holistically to surface missed themes.

## Feature

The default shape for building one coherent thing. Linear: an optional research phase for open unknowns, then discussion → specification → planning → implementation → review, each phase handed off through the [bridge](how-it-fits-together.md#the-bridge) into a clean context. At the end of implementation the bridge offers review or early completion (`d`/done completes without review).

## Bugfix

Something that worked is broken. The pipeline leads with [investigation](#investigation-the-bugfix-first-phase) instead of discussion, because you can't specify a fix before you know the cause, and the resulting specification focuses on the fix approach, inheriting the root cause rather than re-deriving it.

### Investigation, the bugfix first phase

Investigation is symptom gathering plus code analysis, run as a collaboration: gather reproduction steps, error messages, and environmental context from the user; query the [knowledge base](knowledge-base.md) for prior investigations matching the symptoms; trace code paths to the root cause. The investigation file at `investigation/{topic}.md` is created early and committed after each significant finding: the documented trail, not a post-hoc summary. Synthesis produces four things: a root cause statement, contributing factors, why it wasn't caught, and a fix direction. A [synthesis agent](agents.md) then validates the root cause against the codebase before findings review with the user.

## Quick-fix

A small, known, mechanical change: nothing to diagnose, no behaviour debate. Scoping compresses specification and planning into one pass (gather context, run a complexity check, write a lightweight spec, pick an [output format](output-formats.md), write the tasks). Three hard rules define the shape:

1. **Maximum 2 tasks.** Needs more? It's not a quick-fix; promote it.
2. **No acceptance criteria.** Mechanical changes are verified by test baselines and completeness checks.
3. **No agents.** Scoping writes the spec and tasks directly, without planning agents or review cycles.

Implementation then runs the [verification variant](implementation.md#the-quick-fix-verification-variant) instead of the TDD loop.

## Cross-cutting

Project-level definition work: a pattern, principle, or policy that shapes other work rather than shipping as a deliverable. The pipeline is research (optional) → discussion → specification, and it is **terminal**: the spec is the deliverable. Cross-cutting units also arise without ever being started as one, when an epic specification assessed as project-wide is [promoted](lifecycle-tools.md#promote-epic-spec--cross-cutting-unit) out into its own cross-cutting unit, arriving already completed.

---

*Next: how work units, phases, and skills connect in a running session, in [how it fits together](how-it-fits-together.md).*

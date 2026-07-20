# Parallel Phase Task-List Design in Planning

## The Idea

Let `workflow-planning-process` **fan out the task-LIST DESIGN step across phases in parallel** — one `workflow-planning-task-designer` per phase, concurrently — as an opt-in optimisation, while keeping the **AUTHORING step (`workflow-planning-task-author`) strictly sequential**.

Today the skill constructs the plan phase-by-phase (`plan-construction.md` → "B. Process Current Phase" loops; `define-tasks.md` designs one phase's task list, gets it approved, authors it, advances). The **intent** of doing design sequentially is that each phase's designer can build on the prior phase's *concrete task decisions* (seam names, task boundaries, deferrals). The question this idea answers: **does the design step actually need that, or can it be parallelised for wall-clock without quality cost?**

The proposal is narrow: parallelise only the *design* (which produces the task list + edge-cases — cheap, read-only analysis), never the *authoring* (which writes full self-contained task detail and genuinely benefits from — and in this experiment relied on — seeing prior phases' authored detail).

## What Happened

During the `restore-host-terminal-windows` **feature** plan (Portal project — 6 phases, 45 tasks), the orchestrator deviated from the sequential flow: it dispatched **5 task-designers (Phases 2–6) concurrently**, each given only the approved phase *definitions* (goals + full acceptance criteria) + the spec — **not** the sibling phases' task breakdowns. Authoring then ran **sequentially** (each author received the earlier phases' authored detail).

The user flagged the deviation (the explicit "never invoke multiple authoring agents concurrently" rule is authoring-only; the parallel *design* was outside its letter but against the sequential-design *spirit*) and asked for a live assessment: **did parallel design cost anything the sequential authors didn't silently repair?** Two independent read-only analysis agents (a cross-phase consistency audit + a counterfactual "would sequential design have been better" analysis) were run over all six authored task files.

## The Assessment

**Verdict: net-positive for this plan — real wall-clock saved, exactly one absorbed design-level miss, zero surviving defects attributable to the parallelism.**

The one genuine miss — and it is instructive:

- Phase 2's task `2-5` (Ghostty driver) **deferred the `-1712/-1743 → permission-required` error mapping "to Phase 3"** — but that deferral was recorded **only in Phase 2's task-table edge-cases, not in Phase 2's phase-level acceptance criteria**.
- Phase 3's designer, running in parallel and blind to Phase 2's task table, saw only Phase 3's definition (which speaks of *handling* a `permission-required` result, assuming one is produced). It allocated task `3-7` as **burst-stop only — no task for the driver mapping**.
- The **sequential author caught it** and folded the mapping into `3-7`, with an explicit note ("the Phase 3 task list has no separate driver-mapping task, so the mapping is authored here alongside its sole consumer… without it, the burst-stop would be dead code with no producer").

Everything else across the P2→P6 handoffs lined up cleanly (`SpawnWindows`→`Burster`, `AttachCommand` gaining `batch/token`, `ResolveAdapter`→`Resolver`, `PreflightMissing` reuse, notice-band precedence split, closed attr-set + count semantics) — because two substrates carried the cross-phase coordination that sibling task-detail would otherwise provide: **detailed phase definitions (full acceptance criteria, not just goals)** and **a spec that pre-enumerated the cross-cutting contracts** (net-N invariant, the `spawn` closed attr set, the notice-band precedence enumeration, the ack-channel design, the typed-result taxonomy).

## Root Cause / The Failure Mode

The precise, generalisable failure mode:

> **A cross-phase deferral recorded ONLY in a task's edge-cases — not in a phase-level acceptance criterion — is invisible to a parallel designer.**

A parallel designer sees phase *definitions* + the spec, never sibling *task tables*. So any handoff that a phase encodes only in its task-level detail is a blind spot. A sequential designer would have seen the sibling task table and allocated the task; the parallel designer cannot.

Two honest caveats that bound the "net-positive" verdict:

1. **The safety net was sequential *authoring*, not the parallel design.** Had authoring *also* been parallel, the `3-7` gap would have shipped as dead code (a burst-stop with no producer). The result generalises to: *parallel design is safe **provided authoring stays sequential and thorough**.*
2. **It worked here because the inputs were unusually rich.** Full phase acceptance criteria + a spec that pre-enumerated the contracts did the coordination. The single failure was precisely the one boundary that lived *only* in a task table and *not* in a phase definition — exactly the seam parallel design is blind to.

(Separately, the same assessment surfaced an **unrelated** plan blocker — the `terminals.json` config tier wired into the CLI but not the picker, an author *misread* of a Phase-4 refactor. It is **orthogonal** to this experiment: sequential authoring did not prevent it, and it is what the Step-9 plan review exists to catch. Worth noting only to keep the verdict honest: parallel design neither caused nor would have prevented it, and it does **not** reduce the need for the formal review.)

## Recommendation

**Allow parallel phase task-list design as an opt-in, gated on three preconditions — otherwise keep it sequential:**

1. **Phase definitions carry full acceptance criteria** (not just goals). This is what lets a blind designer decompose correctly.
2. **Authoring stays strictly sequential** (unchanged from today's `workflow-planning-task-author` rule). This is the actual safety net.
3. **Every cross-phase deferral is lifted into a phase-level acceptance criterion** — a deferral naming a downstream phase must appear in the deferring phase's (and/or the receiving phase's) acceptance criteria, never *only* in a task's edge-cases. This closes the exact blind spot.

Precondition (3) is worth adopting as an **authoring convention regardless of whether the parallelism ships** — it also improves the Step-9 traceability review (a deferral in the phase definition is checkable against the spec; one buried in a task edge-case is easy to miss). It could be enforced as a lint in `workflow-planning-phase-designer` / `define-tasks.md`: "if a task defers work to phase N, the deferral must be reflected in a phase-level acceptance criterion."

## Scope

- `workflow-planning-process` — `plan-construction.md` ("B. Process Current Phase" would gain an opt-in "design all pending phases' task lists concurrently, then walk the approval/authoring loop sequentially" mode) and `define-tasks.md`.
- `workflow-planning-phase-designer` / `define-tasks.md` — precondition (3): the deferral-placement convention/lint (adopt independently).
- Keep `workflow-planning-task-author` **sequential** — do not parallelise authoring (this experiment is direct evidence of why: sequential authoring was the net that caught the one miss).
- Net trade for a well-specified plan: real wall-clock saved (N designers concurrent), one absorbable seam, zero shipped defects — a **good, narrow win** conditioned on the three preconditions. Where phase definitions are thin or deferrals live in task edge-cases, **disallow** and design sequentially.

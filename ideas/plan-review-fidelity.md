# Plan Review — Fidelity, Not Completeness

**Early discussion (2026-09-21).** Nothing here is decided. Logged after the planning-review-convergence stack so the conversation can resume in a fresh context; the design record comes after that conversation, not before it.

## The Idea

The planning cycle was always about making sure the items in discussion made it into the spec, that the spec fully covers what was discussed, and that from the spec we create the plan. The plan is about what we are building, not how. The implementer decides how, on the whole.

That is not to say the plan cannot carry pieces from discussion, research, or experiments that help with the code. If code was talked through during discussion — a pattern, an architecture, a pipeline decided to be more optimal — it is documented in the discussion because that is where decisions are ratified, and then it appears mandatorily in the spec and therefore in the plan. But where code was never discussed for some part of the feature, it has no place in the spec or the plan: the spec agent or the planning agent has created its own design, and that is out of scope for them.

If a gap arises it is settled — the tiers exist for that. What the planner should not be doing is *finding* gaps that were never discussed. The review loop is forcing Claude to hunt for gaps to fill, and some gaps are fine: the implementer is a Claude agent as capable as the planner, and often better placed — code has been written, there may be a UI to look at, it is in the codebase rather than looking at markdown. Those last-five-percent problems are more appropriately solved there. Worst case the implementer stops and asks the human, even under auto, because it cannot reconcile something; and the facility to go back to discussion for a real product gap stays, though that is rare.

Settle on a line and do not chase perfection. Deal with the obvious cases. Chasing 100% is how the loop never converges: everything added creates the next gap. The bar is 95%.

## Where It Came From

Portal's `lazy-resume-on-attach` plan review on 2026-09-20: twelve cycles, forty-nine findings, none declined, the plan grown to 5.4 times its specification. Traceability was near clean from cycle 4; integrity kept finding defects in mechanism the plan itself had prescribed, and every fix prescribed more, until a task specified a terminal escape parser. The convergence stack (`design/planning-review-convergence.md`) bounds the loop. It does not remove the mandate that produced the findings.

## What the Shipped Prose Currently Says

Facts to have in hand for the discussion, not a proposal:

- `task-design.md`'s template requires **Do** ("specific implementation steps"; "Do steps direct code and tests") and **Tests** ("at least one test name").
- `review-integrity.md`: an implementer should execute the plan "without referring back to the specification"; Task Self-Containment says no task requires reading other tasks. `review-traceability.md`'s depth rule: "enough detail that an implementer wouldn't need to go back to the specification".
- `planning-principles.md`: "spell out the context, don't assume the implementer knows it"; a how-fork the record leaves open is settled on the planner's honest call stated in the plan. CLAUDE.md #8: "the planner owns the how end to end".
- The executor already stops: `workflow-implementation-task-executor.md` rule 4 ("Uncertain about intent or approach? STOP and report back"), returning `blocked` with the decision named. What the task loop does with that under `auto` is unverified.
- The three tiers at planning (`resolve-spec-gap.md`) and at specification settle, land, or route a gap the review trips over.

## To Discuss

- Where the line sits between carrying a decision and hunting for a gap, and what "the obvious cases" means as an instruction to a reviewer.
- Whether the same applies to the specification's gap pass.
- What the task template should and should not ask for.
- Whether the how-fork rule (the planner's honest call, stated in the plan) stays for a fork the review trips over, or goes.
- The executor's `blocked` path under `auto`, and whether the discussion route is reachable from a task.
- What the case corpus and the concluded designs pin, and what a change would supersede.

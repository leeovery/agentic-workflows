# The five work types

Not all work is the same size. A one-line rename and a multi-month platform initiative both deserve a process, but not the *same* process — forcing a typo fix through months of discovery would be absurd, and letting a platform rewrite skip straight to code would be reckless. So the system recognises five shapes of work, each with a pipeline sized to fit, and it picks the right one for you before any real work begins.

You do not have to know which shape your work is. You describe it in your own words and [discovery](discovery.md) settles the type in conversation. Naming a type when you start is only a hint; the shape is confirmed before the pipeline commits to it, and it can change mid-conversation if the work turns out bigger or smaller than it first looked.

## The shapes

| Type | What it is | Pipeline |
|---|---|---|
| **Epic** | A large initiative that fans out into several distinct concerns; multi-topic, multi-session. | Discovery → per topic: (Research) → Discussion → Specification → Planning → Implementation → Review |
| **Feature** | One coherent, shippable thing. | Discovery → (Research) → Discussion → Specification → Planning → Implementation → Review |
| **Bugfix** | Something that used to work is now failing. | Discovery → Investigation → Specification → Planning → Implementation → Review |
| **Quick-fix** | A small, known, mechanical change. | Discovery → Scoping → Implementation → Review |
| **Cross-cutting** | A pattern, policy, or convention to define — nothing shippable at the end. | Discovery → (Research) → Discussion → Specification |

Parenthesised phases are optional. Every shape begins in discovery, because that is where the shape itself is decided — see [why every work type starts in discovery](discovery.md).

The differences are not cosmetic. A **feature** runs the full arc from a decision-making discussion through to a verified build. A **bugfix** swaps discussion for **investigation**, because you cannot decide how to fix something until you know why it broke. A **quick-fix** collapses the whole middle into a single **scoping** pass — there is nothing to debate and nothing to diagnose, so context, spec, and plan are written in one sitting and the work goes straight to building. A **cross-cutting** concern is terminal at specification: you are establishing a standard the rest of the codebase will follow, not shipping a unit of work, so there is nothing to plan or build. An **epic** is a feature's pipeline run many times over, once per topic, held together by a map of everything the initiative contains.

## The three stages

Whatever the shape, its phases group into three stages — the arc every piece of work travels:

- **Discovery** — explore and decide. Settling what the work is, then exploring it: research, discussion, investigation.
- **Definition** — specify and plan. Turning decisions into a standalone specification and a concrete plan; quick-fix scoping lives here too.
- **Delivery** — build and verify. Implementation, then review.

This grouping is more than a label. It maps the collaboration arc directly: Discovery is where you talk most, Definition is where you approve, Delivery is where you step back and let the loop run. It is also how an epic's dashboard organises itself, so a large initiative reads as three bands of progress rather than a flat list of phases.

## Work units and topics

Two words recur throughout this documentation. A **work unit** is one named instance of a work type — "auth-flow" might be a feature work unit, "payments-overhaul" an epic. Each gets its own home in your repository and its own record. A **topic** is a unit of work *within* a phase. For a feature, bugfix, or quick-fix there is only ever one topic and it shares the work unit's name, so the distinction is invisible. For an epic, topics are the distinct concerns the initiative breaks into — each with its own name, its own routing, its own trip through the pipeline. When later pages say "per topic," this is what they mean: an epic runs the pipeline once for each named concern on its map.

## When the shape turns out wrong

Work is not locked to the shape it started with. A feature that grows past a single topic can **pivot** into an epic; a feature that belongs inside a larger initiative can be **absorbed** into an epic as one of its topics. Both are deliberate operations you invoke, covered in [lifecycle operations](lifecycle-operations.md). The point is that guessing the shape wrong at the start costs you nothing — the system is built to reshape work as your understanding of it sharpens.

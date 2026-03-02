# Phase Design

*Reference for **[technical-planning](../SKILL.md)***

---

This reference defines generic principles for breaking specifications into implementation phases.

A work-type context file (epic, feature, or bugfix) is always loaded alongside this file. The context file provides the Phase 1 strategy, progression model, examples, and work-type-specific guidance. These generic principles apply across all work types.

## What Makes a Good Phase

Each phase should:

- **Deliver a working increment** — not a technical layer, but functionality that can be used or tested end-to-end
- **Have clear acceptance criteria** — checkboxes that are pass/fail verifiable
- **Follow natural boundaries** — domain, feature, or capability boundaries, not architectural layers
- **Leave the system working** — every phase ends with a green test suite and deployable code
- **Be independently valuable** — if the project stopped after this phase, something useful would exist

---

## Vertical Phases

Each phase adds complete functionality — a vertical slice through the relevant layers.

**Horizontal (avoid):**

```
Phase 1: All database models and migrations
Phase 2: All service classes and business logic
Phase 3: All API endpoints
Phase 4: All UI components
Phase 5: Wire everything together
```

Nothing works until Phase 5. No phase is independently testable. Integration risk concentrates at the end.

A phase may touch multiple architectural layers — that's expected. The test is: **does this phase deliver working functionality, or does it deliver infrastructure that only becomes useful later?**

---

## Phase Boundaries

A phase boundary belongs where:

- **A meaningful state change occurs** — the system gains a new capability
- **Human validation is needed** — the approach should be confirmed before building more
- **The risk profile shifts** — different concerns, different complexity, different unknowns
- **The work's nature changes** — from core functionality to edge cases, from features to optimisation

### When to split

- The combined work exceeds what can be reasoned about in a single focused session
- An intermediate state is independently valuable or testable
- You need a checkpoint to validate before investing further
- Different parts have different risk or uncertainty levels

### When to keep together

- High cohesion — changes to one part directly affect the other
- The intermediate state has no independent value
- Splitting would create phases that aren't meaningful milestones
- The overhead of phase management exceeds the benefit

### Granularity check

If a phase has only 1-2 trivial tasks, it's probably too thin — merge it. If a phase has 8+ tasks spanning multiple concerns, it's probably too thick — split it. Most phases land at 3-6 focused tasks.

---

## Cross-Phase Coupling

**Maximize cohesion within a phase, minimize dependencies between phases.**

A well-bounded phase could theoretically be reordered or dropped without cascading failures across other phases. In practice, phases have a natural sequence, but each phase should be as self-contained as possible.

Strategies:

- **Strongest foundation first** — subsequent phases add to a working system rather than depending on future phases
- **Clear interfaces between phases** — each phase produces defined contracts (API shapes, data models, test suites) that subsequent phases consume
- **No forward references** — a phase should never depend on something that hasn't been built yet

---

## Anti-Patterns

**Horizontal phases** — organising by technical layer ("all models, then all services, then all controllers"). Defers integration risk, produces phases that aren't independently valuable. Vertical slicing eliminates this by integrating from the start.

**God phase** — one massive phase covering too many concerns. Results in unclear success criteria, inability to track progress, and cognitive overload. If you can't summarise a phase's goal in one sentence, it needs splitting.

**Trivial phases** — phases so small they're just individual tasks wearing a trenchcoat. Phase management has overhead; don't pay it for work that doesn't warrant a checkpoint.

**Infrastructure-only phases** (after Phase 1) — phases that deliver tooling, configuration, or refactoring with no user-facing value. These should be folded into the phase that needs them, unless they're genuinely cross-cutting prerequisites.

**Speculative phases** — phases planned for hypothetical future requirements. Plan what the specification defines, not what might be needed later.

# Epic Task Design

*Context guidance for **[task-design.md](../task-design.md)** — new system builds*

---

## Foundation-First Ordering

In epic projects, the first tasks establish the pattern that all subsequent tasks follow. Foundation means models, migrations, base configuration, and core abstractions that other tasks need to build on.

**Example** ordering within a phase:

```
Task 1: Create Event model and migration (foundation)
Task 2: Create event via API endpoint (happy path)
Task 3: Validate event time ranges (error handling)
Task 4: Handle overlapping events (edge case)
```

The first task builds what doesn't exist yet. Later tasks extend it.

---

## Epic Vertical Slicing

Each task delivers a complete, testable slice of new functionality. Since nothing exists yet, early tasks often establish both the data layer and the first behaviour in a single TDD cycle.

**Example** (Building new feature surfaces from scratch):

```
Task 1: Room model + create room endpoint (establishes the pattern)
Task 2: Post message to room (builds on room, adds messaging)
Task 3: List messages with pagination (extends messaging)
Task 4: Handle empty room and deleted messages (edge cases)
```

The first task is slightly larger because it establishes the foundation AND the first working behaviour. Subsequent tasks are narrower because the pattern exists.

---

## Phase 2+ Considerations

After Phase 1 completes, code exists. When designing tasks for subsequent phases:

- **Review what Phase 1 established** — understand the patterns, conventions, and structure that were created. Subsequent tasks should extend these consistently.
- **Check for drift** — if early implementation decisions could be improved, note them but don't redesign mid-project. Consistency matters more than perfection.
- **Build on what's there** — subsequent phases have infrastructure to work with. Tasks should use existing models, services, and patterns rather than creating parallel structures.

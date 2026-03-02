# Epic Phase Design

*Context guidance for **[phase-design.md](../phase-design.md)** --- new system builds*

---

## The Walking Skeleton

Phase 1 is always a **walking skeleton** --- the thinnest possible end-to-end slice that threads through all system layers and proves the architecture works.

The walking skeleton:

- Touches every architectural component the system needs (database, API, UI, external services)
- Delivers one complete flow, however minimal
- Establishes the patterns subsequent phases will follow
- Is production code, not throwaway --- it becomes the foundation

**Example** (Slack clone):

> Phase 1: "Any unauthenticated person can post messages in a hardcoded #general room. Messages persist through page refreshes."
>
> No auth, no accounts, no multiple rooms. Just the thinnest thread through the entire stack.

**Example** (Calendar app):

> Phase 1: "A single event can be created with title, start, and end time, persisted, and retrieved by ID."
>
> No recurrence, no sharing, no notifications. Just one thing working end-to-end.

The skeleton validates architecture assumptions at the cheapest possible moment. If the end-to-end flow doesn't work, you discover it in Phase 1 --- not after building three phases of isolated components.

This is the **steel thread** principle: never have big-bang integration. By threading through all layers immediately, integration is the first thing you solve, not the last.

---

## Epic Vertical Phases

After the walking skeleton, each subsequent phase adds complete functionality --- a vertical slice through the relevant layers.

```
Phase 1: Walking skeleton --- single event CRUD, end-to-end
Phase 2: Recurring events --- rules, instance generation, single-instance editing
Phase 3: Sharing and permissions --- invite users, permission levels, shared calendars
Phase 4: Notifications --- email and push notifications for event changes
```

Each phase delivers something a user or test suite can validate independently.

### Progression

**Skeleton -> Core features -> Edge cases -> Refinement**

- **Skeleton** (Phase 1): Thinnest end-to-end slice proving the architecture
- **Core features**: Each phase adds a complete capability, building on what exists
- **Edge cases**: Handling boundary conditions, error scenarios, unusual inputs
- **Refinement**: Performance optimisation, UX polish, hardening

This ordering means each phase builds on a working system. The skeleton establishes the pattern; core features flesh it out; edge cases harden it; refinement polishes it.

---

## Cross-Phase Coupling (Epic)

- **Walking skeleton first** --- subsequent phases add to a working system rather than depending on future phases
- **Shared infrastructure in Phase 1** --- if multiple phases need the same foundation, it belongs in the skeleton

---

## Phase 2+ Considerations

After Phase 1 is implemented, code exists. When designing subsequent phases:

- **Review what Phase 1 established** --- understand the patterns, conventions, and architectural decisions that were made. Subsequent phases should build on these consistently.
- **Extend, don't reinvent** --- Phase 2+ should use the infrastructure Phase 1 created. If something is missing, add it --- don't create parallel structures.
- **Watch for drift** --- if early decisions could be improved, note them but maintain consistency unless the specification calls for restructuring.

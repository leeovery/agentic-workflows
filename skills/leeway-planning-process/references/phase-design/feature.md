# Feature Phase Design

*Reference for **[phase-design.md](../phase-design.md)** — feature additions to existing systems*

---

## Phase 1 Strategy

Deliver the most fundamental new capability first. The existing codebase IS the foundation — no need to re-prove architecture. Integration with established patterns is the priority.

Phase 1 should:

- Add the core new behaviour that all subsequent phases build on
- Integrate naturally with existing code and conventions
- Verify both the new functionality AND that existing behaviour isn't broken
- Follow the project's established architectural patterns

---

## Feature Vertical Phases

Each phase adds a complete slice of the new feature, building on the existing system. The number of phases depends entirely on the specification's scope — a focused feature may be a single phase, a larger feature may need several.

**Example** (Adding a configuration toggle with validation):

```
Phase 1: Configuration toggle — setting storage, validation rules, API endpoint, UI control
```

One phase is sufficient when the feature is cohesive and doesn't have distinct stages that benefit from separate checkpoints.

**Example** (Adding webhook support to existing API):

```
Phase 1: Core webhook delivery — event registration, payload construction, HTTP dispatch, retry on failure
Phase 2: Management and observability — webhook CRUD endpoints, delivery logs, manual retry UI
```

**Example** (Adding OAuth to existing Express API):

```
Phase 1: Basic OAuth flow — provider registration, callback, token exchange, session creation
Phase 2: Permission scoping — granular permissions, role mapping, scope enforcement
Phase 3: Token lifecycle — refresh tokens, expiry handling, revocation
Phase 4: Edge cases — concurrent sessions, provider downtime, account linking
```

Each phase delivers functionality that users or tests can validate against the existing system.

### Progression

**Core new functionality → Extended capability → Edge cases → Refinement**

- **Core new functionality** (Phase 1): The fundamental new behaviour, integrated with existing code
- **Extended capability**: Richer variations, additional options, deeper integration
- **Edge cases**: Boundary conditions, failure modes, interaction with existing features
- **Refinement**: Performance, UX polish, hardening

Not every feature passes through all stages. A focused feature might cover core functionality and edge cases together in a single phase. Only create separate phases for stages that represent genuinely distinct work with meaningful checkpoints between them.

---

## Integration Considerations

- **Follow existing patterns** — if the codebase uses service classes, add service classes. If it uses middleware, add middleware. Don't introduce new architectural patterns unless the specification calls for it.
- **Tests verify both directions** — new functionality works AND existing behaviour isn't broken
- **Existing infrastructure is available** — don't rebuild what exists. Use established models, services, and utilities.

---

## Codebase Awareness

Before designing phases, understand what exists. You cannot plan feature work without knowing how the feature integrates with the codebase:

- **Analyze the relevant areas** — read the code the feature touches. Understand existing patterns, conventions, and structure in those areas.
- **Identify integration points** — where does this feature connect to existing code? What modules, services, or APIs will it use or extend?
- **Follow established patterns** — if similar features exist, note how they're structured. New phases should follow the same approach unless the specification explicitly calls for something different.
- **Understand before designing** — phase boundaries should respect existing architectural seams. Don't design phases that cut across established module boundaries without good reason.

This is not a full codebase audit — focus on the specific areas relevant to the feature.

---

## Scope Discipline

Implement what the specification defines. Don't refactor surrounding code, even if it could be "improved". If the existing code works and the specification doesn't call for changing it, leave it alone.

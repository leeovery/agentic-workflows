# Feature Phase Design

*Context guidance for **[phase-design.md](../phase-design.md)** — feature additions to existing systems*

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

Each phase adds a complete slice of the new feature, building on the existing system.

**Example** (Adding OAuth to existing Express API):

```
Phase 1: Basic OAuth flow — provider registration, callback, token exchange, session creation
Phase 2: Permission scoping — granular permissions, role mapping, scope enforcement
Phase 3: Token lifecycle — refresh tokens, expiry handling, revocation
Phase 4: Edge cases — concurrent sessions, provider downtime, account linking
```

**Example** (Adding search to existing e-commerce app):

```
Phase 1: Basic keyword search — index products, query endpoint, display results
Phase 2: Filtering and facets — category filters, price ranges, attribute facets
Phase 3: Relevance tuning — boosting, synonyms, typo tolerance
```

Each phase delivers functionality that users or tests can validate against the existing system.

### Progression

**Core new functionality → Extended capability → Edge cases → Refinement**

- **Core new functionality** (Phase 1): The fundamental new behaviour, integrated with existing code
- **Extended capability**: Richer variations, additional options, deeper integration
- **Edge cases**: Boundary conditions, failure modes, interaction with existing features
- **Refinement**: Performance, UX polish, hardening

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

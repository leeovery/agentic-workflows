# Feature Task Design

*Context guidance for **[task-design.md](../task-design.md)** — feature additions to existing systems*

---

## Integration-Aware Ordering

In feature work, the existing codebase provides the foundation. "Foundation" means whatever the existing codebase doesn't provide yet — new model fields, new routes, service extensions — that other tasks in this phase need.

Extend existing code first, then build new behaviour on top.

**Example** ordering within a phase:

```
Task 1: Add OAuth fields to User model + migration (extends existing model)
Task 2: OAuth callback endpoint + token exchange (new route, uses existing auth middleware)
Task 3: Session creation from OAuth token (extends existing session logic)
Task 4: Handle provider errors and token validation failures (error handling)
```

The first task extends what exists. Later tasks build the new behaviour using both existing and newly-added code.

---

## Feature Vertical Slicing

Each task delivers a complete, testable increment that integrates with the existing system. Since infrastructure already exists, tasks can focus on behaviour rather than setup.

**Example** (Extending an existing system):

```
Task 1: Add search index fields to Product model (extends existing)
Task 2: Search query endpoint returning products (new endpoint, existing model)
Task 3: Filter results by category and price range (extends search)
Task 4: Handle empty results and malformed queries (edge cases)
```

---

## Follow Existing Patterns

Task implementations should match established conventions in the codebase:

- Use the same testing patterns (if the project uses factory functions, use factories; if it uses fixtures, use fixtures)
- Follow the existing file organisation and naming conventions
- Use established service/repository/controller patterns rather than introducing new ones
- Match the existing error handling approach

---

## Codebase Analysis During Task Design

Tasks must be designed with knowledge of the existing code. Before finalizing task lists:

- **Identify similar implementations** — find existing code that does something similar. Tasks should reference this as the pattern to follow. "Follow the same approach as UserController" is more effective than abstract descriptions.
- **Map what needs to change** — which files, modules, or services does each task touch? Understanding this shapes task scope and ordering.
- **Prefer addition over modification** — when possible, design tasks that add new code (functions, modules, endpoints) and call it from existing code, rather than tasks that heavily modify existing code. This reduces risk and makes changes easier to review.
- **Keep tasks focused** — tasks touching existing code should ideally stay within one file or module. Multi-file tasks in existing codebases are significantly harder to get right.

This analysis happens during task design — it informs task scope and ordering without being documented separately.

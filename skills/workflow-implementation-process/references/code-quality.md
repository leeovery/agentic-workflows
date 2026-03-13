# Code Quality

*Reference for **[workflow-implementation-process](../SKILL.md)***

---

Apply standard quality principles. Defer to project-specific skills for framework conventions.

## Principles

### DRY: Don't Repeat Yourself
- Extract repeated logic after three instances (Rule of Three)
- Avoid premature abstraction for code used once or twice

### Compose, Don't Duplicate
When new behavior is the logical inverse or subset of existing behavior, derive it from the existing abstraction rather than implementing independently. If you have a query for "ready items," the query for "blocked items" should be "open AND NOT ready" — not an independently authored query that could drift. Prefer mathematical relationships (derived = total - computed) over parallel computations that must be kept in sync.

### SOLID
- **Single Responsibility**: Each class/function does one thing. Multi-step logic should decompose into named helper functions — each step a function, each name documents intent.
- **Open/Closed**: Extend behavior without modifying existing code
- **Liskov Substitution**: Subtypes must be substitutable for base types
- **Interface Segregation**: Don't force classes to implement unused methods
- **Dependency Inversion**: Depend on abstractions, not concretions

### Cyclomatic Complexity
Keep low. Fix with early returns and method extraction.

### YAGNI
Only implement what's in the plan. Ask: "Is this in the plan?"

### Concrete Over Abstract
Prefer concrete types over language-level escape hatches that bypass the type system. Use specific types for data passing between layers, not untyped containers. If you need polymorphism, define a named interface/protocol with specific methods — don't pass untyped values. If you find yourself writing runtime type checks or casts inside a function, the signature is too abstract.

## Testability
- Inject dependencies
- Prefer pure functions
- Avoid hidden dependencies

## Anti-Patterns to Avoid
- God classes
- Magic numbers/strings
- Deep nesting (3+)
- Long parameter lists (4+)
- Boolean parameters
- Untyped parameters when concrete types are known at design time
- Substring assertions in tests when exact output is deterministic

## Project Standards
Check `.claude/skills/` for project-specific patterns.

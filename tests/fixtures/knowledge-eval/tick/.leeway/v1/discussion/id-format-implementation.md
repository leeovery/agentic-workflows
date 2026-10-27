---
topic: id-format-implementation
status: concluded
work_type: greenfield
date: 2026-01-19
---

# Discussion: ID Format Implementation

## Context

Tick needs unique, stable task identifiers. The research phase decided on hash-based IDs with customizable prefix (`{prefix}-{hash}` format like `tick-a3f2b7`), rejecting sequential IDs (`TICK-001`) to avoid merge conflicts.

**What's settled**:
- Format: `{prefix}-{hash}`
- Prefix customizable at `tick init` (default: `tick`)
- Must be readable and referenceable in conversation

**What's open**: The implementation details of the hash portion.

### References

- [Research: exploration.md](../research/exploration.md) (lines 305-319) - Original ID format decision

## Questions

- [x] What should be the hash length?
      - **Decision**: 6 hex characters
- [x] Random or content-based hash?
      - **Decision**: Random via crypto/rand (stdlib, no deps)
- [x] How should collisions be handled?
      - **Decision**: Retry up to 5 times, error if exhausted (suggests archive)
- [x] What character set for the hash?
      - **Decision**: Hex (0-9, a-f) - decided during hash length discussion
- [x] Should IDs be case-sensitive?
      - **Decision**: Case-insensitive, normalize to lowercase

---

## What should be the hash length?

### Context
IDs need to be short enough to type/reference in conversation but long enough to avoid collisions within a project's lifetime. Research suggested 6-8 characters.

### Options Considered

**6 characters**
- Pros: Easy to type, fits well in conversation
- Cons: ~17M combinations (hex) - collision risk grows with project size

**7 characters**
- Pros: Balance of brevity and space
- Cons: Odd number, slightly less elegant

**8 characters**
- Pros: ~4B combinations (hex), effectively collision-proof for any project
- Cons: Longer to type

### Journey

Explored shorter options (3-4 chars) for better ergonomics. 3 chars too risky (26% collision at 500 tasks). 4 chars viable only with base36 encoding.

Considered base36 (a-z, 0-9) vs hex (0-9, a-f):
- 4 base36 = 1.68M combinations
- 6 hex = 16.7M combinations

Decided hex simpler (no ambiguous chars like 0/O, 1/l to worry about in base36) and 6 chars still very typable.

### Decision

**6 hex characters**. ~16.7M combinations, negligible collision risk at project scale. Collision detection on creation as safety net.

Format: `{prefix}-{6 hex chars}` → e.g., `tick-a3f2b7`

---

## Random or content-based hash?

### Context
The hash source affects determinism and uniqueness guarantees.

### Options Considered

**Random (UUID/nanoid slice)**
- Pros: Simple, guaranteed unique, no input dependencies
- Cons: Non-deterministic, can't recreate

**Content-based (hash of title/description)**
- Pros: Deterministic, same input = same ID
- Cons: Changing title changes ID? Or frozen at creation?

**Timestamp-based**
- Pros: Naturally ordered, unique if resolution high enough
- Cons: Reveals creation time, potential privacy concern

### Journey

Content-based rejected - awkward "what if title changes" problem. Idempotent task creation not a real need; agents shouldn't create duplicates anyway.

Timestamp-based rejected - leaks creation time, adds ordering semantics we don't want.

Random is simplest and cleanest. Considered nanoid libraries:
- `matoous/go-nanoid` - popular, stable
- `jaevor/go-nanoid` - buffered/efficient
- `sixafter/nanoid` - recent 2025, optimized

But for hex-only + fixed length, stdlib `crypto/rand` is 3 lines with no dependency:
```go
b := make([]byte, 3)  // 3 bytes = 6 hex chars
crypto/rand.Read(b)
id := fmt.Sprintf("%x", b)
```

Decided simpler to avoid the dependency.

### Decision

**Random via stdlib `crypto/rand`**. No external dependencies. Generate 3 random bytes, encode as hex = 6 chars.

---

## How should collisions be handled?

### Context
Even with low probability (~0.003% at 1000 tasks), collisions need a strategy.

### Options Considered

**Retry silently**
- Generate new ID on collision, loop until unique
- User/agent never sees the retry
- Needs max attempts to avoid infinite loop

**Error immediately**
- Fail creation, let caller retry
- Exposes implementation detail unnecessarily

**Append suffix**
- `tick-a3f2b7-2` on collision
- Ugly, variable-length IDs

### Journey

Retry is clearly the right approach - no reason to expose collision to user/agent. The question was max attempts.

Probability of consecutive collisions is multiplicative. If P(collision) = 0.003%, then:
- 2 consecutive: 0.00000009%
- 3 consecutive: effectively impossible

Started at 3 max attempts. Bumped to 5 for extra robustness - costs nothing and provides margin.

If 5 consecutive collisions occur, something is seriously wrong (ID space exhaustion). Error message should guide user: "too many tasks, consider `tick archive`".

### Decision

**Retry up to 5 times, silent to caller**. On exhaustion, error with actionable message suggesting archive command.

```
for attempts := 0; attempts < 5; attempts++ {
    id := generateID()
    if !exists(id) {
        return id
    }
}
return error("failed to generate unique ID after 5 attempts - consider archiving completed tasks")
```

---

## What character set for the hash?

### Decision

**Hex (0-9, a-f)**. Decided during hash length discussion. Simpler than base36 - no ambiguous characters (0/O, 1/l), and 6 hex chars provides sufficient space (16.7M combinations).

---

## Should IDs be case-sensitive?

### Context
IDs are generated lowercase (`%x` format), but users might encounter uppercase versions (copy-paste, manual typing).

### Options Considered

**Case-sensitive**
- Simpler implementation (exact match)
- User typo or uppercase = "not found"

**Case-insensitive**
- Normalize to lowercase on lookup
- More forgiving of input variations

### Decision

**Case-insensitive**. Normalize input to lowercase before lookup. Minimal cost, better UX when users copy-paste or type IDs.

---

## Summary

### Key Insights
1. Simpler is better - stdlib over dependencies, hex over base36
2. Collision handling should be invisible to users with actionable error if it fails
3. Small ergonomic choices (case-insensitivity) reduce friction

### Current State
All questions resolved:
- Format: `{prefix}-{6 hex chars}` (e.g., `tick-a3f2b7`)
- Generation: `crypto/rand` (stdlib, no deps)
- Collision: Retry up to 5x, error with archive suggestion
- Matching: Case-insensitive

### Next Steps
- [x] Resolve hash length → 6 hex
- [x] Decide random vs content-based → random (crypto/rand)
- [x] Define collision handling → retry 5x
- [x] Character set → hex
- [x] Case sensitivity → case-insensitive

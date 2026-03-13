# Analysis Patterns

*Reference for **[workflow-investigation-process](../SKILL.md)***

---

Techniques for tracing bugs through code.

## Code Tracing Techniques

### 1. Entry Point Identification

Start from where the user sees the problem:
- UI component that displays the error
- API endpoint that returns wrong data
- Background job that fails
- Event handler that misbehaves

Work backwards from the symptom to the source.

### 2. Data Flow Analysis

Follow the data through the system:
- Where does the data originate?
- What transformations does it undergo?
- Where is it stored/retrieved?
- What validations exist?
- Where does corruption or loss occur?

### 3. Control Flow Analysis

Trace the execution path:
- What conditions must be true to reach the bug?
- Are there early returns or exceptions?
- What state affects the flow?
- Are there race conditions?

### 4. Dependency Mapping

Understand what the buggy code depends on:
- External services (APIs, databases)
- Shared state (caches, session)
- Configuration values
- Other modules/components

### 5. Change Analysis

If the bug is recent:
- What changed recently? (git log, PRs)
- What was the last working version?
- Can you bisect to find the introducing commit?

## Common Bug Patterns

### Race Conditions

**Symptoms:**
- Intermittent failures
- Works in dev, fails in prod
- Related to timing or load

**Investigation:**
- Look for shared mutable state
- Check async operations
- Examine lock/synchronization
- Review concurrent access patterns

### Off-by-One Errors

**Symptoms:**
- Boundary cases fail
- Works for most inputs, fails for edge cases
- Array index out of bounds

**Investigation:**
- Check loop boundaries
- Examine array/string indexing
- Review length calculations
- Test boundary values explicitly

### Null/Undefined References

**Symptoms:**
- TypeError or NullPointerException
- Fails on specific data combinations
- Works when optional fields are present

**Investigation:**
- Trace where null can originate
- Check optional field handling
- Review default value assignments
- Examine null propagation paths

### State Corruption

**Symptoms:**
- Wrong values appear unexpectedly
- State doesn't match expectations
- Problem persists across sessions

**Investigation:**
- Map all mutation points
- Check for unintended side effects
- Review state initialization
- Examine persistence/hydration

### Memory/Resource Leaks

**Symptoms:**
- Gradual degradation over time
- OOM errors after extended use
- Performance slowdown

**Investigation:**
- Check cleanup/disposal code
- Review subscription/listener patterns
- Examine caching behavior
- Profile memory over time

## Investigation Commands

### Finding Related Code

```bash
# Find all references to a function
grep -r "functionName" --include="*.ts"

# Find recent changes to a file
git log -p --follow -- path/to/file.ts

# Find commits mentioning a pattern
git log --all --grep="pattern"

# Find who changed a line
git blame path/to/file.ts
```

### Comparing States

```bash
# Diff between working and broken
git diff good-commit bad-commit -- path/

# Find introducing commit
git bisect start
git bisect bad HEAD
git bisect good known-good-commit
```

## Documentation Tips

### Recording Code Traces

Format traces clearly:
```
src/auth/login.ts:45 - validateCredentials() called
  → src/auth/validate.ts:12 - checks password hash
  → src/db/users.ts:78 - queries user record
  → BUG: returns null when user.status is 'pending'
```

### Capturing Dead Ends

Dead ends are valuable. Document them:
```
### Hypothesis: Cache invalidation issue
Investigated: src/cache/userCache.ts
Finding: Cache is correctly invalidated on user update
Ruled out: Caching is not the cause
```

### Noting Environmental Factors

Record environment-specific findings:
```
### Environment Observations
- Bug occurs in production but not staging
- Difference: Production uses connection pooling
- Staging: Single connection per request
- This affects transaction isolation
```

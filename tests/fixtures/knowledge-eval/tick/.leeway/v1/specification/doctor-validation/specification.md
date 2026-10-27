---
topic: doctor-validation
status: concluded
type: feature
work_type: greenfield
date: 2026-01-24
sources:
  - name: doctor-command-validation
    status: incorporated
---

# Specification: Doctor Validation

## Overview

The `tick doctor` command provides diagnostics for the tick data store. It identifies issues that could cause tick to behave incorrectly - cache staleness, data corruption, invalid references, and constraint violations.

Doctor is **diagnostic only** - it reports problems and suggests remedies but never modifies data. A separate `tick rebuild` command handles cache repair.

### Design Principles

1. **Report, don't fix** - Doctor diagnoses and suggests; user/agent decides what to run
2. **Human-focused** - Debugging tool for humans; agents don't need to parse diagnostic output
3. **Safety net** - Catches what slipped through write-time validation or got corrupted
4. **Run all checks** - Doctor completes all validations before reporting, never stops early

---

## Validation Checks

Doctor performs two categories of checks: **errors** (things that break tick) and **warnings** (suspicious but allowed states).

### Errors

| # | Check | Description |
|---|-------|-------------|
| 1 | Cache staleness | Hash mismatch between JSONL and SQLite cache |
| 2 | JSONL syntax errors | Malformed JSON lines that can't be parsed |
| 3 | Duplicate IDs | Case-insensitive duplicate detection (tick-ABC123 = tick-abc123) |
| 4 | ID format violations | IDs not matching required format (prefix + 6 hex chars) |
| 5 | Orphaned parent references | Task references non-existent parent |
| 6 | Orphaned dependency references | Task depends on non-existent task |
| 7 | Self-referential dependencies | Task depends on itself |
| 8 | Dependency cycles | Circular dependency chains (A→B→C→A) |
| 9 | Child blocked_by parent | Deadlock condition - child can never become ready |

### Warnings

| # | Check | Description |
|---|-------|-------------|
| 1 | Parent done with open children | Parent marked done while children still open - allowed but suspicious |

### Out of Scope

Schema validation (field types, required fields, valid enum values) happens at **write time**, not in doctor. Doctor catches corruption and edge cases that slipped through.

---

## Output Format

Doctor outputs **human-readable text only**. No TOON/JSON variants.

### Rationale

- Doctor is a debugging/maintenance tool run by humans investigating issues
- Agents use normal operations (`ready`, `start`, `done`) - they don't parse diagnostics
- If cache is stale, tick auto-rebuilds on read anyway
- Adding structured output would be complexity for no real use case

### Format

```
✓ Cache: OK
✓ JSONL syntax: OK
✓ ID uniqueness: OK
✗ Orphaned reference: tick-a1b2c3 references non-existent parent tick-missing
  → Manual fix required

1 issue found.
```

- `✓` for passing checks
- `✗` for failures, with details and suggested action
- Summary count at end

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All checks passed (no errors, warnings allowed) |
| 1 | One or more errors found |

### Multiple Errors

Doctor lists each error individually. If there are 5 orphaned references, all 5 are shown with their specific details.

---

## Fix Suggestions

Doctor includes actionable suggestions in its output:

| Issue | Suggestion |
|-------|------------|
| Cache stale | "Run `tick rebuild` to refresh cache" |
| All other errors | "Manual fix required" with explanation of what's wrong |

Doctor never modifies data - it only diagnoses and suggests.

---

## The `tick rebuild` Command

A separate command for cache repair.

### Purpose

Rebuilds the SQLite cache from the JSONL source of truth. Resolves cache staleness issues detected by doctor.

### Behavior

- No flags or options - just rebuilds
- Deletes existing SQLite cache
- Regenerates from JSONL
- If no cache exists, creates it fresh (same as initial build)
- Reports success/failure

### Usage

```
tick rebuild
```

Doctor suggests this command by name when cache issues are detected.

---

## Dependencies

Prerequisites that must exist before implementation can begin:

### Required

| Dependency | Why Blocked | What's Unblocked When It Exists |
|------------|-------------|--------------------------------|
| **tick-core** | Doctor validates against the data schema, ID format, hierarchy rules, and cache structure. Cannot implement validation logic without these definitions. | All doctor checks can be implemented |

### Notes

- Doctor validates rules defined in tick-core (ID format, hierarchy constraints, cache hash mechanism)
- The `tick rebuild` command depends on the dual-write/freshness system defined in tick-core

---
topic: doctor-command-validation
status: concluded
work_type: greenfield
date: 2026-01-19
---

# Discussion: Doctor Command & Validation

## Context

Tick uses dual storage: JSONL as source of truth (committed), SQLite as ephemeral cache (gitignored). Things can go wrong - cache corruption, data inconsistencies, invalid references. A `tick doctor` command provides diagnostics and repair capabilities.

From research (exploration.md lines 538-543):
- Cache corruption → Auto-rebuild from JSONL. Also `tick rebuild` for manual force.
- Dependency cycles → `tick doctor` will detect and report
- Orphaned tasks → `tick doctor` will detect (tasks referencing non-existent parents/deps)

User context: Simple diagnostic command for identifying issues, refreshing SQLite, general health checks.

### References

- [exploration.md](../research/exploration.md) - Lines 538-543

## Questions

- [x] What validations should doctor perform?
- [x] Should doctor auto-fix or just report?
- [x] Separate `tick rebuild` command or fold into doctor?
- [x] Output format for diagnostics?

---

## What validations should doctor perform?

### Context
Doctor needs to check for issues that could cause tick to behave incorrectly or confusingly.

### Options Considered

**From research**:
1. Cache corruption / staleness
2. Dependency cycles
3. Orphaned tasks (referencing non-existent parents/deps)

**Additional candidates**:
4. JSONL syntax errors / malformed lines
5. Invalid field values (bad status, missing required fields)
6. Duplicate IDs
7. Self-referential dependencies
8. Schema version mismatches

**From other discussions**:
9. Child blocked_by parent (deadlock - from hierarchy-dependency-model)
10. ID format compliance (prefix + 6 hex chars - from id-format-implementation)
11. Case-insensitive ID duplicates (tick-ABC123 vs tick-abc123)
12. Parent done while children open (warning only - from hierarchy-dependency-model)

### Journey

Initial list from research covered cache, cycles, orphans. Analyzed other concluded discussions and found additional edge cases:

- hierarchy-dependency-model.md flagged child→parent blocking as deadlock condition
- id-format-implementation.md specified format validation and case-insensitive uniqueness
- Parent-done-before-children is allowed but potentially suspicious - worth a warning

Considered schema validation (field constraints, timestamps) but these should happen at write time, not doctor. Doctor catches what slipped through or got corrupted.

Also considered: cycles already prevented at write time, so doctor is a safety net / corruption detector, not primary validation.

### Decision

**Errors** (things that break tick):
1. Cache staleness (hash mismatch)
2. JSONL syntax errors
3. Duplicate IDs (case-insensitive)
4. ID format violations
5. Orphaned parent references
6. Orphaned dependency references
7. Self-referential dependencies
8. Dependency cycles
9. Child blocked_by parent (deadlock)

**Warnings** (suspicious but allowed):
10. Parent marked done while children still open

Schema validation (field types, required fields) happens at write time - not doctor's job.

---

## Should doctor auto-fix or just report?

### Context
Some issues can be fixed automatically (rebuild cache), others need human judgment (cycles, orphans).

### Options Considered

**Option A: Report only**
- Doctor just reports issues
- Suggests commands to fix (e.g., "run `tick rebuild` to fix cache")
- User/agent decides what to run

**Option B: Auto-fix with flag**
- `tick doctor` reports
- `tick doctor --fix` auto-fixes what it can
- Still reports unfixable issues

**Option C: Auto-fix by default**
- Doctor fixes everything it safely can
- Reports what it couldn't fix

### Journey

Considered auto-fix options but they add complexity. Some fixes are safe (cache rebuild), others need judgment (which duplicate ID to keep? which dependency to break in a cycle?).

User preference: Keep doctor as pure diagnostic. Output includes actionable suggestions - specific commands to run for fixable issues. This keeps responsibilities clear and avoids doctor making decisions it shouldn't.

### Decision

**Report only**. Doctor diagnoses and suggests remedies but doesn't modify anything.

Output includes actionable fix suggestions:
- Cache stale → "Run `tick rebuild` to refresh cache"
- Other issues → Manual intervention required, explain what's wrong

---

## Separate `tick rebuild` command or fold into doctor?

### Context
Research mentions both `tick doctor` and `tick rebuild`. Question: are these distinct commands or should rebuild be a doctor subcommand/flag?

### Options Considered

**Option A: `tick rebuild`**
- Dedicated command, clear purpose
- Matches what doctor suggests in output

**Option B: `tick doctor --fix`**
- Keeps cache management under doctor
- Single command with mode flag

**Option C: `tick cache rebuild`**
- Namespaced approach
- Room for future cache subcommands

### Journey

With doctor being report-only, we need a separate place for the "fix cache" action. Considered namespacing under `tick cache` but YAGNI - no other cache operations planned.

`tick rebuild` is simple, discoverable, and matches natural language ("rebuild the cache"). Doctor output can say "Run `tick rebuild` to refresh cache" - clean handoff.

### Decision

**`tick rebuild`** as separate command.

- Simple, single-purpose
- Doctor suggests it by name in output
- No flags needed - just rebuilds SQLite from JSONL

---

## Output format for diagnostics?

### Context
Other tick commands use TTY detection (human-readable vs TOON for agents). Does doctor need the same?

### Options Considered

**Option A: TTY detection like other commands**
- Human-readable when TTY
- TOON when piped
- Override flags

**Option B: Human-readable only**
- Single output format
- No TOON/JSON variants
- Simpler implementation

### Journey

Considered following the same TTY detection pattern as other commands. But doctor is fundamentally different - it's a debugging/maintenance tool that humans run when investigating issues.

Agents don't need to parse diagnostic output. They use `ready`, `start`, `done` for normal operations. If cache is stale, tick auto-rebuilds on read anyway (per freshness-dual-write discussion). Agents never need to programmatically analyze health check results.

Adding TOON output for doctor would be complexity for no real use case.

### Decision

**Human-readable only**. No TOON/JSON variants.

Example output:
```
✓ Cache: OK
✓ JSONL syntax: OK
✓ ID uniqueness: OK
✗ Orphaned reference: tick-a1b2c3 references non-existent parent tick-missing
  → Manual fix required

1 issue found.
```

Simple checkmarks for passing, X for failures with details and suggested action.

---

## Summary

### Key Insights
1. Doctor is diagnostic-only - reports issues, suggests commands, doesn't modify
2. `tick rebuild` is the action command for cache issues - separate from doctor
3. Doctor is a human tool - no need for TOON/JSON output variants
4. Schema validation happens at write time; doctor catches corruption/edge cases

### Decisions Made
1. **Validations**: 9 error conditions + 1 warning (see full list above)
2. **Behavior**: Report only, suggest fix commands
3. **Rebuild**: Separate `tick rebuild` command
4. **Output**: Human-readable only

### Next Steps
- [ ] Ready for specification

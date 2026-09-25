---
topic: config-file-design
status: concluded
work_type: greenfield
date: 2026-01-19
---

# Discussion: Config File Design

## Context

Tick needs a way to customize behavior per-project. The research phase proposed a simple flat key=value config file at `.tick/config`. This discussion validates that approach and works through the details.

**User preference**: Simple flat config for overriding defaults only. Minimal complexity.

**Agent-first principle**: Config should not require agent awareness - sensible defaults mean agents can ignore config entirely.

### References

- [Research: exploration.md](../research/exploration.md) (lines 401-437) - Config file proposal
- [CLI Command Structure & UX](cli-command-structure-ux.md) - Output flags, error handling decisions
- [TOON Output Format](toon-output-format.md) - Format selection decisions

### Relevant Prior Decisions

From CLI discussion:
- Output format auto-detected via TTY (agents get TOON, humans get pretty)
- Override flags: `--toon`, `--pretty`, `--json`, `--quiet`, `--verbose`
- Simple exit codes (0/1), plain text errors to stderr

## Questions

- [x] What config options are actually needed?
- [ ] ~~What format should the config file use?~~ (moot - no config)
- [ ] ~~Where should config live and when is it created?~~ (moot - no config)
- [ ] ~~How do config values interact with command-line flags?~~ (moot - no config)
- [ ] ~~Should environment variables override config?~~ (moot - no config)
- [ ] ~~How to handle unknown or deprecated config keys?~~ (moot - no config)

---

## Q1: What config options are actually needed?

### Options Considered

**Option A: Minimal config (prefix only)**
```
prefix = auth
```
Just ID prefix customization.

**Option B: Prefix + defaults**
```
prefix = auth
default_priority = 2
```
Add commonly overridden defaults.

**Option C: No config file at all**
Hardcode everything. `tick-` prefix. Sensible defaults. Add config later if needed.

### Journey

Started with research proposal: flat key=value file with `prefix`, `default_priority`, `auto_archive_after_days`.

Challenged: are these actual needs or hypothetical examples?

**Examined each potential option:**

1. **prefix** - Why change it?
   - Semantic prefixes (`auth-`, `api-`) - misleading, tasks span concerns
   - Multi-project disambiguation - each repo has own `.tick/`, no collision
   - Branding preference - is this real need or hypothetical?

2. **default_priority** - Flag works fine: `tick create "X" --priority 2`

3. **auto_archive_after_days** - Premature. Don't have archiving behavior finalized yet.

**The YAGNI case won:**

- Prior decisions (TTY detection, output flags) already handle format selection
- No concrete use case for prefix customization
- Can add config later without breaking anything
- Existing `tick-*` IDs remain valid even if config added later
- Zero config code = less to write, test, document

### Decision

**Option C: No config file for v1**

Hardcoded defaults:
- ID prefix: `tick-`
- Priority: determined at implementation (likely 2 = medium)
- All behavior controlled via command-line flags

**Rationale**: YAGNI. No concrete use case. TTY detection + flags handle the customization that matters (output format). Adding config later is non-breaking - existing task IDs stay valid.

**Future**: If users request customization, add config then with known requirements rather than guessing now.

---

## Summary

### Key Insight

The research proposed config as a solution looking for a problem. When challenged against actual use cases, none survived scrutiny:

- **Output format** - Already handled by TTY detection + flags (prior decision)
- **ID prefix** - No real need to customize; `tick-` is fine
- **Defaults** - Flags handle one-off overrides; no pattern of repeated overrides identified

### Decision

**No config file for v1.**

`.tick/` directory contains only:
- `tasks.jsonl` - Task data (source of truth)
- `tasks.db` - SQLite cache

No `.tick/config`. All defaults hardcoded. Customization via command-line flags only.

### Why This Is Safe

Adding config later is **non-breaking**:
- Existing task IDs (`tick-*`) remain valid
- Absence of config file → use hardcoded defaults (same as v1 behavior)
- New config options can be introduced incrementally

### Next Steps

None needed for config - topic concluded with "don't build it."

Remaining undiscussed topics from research:
- Data Schema Design
- Freshness Check & Dual Write Implementation
- Agent Integration Patterns
- Workflow Integration
- And others (see research analysis)

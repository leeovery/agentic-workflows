---
topic: archive-strategy-implementation
status: concluded
work_type: greenfield
date: 2026-01-19
---

# Discussion: Archive Strategy Implementation

## Context

Tick needs a strategy for handling completed tasks over time. As projects grow, the task file accumulates done tasks that slow queries and clutter output. The research phase established a baseline approach: keep done tasks in main file by default, with optional manual archiving.

Key constraints:
- Agent-first: Agents need fast, predictable queries
- JSONL as source of truth: Archive must preserve this
- SQLite cache for queries: Indexing strategy matters
- Human usability: History should be searchable when needed

### References

- [Research: Archive Strategy](../research/exploration.md) (lines 361-398)

## Questions

- [x] Should archiving be manual-only or support automatic triggers?
- [x] How should the SQLite cache handle archived tasks?
- [~] Is an unarchive command needed? *(deferred - no archiving in v1)*
- [~] What metadata should track archive operations? *(deferred)*
- [~] How do dependencies interact with archiving? *(deferred)*

---

## Should archiving be manual-only or support automatic triggers?

### Context
Foundational decision affecting system predictability. Agents script against tick's behavior - if tasks silently move, workflows could break.

### Options Considered

**Option A: Manual-only (`tick archive`)**
- Pros: Completely predictable, user controls when history moves, no surprises for agents
- Cons: Requires user discipline, file can grow unbounded if ignored

**Option B: Auto-archive on threshold**
- Pros: Zero maintenance, file stays lean automatically
- Cons: Agents might see tasks "disappear" between runs, harder to reason about

**Option C: Manual with advisory warnings**
- Pros: Predictable like manual, but proactive guidance prevents unbounded growth
- Cons: Slightly more complexity in output handling

### Journey

Started with manual-only as the clear winner for agent-first design. The question became: how do we prevent unbounded growth without automatic intervention?

The hybrid emerged: manual archiving, but tick monitors thresholds and advises when they're exceeded. For agent output, include an `advisories` array (footer-style, at bottom of output) so agents can relay the message to users. No behavior change, just information.

**Threshold type debate:**
- Count-based: "100+ done tasks" - concrete but 100 felt low
- Size-based: "tasks.jsonl > X" - more performance-relevant
- Age-based: "done tasks older than 30 days" - rejected as too aggressive for short projects

Settled on dual thresholds (count AND size) to cover both normal and meaty-task scenarios.

**Reverse-engineering defaults** from task schema analysis:
- Minimal task: ~150 bytes
- Typical task: ~300-400 bytes
- Meaty task with description: ~500-1000 bytes
- Go parses JSONL at ~100MB/s, so 5MB still parses in <100ms

### Decision

**Manual-only archiving with advisory warnings.**

- Archiving triggered only by explicit `tick archive` command
- Tick monitors and warns when thresholds exceeded
- Warnings appear in `advisories` array (bottom of output) for agents to relay
- Dual thresholds, configurable as top-level constants:

```go
const (
    ArchiveAdvisoryDoneCount = 500
    ArchiveAdvisorySizeBytes = 2 * 1024 * 1024 // 2MB
)
```

**Rationale**: 500 done tasks is substantial history - most projects won't hit it quickly. 2MB is well before noticeable performance impact. Advisory-only preserves predictability while preventing neglect.

**Note**: This decision was later superseded - see cache question below for the pivot to deferring archiving entirely.

---

## How should the SQLite cache handle archived tasks?

### Context
With archiving, we'd have two JSONL files (`tasks.jsonl` and `archive.jsonl`). How the cache handles this split affects complexity significantly.

### Options Considered

**Option A: Single database, archive flag on tasks**
- Both files indexed into one `tasks` table with `archived BOOLEAN`
- Queries filter by `WHERE NOT archived` by default
- Pros: Simple queries, one cache to maintain
- Cons: Defeats the purpose - must parse both files on every sync

**Option B: Separate databases per file**
- `cache.db` for tasks.jsonl, `archive-cache.db` for archive.jsonl
- `--include-archived` queries both and merges
- Pros: Cache stays lean by default
- Cons: Complex cache management, SQLite ATTACH for cross-DB queries, freshness tracking for two caches

**Option C: No archive indexing (scan on demand)**
- Only `tasks.jsonl` is cached
- `--include-archived` does live JSONL scan of archive
- Pros: Simplest, archive rarely queried
- Cons: Humans can't query archive without agent interpreting JSONL

### Journey

Started exploring Option A vs B vs C. Each had significant drawbacks:

- **Option A** complicates the common path (syncing both files every time)
- **Option B** adds cache management complexity, freshness tracking, cross-database queries
- **Option C** leaves humans unable to query archive without an agent

The B+C hybrid (build archive cache on-demand) introduced more questions: keep it around and track staleness? Delete after query? What happens on subsequent commands without the flag?

**The pivot**: Stepped back and questioned the premise. Do we actually need archiving?

Reality check:
- SQLite handles tens of thousands of rows trivially
- JSONL parses at 100MB/s - even 5MB is <100ms
- Most projects won't hit 500 done tasks
- Those that do still won't have performance issues

We were over-engineering for a hypothetical problem.

### Decision

**Defer archiving entirely - not needed for v1.**

- One file: `tasks.jsonl`
- One cache: `cache.db`
- No archive commands, no `--include-archived` flag, no advisory warnings about archiving
- Clean, simple mental model

If real performance issues emerge from actual usage, revisit with concrete data to design against. The `advisories` array concept remains valuable for other purposes (validation warnings, deprecation notices).

**Rationale**: Solve real problems, not hypothetical ones. YAGNI.

---

## Summary

### Key Insights

1. Agent-first design favors predictability over automatic optimization
2. Performance concerns should be validated with real data before designing solutions
3. Simpler is better - one file, one cache, no edge cases

### Current State

- Archiving deferred to post-v1
- No immediate action needed
- Advisory system concept preserved for other uses

### Next Steps

- [ ] Revisit if users report actual performance issues with large task files
- [ ] Consider archiving for v2 based on real-world feedback

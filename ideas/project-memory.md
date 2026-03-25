# Project Memory — Capture, Access & Consolidation

## The Idea

A persistent project-level memory system that the workflows read from and write to. Memories are captured during and after work units, accessed by future phases as context, and periodically consolidated to stay useful and concise.

## Why This Matters

Currently each work unit is independent — learnings from building Feature A don't influence how Feature B is planned or implemented. The system captures decisions within a work unit beautifully but doesn't learn across work units. Senior developers carry institutional knowledge in their heads; this makes it explicit and persistent.

## Three Concerns

**Capture:** Memories are written at natural moments — after discussion (patterns discovered, user preferences observed), after implementation (codebase conventions found, common errors hit), after review (recurring findings, estimation accuracy). Could also run as a dedicated retrospective step after work unit completion, reading the full artifact trail and extracting insights.

**Access:** Future phases read project memory as optional context. Newer memories are prioritised over older ones. Each phase reads what's relevant — discussion reads past blind spots, planning reads past estimation misses, implementation reads codebase patterns and common errors.

**Consolidation:** Memories accumulate and need pruning. A lottery-based system could trigger consolidation — not on every workflow invocation, but probabilistically as workflows are used. Consolidation would: merge related memories, prune stale or contradicted entries, strengthen memories that have proven useful repeatedly, and keep the total size manageable so it doesn't become noise.

## Storage

Project-level memory file(s) in `.workflows/.state/memory/` or similar. Entries could have metadata: created date, last-referenced date, source work unit, relevance score. The consolidation process uses these signals to decide what stays, what merges, and what gets pruned.

## Design Tension

Must stay concise — if memory grows to hundreds of entries it becomes noise. The lottery-based consolidation helps, but the capture side also needs restraint. Only capture observations that are non-obvious and likely to recur. "The codebase uses PostgreSQL" isn't a memory — "the codebase's custom ORM wrapper silently swallows constraint violations" is.

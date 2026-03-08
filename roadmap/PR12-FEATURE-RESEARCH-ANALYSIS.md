# PR 12: Feature Research Analysis for Discussion Seeding

## Problem

When a feature work unit completes research and enters the discussion phase, the research content is shown as raw context but not analysed. For epic, the discussion entry skill analyses all research files, extracts themes, caches the analysis (with content hashing in the manifest), and presents topic recommendations. Feature has no equivalent — the research-to-discussion transition is unstructured.

## Proposal

Introduce research analysis for feature work units entering discussion. Same caching mechanics as epic (content hash tracked in manifest, analysis cached in `.state/`), but different output shape:

- **Epic**: Analysis breaks research into multiple topic recommendations. User picks which to discuss. Multiple discussions over multiple sessions.
- **Feature**: Analysis produces a single summary that seeds one discussion. No topic breakdown — the feature pipeline is linear by design. Even if the research suggests multiple themes, they feed into one discussion topic (the feature's work unit name).

## What This Involves

### Discussion entry skill (`workflow-discussion-entry`)

The "new entry with research concluded" path in `gather-context.md` currently shows raw research context with "anything to add?". Instead:

1. Check if a cached feature research analysis exists (hash in manifest, file in `.state/`)
2. If cache is valid — use it to seed the discussion with a structured summary
3. If no cache or stale — analyse the research file, extract key findings, decisions, open questions, and constraints into a structured summary. Cache the analysis with content hash.
4. Present the summary to the user with "anything to add?" before proceeding

### Caching mechanics

Same pattern as epic research analysis in the discussion discovery script:
- Hash the research file content
- Store hash + timestamp in manifest at `phases.research.analysis_cache`
- Store the analysis in `.workflows/{work_unit}/.state/research-analysis.md`
- Invalidate when hash changes

### Key constraint

Feature = one topic = one discussion. The analysis must NOT suggest breaking into multiple topics. It produces a consolidated summary of everything the research explored, framed as input to a single discussion.

## Scope

- `workflow-discussion-entry/references/gather-context.md` — new entry path checks for and runs feature research analysis
- `workflow-discussion-entry/scripts/discovery.js` — may need to compute feature research cache state (currently only does this for epic)
- Manifest cache fields — same structure as epic, just scoped to feature work units
- New or updated cache file in `.state/`

## Not In Scope

- Bugfix (no research phase)
- Epic (already has research analysis with topic breakdown)
- Changes to the research processing skill itself

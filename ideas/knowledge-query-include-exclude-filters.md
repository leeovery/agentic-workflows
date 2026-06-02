# Knowledge Base Query — Include/Exclude Result Filters

## The Idea

`knowledge query` can narrow results with hard *include* filters (`--work-unit`, `--work-type`, `--phase`, `--topic`, `--confidence`) and bias them with `--boost:<field>`, but it cannot **exclude**. Add the ability to scope a query by what to include *and* what to exclude across the same set of filterable fields — so a caller can ask for "everything", "only this work unit", or "everything **except** this work unit", and the equivalent for any field.

## Why This Matters

The seeds work (phase 17) hit the concrete gap. A single-phase phase reads its own seed directly, then runs the contextual query for *other* prior work — but the seed (and the unit's imports) surface in that query too, as duplicates, because there's no way to say "prior work, but not from this work unit". Today the only levers are a hard `--work-unit` *include* (the opposite of what's wanted) or an unfiltered query the unit's own chunks can crowd.

Exclusion is a missing primitive more broadly: "what else have we decided about X, ignoring the area I'm already in" is a natural retrieval question the CLI can't currently express.

## What It Would Look Like

The intent (exact syntax is open — see below):

- All results: `knowledge query "..."` (today's default).
- Only this work unit: `knowledge query "..." --work-unit auth-flow` (today).
- Everything except this work unit: `knowledge query "..." --not:work-unit auth-flow` (new).

It should generalise uniformly across every filterable field (`work-unit`, `work-type`, `phase`, `topic`, `confidence`) — the same way `--boost:<field>` already does — with include and exclude as symmetric operations.

## What Needs Deciding (discussion)

This is a feature, not a mechanical change — the right shape needs a design discussion:

- **Syntax** — `--not:<field> <value>` mirroring `--boost:<field>`, a unified `--exclude:<field>`, or something else; repeatable for multiple values.
- **Interaction** with the existing hard include filters and with `--boost` — precedence, and what an include + exclude on the same field should mean.
- **Semantics** for multiple excludes (AND vs OR), and whether exclusion is a hard filter (drop chunks) or a strong de-rank.
- **Scope** — `query` only, or also `remove` and other commands that already accept `--work-unit`.
- **Implementation surface** — the filter construction feeding `store.searchHybrid` in `src/knowledge/index.js`, plus the `--boost:`-style flag parser.

Immediate consumers: the contextual-query step in research/discussion/investigation/scoping (own-unit-vs-cross-unit split), and any future "find related work elsewhere" lookup.

---
topic: toon-output-format
status: concluded
work_type: greenfield
date: 2026-01-19
---

# Discussion: TOON Output Format Implementation

## Context

Tick needs to output task data in a format optimized for AI agent consumption. The research phase decided on TOON (Token-Oriented Object Notation) as the default output format, with JSON as a fallback. This discussion formalizes the implementation details.

**Why TOON matters**: Agents consume tick output frequently (every `tick ready` call). Token efficiency directly impacts cost and context window usage. TOON achieves 30-60% token savings over JSON while actually improving parsing accuracy (73.9% vs 69.7% in benchmarks).

**Core decision already made**: JSONL for storage, TOON for default output.

### References

- [Research: exploration.md](../research/exploration.md) (lines 473-511)
- [TOON specification](https://github.com/toon-format/toon)

## Questions

- [x] What should the TOON output structure look like for each command type?
- [x] How should output format selection work (flags, detection, defaults)?
- [x] How should complex/nested data be handled in TOON?
- [x] Should error output also use TOON format?
- [x] What about human-readable output (--pretty)?

---

*Each question above gets its own section below. Check off as concluded.*

---

## What should the TOON output structure look like for each command type?

### Context

Different commands return different data shapes. `tick list` returns arrays of tasks. `tick show` returns a single task with more detail. `tick stats` returns aggregates. Each needs a TOON representation.

### Options Considered

**Option A: Single flat table for everything**
- Try to fit all data into one TOON table per command
- Con: Nested arrays (blocked_by, children) don't fit TOON's tabular format

**Option B: Multi-section approach**
- Break complex output into multiple TOON sections
- Each section is a clean, uniform table with its own schema
- Pro: Plays to TOON's strengths, self-documenting

**Option C: Fall back to JSON for complex commands**
- Use TOON only for simple lists, JSON for `tick show` etc.
- Con: Inconsistent, agents need to handle multiple formats

### Journey

Started by examining the research example for `tick list`:
```
tasks[2]{id,title,status,priority}:
  tick-a1b2,Setup Sanctum,done,1
  tick-c3d4,Login endpoint,open,1
```

This works well for uniform arrays. But `tick show` has nested data - blocked_by array, children, long text fields.

Explored inline arrays with delimiters (`tick-a|tick-b`) but felt hacky.

**Key insight**: Breaking into sections keeps TOON's strength. Each section is self-describing with its schema header. Related tasks (blockers, children) can include useful context (title, status) not just IDs.

**Empty arrays question**: Should empty sections be omitted or shown with zero count?
- Omit: Cleaner output
- Zero count: Explicit, consistent, agents don't need "missing means empty" logic

Decided: Include with zero count for consistency.

### Decision

**Option B: Multi-section approach**

Example `tick show` output:
```
task{id,title,status,priority,type,parent,created,updated}:
  tick-a1b2,Setup Sanctum,in_progress,1,task,tick-e5f6,2026-01-19T10:00:00Z,2026-01-19T14:30:00Z

blocked_by[2]{id,title,status}:
  tick-c3d4,Database migrations,done
  tick-g7h8,Config setup,in_progress

children[0]{id,title,status}:

description:
  Full task description here.
  Can be multiple lines.

notes:
  Agent notes captured during work.
```

**Principles**:
1. Each section has its own schema header - self-documenting
2. Related entities include context (title, status), not just IDs
3. Long text fields get their own unstructured sections
4. Empty arrays shown with zero count: `blocked_by[0]{id,title,status}:`
5. Sections can be omitted only if the field doesn't exist (vs empty)

---

## How should output format selection work?

### Context

Need to support multiple output formats: TOON (default for agents), JSON (compatibility/debugging), plain text (humans). How does the user/agent select which format?

### Options Considered

**Option A: TOON default (agent-first)**
- Always output TOON, require `--pretty` for human-readable
- Con: Humans see cryptic output by default

**Option B: Human-readable default**
- Pretty tables by default, `--toon` for agents
- Con: Agents must always remember flag

**Option C: Auto-detect (TTY vs pipe)**
- Check if stdout is a terminal
- Terminal → human-readable
- Piped/redirected → TOON
- Pro: Best of both worlds automatically

### Journey

This was discussed in detail in [CLI Command Structure & UX](cli-command-structure-ux.md) discussion.

Key insight: When agents run commands via Bash tool, stdout is a pipe (not TTY). So TOON happens automatically without flags. Humans at terminals get readable output naturally.

This is a well-established Unix pattern used by `ls` (colors), `git` (pager), `grep` (colors).

### Decision

**Option C: Auto-detect TTY** (decided in CLI discussion)

| Condition | Output Format |
|-----------|---------------|
| No TTY (pipe/redirect) | TOON |
| TTY (terminal) | Human-readable table |
| `--toon` flag | Force TOON |
| `--pretty` flag | Force human-readable |
| `--json` flag | Force JSON |

**Rationale**: Agents get TOON automatically without remembering flags. Humans get readable output. Edge cases covered by explicit flags. Intuitive, not magic.

---

## How should complex/nested data be handled in TOON?

### Context

TOON excels at uniform arrays (like task lists). But what about task details with nested dependencies, or hierarchical parent-child relationships? Need to decide how to represent these.

### Options Considered

**Option A: Inline with delimiters**
- `blocked_by` as `tick-a|tick-b|tick-c` within the row
- Con: Needs escaping, parsing complexity, loses structure

**Option B: Multi-section output**
- Break into separate TOON sections, each with its own schema
- Pro: Each section is clean, self-describing

**Option C: Hybrid (JSON for nested parts)**
- TOON for main data, embedded JSON for arrays
- Con: Two formats to parse, defeats the purpose

### Journey

See Q1 discussion. The multi-section approach emerged as the natural fit.

Key realization: TOON's strength is uniform tabular data. Instead of fighting that by cramming arrays into cells, embrace it by making each array its own section.

**Bonus**: Related tasks in sections can include context (title, status), not just IDs. More useful for agents deciding what to do.

### Decision

**Option B: Multi-section output**

Same decision as Q1. Complex data handled by breaking into sections:
- Main entity as single-row table
- Related arrays as their own tables with full schema
- Long text as unstructured sections

See Q1 for full example.

---

## Should error output also use TOON format?

### Context

When commands fail, what format should errors use? Should it match the requested output format, or always be plain text for readability?

### Options Considered

**Option A: Always plain text errors to stderr**
- Simple, universal, humans can always read it
- Errors go to stderr, not mixed with stdout data
- Agents detect via non-zero exit code

**Option B: Match requested format**
- TOON output → TOON error, JSON output → JSON error
- Pro: Consistent parsing for agents
- Con: More complex to implement

**Option C: Structured to stdout + human message to stderr**
- Both machine-readable and human-readable
- Con: Duplicated information, unnecessary complexity

### Journey

Brief discussion. Errors are exceptional - simplicity wins.

Agents can reliably detect errors via:
1. Non-zero exit code (primary signal)
2. stderr contains the error message (human-readable)
3. stdout is empty or incomplete

No need for structured error format. This is standard Unix convention.

### Decision

**Option A: Plain text errors to stderr**

- All errors output to stderr as plain text
- Non-zero exit codes for error conditions
- Exit codes could be meaningful (e.g., 1 = not found, 2 = invalid input) but not required initially

Example:
```
$ tick show tick-xyz
Error: Task 'tick-xyz' not found
$ echo $?
1
```

**Rationale**: Standard Unix convention. Simple, universal. Agents check exit code first, read stderr if needed.

---

## What about human-readable output (--pretty)?

### Context

While agents are the primary user, humans need to read output too (debugging, oversight). What should the default human-readable format look like?

### Options Considered

**Option A: Simple aligned table**
```
ID          STATUS       PRI  TITLE
tick-a1b2   done         1    Setup Sanctum
tick-c3d4   in_progress  1    Login endpoint
```
- Pro: Clean, minimal, no visual noise
- Pro: Works in any terminal

**Option B: Bordered table (MySQL style)**
```
+------------+-------------+-----+------------------+
| ID         | STATUS      | PRI | TITLE            |
+------------+-------------+-----+------------------+
| tick-a1b2  | done        | 1   | Setup Sanctum    |
+------------+-------------+-----+------------------+
```
- Con: Heavy, cluttered for a CLI tool

**Option C: Compact with icons**
```
tick-a1b2  ✓  Setup Sanctum
tick-c3d4  ►  Login endpoint
tick-e5f6  ○  Logout endpoint
```
- Pro: Very compact
- Con: Less structured, harder to scan columns

### Journey

Briefly discussed Go libraries for terminal output (tablewriter, lipgloss, pterm). Heavy TUI frameworks (bubbletea, tview) are overkill for tick.

User preference: "Minimalist and clean"

Realized the specific styling choice (bordered tables, icons, colors) is implementation detail - out of scope for this discussion.

### Decision

**Design philosophy: Minimalist and clean**

- Human-readable output activated via TTY detection or `--pretty` flag
- Should be clean, scannable, not cluttered
- Exact styling (borders, colors, icons) deferred to implementation phase

**Rationale**: This discussion establishes that human-readable output exists and should follow minimalist principles. Implementation details belong in planning/implementation.

---

## Summary

### Key Insights

1. **Multi-section TOON for complex data** - Instead of fighting TOON's tabular nature with nested arrays, break output into multiple self-describing sections. Each section has its own schema header.

2. **TTY detection is elegant** - Agents get TOON automatically (pipes), humans get pretty output (terminals). No flags needed for the common case. Explicit flags (`--toon`, `--pretty`, `--json`) for edge cases.

3. **Empty arrays should be explicit** - Use `blocked_by[0]{id,title,status}:` rather than omitting. Consistency wins over terseness.

4. **Errors stay simple** - Plain text to stderr, non-zero exit codes. Standard Unix convention. No structured error format needed.

5. **Minimalist human output** - Design philosophy is "minimalist and clean". Exact styling deferred to implementation.

### Decisions Made

| Question | Decision |
|----------|----------|
| TOON structure | Multi-section approach for complex data |
| Format selection | TTY auto-detection with override flags |
| Nested data | Separate sections per array/relationship |
| Error output | Plain text to stderr |
| Human output | Minimalist and clean (styling deferred) |

### Implementation Notes

- Related entities in sections include context (title, status), not just IDs
- TOON parsing library may need to be written or adapted for Go
- Human-readable styling choices (library, colors, borders) to be decided during implementation

### Next Steps

- [ ] Proceed to specification phase
- [ ] Define exact TOON output for each command
- [ ] Document TOON parsing requirements

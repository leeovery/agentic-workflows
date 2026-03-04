# Audit Round 4 — Discussion Log

This document captures the findings, discussions, and decisions from the Round 4 audit of `feat/work-type-architecture-v2`. Round 4 dispatched 10 agents (5 logic/integrity + 5 convention) with a focus on logic correctness, content damage, and architectural issues — not just convention violations.

**Rule**: No changes are made until findings are discussed and agreed upon one at a time.

---

## Round 4 Agent Summary

10 agents dispatched:

| # | Focus | Result |
|---|-------|--------|
| 1 | Path integrity (every path in every file) | CLEAN |
| 2 | Content/instruction damage (step numbering, load targets, navigation) | 5 findings |
| 3 | Manifest CLI correctness (every call site) | Minor findings |
| 4 | Discovery script logic (output shape vs consumers) | Minor findings |
| 5 | Diff against main (unexpected changes) | CRITICAL + content damage |
| 6 | Paths deep scan (agents, bridge, hooks) | CLEAN |
| 7 | Manifest usage deep scan (context around every mention) | Minor findings |
| 8 | Work type logic flow (trace feature/epic/bugfix through pipeline) | Multiple logic issues |
| 9 | Dead code and remnants (orphaned refs, stale comments) | Terminology findings |
| 10 | Convention deep scan (STOP gates, navigation, load directives) | 43+ convention violations |

---

## Finding 1: `completed_tasks`/`completed_phases` Never Written (CRITICAL)

**Source**: Agent 5 (diff against main)

**Problem**: During the migration from tracking files to manifest CLI, the task loop in `skills/technical-implementation/references/task-loop.md` Section E was updated to use manifest CLI for `current_phase`, `current_task`, and gate modes — but the `completed_tasks` and `completed_phases` array updates were dropped entirely. Discovery scripts (`start-implementation/scripts/discovery.js` and `status/scripts/discovery.js`) still read these fields, so they'll always be empty.

**On main branch**: Section E had a "Mirror to implementation tracking file" block that explicitly listed: "Append the task ID to `completed_tasks`", "Update `completed_phases` if a phase completed this iteration". This entire block was replaced with manifest CLI calls that omitted these two fields.

**Impact**: Implementation progress always shows 0 completed tasks. External dependency resolution (checking if a blocking task is done) always fails. Status display undercounts completion.

### Discussion: Manifest CLI Array Operations

Investigating how to fix this led to a broader discussion about the manifest CLI's array handling capabilities.

**Current state**: The manifest CLI only supports full-array replacement via `set`. There is no append, push, or partial update command. For `completed_tasks` (appended every task iteration), a read-modify-write cycle each time is clunky and fragile.

**Investigation of all manifest arrays**:

| Array | Type | Modification Pattern |
|-------|------|---------------------|
| `external_dependencies` | Array of objects (keyed by topic) | Read-modify-write for state transitions |
| `linters` | Array of objects | Write-once during setup, never modified |
| `project_skills` | Array of strings | Write-once during setup, never modified |
| `sources` | Already object-keyed in manifest | Dot-path updates via `set` (correct pattern) |
| `completed_tasks` | Array of strings | Needs append (every task iteration) |
| `completed_phases` | Array of numbers | Needs append (on phase completion) |

### Decisions

#### Decision 1: Rename `add-item` → `init-phase`

**Rationale**: `add-item` doesn't add an item to a collection — it initiates a topic entry within a phase with default `{ status: "in-progress" }`. It normalises the difference between epic (creates `phases.{phase}.items.{topic}`) and feature/bugfix (creates `phases.{phase}` flat). The name `add-item` is misleading and collides with the natural naming for actual array operations.

**What `init-phase` does**: Creates a phase entry with `{ status: "in-progress" }`. Guards against duplicates (errors if entry already exists). Routes correctly by work type (flat vs items). No parameters beyond work_unit, phase, topic.

**Could `set` replace it?** Technically yes — `setByPath` auto-creates intermediate objects. But `init-phase` adds a duplicate guard and makes skill intent explicit ("I'm starting a new phase" vs "I'm updating a field").

**Impact**: All call sites use identical syntax (`add-item {name} --phase {phase} --topic {topic}`) — straightforward rename across ~6 processing skills, tests, and docs.

#### Decision 2: Add `push` command

**Purpose**: Append a value to an array, creating the array if it doesn't exist.

```bash
$MANIFEST push {work_unit} --phase implementation --topic {topic} completed_tasks "task-1"
$MANIFEST push {work_unit} --phase implementation --topic {topic} completed_phases 3
```

**Use cases**: `completed_tasks` (every task iteration), `completed_phases` (on phase completion). These are the only arrays that need incremental appending.

**No `remove` command needed**: Nothing in the codebase ever shrinks an array. `completed_tasks` only grows. `external_dependencies` items change state but are never deleted.

#### Decision 3: Convert `external_dependencies` from array to object-keyed-by-topic

**Rationale**: `external_dependencies` is always looked up by topic name. Converting from array to object eliminates the need for a `set-where`/`patch-item` command entirely — individual items can be updated via standard dot-path `set`:

```bash
# Before (read-modify-write cycle):
# 1. Read entire array
# 2. Find item by topic
# 3. Update state
# 4. Write entire array back

# After (single set call):
$MANIFEST set {work_unit} --phase planning --topic {topic} external_dependencies.auth-flow.state resolved
$MANIFEST set {work_unit} --phase planning --topic {topic} external_dependencies.auth-flow.task_id core-2-3
```

**Structure change**:
```json
// Before (array):
"external_dependencies": [
  { "topic": "auth-flow", "description": "...", "state": "unresolved" }
]

// After (object):
"external_dependencies": {
  "auth-flow": { "description": "...", "state": "unresolved" }
}
```

**Impact**: Discovery scripts simplify — `Object.entries(deps)` gives `[topic, {state, task_id}]` directly. No `.find()`, `.filter()` by topic needed. Skill files that update dependencies become one-liners instead of read-modify-write blocks. Tests and migration need updating.

**Not converting `linters`**: Written once during setup as a full JSON array, read-only after that. No incremental updates, no partial modifications. Array is fine.

#### Decision 4: No `set-where`/`patch-item` command needed

With `external_dependencies` converted to object-keyed-by-topic, the only new command needed is `push`. All other array-of-objects either use write-once patterns (linters) or are already object-keyed (sources). This keeps the CLI surface minimal.

### Updated CLI Command Set

| Command | Purpose | Status |
|---------|---------|--------|
| `init` | Create work unit | Unchanged |
| `init-phase` | Create phase entry (renamed from `add-item`) | Renamed |
| `get` | Read value | Unchanged |
| `set` | Write value | Unchanged |
| `push` | Append to array | **New** |
| `list` | Enumerate work units | Unchanged |
| `archive` | Archive work unit | Unchanged |

### Fix Plan for Finding 1

1. Rename `add-item` → `init-phase` (manifest.js, all call sites, tests, SKILL.md docs, CLAUDE.md)
2. Add `push` command to manifest CLI (with tests)
3. Convert `external_dependencies` from array to object-keyed-by-topic (manifest structure, discovery scripts, skill references, tests, migration if needed)
4. Add `completed_tasks`/`completed_phases` writes to `task-loop.md` Section E using `push`
5. Update `linter-setup.md`, `dependencies.md`, and any other docs that reference the old patterns

---

## Finding 2: `computeNextPhase` Ignores Research for Features

**Source**: Agent 8 (work type logic flow)

**Problem**: In `discovery-utils.js`, `computeNextPhase()` only checks research status for epics (lines 93-97). Features skip research checks entirely — if a feature has `research: in-progress`, the function returns "ready for discussion", ignoring active research.

Additionally, the epic default (line 96) returns "ready for research", implying research is mandatory for epics. It's not — it's optional for both.

### Discussion: Research Optionality

**How research actually works**:
- Research is **optional** for both features and epics
- On fresh start (`start-feature` or `start-epic`), the user is offered a choice: go to research or skip to discussion
- This is a human+agent decision based on complexity, not a programmatic default
- Once research is started (`in-progress`), it must be concluded before moving to discussion
- If research doesn't exist, discussion is the natural starting point — no research is implied
- Bugfixes never have research (they use investigation instead)

**The two routing mechanisms**:
1. **First phase selection** (fresh start): Natural language in skill references (`research-gating.md`, `route-first-phase.md`). User chooses at a STOP gate. Not programmatic.
2. **Continuation routing** (after phase concludes): `computeNextPhase()` — deterministic state machine. This is where the bug lives.

**Current behaviour**:
- Epic: checks research, defaults to "ready for research" (wrong — should default to "ready for discussion")
- Feature: no research checks at all (wrong — should check if research exists and is in-progress)
- Bugfix: no research (correct)

**Additionally**: The `workflow-start/scripts/discovery.js` phase list for features (line 18) hardcodes `['discussion', 'specification', 'planning', 'implementation', 'review']`, excluding research from display entirely.

### Decision

Share research checks between epic and feature. Default to "ready for discussion" for both (not "ready for research"). Research only appears in routing if it's already been started:

```javascript
// Replace epic-only block with shared logic
if (wt !== 'bugfix') {
  if (ps('research') === 'in-progress') return { next_phase: 'research', phase_label: 'research (in-progress)' };
  if (ps('research') === 'concluded') return { next_phase: 'discussion', phase_label: 'ready for discussion' };
  return { next_phase: 'discussion', phase_label: 'ready for discussion' };
}
```

Also: make the workflow-start phase list dynamic for features — include research conditionally if it exists in the manifest.

**Future context**: The user plans to introduce `continue-feature`, `continue-bugfix`, `continue-epic` skills to simplify continuation logic. The `start-{phase}` skills will become non-user-invokable (internal routing targets only). The `computeNextPhase` fix is a prerequisite — it needs to correctly understand research optionality before `continue-feature` can rely on it. This is a stepping stone toward that destination.

---

## Finding 3: Epic Routing Passes `work_unit` Where `topic` Is Needed

**Source**: Agent 8 (work type logic flow)

**Problem**: A naming inconsistency — possibly a deeper architectural issue — in how epic routing tables reference the second positional argument.

**CLAUDE.md** defines the two-mode pattern: `$0` = work_type, `$1` = topic.

But the epic routing tables in both `epic-routing.md` (line 95) and `epic-continuation.md` (line 164) say: `$0` = work_type, `$1` = work_unit.

For feature/bugfix this doesn't matter (topic = work_unit). For epic, they're different:
- work_unit = "payments-overhaul" (the epic name)
- topic = "payment-processing" (an item within a phase)

The routing tables pass `{work_unit}` as $1 for epics. But the start-{phase} skills expect $1 to be the topic (per CLAUDE.md). For epic bridge mode, the skill needs BOTH the work_unit (to find the manifest) AND the topic (to know which item) — but there's only one positional argument slot.

**User context**: This is likely a knock-on effect from early in the PR where an agent did a find-and-replace swapping "topic" for "work_unit". The user caught and largely fixed this, but some instances in the routing tables remain.

### Discussion

**Background**: The positional argument pattern (`$0` = work_type, `$1` = topic) was introduced before this PR when feature and bugfix pipelines were added. At that time there was no concept of work units — everything was one big group of artifacts. The work-unit concept was added in this PR to constrain analysis scope (e.g., preventing cross-feature data from leaking into analysis). During implementation, an agent did a find-and-replace changing "topic" to "work_unit", which conflated the two concepts.

**Key principle from user**: Topic and work_unit are **different concepts** even when they have the same string value (feature/bugfix). They represent different things. We should never assume they're interchangeable, and the system should handle them consistently across all work types.

**The problem**: For epic, the skill needs two pieces of information — the work_unit (to find the manifest) and the topic (to know which item within the phase). The original single-argument pattern can't express both.

**Considered and rejected**:
- Colon-delimited syntax (`epic payments-overhaul:payment-processing`) — adds parsing complexity, edge cases with colons in names, no real benefit over positional
- $1 = topic with reverse lookup to find work_unit — expensive, fragile
- Different bridge semantics per work type — inconsistent

### Decision

**Three positional arguments**: `$0` = work_type, `$1` = work_unit, `$2` = topic (optional)

**Rules**:
- Feature/bugfix: always two args (`$0 $1`). Topic inferred from work_unit since they share the same value for these work types.
- Epic with known topic: three args (`$0 $1 $2`). Full bridge mode — skip all discovery.
- Epic without topic: two args (`$0 $1`). Scoped discovery within the epic to determine topic.

**Skill resolution logic**:
```
work_unit = $1                                    (always present)
topic = $2 || (wt !== 'epic' ? $1 : null)        (infer for feature/bugfix, null triggers discovery for epic)
```

**Examples**:
```
/start-discussion feature auth-flow                           → bridge mode (topic = auth-flow)
/start-investigation bugfix login-crash                       → bridge mode (topic = login-crash)
/start-discussion epic payments-overhaul payment-processing   → bridge mode (topic = payment-processing)
/start-specification epic payments-overhaul                   → scoped discovery (spec is not 1:1 from discussion)
/start-research epic payments-overhaul                        → scoped discovery (research has no topic)
```

**Note on specification**: Epic specification doesn't take a topic because it's not one-to-one from discussion to specification. The skill analyses all concluded discussions within the epic and determines groupings. This is already the intended behaviour — `/start-specification epic {work_unit}` runs scoped discovery.

**Impact**: Update CLAUDE.md two-mode pattern docs, all routing tables (epic-continuation, epic-routing, feature-routing, bugfix-routing, feature-continuation, bugfix-continuation), and all start-{phase} skill mode detection logic.

---

## Findings Not Yet Discussed

The following findings from Round 4 agents have not yet been presented or discussed. They are listed here for completeness so nothing is lost.

### From Agent 2 (Content/Instruction Damage)
- Broken `→ Proceed to **Step 6**` in `technical-review/SKILL.md` line 56 — Step 6 doesn't exist (should be Step 5)
- Missing reference file attribution headers in technical-research reference files
- Triple-dash instead of em-dash in epic.md attribution lines

### From Agent 3 (Manifest CLI Correctness)
- Discovery script for spec (`start-specification/scripts/discovery.js`) reads `specPhase.sources` at phase level, but for epics sources are inside `items.{topic}` — always empty for epics
- SKILL.md example pairs `--phase planning` with `task_gate_mode` but real name is `task_list_gate_mode`

### From Agent 4 (Discovery Script Logic)
- Placeholder naming mismatch in status SKILL.md
- Minor orphan fields

### From Agent 5 (Diff Against Main — Content Damage)
- Epic routing display drastically simplified vs old greenfield routing (information loss)
- Epic continuation display also simplified (cross-phase relationship visibility lost)
- `status/SKILL.md` removed CRITICAL note about entities not flowing one-to-one
- Em-dash to triple-dash changes in `phase-design/epic.md` and `task-design/epic.md`

### From Agent 8 (Work Type Logic Flow)
- Feature phase list in `workflow-start/scripts/discovery.js` excludes research (related to Finding 2)
- `$1` positional argument called "topic" in CLAUDE.md but "work_unit" in most phase skills (related to Finding 3)
- Unreachable `research` row in `feature-continuation.md`
- Investigation handoff omits `Work type: bugfix`

### From Agent 9 (Dead Code and Remnants)
- Loop variable inconsistency in `work-type-selection.md` template: epics use `unit`, features/bugfixes use `topic` for iterating `work_units`
- Natural language says "topic" where "work unit" is correct in `feature-routing.md` and `bugfix-routing.md`

### From Agent 10 (Convention Deep Scan)
- 43+ STOP gate format violations across codebase (various non-standard patterns)
- 7 non-standard Load directive wordings in backbone SKILL.md files
- H2 conditionals in `environment-setup.md`
- Bold top-level conditionals in `determine-review-version.md` and `spec-change-detection.md`

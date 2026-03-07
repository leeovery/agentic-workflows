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
| 10 | Convention deep scan (STOP gates, navigation, load directives) | Convention violations |

---

## Finding 1: `completed_tasks`/`completed_phases` Never Written (CRITICAL)

**Source**: Agent 5 (diff against main)
**Status**: ✅ Discussed — decisions made

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

**Deep investigation of `linters` and `sources`**: Both were checked for whether they need converting. `linters` is set once during implementation setup (Step 5 of technical-implementation), then read by `invoke-executor.md` (passes to executor agent) and `tdd-workflow.md` (runs during LINT step). Never appended to, never partially updated — full replacement is fine. `sources` is already stored as an object in the manifest (`sources.auth-flow.status`), updated via dot-path `set`, and converted to array in discovery output via `Object.entries().map()`. Already the correct pattern.

### Discussion: Naming the Commands

**Renaming `add-item`**: The user questioned what `add-item` actually does. Investigation showed it only creates a phase entry with hardcoded `{ status: "in-progress" }` — it's initiating phase tracking, not adding to a collection. It normalises epic vs feature/bugfix structure and guards against duplicates. Alternatives considered: `register`, `add-phase`, `init-phase`. Chose `init-phase` for symmetry with `init` (which creates work units). The user confirmed keeping it as a separate command (rather than replacing with `set`) because the duplicate guard has value.

**New array commands**: Initially proposed two commands — `add-item` (append to array) and `patch-item` (update matched item in array by key). The user raised that `add-item` and `patch-item` aren't clear names, and `add-item` conflicts with the existing command's conceptual space. This led to investigating whether `external_dependencies` could be an object instead of an array — which it can, eliminating the need for `patch-item` entirely.

**Naming `push`**: Alternatives considered: `append`, `array-push`, `add-to`. Chose `push` — universally understood for arrays, no collision with other commands.

**Whether `remove` is needed**: Investigated all array mutation patterns. Nothing in the codebase ever removes items from arrays. `completed_tasks` only grows. `external_dependencies` items change state but are never deleted. No `remove` command needed.

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

**Not converting `sources`**: Already stored as object-keyed in manifest. Dot-path updates via `set` already work. Discovery converts to array via `Object.entries().map()` for output. Already the correct pattern.

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
**Status**: ✅ Discussed — decision made

**Problem**: In `discovery-utils.js`, `computeNextPhase()` only checks research status for epics (lines 93-97). Features skip research checks entirely — if a feature has `research: in-progress`, the function returns "ready for discussion", ignoring active research.

Additionally, the epic default (line 96) returns "ready for research", implying research is mandatory for epics. It's not — it's optional for both.

### Discussion: Research Optionality

**How research actually works** (from user's detailed explanation):
- Research is **optional** for both features and epics
- On fresh start (`start-feature` or `start-epic`), the user is offered a choice: "Do you want to go into research or are you happy to skip forward to discussion?" This is presented as a STOP gate choice, potentially influenced by Claude's assessment of complexity
- If complexity is low, Claude may suggest skipping research without even asking
- This is a human+agent decision based on knowledge in the moment — **not a programmatic decision**
- Once research is started (`in-progress`), it must be concluded before moving to discussion
- If the user exits and comes back with research in-progress, the system should continue research — not skip to discussion
- If research is concluded, proceed to discussion
- If there's no research but an in-progress discussion, go straight to discussion — the choice has already been made
- If nothing exists (fresh start), present the choice again
- Bugfixes never have research (they use investigation instead)

**User's concern about codifying routing**: The user expressed concern about `computeNextPhase` being too rigid. Before this PR, phase routing was handled through natural language in skill instructions — each start skill would analyse state and provide options. Now with `computeNextPhase`, it's codified as a deterministic state machine. The user's view: this is acceptable as long as it correctly handles optionality. Research being optional is the key test case. The function should reflect what the skills know, not impose a rigid pipeline. If it's too rigid, it will restrict how the system works.

**Historical context**: Research didn't have a state on main branch — it was always open-ended, never "concluded." This PR introduced `in-progress` and `concluded` states for research. The `computeNextPhase` function wasn't updated to handle this for features (only for epics), and the epic handling defaults to "ready for research" which implies it's mandatory.

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

**Future context**: The user plans to introduce `continue-feature`, `continue-bugfix`, `continue-epic` skills to sit alongside and help simplify the corresponding start skills. The `start-{phase}` skills (`start-discussion`, `start-specification`, etc.) will all become non-user-invokable — purely mechanisms for gathering information and doing discovery before routing into the technical-level processing skills. The continue skills will handle the continuation/resume flow that currently lives split between `workflow-start` (the "continue X" menu), `workflow-bridge` (phase computation), and the routing references. The `computeNextPhase` fix is a prerequisite — it needs to correctly understand research optionality before `continue-feature` can rely on it. The current architecture already has the right separation of concerns; the continue skills consolidate pieces that already exist. This is a stepping stone toward that destination — no continue skills work in this PR, but the fixes should align with that direction.

---

## Finding 3: Positional Argument Redesign

**Source**: Agent 8 (work type logic flow)
**Status**: ✅ Discussed — decision made

**Problem**: A naming inconsistency — and deeper architectural issue — in how routing tables reference positional arguments.

**CLAUDE.md** defines the two-mode pattern: `$0` = work_type, `$1` = topic.

But the epic routing tables in both `epic-routing.md` (line 95) and `epic-continuation.md` (line 164) say: `$0` = work_type, `$1` = work_unit.

For feature/bugfix this doesn't matter (topic = work_unit). For epic, they're different:
- work_unit = "payments-overhaul" (the epic name)
- topic = "payment-processing" (an item within a phase)

The routing tables pass `{work_unit}` as $1 for epics. But the start-{phase} skills expect $1 to be the topic (per CLAUDE.md). For epic bridge mode, the skill needs BOTH the work_unit (to find the manifest) AND the topic (to know which item) — but there's only one positional argument slot.

**User context**: This is likely a knock-on effect from early in the PR where an agent did a find-and-replace swapping "topic" for "work_unit". The user caught and largely fixed this, but some instances in the routing tables remain.

### Discussion

**Routing architecture analysis**: A deep investigation of all routing files revealed how phase transitions actually work across work types:
- **Feature/bugfix**: Continuation is deterministic. `computeNextPhase()` computes the single next phase, `workflow-bridge` loads `feature-continuation.md` or `bugfix-continuation.md`, which enters plan mode with `Invoke /start-{next_phase} {work_type} {work_unit}`. No user choice.
- **Epic**: Continuation is interactive. `epic-continuation.md` displays ALL actionable items across ALL phases and lets the user choose what to work on next — they can pick any phase, not just the computed "next" one.
- **Pipeline shape**: There is no central "pipeline definition" file. The sequence (research → discussion → specification → planning → implementation → review) emerges from three things: (1) entry-point skills conditionally invoking the first phase, (2) processing skills invoking workflow-bridge when done, (3) `computeNextPhase()` computing what comes next. This is important context because `computeNextPhase` is the **single point of truth** for continuation routing — if it's wrong, the entire pipeline breaks.
- **Discovery mode with pipeline context** (`/start-specification epic`) requires the work_unit to know which manifest to load. The old pattern of just passing work_type without work_unit would fail for this reason.

**Background**: The positional argument pattern (`$0` = work_type, `$1` = topic) was introduced before this PR when feature and bugfix pipelines were added. At that time there was no concept of work units — everything was one big group of artifacts. The work-unit concept was added in this PR to constrain analysis scope (e.g., preventing cross-feature data from leaking into analysis). During implementation, an agent did a find-and-replace changing "topic" to "work_unit", which conflated the two concepts.

**Key principle from user**: Topic and work_unit are **different concepts** even when they have the same string value (feature/bugfix). They represent different things. We should never assume they're interchangeable, and the system should handle them consistently across all work types.

**The problem**: For epic, the skill needs two pieces of information — the work_unit (to find the manifest) and the topic (to know which item within the phase). The original single-argument pattern can't express both.

**Considered and rejected**:
- Colon-delimited syntax (`epic payments-overhaul:payment-processing`) — user suggested, then agreed it would add parsing complexity everywhere (mode detection, routing tables, tests), edge cases with colons in names, and the positional approach is already implicit so no real benefit
- $1 = topic with reverse lookup to find work_unit — expensive, fragile
- Different bridge semantics per work type — inconsistent
- Passing same value twice for feature/bugfix (`feature auth-flow auth-flow`) — explicit but redundant and error-prone. The skill knows from work_type that topic = work_unit for feature/bugfix

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

**Impact**: Update CLAUDE.md two-mode pattern docs, all routing tables (epic-continuation, epic-routing, feature-routing, bugfix-routing, feature-continuation, bugfix-continuation), all start-{phase} skill mode detection logic, and the unify handoff files (see Finding 20).

---

## Finding 4: Unreachable `research` Row in `feature-continuation.md`

**Source**: Agent 8
**Status**: ✅ Discussed — resolves with Finding 2

The feature-continuation routing table includes a `research` row, but since `computeNextPhase` never returns `research` for features, that row is unreachable. Once Finding 2 is implemented (research checks shared between epic and feature), this row becomes reachable. No separate fix needed.

---

## Finding 5: Investigation Handoff — False Positive

**Source**: Agent 8
**Status**: ❌ False positive

The claim was that the investigation handoff omits `Work type: bugfix`. Verified as incorrect — `conclude-investigation.md` line 64 clearly includes `Work type: bugfix` in the bridge invocation.

---

## Finding 6: Epic Spec Discovery Reads `sources` at Wrong Level

**Source**: Agent 3 (Manifest CLI correctness)
**Status**: ✅ Discussed — fix agreed

**Problem**: `start-specification/scripts/discovery.js` line 30 reads `specPhase.sources` at the phase level, but for epics, sources are stored inside `items.{topic}` — so they'd always be empty for epics.

**Context** (from user's explanation): When starting specification for an epic, the system analyses all concluded discussions and groups them. You might have 10 discussions that become 5 specifications. Each grouping gets a derived name based on its constituent discussions (e.g., three auth-related discussions → "authentication" spec topic). A "source" in a spec's manifest represents a discussion topic that was incorporated into that grouping. So `sources.payment-processing.status = "incorporated"` means the "payment-processing" discussion was consumed by this spec. The spec topic is the grouping name, not a discussion name — it's a derived concept.

The discovery script needs to answer: "has this discussion been incorporated into any spec?" For feature/bugfix (flat structure), checking `specPhase.sources` works. For epic (items structure), it needs to check across all spec items.

**Fix**: For epic, check all spec items' sources for the discussion topic:

```javascript
// Current (broken for epic):
if (specPhase.sources && specPhase.sources[item.name]) {

// Fixed: check all spec items' sources for this discussion
const specItems = phaseItems(m, 'specification');
const hasIndividualSpec = specItems.some(si => si.sources && si.sources[item.name]);
```

---

## Finding 7: Broken Step Reference in `technical-review/SKILL.md`

**Source**: Agent 2
**Status**: ✅ Discussed — fix agreed

Line 56 has `→ Proceed to **Step 6**` but Step 6 doesn't exist — should be Step 5 ("Review Actions"). Pre-existing on main branch. The `analysis-only` mode skips the full review and goes straight to review actions.

**Fix**: `Step 6` → `Step 5`.

---

## Finding 8: Missing Reference File Attribution Headers

**Source**: Agent 2
**Status**: ✅ Discussed — fix agreed

Two technical-research reference files missing the standard attribution header:

1. `interview.md` — loaded by `research-guidelines.md`. Should attribute to `research-guidelines.md`.
2. `template.md` — loaded by the backbone (`SKILL.md` line 88). Should attribute to `../SKILL.md`.

Note: `convergence-awareness.md` attributes to `research-session.md` — verified correct (loaded by that file, not the backbone).

Pre-existing on main.

---

## Finding 9: Triple-Dash Instead of Em-Dash in Epic Planning References

**Source**: Agent 2 / Agent 5
**Status**: ✅ Discussed — fix agreed

`phase-design/epic.md` and `task-design/epic.md` use ` --- ` where ` — ` (em-dash) is intended. ~16 instances across both files. Used as prose separators, not markdown horizontal rules.

These files were created in this PR (commit `03c2cb2`). Simple find-and-replace of ` --- ` → ` — ` within these two files.

---

## Finding 10: `task_gate_mode` vs `task_list_gate_mode` in Manifest Docs

**Source**: Agent 3
**Status**: ✅ Discussed — fix agreed

`skills/workflow-manifest/SKILL.md` line 106 shows `task_gate_mode` in an example, but the actual field name used in planning is `task_list_gate_mode`. Note that `task_gate_mode` exists as a separate field in implementation (different context) — the doc example is just using the wrong name for the planning context.

**Fix**: Line 106 `task_gate_mode` → `task_list_gate_mode`.

---

## Finding 11: Loop Variable and Terminology Inconsistency

**Source**: Agent 9
**Status**: ✅ Discussed — fix agreed

**Loop variables in `work-type-selection.md`**: Epics use `unit` as loop variable, features and bugfixes use `topic`. All iterate over `work_units`. Should be consistent — `unit` is correct since the collection is `work_units`.

**Natural language in `feature-routing.md` and `bugfix-routing.md`** (line 59): "Each topic shows..." should be "Each work unit shows..." — the array being described is `work_units`.

**Fix (part 1 — safe now)**: Rename loop variables `topic` → `unit` in `work-type-selection.md`. Change "Each topic" → "Each work unit" in routing files.

**Fix (part 2 — tied to Finding 3)**: Epic routing table `{work_unit}` values may need revisiting when positional argument redesign is implemented — some may actually be topics.

---

## Finding 12: Epic Routing Display Simplification

**Source**: Agent 5
**Status**: ⏭️ Deferred — leave for post-PR review

The epic routing display in `workflow-start` was simplified compared to the old greenfield routing (less per-phase detail). Verified that the detailed per-phase view moved to `epic-continuation.md` — information is relocated, not lost. The simplification in `workflow-start` is appropriate (summary view for selecting which epic).

Epic continuation display similarly simplified but still shows all phases with items and statuses.

User decision: leave as-is, review through practical use post-PR.

---

## Finding 13: Removed CRITICAL Note About Entities in `status/SKILL.md`

**Source**: Agent 5
**Status**: ✅ Discussed — fix agreed

A CRITICAL note about entities not flowing one-to-one across phases was removed during the PR. With work-unit architecture, this is less of an issue for feature/bugfix (single topic throughout), but still applies to epics (multiple discussions may combine into one specification).

**Fix**: Restore the note, scoped to epics: "For epics, topics don't flow one-to-one across phases — multiple discussions may combine into one specification. The specification's `sources` object tracks which discussions were incorporated."

---

## Finding 14: STOP Gate Format Violations — False Positive

**Source**: Agent 10
**Status**: ❌ False positive

Agent claimed 43+ violations. Investigation found only 1 file (`epic-continuation.md`) with "Stop here" — but this is a **menu option** (user-facing choice to pause the session), not a STOP gate. The actual STOP gate on line 144 (`**STOP.** Do not proceed — terminal condition.`) is correctly formatted.

---

## Finding 15: Non-Standard Load Directive Wordings

**Source**: Agent 10
**Status**: ⏭️ Deferred — not worth fixing

Some skills use "and follow its instructions." vs "and follow its instructions as written." Inconsistent but not impactful. Unique variants with additional context (e.g., "and use its techniques to...") are intentional.

User decision: leave as-is.

---

## Finding 16: H2 Conditionals in `environment-setup.md`

**Source**: Agent 10
**Status**: ✅ Discussed — fix agreed

`## If Setup Document Exists` and `## If Setup Document Missing` use H2 for conditional routing — should be H4 per convention.

**Fix**:
- `## If Setup Document Exists` → `#### If setup document exists`
- `## If Setup Document Missing` → `#### If setup document is missing` (or `#### If no setup document exists`)
- `## No Setup Required` → `#### If no setup required`
- `## Setup Document Location`, `## Plan Format Setup`, `## Example Setup Document` stay as H2 (genuine sections)

Pre-existing on main.

---

## Finding 17: Bold Top-Level Conditionals

**Source**: Agent 10
**Status**: ✅ Discussed — fix agreed

Two files use bold for top-level conditionals (not nested under H4):

1. `start-review/references/determine-review-version.md`: `**If no reviews exist:**` and `**If reviews exist:**`
2. `technical-planning/references/spec-change-detection.md`: `**If no changes detected:**` and `**If changes detected:**`

Both should be H4. Pre-existing on main.

---

## Finding 18: Placeholder Naming Mismatch in `status/SKILL.md` — False Positive

**Source**: Agent 4
**Status**: ❌ False positive

The template uses generic `{status}`, `{work_unit}` etc. which are placeholder conventions per CLAUDE.md syntax, not meant to be literal field name matches from discovery output.

---

## Finding 19: YAML Illustration for JSON Manifest Data

**Source**: Agent 9
**Status**: ✅ Absorbed into Finding 1

`technical-planning/references/dependencies.md` shows `external_dependencies` structure using YAML syntax but the manifest is JSON. Will be updated as part of the `external_dependencies` conversion to object-keyed-by-topic (Finding 1, Decision 3).

---

## Finding 20: Hardcoded "unified" as Work Unit in Spec Handoffs

**Source**: Agent 7
**Status**: ✅ Absorbed into Finding 3

`start-specification/references/handoffs/unify.md` and `unify-with-incorporation.md` use `"unified"` where `{work_unit}` should be. "Unified" is a **topic** name (the grouping name when a user chooses to combine all discussions into one specification), not a work unit name.

**What "unified" means** (from user's explanation): When starting a specification for an epic, the system analyses all discussions and groups them. You might have 10 discussions that become 5 specifications — each grouping gets a derived name based on its constituent discussions (e.g., three auth-related discussions become the "authentication" spec topic). However, the user can override and say "I just want one big specification" — that single grouping is given the topic name "unified." So "unified" is a topic representing a group of discussions within an epic work unit — it is NOT a work unit name.

Lines affected in both files: session state path (line 17/19), manifest get (line 24), output path (line 35/39). The topic position ("unified" as the second segment in spec paths like `.workflows/{work_unit}/specification/unified/specification.md`) is correct — only the work_unit position needs to become `{work_unit}`.

Fix is part of Finding 3's positional argument cleanup scope.

---

## Summary: Agreed Fixes

| # | Finding | Type | Pre-existing? | Scope |
|---|---------|------|--------------|-------|
| 1 | `completed_tasks`/`completed_phases` never written | CRITICAL bug | No (introduced in PR) | CLI changes + task-loop fix |
| 2 | `computeNextPhase` ignores research for features | Logic bug | No (introduced in PR) | discovery-utils.js + workflow-start discovery |
| 3 | Positional argument redesign ($0=wt, $1=wu, $2=topic) | Architecture | No (introduced in PR) | CLAUDE.md, all routing tables, mode detection, unify handoffs |
| 6 | Epic spec sources at wrong level | Logic bug | No (introduced in PR) | start-specification discovery script |
| 7 | Broken Step 6 reference | Content damage | Yes (pre-existing) | technical-review/SKILL.md line 56 |
| 8 | Missing attribution headers | Convention | Yes (pre-existing) | 2 technical-research reference files |
| 9 | Triple-dash → em-dash | Content | No (introduced in PR) | 2 epic planning reference files, ~16 instances |
| 10 | `task_gate_mode` → `task_list_gate_mode` | Doc error | No (introduced in PR) | manifest SKILL.md line 106 |
| 11 | Loop variable + terminology inconsistency | Naming | No (introduced in PR) | work-type-selection.md, feature-routing.md, bugfix-routing.md |
| 13 | Removed CRITICAL note about entities | Content damage | No (introduced in PR) | status/SKILL.md |
| 16 | H2 conditionals in environment-setup.md | Convention | Yes (pre-existing) | 3 headings |
| 17 | Bold top-level conditionals | Convention | Yes (pre-existing) | 2 files, 4 headings |

## Not Fixing / Deferred

| # | Finding | Reason |
|---|---------|--------|
| 4 | Unreachable research row | Resolves with Finding 2 |
| 5 | Investigation handoff | False positive |
| 12 | Epic routing display simplified | Deferred — review post-PR through practical use |
| 14 | STOP gate violations | False positive (menu option, not gate) |
| 15 | Load directive wording | Not impactful |
| 18 | Status placeholder naming | False positive |
| 19 | YAML illustration | Absorbed into Finding 1 |
| 20 | Hardcoded "unified" | Absorbed into Finding 3 |

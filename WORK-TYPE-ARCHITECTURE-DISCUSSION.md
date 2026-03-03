# Work Type Architecture — Discussion Record

Captured from design discussion on 2026-03-01. This documents the full conversation, decisions made, and reasoning behind them.

---

## Starting Point

We began with the 5 open design questions in `WORK-TYPE-ARCHITECTURE.md`, captured during the unified entry point PR. The goal was to work through each systematically and make design decisions rather than quick fixes.

---

## Problem 1: Pipeline Continuity Is Fragile

### The Problem

`work_type` in artifact frontmatter serves two purposes: pipeline shape (which phases exist) and pipeline continuity (triggers bridge at conclusion). If `work_type` is missing, the pipeline silently stops. Multiple code paths drop it — bare invocations from greenfield menus, direct phase entry, templates that omit it, discovery-mode handoffs.

### Options Considered

1. **`pipeline: active` flag** — explicit, independent of work_type. Simple but another field that can be forgotten, same class of bug.
2. **Always fire bridge, let it decide** — bridge runs at every phase conclusion, checks context, routes forward or exits gracefully. Inverts the problem from "opt-in to continuity" to "opt-out."
3. **Make work_type propagation bulletproof** — fix every code path. Whack-a-mole, doesn't prevent future leaks.

### Decision: Always fire the bridge (Option 2)

The bridge fires at every phase conclusion regardless. Eliminates the entire class of "forgot to set the flag" bugs. Bridge behavior varies by work_type:

- **Feature/Bugfix**: Linear routing forward (current behavior, already working).
- **Epic** (formerly greenfield): Present options — next phase, stay in current phase (new topic), go back, or done. The bridge becomes a navigation hub rather than a one-way escalator.

*Note: The original discussion included a "no work_type" fallback (bridge exits cleanly). This was superseded by the Problem 5 decision — all work is manifest-backed, so every artifact lives within a work unit that has a work_type. The no-work_type case should not arise.*

### work_type source of truth

Originally discussed as "work_type in all artifact frontmatter." Superseded by the manifest system decision in Problem 2 — work_type lives in the manifest as part of work unit identity, not duplicated in every artifact's frontmatter. The bridge reads work_type from the manifest, not from the artifact.

---

## Problem 3: Missing Middle Ground in Work Type Taxonomy

*Discussed before Problem 2 because it feeds into scope/archive decisions.*

### The Problem

Gap in taxonomy: large feature set on an existing product. Multiple related discussions and specs needed. Greenfield's model is too rigid (complete all discussions before specs). Feature's model is too narrow (single topic).

### Options Considered

1. Add a fourth work type (epic, initiative, project).
2. Repurpose greenfield to mean "multi-topic work" regardless of product state.

### Decision: Rename greenfield to "epic"

Greenfield's mechanics (multi-topic, phase-centric, long-running) are exactly right. The name is wrong — it implies "new product from scratch" when the real differentiator is scope (multi-topic vs single-topic) and session model (long-running vs single-session).

`epic` was chosen over `project` because:
- Well-understood term from task tracking platforms (Linear, Jira)
- Less overloaded than "project"
- Maps directly to the concept — a collection of related topics progressing through phases

### Final Taxonomy

- **Epic**: Multi-topic, phase-centric, long-running. New products AND large initiatives on existing ones.
- **Feature**: Single-topic, linear, single-session.
- **Bugfix**: Single-topic, investigation-centric, single-session.

### Phase Gating Model

- **Hard gates**: Can't enter a phase if zero completed artifacts from the prerequisite phase exist. No discussions → can't spec. No specs → can't plan. Structural — the phase has nothing to work with.
- **Soft guidance**: When entering a phase with incomplete prior work (e.g., specification with in-progress discussions), surface a warning: "2 discussions still in progress. Specification works best with all discussions concluded so it can analyze groupings fully. Proceed anyway?" User decides.
- **No enforcement**: Topics move independently within an epic. One topic in planning while another is still in discussion is valid.

Note: This was later revised — research now gets `in-progress` / `concluded` status like every other phase. See "Resolved: Research Phase Concludes" below (lines 496-502).

### Migration Implication

All existing artifacts with `work_type: greenfield` need updating to `work_type: epic`. Straightforward migration script, same pattern as existing 013-015 migrations.

---

## Problem 2: Greenfield Scope Pollution

### The Problem

All artifacts live in `.workflows/` with no scoping. After completing an epic cycle, old concluded artifacts pollute discovery, menus, and analysis. With epic being reusable for multiple cycles, this gets worse.

### Options Considered

1. **Archive mechanism** — move concluded artifacts to `.workflows/.archive/`. Discovery only looks at active directory.
2. **Epic scoping in frontmatter** — add `epic: {name}` to all artifacts. Filter by active epic. Medium cost, ongoing complexity.
3. **Directory scoping** — `.workflows/{epic-name}/discussion/`. Physical separation. Most disruptive — every path reference changes.

### Decision: Work-unit-first directory structure with manifests

The discussion evolved significantly beyond the original archive question. We ended up redesigning the entire directory structure and state management approach.

#### Manifest System

Every work unit (epic, feature, bugfix) gets a YAML manifest file. This was driven by wanting deterministic discovery instead of directory scanning + frontmatter parsing.

**Manifest location**: `.workflows/{work-unit-name}/manifest.yaml`

**Uniform structure across all work types** — features, bugfixes, and epics all use the same manifest shape. No `topic`/`topics` field distinction.

Early in the discussion, we considered having epic manifests track a `topics` list. This was rejected because topics evolve through the pipeline — discussion topics get grouped into different specification names, which carry through to planning/implementation/review. A static topic list in the manifest would go stale. Instead, the manifest tracks identity and phase-level state; the artifacts themselves provide item detail.

#### Renaming "topic" to "name"

The field currently called `topic` throughout the system is being renamed to `name`. "Topic" made sense when everything was discussion-centric, but as the identifier flows through specification, planning, implementation, and review, "name" is simpler and more accurate. It appears in both manifests and artifact frontmatter.

#### Work-Unit-First Directory Structure

Pivoting from phase-first (`.workflows/discussion/`, `.workflows/specification/`) to work-unit-first (`.workflows/{name}/discussion/`, `.workflows/{name}/specification/`).

Previously attempted early in the project and reverted because it was convenient to see all discussions across topics. Revisited now because:
- Discovery scripts (which didn't exist in the first attempt) can aggregate across work units when needed
- The pipeline model means you work on a specific thing, not a specific phase
- Archiving becomes trivial — move one directory
- Epic scoping is automatic — no frontmatter filtering needed, the directory IS the scope

Every phase gets its own subdirectory within the work unit, even if it only contains one file. This provides consistency and a home for ancillary files (review tracking, analysis findings, task storage).

For features/bugfixes (single-topic), the phase directory is the container — no nested subdirectory. For epics (multi-topic), grouping names create subdirectories within phases from specification onward (where discussion groupings form).

#### Rich Manifest with CLI Access

The discussion around manifest richness went through several iterations:

1. **Rich manifest** (tracks everything per-phase per-item) — powerful but creates context pollution. A large epic manifest could be 100+ lines, and Claude loads all of it when it only needs one item in one phase.

2. **Thin manifest** (just identity + overall status) — simple but doesn't improve discovery much. Still need to scan directories and parse frontmatter.

3. **Middle ground** (phase-level status only, e.g., `discussion: in-progress`) — rejected because epic phases aren't linear. Having "discussion: in-progress" when 4 of 5 discussions are concluded isn't useful information. Doesn't prevent needing to read artifact frontmatter.

4. **Rich manifest + CLI wrapper** — chosen approach. The manifest IS rich and comprehensive (single source of truth for all state), but Claude doesn't read the raw YAML. Instead, a CLI tool with dot notation queries specific paths:

```bash
# Reading
wf get payments-overhaul.phases.discussion.payment-processing.status
wf get payments-overhaul.phases.planning  # all planning items

# Writing
wf set payments-overhaul.phases.implementation.transaction-management.current_task txn-2-3

# Discovery
wf list                    # all manifests
wf list --status active    # active only
wf list --work-type epic   # epics only

# Structural
wf init dark-mode --work-type feature --description "Add dark mode"
wf add-item payments-overhaul discussion payment-processing
wf archive dark-mode
```

This solves context pollution (Claude only sees what it queries), replaces most discovery script complexity (no more directory scanning + frontmatter parsing), and provides a single source of truth.

**Implementation dependency**: Node.js, not yq or pure bash. Node is guaranteed available because the skill package installs via `npx agntc add`. Pure bash YAML parsing is a minefield of edge cases. yq would be an additional dependency users may not have.

#### Frontmatter Eliminated

Decision: **all state moves to the manifest. Artifacts have no frontmatter.** Artifacts are pure markdown content.

This was reached after extensive discussion exploring alternatives (frontmatter as source of truth with CLI as query layer, hybrid splits, manifest as cache). The deciding factors:

- The CLI solves context pollution via scoped queries, removing the argument for keeping fields close to artifacts
- Node can't parse YAML frontmatter without a dependency, so a frontmatter-based CLI would need the same YAML library we're trying to avoid
- Two sources of truth (manifest + frontmatter) creates integrity/drift risk
- File names link manifest entries to artifacts — same fragility as today's topic-based references, but the CLI can offer a `rename` command to handle it properly

All current frontmatter fields move to the manifest:
- `status`, `work_type`, `date`/`created`/`updated` — lifecycle
- `current_task`, `completed_tasks`, `current_phase`, `completed_phases` — progress
- `review_cycle` — cycle tracking
- Gate modes (`task_gate_mode`, `fix_gate_mode`, etc.) — session state
- `sources` — spec-to-discussion lineage
- `specification` path reference — plan-to-spec reference
- `cross_cutting_specs` — architectural references
- `format` — planning output format
- `linters`, `project_skills` — implementation config
- `name` — artifact identity

#### Archive Flow

When a work unit concludes its review phase, offer to archive. Move the entire work unit directory to `.workflows/.archive/{name}/`. Manifest status set to `archived`. Works uniformly for epics, features, and bugfixes.

---

## Artifact Naming Consistency

### The Problem

Current naming across phases is inconsistent — three different strategies:

| Phase | Current File | Named After |
|-------|-------------|-------------|
| Research | `exploration.md` | concept |
| Discussion | `{topic}.md` | topic |
| Investigation | `investigation.md` | phase |
| Specification | `specification.md` | phase |
| Planning | `plan.md` | noun (shortened) |
| Implementation | `tracking.md` | function |
| Review | `review.md` | phase |

`tracking.md` is the biggest outlier — every other phase names after what it *is*, implementation names after what it *does*.

### Decision: Name after the phase, consistently

- `tracking.md` → `implementation.md`
- `plan.md` → `planning.md` (the file is a tracking artifact of the planning phase, not the plan itself — the actual plan lives in the output format: tick tasks, markdown task files, linear)
- Discussion files in features/bugfixes: `discussion.md` (not `{topic}.md`, since the work unit directory already provides the name)
- Discussion files in epics: still named by discussion topic (multiple discussions per epic)

### Full Directory Structure

```
.workflows/
  dark-mode/                              # feature
    manifest.yaml
    discussion/
      discussion.md
    specification/
      specification.md
      review-input-tracking-c1.md
    planning/
      planning.md
      tasks/
    implementation/
      implementation.md
      analysis-{title}-c1.md
    review/
      r1/
        review.md

  login-timeout/                          # bugfix
    manifest.yaml
    investigation/
      investigation.md
    specification/
      specification.md
    planning/
      planning.md
      tasks/
    implementation/
      implementation.md
    review/
      r1/
        review.md

  payments-overhaul/                      # epic
    manifest.yaml
    research/
      exploration.md
      market-analysis.md
    discussion/
      payment-processing.md
      refund-handling.md
      billing-integration.md
    specification/
      transaction-management/
        specification.md
        review-input-tracking-c1.md
      billing-system/
        specification.md
    planning/
      transaction-management/
        planning.md
        tasks/
      billing-system/
        planning.md
        tasks/
    implementation/
      transaction-management/
        implementation.md
      billing-system/
        implementation.md
    review/
      transaction-management/
        r1/
          review.md
```

---

## Problem 5: Direct Phase Entry Ambiguity

### The Problem

When a user calls `/start-discussion` directly (no `/workflow-start`, no `/start-feature`), what work type applies? What manifest context exists?

### How the Discussion Evolved

Initially leaned toward "standalone, no pipeline, clean exit" — direct entry is standalone, bridge fires and exits gracefully. But the work-unit-first directory structure undermined this. With everything living under `.workflows/{work_unit}/`, there's no natural home for a loose unassigned artifact.

Explored option 3 from the original doc — allowing unassigned artifacts in a `_standalone/` or `_unassigned/` directory. This had appeal as an exploratory space where you discuss before committing to a work type. The idea was: discuss freely, figure out scope, then create the work unit and adopt the discussion.

However, this creates problems for downstream phase skills. `/start-specification` would need to scan across every work unit's discussion directory AND the unassigned area. `/start-implementation` — implementing what? These skills don't make sense outside the context of a work unit.

Also considered whether "if in doubt, just use epic" makes feature redundant — an epic with one topic behaves identically to a feature. Decided the distinction is worth keeping because it encodes **session model**: feature means "roll through the whole thing in one sitting," epic means "this spans multiple sessions." That's a real behavioral difference in bridge prompts and state management.

### Decision: Phase skills become internal only

Phase entry skills (`/start-discussion`, `/start-specification`, etc.) are no longer user-invocable. They become model-invocable internal skills, invoked by the work unit entry points and the bridge.

**There is no direct phase entry.** This eliminates Problem 5 entirely.

User entry points are:
- `/workflow` (renamed from `/workflow-start`) — universal entry. Shows all active work, offers to create new, routes to appropriate start or continue skill.
- `/start-epic`, `/start-feature`, `/start-bugfix` — create new work unit
- `/continue-epic`, `/continue-feature`, `/continue-bugfix` — resume existing work unit

### Start / Continue Split

Previously, `/start-feature` handled both "create new" and "resume existing" internally, with branching logic. Splitting into start and continue gives each skill a focused responsibility:

**Start skills**: Gather context from scratch. Name the work unit. Set up manifest. Run the first phase (discussion for feature/epic, investigation for bugfix).

**Continue skills**: Show active work units of that type. Pick one. Show where it's at (reading from manifest). Resume from the right phase via bridge logic.

**Cross-routing**: If a user calls `/start-feature` but existing features are active, offer "did you mean to continue one of these?" and route to `/continue-feature`. No duplication, just a handoff.

Six type-specific skills (3 start + 3 continue) but each is simpler than the current three that try to handle both. `/workflow` remains the single universal entry that routes to the appropriate one.

### Bridge Behavior Within Epics

When bridging between phases within an epic, a valid option is always "do nothing and come back later." The bridge should never assume the user wants to continue to the next phase. Options presented:

- Proceed to next phase (with specific topic/grouping)
- Stay in current phase (work on another topic)
- Go back to a previous phase
- **Done for now** — exit cleanly, come back via `/continue-epic`

This supports the multi-session nature of epics.

---

## Problem 4: No Work Type Pivot

### The Problem

If a user starts with `/start-feature` but realizes scope is larger, no mechanism to pivot to epic without starting over.

### Observation: Manifest makes pivoting technically simple

The manifest system means changing work_type is a one-line operation (`wf set {name}.work_type epic`). The directory structure is work-unit-first, so nothing moves. Bridge routing would adapt on the next fire.

However, we haven't discussed whether pivoting is actually desirable or what the UX should look like. Open questions include:

- Who triggers the pivot — user request, Claude suggestion, or automatic detection?
- What happens to existing artifacts when the type changes mid-flow?
- What if you're mid-discussion when the pivot happens?
- Is feature → epic the only valid direction, or could epic → feature also make sense?
- Should this even be a feature, or is "finish what you started, start fresh with the right type" good enough?

This remains an open design question. The manifest system removes the *technical* barrier to pivoting, but the *workflow* implications need proper discussion.

---

## Natural Language Migrations

### Idea

Instead of coded migration scripts (bash), use natural language migration files that describe the required changes and let Claude execute them. Not fully discussed — captured for future exploration.

### Potential Benefits

- **Nuance**: Can ask questions like "this has one topic and linear flow — is this a feature or an epic?" rather than blindly stamping everything as one type.
- **Error surfacing**: Claude can spot inconsistencies and flag them rather than silently corrupting data.
- **Iterative**: Can be collaborative — pause, ask, adjust — rather than all-or-nothing.
- **Complex structural changes**: Directory restructures, work_type reclassification, and other changes where context matters are better handled with intelligence than rigid scripts.

### Potential Risks

- **Determinism**: Code migrations are idempotent and repeatable. Natural language migrations might make different decisions on a second run.
- **Auditability**: Harder to know exactly what changed and why.
- **Reliability**: Depends on model quality and context window.

### Context

The most recent migrations (013-015) backfilled `work_type: greenfield` into all existing artifacts. Some were actually features, requiring manual correction. A natural language migration could have handled this with more nuance.

Worth exploring further — particularly for the large structural migration this architecture change will require.

---

## Manifest CLI Design

### Overview

A Node.js script that reads and writes manifest JSON files. All manifest access goes through this CLI — Claude never edits manifest files directly. This ensures file locking for concurrent session safety.

**Location**: `skills/manifest/scripts/manifest.js` — packaged as a skill, ships with the skills package automatically.

**Path access**: Deterministic path based on skills installation location. No env variable or hook dependency:

```bash
node .claude/skills/manifest/scripts/manifest.js <command> [args]
```

The path is always the same in every project with the skills installed. The manifest skill's SKILL.md documents the invocation pattern once; other skills and natural language instructions reference it.

For bash scripts within skills, the path can also be resolved relatively from `$SKILL_DIR` (e.g., `"$SKILL_DIR/../manifest/scripts/manifest.js"`), which is the standard pattern for inter-skill script references.

**Manifest format**: JSON (not YAML). Zero dependencies — Node handles JSON natively. No vendored libraries, no `node_modules`.

**Manifest location**: `.workflows/{work-unit-name}/manifest.json`

### Invocation Path Discussion

Several alternatives were explored before settling on the deterministic path:

- **Environment variable** (`$CLAUDE_WF_CLI` exported by session hook) — rejected because the hook system's reliability is unproven, and if it breaks, the entire system stops. Too fragile for the backbone of the system.
- **Bash wrapper/function library** (source a `.sh` file, call functions) — same path resolution problem, just moved to the source line.
- **Flat properties format with pure bash** — avoids Node entirely, but falls apart with nested structured data (e.g., sources with statuses). Not expressive enough.
- **`npx` sidekick package** — separate repo, runnable via npx. Clean invocation but two packages to manage.

The deterministic path works because agntc always installs skills to `.claude/skills/{skill-name}/`, which is a known, fixed location.

### Commands

```bash
WF="node .claude/skills/manifest/scripts/manifest.js"

# Init — create manifest (directories created lazily by skills, not by CLI)
$WF init <name> --work-type <epic|feature|bugfix> --description "..."

# Get — read by dot path
$WF get <name>                          # full manifest
$WF get <name>.status                   # single value
$WF get <name>.phases.discussion        # subtree

# Set — write by dot path (auto-creates intermediate keys)
$WF set <name>.status archived
$WF set <name>.phases.discussion.payment-processing.status concluded

# List — enumerate manifests
$WF list                                # all
$WF list --status active
$WF list --work-type epic

# Add-item — convenience for creating an item with multiple fields at once
$WF add-item <name> <phase> <item-name>

# Archive — move work unit to .workflows/.archive/
$WF archive <name>
```

### Output

JSON to stdout. Single values return the raw value. Subtrees return formatted JSON. Errors go to stderr with non-zero exit code.

### Design Decisions

**Auto-create intermediate keys on `set`**: If `set foo.phases.planning.new-item.status active` is called and `planning` doesn't exist, intermediate keys are created automatically. Reduces friction — skills don't need to check parent paths before writing. `add-item` exists as a convenience for creating items with multiple fields, not as a prerequisite.

**Lazy directory creation**: `init` creates only the manifest file. Phase directories are created by the skills themselves when they enter that phase. No empty directory scaffolding.

**File locking**: The CLI acquires a lock file (`.lock` next to the manifest) before read-modify-write operations, releases after. This ensures concurrent sessions on the same epic (e.g., one discussing, one specifying) don't lose each other's writes. All manifest writes go through the CLI, so locking is guaranteed.

### Validation

The CLI validates structural values that would break downstream processing if wrong. This centralises knowledge that's currently scattered across skill files:

- **work_type**: Must be `epic`, `feature`, or `bugfix`
- **phase names**: Must be one of `research`, `discussion`, `investigation`, `specification`, `planning`, `implementation`, `review`
- **phase statuses**: Per-phase valid values (e.g., discussion: `in-progress`/`concluded`, implementation: `in-progress`/`completed`)
- **gate modes**: Must be `gated` or `auto`

The CLI prevents invalid values from being written. If Claude tries to set a hallucinated status, the CLI rejects it immediately with a clear error rather than letting it silently break discovery later.

Values that aren't structural (descriptions, dates, item names) are not validated by the CLI — skills own that layer.

### What the CLI Replaces

- **Discovery scripts**: Most directory scanning + frontmatter parsing logic. `list` and `get` replace the heavy lifting. Some phase-specific display logic may remain in discovery scripts but the data gathering becomes CLI queries.
- **Frontmatter state management**: Status, progress tracking, gate modes — all move to manifest, accessed via CLI.
- **Bash YAML parsing**: Eliminated entirely. No more `awk` frontmatter extraction patterns.

### No Artifact Frontmatter

All state moves to the manifest. Artifacts are pure markdown content with no frontmatter. This was decided after exploring several alternatives:

1. **Some fields in frontmatter, some in manifest** — proposed split of "content metadata" vs "pipeline state." Never agreed upon, and the CLI's scoped queries removed the context pollution argument for keeping anything in frontmatter.
2. **Frontmatter as source of truth, manifest as cache** — rejected because Claude could update frontmatter directly, causing the cache to drift.
3. **Everything in frontmatter, CLI as query layer** — rejected because Node can't parse YAML frontmatter without a dependency, bringing us back to the same problem.

With no frontmatter, file names become the link between manifest and artifacts. This is the same fragility as today (renaming a discussion file breaks references), but the CLI could offer a `rename` command that updates the filename and all manifest references in one operation — an improvement over the current situation.

---

## Resolved: Discovery Script Replacement

Discovery scripts currently return YAML data for Claude to interpret (not user-facing display). With the CLI handling data gathering, discovery scripts become thin wrappers that call the CLI and maybe do light aggregation. The exact boundary will fall out naturally during implementation — not a design question that needs deciding upfront.

## Resolved: Research Phase Concludes

Decision: **research gets `in-progress` / `concluded` status like every other phase.** Previously research was treated as open-ended and never concluded. This was a constant source of confusion — Claude frequently assumed it should conclude and had to be corrected.

With the manifest tracking state deterministically, research can conclude when the user moves forward. If they return to it, it reopens — same as reopening any other concluded artifact. No special-casing needed. Every phase now has the same lifecycle.

This change requires updating documentation and skill references that describe research as non-concluding.

## Resolved: Skill Naming

- `/workflow-start` — **keeps its name**. Framed as "starting up the engine" (booting the system, showing the dashboard) rather than "start a workflow." Universal entry point that shows all active work and routes to the appropriate start/continue skill.
- `/start-epic`, `/start-feature`, `/start-bugfix` — create new work units
- `/continue-epic`, `/continue-feature`, `/continue-bugfix` — resume existing work units

## Epic Phase Navigation Model

### Principle: Free Navigation with Soft Guidance

Within an epic, any phase can transition to any other phase — forward or backward, not just one step at a time — as long as the target phase's hard gates are met (prerequisite artifacts exist). The bridge acts as a dashboard: "Here's where everything is. Where do you want to go?"

Feature and bugfix pipelines remain linear (forward only, one phase at a time).

### Hard Gates (blocking)

A phase cannot be entered if zero completed artifacts exist from its prerequisite phase:
- Discussion requires nothing (or research, but research doesn't gate)
- Specification requires at least one concluded discussion
- Planning requires at least one concluded specification
- Implementation requires at least one concluded plan
- Review requires at least one completed implementation

### Soft Guidance (non-blocking)

At each forward transition, the bridge surfaces a warning if the suggested completion isn't met. The user always decides — they're the engineer.

| Transition | Suggested completion | Why |
|------------|---------------------|-----|
| Research → Discussion | All research concluded | Research informs discussion topic identification |
| Discussion → Specification | All discussions concluded | Spec phase analyses and groups discussions together |
| Specification → Planning | All specs concluded | Planning analyses cross-spec dependencies |
| Planning → Implementation | All plans concluded | Dependency ordering across plans determines implementation sequence |
| Implementation → Review | No suggestion — order doesn't matter | Review is independent per implementation |

### What the Bridge Presents (Epic)

1. **Current phase status** — what's in-progress, what's concluded across all phases
2. **All reachable phases** — any phase where hard gates are met, not just "next." Could jump from discussion straight to planning if specs and plans already exist for other topics.
3. **Soft guidance** — if suggested completion isn't met: "3 of 5 discussions still in progress — specification works best with all concluded. Proceed anyway?"
4. **Done for now** — always available. Exit cleanly, return via `/continue-epic`.

### Going Backward

Going back to a previous phase is always valid. This could mean:
- **Reopen a concluded artifact** — "the auth-flow discussion missed something, reopen it"
- **Create a new artifact in a previous phase** — "we need a new discussion about caching"
- **Return to research** — "we need more research before continuing"

The bridge handles both scenarios — showing concluded artifacts that could be reopened alongside the option to create new ones.

---

## Terminology

Precise terms for internal consistency across skills, CLI, and documentation. May surface to users where it makes sense, but primarily for how we explain concepts to Claude inside skills.

- **Work type** — the classification: `epic`, `feature`, `bugfix`. Stored as the `work_type` field in the manifest.
- **Work unit** — a specific instance of work. "dark-mode" is a work unit of work type `feature`. The manifest file represents a work unit. "Create a new work unit" means create a manifest + directory.

---

## Implementation Sequencing

### PR 1: Big Bang — New Architecture

Everything structural in one coordinated change:

- **Manifest CLI** — Node script at `skills/manifest/scripts/manifest.js`. JSON format, get/set/list/init/archive with dot notation, validation, file locking.
- **Directory restructure** — phase-first → work-unit-first. `.workflows/{work_unit}/manifest.json` + phase subdirectories.
- **Remove all frontmatter** — manifest is sole source of truth. Artifacts become pure markdown.
- **Rename greenfield → epic** — work_type value, all references across skills.
- **Artifact renaming** — `plan.md` → `planning.md`, `tracking.md` → `implementation.md`, topic-named discussions → `discussion.md` for features/bugfixes.
- **Research concludes** — gets `in-progress`/`concluded` like every other phase. Update all documentation and skill references.
- **Discovery script simplification** — leverage CLI for data gathering, thin down to presentation wrappers.

**Migration**: Bash migration script using the existing migration system. Programmatic, not natural language:
1. Trace artifact relationships (specs reference discussions, plans reference specs) to build work unit groupings
2. Create work-unit directories and move files
3. Read frontmatter from each artifact, create manifest JSON
4. Strip frontmatter from artifacts
5. Rename files to new conventions
6. Rename `work_type: greenfield` → `epic` in manifests

Ambiguous cases logged for manual resolution rather than guessing.

**Testing**: Migration script gets corresponding tests (consistent with existing migration test pattern). Additionally, test against real project data from multiple projects using the workflows to catch edge cases.

### PR 2: Bridge Always Fires

Update all processing skills to trigger bridge at phase conclusion. Bridge reads manifest for work_type and routes accordingly. For feature/bugfix, linear forward routing. For epic and no-context cases, handled by PR 3.

### PR 3: Bridge Epic Navigation

Epic-specific bridge behavior. Options presented at phase conclusion:
- Proceed to next phase (specific topic/grouping)
- Stay in current phase (work on another topic)
- Go back to a previous phase
- Done for now — exit cleanly

### PR 4: Start/Continue Split

Six new entry point skills:
- `/start-epic`, `/start-feature`, `/start-bugfix` — create new work units
- `/continue-epic`, `/continue-feature`, `/continue-bugfix` — resume existing work units

Cross-routing: `/start-feature` with existing active features offers handoff to `/continue-feature`.

### PR 5: Phase Skills Internal

Phase entry skills (`/start-discussion`, `/start-specification`, etc.) become model-invocable only, no longer user-invocable. Users enter through `/workflow-start` or the type-specific start/continue skills.

---

## Deferred Items

1. **Natural language migrations**: Viability for structural changes. Parked — revisit when relevant.
2. **Work type pivot**: Manifest makes it technically trivial, but UX and workflow implications not discussed. Revisit once the main architecture is built out.

---

## Summary of All Decisions

For quick reference, the decisions made in this discussion:

| Decision | Details |
|----------|---------|
| Bridge always fires | Every phase conclusion triggers bridge. Bridge decides what to do based on work_type. |
| Greenfield → Epic | Rename work type. Multi-topic, phase-centric, long-running. |
| Taxonomy | Epic (multi-topic), Feature (single-topic, single-session), Bugfix (investigation-centric, single-session). |
| Phase gating | Hard gates (zero artifacts = blocked), soft guidance (incomplete prior work = warning), no enforcement (topics move independently). |
| Work-unit-first directories | `.workflows/{name}/` with phase subdirectories. |
| Manifest system | JSON file per work unit. Single source of truth for all state. |
| Manifest CLI | Node script, dot notation, validation, file locking. Path: `.claude/skills/manifest/scripts/manifest.js`. |
| No frontmatter | Artifacts are pure markdown. All state in manifest. |
| "topic" → "name" | Field rename throughout the system. |
| Artifact naming | Phase-named: `discussion.md`, `specification.md`, `planning.md`, `implementation.md`, `review.md`. |
| Research concludes | Gets `in-progress`/`concluded` like all other phases. |
| Phase skills internal | Not user-invocable. Invoked by entry points and bridge. |
| Start/continue split | `/start-{type}` for new, `/continue-{type}` for existing. |
| `/workflow-start` stays | Universal entry point, keeps current name. |
| Archive flow | Move work unit directory to `.workflows/.archive/{name}/`. |
| Migration approach | Bash script, programmatic, tested against real project data. |

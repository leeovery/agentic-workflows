# Entry-layer audit — entry skills, continue skills, workflow-start

Tree: `/Users/leeovery/Code/agentic-workflows/.claude/worktrees/mod-handoff` at `0b05093e7` (v0.8.9). Read-only; nothing in the repo was changed. All paths below are relative to that worktree. Byte counts are `wc -c`.

---

## 0. The caller map

Every route into an entry skill or a continue skill that exists today. Everything in sections 1–2 is judged against this table.

### 0.1 Routes into `workflow-*-entry`

| # | Caller | Route string | Args passed | Where |
|---|---|---|---|---|
| C1 | Epic menu, topic rows (start/continue research·discussion from the map, experiment rows, continue_* rows, start_* rows from `next_phase_ready`, the completed-topic resume menu) | `/{PHASE_ENTRY_SKILL[phase]} epic {wu} {topic}` | `$0 $1 $2` — topic always | `domain/projections/epic.cjs:549-551` (`topicRoute`), used at :613, :649, :687, :720, :1219 |
| C2 | Epic menu command rows | `s` → `/workflow-specification-entry epic {wu}`; `d` → `/workflow-discussion-entry epic {wu}`; `r` → `/workflow-research-entry epic {wu}` | `$0 $1` — **no topic** | `epic.cjs:739`, `:764`, `:769` |
| C3 | Linear continue menu (`continue` + every `revisit_phase` row) | `/workflow-{phase}-entry {wt} {wu}` | `$0 $1` — topic inferred | `domain/projections/workunit.cjs:35-37` (`entryRoute`) |
| C4 | Bridge, linear continuations (plan file) | `/workflow-{target_phase}-entry {wt} {wu}` | `$0 $1` | `workflow-bridge/references/feature-continuation.md:116,139`; `bugfix-continuation.md:116,139`; `quickfix-continuation.md:108`; `cross-cutting-continuation.md:100,123` |
| C5 | Bridge, discovery handoff (plan file) | `/workflow-{next_phase}-entry {wt} {wu}` — next_phase ∈ research/discussion/investigation/scoping | `$0 $1` | `discovery-continuation.md:54` |
| C6 | Bridge, epic continuation (plan file) | the C1/C2 `route` verbatim | as C1/C2 | `epic-continuation.md:178,201` |
| C7 | Review actions loop — **its own plan-mode handoff, not via the bridge** | `/workflow-implementation-entry {wt} {wu} {topic}` | `$0 $1 $2` | `workflow-review-process/references/review-actions-loop.md:270-288` |
| C8 | Experiment process, next pick (loads a reference, does not invoke) | `select-record.md` | — | `workflow-experiment-process/references/next-experiment.md:43` |

Consequences used throughout:
- **Linear types never pass `$2`.** Every linear entry resolves `topic = $1`.
- **Epic omits topic only on C2** (`s`/`d`/`r`). Planning, implementation, review and experiment are never reached on an epic without a topic, and none of them handles that case.
- `workflow-research-entry`, `workflow-discussion-entry` and `workflow-specification-entry` are the only entries with a live no-topic path, and only through C2.

### 0.2 Routes into `workflow-continue-*`

| # | Caller | Route | Passes work unit? | Where |
|---|---|---|---|---|
| K1 | Start menu `continue_work_unit` rows (all five types) | `/${CONTINUE_SKILL[type]} ${u.name}` | yes | `projections/start.cjs:64-68,211`; invoked at `workflow-start/references/active-work.md:38` |
| K2 | Bridge, epic discovery handoff | `/workflow-continue-epic {wu}` | yes | `discovery-continuation.md:32` |
| K3 | Spec gap exit (source-incoherence routes back to the menu) | `/workflow-continue-{epic,feature,bugfix,cross-cutting} {wu}` | yes | `workflow-specification-process/references/resolve-source-incoherence.md:263` |
| K4 | Manage → pivot → `c/continue` | `/workflow-continue-epic` | **no** | `workflow-start/references/manage-work-unit.md:96-100` |
| K5 | Manage → absorb → `c/continue` | `/workflow-continue-epic` | **no** | `workflow-start/references/absorb-into-epic.md:135-139` |
| — | Backfill restart advice (tells the user to type) | `/clear`, then `/workflow-start` | — | `workflow-continue-epic/references/backfill-checks.md:57-70` |

K4 and K5 are the **only** routes that reach any continue skill's "work unit not provided" branch. Both have the name in hand (`{selected.name}` after the pivot; `{target_epic}` after the absorb), so passing it is a two-word fix. After that fix, every continue skill's Step 3 is unreachable.

---

## 1. The entry skills

### 1.0 Sizes

| Entry skill | SKILL.md | references | scripts | total |
|---|---:|---:|---:|---:|
| research | 6,138 | 4,822 (validate-phase 1,302 · invoke-skill 2,174 · gather-context 1,346) | — | 10,960 |
| experiment | 3,592 | 5,761 (validate-series 1,210 · invoke-skill 810 · select-record 3,741) | — | 9,353 |
| discussion | 6,072 | 7,358 (validate-phase 1,743 · gather-context-fresh 1,546 · invoke-skill 1,860 · gather-context 814 · validate-research 659 · gather-context-continue 736) | — | 13,430 |
| investigation | 2,993 | 3,480 (validate-phase 825 · invoke-skill 1,941 · gather-context 714) | — | 6,473 |
| scoping | 1,713 | 1,422 (validate-phase 814 · invoke-skill 608) | — | 3,135 |
| specification | 3,991 | 46,686 (39,930 refs + 6,756 `handoffs/`) | gateway.cjs 14,805 | 65,482 |
| planning | 2,490 | 9,089 (validate-phase 1,489 · invoke-skill 1,314 · validate-spec 613 · cross-cutting-context 5,673) | — | 11,579 |
| implementation | 2,661 | 7,787 (validate-phase 1,596 · check-dependencies 4,491 · validate-dependencies 542 · invoke-skill 1,158) | — | 10,448 |
| review | 2,275 | 2,127 (validate-phase 1,324 · invoke-skill 803) | — | 4,402 |
| **Total** | | | | **135,262** |

Shared references only the entries load (sizes for the fold): `workflow-shared/references/ensure-discovery-item.md` 3,728 (research + discussion entries; has its own node test, `tests/scripts/test-ensure-discovery-item.cjs`), `code-session-gate.md` 1,066 (implementation + review entries). `reconcile-advisory.md` 12,470 is also loaded by the research and discussion sessions, so it stays shared.

**The framework is loaded twice per phase entry.** Every entry and every process skill opens with "Load framework.md" (e.g. `workflow-research-entry/SKILL.md:27`, `workflow-research-process/SKILL.md:26`). framework.md plus what it loads is 23,873 B (framework 1,178 · instructions 9,328 · casing 932 · voice 5,721 · altitude 2,369 · ask-or-decide 2,481 · answering-how-it-works 1,864). An entry→process hop in one context therefore asks for a second ~24 KB load. A start→continue→entry→process walk in one context asks for four. The fold removes one load per phase entry.

**Every entry skill uses the same topic rule**, `topic = $2 || (wt !== 'epic' ? $1 : null)` (research `SKILL.md:33-34`, discussion :33-34, experiment :35-37, investigation :31-32, scoping :31-32, specification :34-35, planning :33-34, implementation :34-35, review :34-35). In investigation and scoping the epic arm is dead because the work type is always bugfix or quick-fix. In planning, implementation, review and experiment the null-topic result is dead (see 0.1) and has no handler.

### 1.1 Presence and engine coupling every entry carries

- `render phase-note` **stamps the presence heartbeat** (`domain/render.cjs:4491-4507`, `beatQuietly`): "claiming the slot is the same act as announcing the entry". Today the entries render it only on Resuming/Reopening/Starting. A fresh research or discussion has no note, and its first beat is the process skill's `topic start`.
- An empty `render code-gate` response **also beats** (`render.cjs:4789-4824`) and never counts the session's own rows. In implementation and review it must stay first, ahead of any phase verb.
- `render entry-gate` (`render.cjs` `entryGate`) and `render direct-entry-gate` (`render.cjs:4546-4580`) are engine-derived, so they move to the process unchanged. The `topic start`/`topic reopen` refusals in the engine stay as the backstop under them.
- The prose-test contract keys on these names. `tests/prose/lib/cases.cjs:196` (`/^workflow-[a-z-]+-entry$/`) requires a case's `entry` to be workflow-start, a `workflow-*-entry` skill, discovery, roadmap or help. 152 of 185 cases enter through an entry skill: discussion 45, specification 29, implementation 24, planning 22, research 13, review 7, investigation 7, experiment 4, scoping 1. The fold has to change that rule and re-aim every one of those cases.
- Conventions lint: `tests/scripts/test-conventions-lint.cjs:422-446` forbids an H1 in entry and navigation backbones, while process skills carry one (e.g. `# Research Process`). The merged skill follows the process rule. Lines 663-699 are an allowlist naming entry reference files by path, and those entries go stale with the fold.

---

### 1.2 `workflow-research-entry`

| Step | What it does | Engine calls | Reached by | Status |
|---|---|---|---|---|
| 1 Parse — "If `topic` resolved" (`SKILL.md:40-44`) | `resolved_filename = {topic}.md` | — | C1 (epic research rows), C3/C4/C5 (feature, cross-cutting) | live |
| 1 Parse — "If no `topic`" (`:46-74`) | Asks "What topic would you like to research?" (STOP), kebab-cases the answer, then `render direct-entry-gate {wu}.research.{topic}`. A name already on the map is a terminal blocker; otherwise it silently derives `direct_entry_summary`/`description` from the answer | `render direct-entry-gate` | **C2 `r` only.** Unreachable for linear types (topic=$1) | live (epic `r` door) |
| 2 Check Phase Entry (`:78-96`) | Loads `ensure-discovery-item.md` (routing `research`), then `manifest get {wu}.research.{topic} status` | `manifest get` (+ `discovery-map add` on create) | all | live. ensure-discovery-item is a no-op for non-epic and a no-op read for C1 topics (the item exists, because the menu row came from the map). Its create branch (`ensure-discovery-item.md` C) fires only from the `r` door |
| 3 Validate Phase → `validate-phase.md` | `triaged`: first start, nothing rendered. `completed`: `topic reopen` + phase-note "Reopening" + `source=continue` + reconcile-advisory. `in-progress`: phase-note "Resuming" + `source=continue` + reconcile-advisory | `topic reopen`, `render phase-note` (beats), `manifest get … reconcile_needed` | triaged: epic "Start research" on a parked stub. completed: epic completed-menu resume, linear revisit. in-progress: continue rows | live. **No `cancelled`/`postponed` branch**, unlike discussion (1.4): such a status falls through `SKILL.md:110-112` "Otherwise" to Step 5 with `source` unset, and only a stale plan-mode route can bring one here |
| 4 Gather Context — non-epic (`:120-136`) | Reads `.workflows/{wu}/discovery/sessions/session-001.md`. A non-empty **Exploration** means nothing to gather; anything else runs the 3-question interview (`gather-context.md`) | Read tool | feature/cross-cutting first starts | the interview branch is **legacy**: every unit created through discovery or a roadmap pull has session-001 with Exploration (`workunit-create.cjs:198-201`; `workflow-roadmap/references/pull.md:75-84`). It fires only for linear units that predate universal discovery. A spec-promoted cross-cutting unit gets no log (`workunit-create.cjs:109-110`) but is terminal at specification, so it never re-enters research |
| 4 Gather Context — epic (`:138-158`) | `manifest get {wu}.discovery.{topic} source`. `direct-start` runs the interview; any other source has the brief as its carrier | `manifest get` | `direct-start`: the `r` door (and a topic started fresh at the `d` door that later gets research). Otherwise C1 | live |
| 5 Invoke → `invoke-skill.md` | Three handoffs. `continue` → `Source: existing research`. Interview → a `Context:` block (prompted-by / knows / starting point / constraints). Otherwise → identity + Output path | — | all | live |

**Process side (`workflow-research-process`), Step 0 and initialisation.** It assumes topic, work_unit, work_type and an Output path from the handoff. Step 0 (`SKILL.md:68-124`) **re-reads the status** that entry Step 2 already read, checks whether the file exists, and has its own `triaged` branch. Any status with a file present goes to `resume-detection.md` (continue or restart). So a completed topic shows "Reopening research: X" and then "An in-progress research file exists — continue or start fresh?". `initialize-research.md:11-15` skips every input read when the handoff says `Source: existing research` (a restart). In the non-epic case `:27-33` **re-reads session-001 Exploration**, the same file entry Step 4 read only to decide the route.

**Fold verdict.**
- **Keep, moved into process Step 0**: the status branch (`triaged` = first start; `completed` → `topic reopen` + phase-note + reconcile-advisory; `in-progress` → phase-note + reconcile-advisory), merged with the existing resume-detection so the user sees one decision instead of a note followed by a menu.
- **Keep, moved into process initialisation**: the interview, on the same two conditions (epic `source: direct-start`; non-epic with no Exploration). Its answers stop being handoff text and become context the session already holds.
- **Drop**: ensure-discovery-item on the topic path (always a no-op); the duplicate status read; the session-001 read in Step 4 (initialisation reads it); the `Source: existing research` handoff flag, replaced by the state the merged Step 0 already knows (restart vs fresh); the no-topic branch for linear types.
- **Move out, to `workflow-continue-epic`'s `r` handler, before any context clear**: the topic-name prompt, the direct-entry gate, and ensure-discovery-item's create (`discovery-map add … --source direct-start --summary … --description … --force-dismissed`). The summary and description come from what the user typed. Once they are persisted on the map before the clear, nothing is lost, and the process always receives a topic.
- **Coupling**: initialize-research A's restart skip; the reconcile-advisory `research` branch reads the research file into context at entry, which has to happen before initialisation.

### 1.3 `workflow-experiment-entry`

| Step | What it does | Engine calls | Reached by | Status |
|---|---|---|---|---|
| 1 Parse (`SKILL.md:33-41`) | Resolves topic and stores wu and wt | — | C1 experiment row (shown only when the series has a live record, `epic.cjs:639-654`); C3/C4 when `computeNextPhase` names `experiment (awaiting evidence)` | live |
| 2 Validate the Series (`:45-69`) | Reads `{wu}.experiment.{topic} status`. Empty → `validate-series.md` "missing" (terminal); `cancelled` → "cancelled" (terminal); otherwise reads the `experiments` subtree | `manifest get` ×2 | — | **missing**: no live caller produces it (rows and the linear next-phase require a live wait), so only a stale route or race reaches it — a backstop. **cancelled**: **no current verb writes an experiment-series status of `cancelled`**. `UNIT_PHASES.discovery` is `['research','discussion']` (`domain/derivations.cjs:123-126`), and topic cancel abandons the records (`transitions.cjs:1288-1298`), while the schema still allows it (`kernel/manifest-schema.cjs:54`) and `experiment.cjs:88,265` still tolerate it. This is a legacy guard |
| 3 Select the Record → `select-record.md` | A: one live record auto-selects; several go to B (register + `render experiment-pick`, STOP); none is the terminal "⚑ Every experiment in this series is finished". C: phase-note "Starting"/"Resuming" `--noun {id}` (beats) | `render experiment-register`, `render experiment-pick`, `render phase-note` | entry, and **also** `next-experiment.md:43` (cross-skill load) | live. "No record live" can only follow a `completed` series reached by a stale route; `next-experiment.md:19` checks liveness before loading it |
| 3 → `b/back` (`SKILL.md:77-85`) | "Nothing entered…" terminal | — | picker back | live |
| 4 Invoke → `invoke-skill.md` | Handoff: topic, wu, wt, `Experiment: {id}`, `Record: …/{id}-{slug}` | — | | live |

**Process side.** `workflow-experiment-process/SKILL.md:50-66` (Step 0) **re-reads the `experiments` subtree** ("the manifest is authoritative, whatever the handoff implied") and takes `{record_status}` from it. The entry's read is used only to pick the record.

**Fold verdict.** The entry is mostly `select-record.md`, which the process already loads from `next-experiment.md`. Keep validate-series (missing) as a one-line backstop and move select-record into the process's own references. Drop the `cancelled` branch, or cover it with a migration if any released version ever wrote that status — CLAUDE.md "Upgrades live in migrations". Drop the handoff fields, since the record is resolved in-session. **Coupling**: phase-note's beat has to stay at the moment the record is announced. Nothing else.

### 1.4 `workflow-discussion-entry`

| Step | What it does | Engine calls | Reached by | Status |
|---|---|---|---|---|
| 1 Parse — topic resolved (`SKILL.md:38-42`) | `source = "topic-provided"` | — | C1, C3/C4/C5 (feature, cross-cutting) | live |
| 1 Parse — no topic (`:44-72`) | "What topic would you like to discuss?" (STOP), kebab-case, `render direct-entry-gate {wu}.discussion.{topic}`, derive summary/description, `source = "fresh"` | `render direct-entry-gate` | **C2 `d` only** | live |
| 2 Validate Research → `validate-research.md` | `render entry-gate {wu}.discussion.{topic}`: outstanding research is a terminal blocker | `render entry-gate` | all | live. It is the friendly face of the engine refusal in `topic start`/`topic reopen` |
| 3 Check Phase Entry (`:84-102`) | ensure-discovery-item (routing `discussion`) + `manifest get … status` | as 1.2 | all | as 1.2 |
| 4 Validate Phase → `validate-phase.md` | `triaged` (no-op). `in-progress`: phase-note "Resuming", `source=continue`, reconcile-advisory. `completed`: `topic reopen` + "Reopening" + reconcile-advisory. **`postponed`**: one-line terminal. **Otherwise (`cancelled`)**: one-line terminal | `render phase-note`, `topic reopen` | epic rows and linear routes | postponed/cancelled are backstops, reachable only by a stale route: the menu carries no row for them (`direct-entry-gate` names them at the doors), and linear types never topic-cancel |
| 5 Gather Context (`:114-156`) | Non-epic: the session-001 Exploration check as in 1.2. Epic: `direct-start` → `gather-context.md`; otherwise nothing | Read, `manifest get … source` | as 1.2 | see the quirk below |
| 5 → `gather-context.md` (`:9-33`) | `source=continue` → `gather-context-continue.md` (reads the discussion, asks "What would you like to focus on?"). Otherwise reads `{wu}.research.{topic} status`; `completed` skips, anything else → `gather-context-fresh.md` (core problem / constraints / files) | `manifest get` | | **Quirk**: Step 4 always proceeds to Step 5 (`SKILL.md:110`). Unlike research, a resume reaches Step 5, so the "focus" question is asked **only** when resuming a `direct-start` epic topic or a legacy linear unit with no log, never on an ordinary resume. And its answer goes nowhere: the `continue` handoff (`invoke-skill.md:15-25`) has no Context block |
| 6 Invoke → `invoke-skill.md` | `continue` → `Source: existing discussion`; interview → `Context:` (core problem, constraints, files); otherwise → identity | — | | `Source: existing discussion` is **never read** by the process (no match in `workflow-discussion-process`) |

**Process side.** `workflow-discussion-process/SKILL.md:68-126` re-reads status and the file, has its own `triaged` branch, and runs map display + resume-detection. `initialize-discussion.md:39-61` **re-reads the research status** that entry `gather-context.md:17-21` read only to decide whether to interview, then reads the completed research in full. `:17-25` re-reads session-001.

**Fold verdict.** Same as research. Keep the entry-gate as the first act of process Step 0. Merge the status branch and reconcile-advisory with resume-detection. The interview moves into `initialize-discussion` A, triggered by no carrier and no completed research. Drop `gather-context-continue.md`, which is legacy and inconsistent and whose answer is discarded; drop `Source: existing discussion`. Keep the postponed/cancelled one-liners as backstops — after the change every move clears context and reaches the process from a fresh route, so a stale route becomes more likely, not less. Move the `d` prompt, gate and ensure-discovery-item create to continue-epic, as in 1.2.

### 1.5 `workflow-investigation-entry`

| Step | What it does | Engine calls | Reached by | Status |
|---|---|---|---|---|
| 1 Parse + status (`SKILL.md:29-52`) | Topic = $1 (always bugfix); `manifest get {wu}.investigation.{topic} status`; empty → `source=new` → Step 3, else Step 2 | `manifest get` | C3/C4/C5 (bugfix) | live; the `$2`/epic arm is dead |
| 2 Validate Phase → `validate-phase.md` | `in-progress`: "Resuming", `source=continue`. `completed`: `topic reopen` + "Reopening", `source=continue`. No `triaged` and no `cancelled` branch | `render phase-note`, `topic reopen` | continue/revisit | `triaged` is in the schema (`manifest-schema.cjs:56`) but practically unreachable for a bugfix: a triage onto an absent item needs the investigation never to have started, and the spec requires it. Either status falls to `SKILL.md:64` "Otherwise" → Step 3 |
| 3 Gather Bug Context (`:70-90`) | session-001 exists → phase-note "Starting" (beats); otherwise `gather-context.md`, one question (expected vs actual) | Read, `render phase-note` | first start | the "no session-001" branch is **legacy** (bugfixes predating universal discovery). The process's own text says so: "A logless bugfix has none" (`initialize-investigation.md:17`) |
| 4 Invoke → `invoke-skill.md` | `new`+interview → `Bug context:`; `new` → identity; `continue` → `Source: existing investigation` | — | | `Source: existing investigation` is never read by the process. The handoff carries no `Work unit:`/`Work type:` lines (`Investigation session for: {work_unit}`) |

**Process side.** `workflow-investigation-process/SKILL.md:95-131` checks only whether the file exists, not the status, and offers resume-detection. `initialize-investigation.md:17-21` re-reads description, session-001 and seeds.

**Fold verdict.** Move the reopen + phase-note into Step 0 next to the file check. Keep the legacy interview only if legacy bugfixes are still supported, otherwise drop it. Drop the Source flag. Trivial fold.

### 1.6 `workflow-scoping-entry`

| Step | What it does | Engine calls | Reached by | Status |
|---|---|---|---|---|
| 1 Parse (`SKILL.md:29-36`) | Topic = $1 | — | C3/C4/C5 (quick-fix) | live; the epic arm is dead |
| 2 Validate Phase → `validate-phase.md` | empty → new; `completed` → `topic reopen` + "Reopening"; `in-progress` → proceed. No `cancelled` branch | `manifest get`, `topic reopen`, `render phase-note` | | live |
| 3 Invoke → `invoke-skill.md` | `Scoping session for: {topic}` / `Work unit:` | — | | live |

**Process side.** `workflow-scoping-process/SKILL.md:74-241` re-reads the scoping status **and** the planning status inside its "specification exists" branch. Its "plan `completed` and scoping status not `in-progress`" branch (`:121-135`, "If the scoping status read was empty (item missing), register and complete it") is reachable only when the scoping item is **missing**, because the entry always reopens a completed scoping first. That is a legacy repair.

**Fold verdict.** Fold the reopen into Step 0 alongside the status reads it already does, and drop the item-missing repair, which belongs in a migration if it is still needed. Trivial fold.

### 1.7 `workflow-specification-entry` — two skills in one

**Topic path** (C1 start/continue_specification rows; C3/C4 for feature, bugfix and cross-cutting; quick-fix never enters it):

| Step | What it does | Engine calls | Status |
|---|---|---|---|
| 1 → 2 (`SKILL.md:39-41`) | — | — | live |
| 2 Validate Source → `validate-source.md` | `render entry-gate {wu}.specification.{topic}` (work-type-aware: discussions, investigation, open sources); a blocker is terminal | `render entry-gate` | live |
| 3 Validate Phase → `validate-phase.md` | empty or `proposed` → verb "Creating"; `in-progress` → "Resuming" + verb Continuing + reconcile-advisory; `completed` → `topic reopen` + "Reopening" + reconcile-advisory; `cancelled` → one-line terminal; `superseded`/`promoted` → `render entry-gate … --own` terminal | `manifest get`, `render phase-note`, `topic reopen`, `render entry-gate --own` | cancelled is a stale-route backstop (the menu omits cancelled specs); superseded/promoted are live backstops |
| 4 Invoke → `invoke-skill.md` | Per-type handoff. Feature: discussion path. Bugfix: investigation path. Epic: `manifest get … sources`, lists each. Cross-cutting: reads research status and adds a `Research:` line when it is completed | `manifest get` | live |

**Scoped path** (C2 `s` only): Step 1's no-topic arm runs `gateway.cjs {wu}` (DATA scenario) → Step 5 `check-prerequisites.md` (blocked scenarios → `display-blocks.md`, terminal) → Step 6 `route-scenario.md` →

| Scenario | Reference | What it does |
|---|---|---|
| `single` | `display-single.md` | Auto-proceeds → `confirm-and-handoff.md` |
| `groupings` | `display-groupings.md` (5,044) | Menu: start/continue/blocked/completed/**unify** (writes `manifest apply` + rewrites `.state/discussion-consolidation-analysis.md` + commit) / reanalyze |
| `analysis-rerun` | `analysis-flow.md` | **legacy** — `route-scenario.md:21` says "an in-flight epic with a valid checksum from before proposed items existed". Derived in `domain/specification.cjs:302` (`cache === 'valid' && spec_count === 0` with completed>1 and proposed 0). Runtime code recognising an earlier version's state |
| `analyze` | `display-analyze.md` | `render analysis-proceed-gate` → `analysis-flow.md` |
| `specs-menu` | `display-specs-menu.md` | analyze / continue / blocked / completed |
| — | `analysis-flow.md` (15,070) | A presence scan (`held_sources` > 0 is terminal, "runs at the next entry"); B asks for grouping context (STOP); C reads every completed discussion + KB consult advisory; D reconciles proposed items (+ build order, `build_order_stale` clear) via `manifest apply`; E writes the cache doc + checksum + commit; re-reads the gateway and routes to groupings or specs-menu |
| — | `confirm-and-handoff.md` → `confirm-{create,continue,refine,unify}.md` | `render spec-confirm-gate --variant …` (with a `consult.json` payload) → `handoffs/{create,create-with-incorporation,continue,continue-completed,unify,unify-with-incorporation}.md` |

The scoped path is 41,253 B of references plus the 14,805 B gateway. The topic path is 5,433 B.

**Divergence between the two paths, which the fold must resolve.** The epic menu's `start_specification` row for a **proposed grouping** (`domain/epic-detail.cjs:589-598`) routes through `topicRoute` to the **topic path**. That path skips:
1. **Consult references.** A proposed grouping has no consult rows in the manifest. "the analysis doc's hints are the pending set" (`domain/specification.cjs:179-182`), and they reach the process only as the handoff's `Consult references` block (`handoffs/create.md:20-21`). The process registers consult references **only from that block** (`workflow-specification-process/references/session-setup.md:15-32`). The topic path's epic handoff (`invoke-skill.md:41-58`) carries no such block, so consult references declared at grouping time are never tracked for a spec started from the epic menu, and they never block its completion.
2. **Incorporation.** When a source discussion has its own spec, the scoped path hands off `create-with-incorporation.md` ("Existing specifications to incorporate" plus the `topic supersede` instruction). The topic path does neither.
3. **The confirm gate** (`render spec-confirm-gate`).

This looks like a live bug today, independent of the fold.

**Process side.** `workflow-specification-process/SKILL.md:91-121` checks only the file (no status read). Step 1 `verify-source-material.md` runs `ls` on each handoff source path; the entry-gate already validated the manifest side. `initialize-specification.md` B `topic start` + `sources.{name}.status pending`. `session-setup.md` consult registration comes from the handoff. `spec-construction.md:72` already falls back to the analysis doc for slice hints "if the handoff is no longer in context".

**Fold verdict.**
- **Topic path → process Step 0**: entry-gate, the status branch (reopen, phase-note, reconcile-advisory, terminal blockers), verb derivation. Sources from the manifest, which the process already reads at Step 5. Drop verify-source-material's `ls` duplication or keep it as a cheap check.
- **Scoped path → do not fold into the process.** It is navigation: an analysis, a menu, confirm gates and a reconcile writer, with no topic until the user picks one. Move it to the epic navigation layer — continue-epic's `s` handler, loading these references cross-skill as the bridge loads `epic-display-and-menu.md` — so the process always receives a topic.
- **Handoff prose must become state before a context-clearing handoff can carry only `wt wu topic`.** (a) Consult references: write `consult_references.{ref}.status: pending` onto proposed items in `analysis-flow.md` D step 7 (and the unify path), so `session-setup.md` reads the manifest instead of handoff text; hints stay in the analysis doc. (b) Incorporation: have the process derive "a source discussion with its own live spec" (the gateway's `individual spec:` DATA already computes it) and own the supersede. (c) "New sources / stale sources" is already manifest state (`sources.*.status`).
- **Coupling**: `analysis-flow.md`'s presence scan and held-source deferral; the `.state/discussion-consolidation-analysis.md` cache and checksum (`manifest set {wu}.discussion analysis_cache.*`); the `allowed-tools` lines `mkdir -p .workflows/*/.state` and `rm …/discussion-consolidation-analysis.md` (`SKILL.md:4`); the gateway's tests (`test-gateway-for-specification.cjs`, `test-engine-specification-projections.cjs`, `test-pipeline-simulation.cjs:64`); 29 prose cases. The scoped menus have **no `b/back` to the epic menu** (`projections/specification.cjs:311-380`), and their "no" exits are terminal "re-run this command when ready", which needs a route once navigation clears context.

### 1.8 `workflow-planning-entry`

| Step | What it does | Engine calls | Reached by | Status |
|---|---|---|---|---|
| 1 Parse (`SKILL.md:31-38`) | | | C1 (epic, topic), C3/C4 (feature, bugfix) | live; epic without topic dead and unhandled |
| 2 Validate Spec → `validate-spec.md` | `render entry-gate {wu}.planning.{topic}` | entry-gate | all | live |
| 3 Validate Phase → `validate-phase.md` | empty → `render plan-context-gate` (STOP; "continue" or free-text additional context), `source=fresh`. `completed` → `topic reopen` + "Reopening plan" + reconcile, `source=existing`. `in-progress` → reconcile, `source=existing` | `manifest get`, `render plan-context-gate`, `topic reopen`, `render phase-note` | | live |
| 4 Cross-Cutting Context → `cross-cutting-context.md` (5,673) | Only when `source=fresh`: builds a query from the spec; `manifest list --work-type cross-cutting`. In-progress relevant cross-cutting specs → `render cross-cutting-gate` (STOP; `s/stop` is terminal). `knowledge query --work-type cross-cutting --phase specification` → `render cross-cutting-references` | manifest list, knowledge query, two renders | fresh plans only | live |
| 5 Invoke → `invoke-skill.md` | fresh → `Additional context:` + `Cross-cutting references:`; existing → `Existing plan:` + `Cross-cutting references:` | — | | On `existing`, Step 4 never runs, so `Cross-cutting references` is always "none" |

**Process side.** `workflow-planning-process/SKILL.md:98-182` re-reads the planning subtree and runs spec-change detection + the resume gate. **`restart` → Step 1 Initialize Plan** — the restarted plan gets **neither** the additional-context gate **nor** the cross-cutting context, because both live only in the entry and ran only for `fresh`.

**Fold verdict.** The entry-gate and status branch go to Step 0. **Move the plan-context gate and cross-cutting context into the process's initialisation (fresh and restart alike)**, which fixes the restart gap and removes two handoff-only fields that a context-clearing handoff could not carry. Coupling: the cross-cutting gate's `s/stop` terminal; the KB query failure path (`knowledge-usage.md` D); the cache payloads at `.workflows/.cache/{wu}/planning/{topic}/cross-cutting*.json`.

### 1.9 `workflow-implementation-entry`

| Step | What it does | Engine calls | Reached by | Status |
|---|---|---|---|---|
| 1 Parse | | | C1, C3/C4 (feature, bugfix, quick-fix), **C7 with topic** | live |
| 2 Code Slot → `code-session-gate.md` (`phase = implementation`) | `render code-gate {wu}.implementation.{topic}`. Empty beats the slot; a held slot shows the gate (back is terminal, yes proceeds) | code-gate | all | live — **must remain first** |
| 3 Validate Phase → `validate-phase.md` | A: `render entry-gate`. B: status — empty → new; `completed` → `topic reopen` + "Reopening" + reconcile; `in-progress` → reconcile | | | live |
| 4 Dependencies → `validate-dependencies.md` | Non-epic → return. Epic → `manifest exists … external_dependencies` → `check-dependencies.md` (4,491): evaluates each dependency (state, the dep's implementation status, the dep's plan task via the format's `reading.md`); a blocking list → `render external-dependency-gate --variant blocking` (STOP). `implement` is terminal ("Use /workflow-start…"); `satisfied` → pick → `manifest set … satisfied_externally` + `commit --sweep` → loop | | epic only | live |
| 5 Invoke → `invoke-skill.md` | Reads `format`, `external_id`, `manifest exists {wu}.implementation.{topic}`. Handoff: Format / External ID / Specification (exists) / Implementation (exists) / Dependencies | 3 manifest reads | | Every field can be derived; nothing in the process reads "Dependencies:"/"Implementation:" |

**Process side.** `workflow-implementation-process/SKILL.md:90-121` runs `task init` (idempotent; `mode` created/resumed) — that decides "exists" again. Step 2 reloads the plan and its adapter.

**Fold verdict.** Code gate → entry-gate → status/reopen/reconcile → epic dependency check → `task init`, all in the process's Step 0, in that order. Drop the handoff. **Duplication to remove**: `check-dependencies.md` D "Mark as Satisfied" (`:120-134`) is the same `manifest set … satisfied_externally` + `commit --topic planning/{topic} --sweep` pair as the epic menu's **G. Unblock Plan** (`workflow-continue-epic/references/epic-display-and-menu.md` G, lines ~306-320). The `implement` terminal's "Use /workflow-start to navigate to the blocking work" should become a route.

### 1.10 `workflow-review-entry`

| Step | What it does | Reached by | Status |
|---|---|---|---|
| 1 Parse | | C1, C3/C4 | live |
| 2 Code Slot (`phase = review`) | as 1.9 | all | live, first |
| 3 Validate Phase → `validate-phase.md` | **A** entry-gate → **C** review status (there is **no section B** — residue of a removed section): `completed` → `topic reopen` + reconcile (**no phase-note**, unlike every other reopen); `in-progress` → reconcile | | live |
| 4 Invoke → `invoke-skill.md` | Reads `format`; handoff `Scope: single` + a `Plans to review:` list of one | | **Legacy multi-plan scope**: the process still says "Review scope (required) - single, multi, or all" (`workflow-review-process/SKILL.md:17`), and `read-plans.md:7` reads "for the selected scope". Only `single` is ever produced |

**Process side.** `SKILL.md:78-200`: reads `reviewed_tasks` plus the report file → resume gate; Step 1 `manifest exists` → `topic start`. `read-plans.md:9-13` re-reads `{wu}.planning` (format again).

**Fold verdict.** As implementation: code gate → entry-gate → reopen/reconcile → existing Step 0. Drop the scope/multi-plan vocabulary and the handoff. Fix the A/C lettering when moving it.

### 1.11 What crosses entry→process today only as handoff prose

This is what a context-clearing handoff that carries only `wt wu topic` would lose, and therefore what the fold, or state, has to own:

| Phase | Handoff-only content | Resolution |
|---|---|---|
| research / discussion / investigation | interview answers (`Context:` / `Bug context:`) | the interview moves into the process (no loss) |
| discussion | the focus answer from `gather-context-continue` | already discarded; drop it |
| specification (scoped) | `Consult references` + slice hints for proposed groupings; "Existing specifications to incorporate" + the supersede instruction; source lists | consult refs → manifest at reconcile; incorporation → process derivation; sources are already manifest |
| planning | `Additional context:` (plan-context gate); `Cross-cutting references:` | both move into process initialisation |
| implementation / review / experiment / scoping | nothing that can't be derived | — |

---

## 2. The continue skills

### 2.1 The four linear skills are the same skill four times

Normalised diff (type nouns replaced with a placeholder; script `normdiff.sh` in the scratchpad):

| File | feature vs bugfix | feature vs quickfix | feature vs cross-cutting |
|---|---|---|---|
| `SKILL.md` (4,179 / 4,160 / 4,221 / 4,357) | identical | only the example route on :141 (`/workflow-implementation-entry`) | :85/:90/:130 "Concern" noun; the :141 example route |
| `references/{type}-display-and-menu.md` (2,984 / 2,977 / 2,996 / 3,022) | identical | identical | :7, :15 "concern" noun |
| `references/select-{type}.md` (1,339 / 1,334 / 1,359 / 1,401) | identical | identical | :1 title, :17 singular noun, :23 heading |
| `references/validate-selection.md` (797 / 795 / 802 / 814) | identical | identical | identical |
| `scripts/gateway.cjs` (3,478 / 3,475 / 3,489 / 3,509) | identical | `result.quick_fixes` (:45) | header comment wording + `result.cross_cutting` (:45) |

Per type the only real differences are the `TYPE` constant, the result key (`features`/`bugfixes`/`quick_fixes`/`cross_cutting`), the dump header (`=== FEATURES ===` …) and nouns. The engine already parameterises all of it through `WORK_UNIT_TYPES` (`domain/workunit-detail.cjs:40-…`: workType, resultKey — its own typedef calls it "legacy per-type key" — header, nouns, pipeline, surfacesSeeds). The projections are shared too ("One projection family serves all four single-topic navigation skills", `projections/workunit.cjs:5-7`): `workUnitStatus/Menu/Data(type, unit)`, `selectionSections(type,…)`, `selectionNotFound(type,…)`.

Combined size of the four: 51,488 B (feature 12,777 · bugfix 12,741 · quickfix 12,867 · cross-cutting 13,103). One parameterised skill is about 13 KB.

**Step map (all four), with reachability:**

| Step | What | Reached? |
|---|---|---|
| 0 Initialisation (`:17-25`) | H1 `■ Continue {Type}` | every entry |
| 1 Discovery State (`:29-55`) | `!` preprocessor runs the full index dump of every active unit of the type | every entry — **wasted** when `$0` is passed (always): Step 4 only checks membership, and Step 5's `view` re-derives everything |
| 2 "If `count` is 0" (`:61-71`) | "No {types} in progress. Run /workflow-start…" (terminal) | stale route only (a passed unit closed meanwhile) |
| 2 "If `work_unit` argument `$0` provided" | → Step 4 | **always** (K1, K3 pass it) |
| 2 "If `work_unit` not provided" → **Step 3 Select** + `select-{type}.md` | pick list; `v/view` → `workflow-start/references/view-completed.md` (with a type filter); `m/manage` → `workflow-start/references/manage-work-unit.md` | **dead** for all four linear types. With it go: `select-{type}.md` (×4, 5,433 B), the selection projections (`projections/selection.cjs`, `v`/`m` options at :97-98), the start gateway's `completed {type}` filter variant (only these dead paths pass a filter), and the `Bash(node .claude/skills/workflow-start/scripts/gateway.cjs)` grant in each continue skill's `allowed-tools` (`SKILL.md:4`) |
| 4 Validate Selection | membership in the index; not found → `gateway view {wu}` `DISPLAY: not found` (terminal) | stale route only. `view` already returns not-found on its own (`gateway.cjs:46-48`), so Step 4 can be folded into Step 5 |
| 5 Display and Menu → `{type}-display-and-menu.md` | `session label {wu}`; `view {wu}` (DATA/TITLE/DISPLAY/MENU). `revisit_available` false → store `continue` and return **without a gate**; otherwise MENU (STOP): continue / finalise (`workunit complete` + receipt, terminal) / revisit → `render revisit-phases` | live |
| 6 Route Selection | invoke the stored `route` (C3) | live |

**A context-clear design point.** When nothing is revisitable, the continue skill is a pure pass-through: status display, then a straight invoke of `/workflow-{next_phase}-entry`, with no user gate between the start-menu pick and the phase. If "every move into work clears context", start → clear → continue → clear → phase spends two approvals on one decision. Options: the start row routes straight to the phase when the unit has nothing to revisit or finalise (the engine knows it: `revisit_available`, `finalising`), or the continue→phase hop stays in-context when the continue skill rendered no gate.

### 2.2 One linear continue skill — feasible, small engine work

- **Skill**: one `workflow-continue` (or `workflow-continue-unit`) taking `$0 = work_unit`. The type is read from the manifest — `workUnitData` already emits `work_type:` in DATA (`projections/workunit.cjs:175-176`). Drop Steps 1-4 in favour of the single `view` call (not-found included). The H1 comes from the engine's TITLE section (`workUnitTitle`), so no per-type noun is left in prose.
- **Engine side**: one gateway that resolves the unit's type from its manifest, then calls `workUnitDetail(cwd, type)` and finds the unit through `typeConfig(type).resultKey` instead of the hard-coded `result.features` etc. `CONTINUE_SKILL` in `projections/start.cjs:64-68` collapses for the four linear types. `resolve-source-incoherence.md:263` collapses to one route. The "no {type} in progress" and not-found displays already come from the engine.
- **Tests that change**: `test-gateway-for-workflow-continue-{feature,bugfix,quickfix,cross-cutting}.cjs` (four suites become one), `test-engine-start-projections.cjs` (routes), `test-engine-gateway.cjs`, `test-engine-gate-payload.cjs`, `test-prose-invariants.cjs`, `test-pipeline-simulation.cjs`, and prose cases `feature-discussion-cancels-the-unit`, `start-continues-a-feature-into-discussion`.
- **The bridge's linear continuations** (`{feature,bugfix,quickfix,cross-cutting}-continuation.md`, 5,412 / 5,372 / 4,081 / 4,824 B) are the same pattern four times over (next-phase gate / revisit / plan mode), and they are a candidate for the same merge in the context-clear stack.

### 2.3 `workflow-continue-epic`

Sizes: `SKILL.md` 7,503 · `epic-display-and-menu.md` 17,516 · `summary-backfill.md` 6,036 · `backfill-checks.md` 3,033 · `select-epic.md` 1,313 · `validate-selection.md` 1,036 · `gateway.cjs` 18,000 → 54,437.

| Step | Kind | What | Reached / notes |
|---|---|---|---|
| 0 Initialisation | display | `■ Continue Epic` | always |
| 1 Discovery State | read | `!` index dump of all active epics | always; wasted when `$0` is passed |
| 2 Count and Arguments | routing | count 0 → terminal; `$0` → Step 4; none → Step 3 | Step 3 is reached **only from K4/K5** |
| 3 Select Epic → `select-epic.md` | menu | pick / `v` view-completed / `m` manage | dead once K4/K5 pass the name |
| 4 Validate Selection | read + validation | not-found terminal; else the **scoped dump** `gateway.cjs {wu}` (the "most recent discovery output") | always |
| 5 Backfill | analysis / repair | `session label {wu}`; `legacy-research-split/scripts/detect.cjs` (**legacy**: pre-discovery epics with migration-seeded broad research); `items_to_recover` = map rows missing summary/description (live: pivot and absorb add rows with `backfill: true`, `workunit-lifecycle.cjs:268-270`, `workunit-absorb.cjs:421-423`) → `backfill-checks.md` → may invoke `/workflow-legacy-research-split`, then `summary-backfill.md`, then **terminal "/clear, then /workflow-start"** when anything committed | rare; the terminal advice becomes a route |
| 6 Topic Discovery | analysis | `topic-discovery-dispatch.md` (gap-analysis cache check, may dispatch the background analysis; populates `new_arrivals`) | always (cheap when the cache is valid) |
| 7 Sequence Map | analysis | `needs_sequencing` → `sequence-discovery-map.md`, re-runs the scoped dump | conditional |
| 8 Sequence Build Order | analysis | `build_order_needs_sequencing` → `sequence-build-order.md` | conditional |
| 9 Display and Menu → `epic-display-and-menu.md` | menu + internal flows | A `view {wu} [new_arrivals]` (STOP). B: `unblock_plan` → G; `resequence_build_order` → sequence-build-order; `resume_completed` → D; `cancel_topic` → E; `reactivate_topic` → F; `postpone_topic` → H (`postponing-the-topic.md`); `pull_forward_topic` → I (`roadmap pull-forward`); otherwise: in-session gate (`gateway in-session-gate`), **hard gate** (analyze_discussions while discussions are open and there are no specs — duplicates spec-entry's `blocked-discussions-open`, `domain/specification.cjs:311-312`), **soft gate** (`render epic-soft-gate`) → C store route | always |
| 10 Route Selection | routing | invoke the stored C1/C2 route, or `/workflow-discovery epic {wu}` | always |

**Notes for the stack:**
- The epic main menu has **no `b/back` to the start menu** (`projections/epic.cjs` `commandOptions` :730-806; `backKey` at :1125 serves the sub-views only), and neither does the linear menu (`projections/workunit.cjs:221` is the revisit sub-menu's back). Once start → continue is a context clear, "back" has to be a row that renders `workflow-start/references/start-menu.md` — the pattern the roadmap, baseline and help already use.
- The bridge's `epic-continuation.md` (8,997 B) re-implements Steps 4 and 6-9 (A scoped dump, B topic discovery, C sequence map, D build order, G loads `epic-display-and-menu.md` cross-skill) and adds E all-done + F the phase banner + H plan mode. Under "every move clears context", the epic bridge could clear into `/workflow-continue-epic {wu}` and pass the outcome (banner) and all-done handling, which would remove the copy.
- Moving C2's prompts here (1.2, 1.4) and the spec scoped path (1.7) makes continue-epic the owner of every topic-less epic action. The phase skills then always receive a topic.

---

## 3. `workflow-start`

`SKILL.md` 17,707 · references 44,220 · `scripts/gateway.cjs` 10,027.

### 3.1 Step 0 — what fires when

| Sub-step | Lines | Bytes | Fires |
|---|---|---:|---|
| frontmatter + preamble + Instructions | 1-18 | 1,275 | every start |
| Step 0 banner (art, title, heading, status line) | 19-47 | 1,378 | every start |
| 0.1 Boot — call + fail branch | 48-65 | 602 | every start |
| 0.1 "If `migrations.changed` … or `migrations.verify` …" | 66-116 | **2,954** | only after an update whose migrations changed files, or that returned verify addenda |
| 0.1 Otherwise | 117-128 | 207 | most starts |
| 0.2 Claude Code Setup — header | 129-132 | ~310 | every start |
| 0.2 `not-running` | 133-160 | **1,155** | the mod didn't load this session (rare) |
| 0.2 `outdated` | 161-184 | **686** | Claude Code older than 2.1.287 (rare, terminal) |
| 0.3 Walkthrough — offer branch | 193-230 | **1,216** | until recorded (first run per project) |
| 0.4 Session Labels — prompt branch | 239-280 | **1,697** | once per project, inside tmux |
| 0.5 Knowledge Gate | 285-296 | 592 | every start; `knowledge-gate.md` (9,596) loads only on `not-ready` (first start per checkout or worktree, broken config) |
| 0.6 Baseline Judgment — signal-reading paragraph + `none` branches | 299-350 | **~3,300** | once per project (until recorded). The paragraph at :301 (~1.7 KB of judgment guidance) is read on every start although only the `none` case uses it |
| Step 1 Discover and Route | 357-397 | 1,517 | every start, + `active-work.md` 2,796 (or `empty-state.md` 2,774) |

Branches that fire rarely: ~11.0 KB of the 17.7 KB `SKILL.md` (migrations review 2,954 · 0.2 notices 1,841 · walkthrough offer 1,216 · label prompt 1,697 · baseline judgment ~3,300). Moving each behind a "Load **[…](references/…)**" line, the pattern 0.5 already uses with `knowledge-gate.md`, leaves a typical start's backbone at **~6.7 KB (−62%)**. That start is a returning user with no migrations, the mod on, and walkthrough, labels, knowledge and baseline all recorded.

### 3.2 References

| Reference | Bytes | Loaded when |
|---|---:|---|
| `active-work.md` | 2,796 | every start with active work |
| `empty-state.md` | 2,774 | no active work |
| `route-to-discovery.md` | 921 | any new-work pick (s/f/e/b/q/c, inbox `w/work`) |
| `start-from-inbox.md` | 2,059 | `i` |
| `inbox-working-set.md` | 6,850 | items picked in the inbox |
| `inbox-archived.md` | 3,155 | inbox `a/archived` |
| `view-completed.md` | 2,723 | `v` (and from the dead continue Step 3 paths, with a type filter) |
| `manage-work-unit.md` | 4,635 | `m` (and from the dead continue Step 3 paths) |
| `absorb-into-epic.md` | 5,325 | manage → absorb |
| `view-plan.md` | 2,237 | manage → view plan |
| `knowledge-gate.md` | 9,596 | knowledge `not-ready` |
| `start-menu.md` | 1,149 | **not by start** — the roadmap's, baseline's and help's `b/back` |

`route-to-discovery.md` is a one-line invoke loaded from three places. It could inline, but three callers justify keeping it.

### 3.3 Routes out of start, and what a context clear would drop

| Route | Invocation | Carries | Lost by a clear |
|---|---|---|---|
| `continue_work_unit` (K1) | `/workflow-continue-{type} {wu}` | work unit | nothing — the reply was a pick. A `Finalise …` row (`start.cjs:177-189`) clears only to show a mark-completed gate |
| `start_new` | `/workflow-discovery {pre_seed} none none` | the type hint | **any free text the user typed with the pick** ("f — OAuth login for the admin app"). Discovery "listen[s] … in the user's framing" (`workflow-discovery/references/detection-core.md` C) and has no argument for an opening statement |
| inbox `w/work` | `/workflow-discovery {set_type} none "{paths}"` | seed paths (re-read as durable seeds) | the per-item summaries start wrote (`.workflows/.cache/working-set-summaries.json`, read by nothing downstream), any Q&A from the working set's Ask branch, items opened with `v/view`. The seed files themselves survive |
| manage → pivot → `c/continue` (K4) | `/workflow-continue-epic` | **nothing** | the work unit name. The user re-picks the epic they just pivoted. Pass `{selected.name}` |
| manage → absorb → `c/continue` (K5) | `/workflow-continue-epic` | **nothing** | the target epic. Pass `{target_epic}` |
| `open_baseline` / Step 0.6 yes / manage `a/baseline` | `/workflow-baseline` | — | nothing |
| `open_roadmap` | `/workflow-roadmap open` | — | nothing |
| `open_help` | `/workflow-help` | — | nothing |
| walkthrough (0.3) | `walk.md`, loaded in-context | — | n/a — stays in-context |
| boot warnings | surfaced at start only | — | not re-shown after a clear (acceptable) |

K4 and K5 also put a `**STOP.** Do not proceed — terminal condition.` after an invoke (`manage-work-unit.md:100`, `absorb-into-epic.md:139`). A skill-invoking exit is terminal by convention (`CONVENTIONS.md` "Exiting a reference file").

---

## 4. Legacy in this layer

### 4.1 Branches guarding states that no longer occur

| Where | What | Evidence |
|---|---|---|
| `workflow-experiment-entry/SKILL.md:57-59` + `references/validate-series.md:25-39` | series status `cancelled` | no writer; `derivations.cjs:123-126`, `transitions.cjs:1288-1298`; still tolerated at `experiment.cjs:88,265`; allowed by `manifest-schema.cjs:54` |
| `workflow-specification-entry/references/route-scenario.md:19-23` + `domain/specification.cjs:302` | `analysis-rerun` scenario | self-described: "from before proposed items existed" |
| `workflow-research-entry/SKILL.md:120-136`, `workflow-discussion-entry/SKILL.md:118-134` | interview for a linear unit with "no log, or a placeholder log" | discovery writes session-001 for every type (`workunit-create.cjs:198-201`); placeholder logs come from migration 038, epic-only |
| `workflow-investigation-entry/SKILL.md:86-90` + `gather-context.md` | the interview when session-001 is missing | "A logless bugfix has none" (`initialize-investigation.md:17`); same for quick-fix (`workflow-scoping-process/references/gather-context.md:17`) |
| `workflow-discussion-entry/references/gather-context-continue.md` | focus question on resume | reachable only for direct-start or legacy resumes; its answer is not in the handoff |
| `workflow-scoping-process/SKILL.md:121-135` | "scoping status read was empty … register and complete it" | the entry always reopens a completed scoping first |
| `workflow-review-entry/references/invoke-skill.md:22-28`, `workflow-review-process/SKILL.md:17`, `read-plans.md:7` | review scope `single, multi, or all`, a "Plans to review" list | only `single` exists |
| `workflow-continue-{feature,bugfix,quickfix,cross-cutting}` Step 3 + `select-*.md`; `workflow-continue-epic` Step 3 (after the K4/K5 fix) | select-a-unit | every caller passes the unit |
| `workflow-continue-epic/SKILL.md:121-141` (detector) + `workflow-legacy-research-split` | pre-discovery broad research split | legacy epics only |
| `workflow-specification-entry/scripts/gateway.cjs` `index` verb (no args, "minimal state line, all work units") | never called by prose (tests only, `test-gateway-for-specification.cjs:10`) | |
| `{research,discussion,…}-entry` "no topic" arm for linear types; `investigation`/`scoping` epic arm; planning/implementation/review/experiment null topic | unreachable (0.1) | |
| `storage_paths` "a plan initialised before the field existed" | prose-side upgrade, **no migration** (none in `workflow-migrate/scripts/migrations/` mentions `storage_paths`) | `workflow-planning-process/SKILL.md:141,160`; `workflow-scoping-process/SKILL.md:172,214`; `workflow-review-process/SKILL.md:161`; `workflow-implementation-process/references/ad-hoc-plan-changes.md:78,219`, `analysis-loop.md:362`, `task-loop.md:545`, `consolidation-pass.md:329` — contrary to CLAUDE.md "Upgrades live in migrations, never in code" |

### 4.2 Dead handoff fields

`Source: existing discussion` (`workflow-discussion-entry/references/invoke-skill.md:23`) and `Source: existing investigation` (`workflow-investigation-entry/references/invoke-skill.md:47`) are read by nothing. Only `Source: existing research` is read (`initialize-research.md:11`). Implementation's `Implementation: {exists}`, `Dependencies:`, `External ID:` and review's `Scope: single` have no reader in their process skills.

### 4.3 Duplicated instructions

- The mark-dependency-satisfied pair: `workflow-implementation-entry/references/check-dependencies.md` D vs `workflow-continue-epic/references/epic-display-and-menu.md` G.
- The analyze-while-discussions-open block: the epic menu's hard gate (`epic-display-and-menu.md` B) vs spec-entry's `blocked-discussions-open` (`domain/specification.cjs:311-312`). This one may be an intentional backstop.
- Status reads repeated entry→process in every phase (1.2–1.10). Session-001 Exploration is read in the entry to decide the route and again in the process to use it (research, discussion).
- The four linear continue skills (2.1); the four linear bridge continuations; the epic dashboard's boot sequence in continue-epic and in `bridge/epic-continuation.md`.
- A second context-clearing handoff outside the bridge: `workflow-review-process/references/review-actions-loop.md:270-290` enters plan mode itself. CONVENTIONS "Loading, Invoking, and the Bridge" says the bridge owns the only context-clearing handoff.

### 4.4 Wording that assumes the user invokes these skills

| Where | Text |
|---|---|
| `workflow-specification-entry/references/display-analyze.md:70`, `confirm-create.md:44`, `confirm-continue.md:44`, `confirm-refine.md:28` | "Understood. Continue working on discussions, or re-run this command when ready." |
| `workflow-bridge/references/{feature,bugfix}-continuation.md:119,142`, `cross-cutting-continuation.md:103,126`, `quickfix-continuation.md:111`, `epic-continuation.md:181`, `workflow-bridge/SKILL.md:124` | "The skill will skip discovery and proceed directly to validation." Entry skills no longer run any discovery |
| `CLAUDE.md` "Phase Entry Skill Routing → Without topic" | "Run discovery scoped to work_unit → analysis/selection flow … Only used by discussion and specification (research also…)". Today discussion and research ask for a name; only specification runs a scoped analysis |
| `workflow-continue-*/SKILL.md:66-68` ("Run /workflow-start to begin a new one."), `check-dependencies.md:81` ("Use /workflow-start…"), `backfill-checks.md` ("Run `/clear`, then `/workflow-start`") | correct today (workflow-start is user-invocable), but each becomes a route under the new design |
| `CLAUDE.md` "Gate surface" | describes `restart` and boot writing the function-hooks flag; boot now reports `on`/`not-running`/`outdated`/`unavailable` (`domain/gate-surface.cjs:32,65-70`), and `workflow-start/SKILL.md:131-187` stops only on `outdated` |

### 4.5 References only one caller loads that could inline

Into the folded process: `validate-research.md` (659), `validate-spec.md` (613), `validate-source.md` (829), `validate-dependencies.md` (542), `check-prerequisites.md` (395), `display-blocks.md` (521), `display-single.md` (850), each one entry-gate or one-branch router. Into one reference: `confirm-refine.md`/`confirm-unify.md` (1,230 / 785) and `handoffs/unify.md`/`create.md` (579 / 788), which differ by a line or two from their siblings.

---

## 5. Suggested shape for the second stack (from the evidence above)

1. **Fix the callers first**: pass the work unit in K4/K5. Decide C7 (review's own plan mode) against the bridge and the new clear mechanism.
2. **Move every topic-less epic action into `workflow-continue-epic`**: the `r`/`d` name prompt + direct-entry gate + ensure-discovery-item create (persisting summary and description), and the specification scoped path (analysis, groupings, confirm gates, unify). Phase skills then always get `wt wu topic`.
3. **Turn handoff-only content into state** before any clear-and-start: consult references on proposed items, incorporation derived in the spec process, planning's additional context and cross-cutting context moved into the process.
4. **Fold the entries.** Each process Step 0 opens with: code gate (implementation/review) → entry-gate → the status branch (reopen + phase-note beat + reconcile-advisory, terminal blockers), merged with the existing resume-detection → the interview where no carrier exists. Drop the duplicate reads, Source flags and dead arms.
5. **Merge the four linear continue skills** into one, keyed by the work unit with the type read from the manifest (2.2), and give every navigation menu a back row to the start menu.
6. **Trim `workflow-start`** by moving the five rare branches into references (~11 KB off a typical start).
7. **Clear the legacy residue in 4.1/4.2** (migrations where a released version could have written the state), and update the prose-test entry rule (`tests/prose/lib/cases.cjs:196`), the conventions-lint allowlist and the affected cases.

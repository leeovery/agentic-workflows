# Audit — every skill-to-skill transition (mod-handoff)

Snapshot: worktree `mod-handoff`, HEAD `0b05093e7` (v0.8.9). Read-only audit. All paths are repo-relative; `file:line` is the line of the invocation / directive itself.

Legend
- **Mechanism**: `IP` = in place (Skill tool call, or a cross-skill reference load; nothing cleared). `PM` = plan mode (`EnterPlanMode` → plan file → `ExitPlanMode`; user approves "Clear context and continue"; the fresh context follows the plan's *Next Step*).
- **Class** (under the new design): `HANDOFF` = a move into work → clears. `STAY` = menu↔menu, back to the start menu, into help, a subroutine that returns, or a same-phase entry→process step. `SPECIAL` = fits neither rule cleanly — see §5. Where my class follows a ruling in `design/mod-handoff.md` (H1/H6), it says so.
- **Agents** = can a background agent this conversation launched still be running at the moment of the transition.

---

## 1. Every transition

### 1A. From `workflow-start` (the start menu, boot, manage)

| # | Source file:line | Target + exact args | What precedes | Today | Class | Reasoning | Agents |
|---|---|---|---|---|---|---|---|
| A1 | `skills/workflow-start/references/active-work.md:38` | stored route `/workflow-continue-{feature\|bugfix\|quickfix\|cross-cutting\|epic} {work_unit}` (built `start.cjs:211`) | start menu pick, `continue_work_unit` (STOP `:26`) | IP | STAY | menu → menu (H1 row 2) | none |
| A2 | `skills/workflow-start/references/active-work.md:44` | `/workflow-baseline` (no args) | pick `a/baseline` (`open_baseline`) | IP | HANDOFF (H1) | baseline holds conversations, writes artifacts; but it self-routes — `completed` lands on its own manage menu (§5.9) | none |
| A3 | `skills/workflow-start/references/active-work.md:50` | `/workflow-roadmap open` | pick `r/roadmap` (`open_roadmap`) | IP | HANDOFF (H1) | roadmap is work per H1; it opens on its home menu (`workflow-roadmap/SKILL.md:72-74` → Step 3) | none |
| A4 | `skills/workflow-start/references/active-work.md:56` | `/workflow-help` | pick `h/help` (`open_help`) | IP | STAY | anything into help stays | none |
| A5 | `skills/workflow-start/references/active-work.md:62` → `route-to-discovery.md:14` | `/workflow-discovery {pre_seed} none "none"` — `{pre_seed}` ∈ `none\|feature\|epic\|bugfix\|quick-fix\|cross-cutting` | pick `s/f/e/b/q/c` (`start_new`) | IP | HANDOFF | menu → discovery (work) | none |
| A6 | `skills/workflow-start/references/empty-state.md:44` | `/workflow-baseline` | empty-state pick `a/baseline` (STOP `:32`) | IP | HANDOFF (H1) | as A2 | none |
| A7 | `skills/workflow-start/references/empty-state.md:50` | `/workflow-roadmap open` | empty-state pick `r/roadmap` | IP | HANDOFF (H1) | as A3 | none |
| A8 | `skills/workflow-start/references/empty-state.md:56` | `/workflow-help` | empty-state pick `h/help` | IP | STAY | as A4 | none |
| A9 | `skills/workflow-start/references/empty-state.md:68` → `route-to-discovery.md:14` | `/workflow-discovery {pre_seed} none "none"` | empty-state `start_new` pick | IP | HANDOFF | as A5 | none |
| A10 | `skills/workflow-start/references/inbox-working-set.md:183` → `route-to-discovery.md:14` | `/workflow-discovery {set_type} none "{inbox_seeds}"` — `{set_type}` ∈ `bugfix\|quick-fix\|none` (`:179`), `{inbox_seeds}` = comma-joined live inbox paths (`:181`), double-quoted (`route-to-discovery.md:14`) | working-set `w/work` pick (type-uniform set only) | IP | HANDOFF | menu → discovery | none |
| A11 | `skills/workflow-start/SKILL.md:337` | `/workflow-baseline` | Step 0.6 baseline-offer gate `yes` (STOP `:333`), during boot, before Step 1 | IP | HANDOFF | always a fresh assessment (status none) → work | none |
| A12 | `skills/workflow-start/references/manage-work-unit.md:33` | `/workflow-baseline` | manage menu `a/baseline` (STOP `:25`) | IP | HANDOFF (H1) | as A2; this reference is also loaded from every continue skill's `select-*.md:39`, so it can fire from inside a continue skill | none |
| A13 | `skills/workflow-start/references/manage-work-unit.md:98` | `/workflow-continue-epic` — **no argument** | `render pivot-continuation` `c/continue` (STOP `:94`) after `pivot-to-epic.md` | IP | STAY | menu → menu; arg missing (§5.6) | none |
| A14 | `skills/workflow-start/references/absorb-into-epic.md:137` | `/workflow-continue-epic` — **no argument** | `render absorb-continuation` `c/continue` (STOP) | IP | STAY | menu → menu; arg missing (§5.6) | none |
| A15 | `skills/workflow-start/SKILL.md:211` | loads `workflow-help/references/walk.md` with origin = `first-run`; "On return, proceed to Step 0.4" (`:213`) | walkthrough-offer `yes` (STOP `:201`) + `walkthrough record walked` | IP (reference load across boundary) | STAY | help content, returns to caller | none |

### 1B. From the navigation skills (`workflow-continue-*`)

| # | Source file:line | Target + exact args | What precedes | Today | Class | Reasoning | Agents |
|---|---|---|---|---|---|---|---|
| B1 | `skills/workflow-continue-epic/SKILL.md:241` (Step 10) | stored route from the epic ACTIONS table — see §1L for every shape (`/workflow-{phase}-entry epic {wu} {topic}`, `/workflow-{specification\|discussion\|research}-entry epic {wu}`, `/workflow-discovery epic {wu}`) | `epic-display-and-menu.md` pick (STOP `:38`), optionally in-session gate `yes` (STOP `:102`), hard gate (`:114-118`), soft gate `yes` (STOP `:136`); or completed sub-view pick (STOP `:166`) | IP | HANDOFF | menu → work (H1 row 3) | none from this conversation (but see B-note) |
| B2 | `skills/workflow-continue-feature/SKILL.md:141` | stored route `/workflow-{phase}-entry feature {work_unit}` (`workunit.cjs:35-37`) | `feature-display-and-menu.md`: **automatic** when `revisit_available` false (`:30-34`, no stop); else `y/yes` (STOP `:40`) or revisit pick (STOP `:86`) | IP | HANDOFF | menu → work | none |
| B3 | `skills/workflow-continue-bugfix/SKILL.md:141` | `/workflow-{phase}-entry bugfix {work_unit}` | same shape (`bugfix-display-and-menu.md:30-34/40/86`) | IP | HANDOFF | menu → work | none |
| B4 | `skills/workflow-continue-quickfix/SKILL.md:141` | `/workflow-{phase}-entry quick-fix {work_unit}` | same shape (`quickfix-display-and-menu.md`) | IP | HANDOFF | menu → work | none |
| B5 | `skills/workflow-continue-cross-cutting/SKILL.md:141` | `/workflow-{phase}-entry cross-cutting {work_unit}` | same shape (`cross-cutting-display-and-menu.md`) | IP | HANDOFF | menu → work | none |
| B6 | `skills/workflow-continue-epic/references/backfill-checks.md:19` | invokes `workflow-legacy-research-split` with work_unit = `{work_unit}` **via context** (no positional); "On return, re-run discovery" (`:21`) | automatic at Step 5 when `qualifying_sources` non-empty (`SKILL.md:131-141`) | IP | SPECIAL (§5.10) | an interview subroutine that returns across the boundary; then `C. Advise Restart` (`:55-73`) is a terminal STOP telling the user "Run `/clear`, then `/workflow-start`" (`:70`) | none |
| B7 | `skills/workflow-continue-{epic,feature,bugfix,quickfix,cross-cutting}/references/select-*.md:33` | loads `workflow-start/references/view-completed.md` (returns) | selection menu `v/view` | IP (ref load) | STAY | menu ↔ menu | none |
| B8 | `skills/workflow-continue-*/references/select-*.md:39` | loads `workflow-start/references/manage-work-unit.md` (returns) — which can itself fire A12/A13 | selection menu `m/manage` | IP (ref load) | STAY | menu ↔ menu | none |

B-note: when the epic menu is rendered **by the bridge** (§1D D11/D12), agents launched by the concluding/pausing phase can still be running at the pick (see E4–E8).

### 1C. The epic menu reference itself (`skills/workflow-continue-epic/references/epic-display-and-menu.md`)

It never invokes; it stores and returns: `C. Route Selection` stores `action`, `topic`, `route` (`:150`, return `:152`); `D. Resume Completed` stores `phase`, `topic`, `route` (`:174`, return `:176`). Callers: `workflow-continue-epic/SKILL.md:233` (then B1) and `workflow-bridge/references/epic-continuation.md:153` (then D11/D12). Everything else in it (`E` cancel, `F` reactivate, `G` unblock, `H` postpone via `workflow-shared/references/postponing-the-topic.md` with phase/topic `none`, `I` pull-forward, resequence) is internal and loops back to `A`.

### 1D. Bridge exits (the plan-mode handoffs)

| # | Source file:line | Target + exact args (plan "Next Step") | What precedes | Today | Class | Reasoning | Agents |
|---|---|---|---|---|---|---|---|
| D1 | `skills/workflow-bridge/references/discovery-continuation.md:23-41` (Next Step `:32`) | `/workflow-continue-epic {work_unit}` | automatic (epic, completed_phase `discovery`) | PM | HANDOFF (H6) | concluded phase → fresh epic menu | none (discovery runs no agents: `workflow-discovery/references/session-loop.md:7`) |
| D2 | `skills/workflow-bridge/references/discovery-continuation.md:45-63` (Next Step `:54`) | `/workflow-{next_phase}-entry {work_type} {work_unit}`, next_phase ∈ `research\|discussion\|investigation\|scoping` (`:45`) | automatic | PM | HANDOFF | concluded discovery → first phase | none (from discovery); from E2 none; from E20 none |
| D3 | `skills/workflow-bridge/references/feature-continuation.md:107-126` (Next Step `:116`) | `/workflow-{target_phase}-entry feature {work_unit}` (paused: `target_phase = next_phase`, `:31`) | automatic — `outcome` `paused` skips the gate (`:29-33`) | PM | HANDOFF | paused phase → what it waits on | yes, possible — see E5/E6/E7 |
| D4 | `skills/workflow-bridge/references/feature-continuation.md:130-149` (Next Step `:139`) | `/workflow-{target_phase}-entry feature {work_unit}` | next-phase gate empty (automatic, `:49-51`) or `y/yes` (STOP `:57`) or revisit pick (STOP `:91`) | PM | HANDOFF | concluded phase → next/revisited phase | yes, possible after E4/E8 (`proceed` past running agents) |
| D5 | `skills/workflow-bridge/references/bugfix-continuation.md:107-126` (`:116`) | `/workflow-{target_phase}-entry bugfix {work_unit}` (paused arm) | as D3 (`:29-33`) — bugfix has no research/discussion, so no caller sends `paused` | PM | HANDOFF | unreachable arm in practice | none |
| D6 | `skills/workflow-bridge/references/bugfix-continuation.md:130-149` (`:139`) | `/workflow-{target_phase}-entry bugfix {work_unit}` | as D4 | PM | HANDOFF | concluded → next | none |
| D7 | `skills/workflow-bridge/references/quickfix-continuation.md:99-118` (`:108`) | `/workflow-{target_phase}-entry quick-fix {work_unit}` | gate empty / `y/yes` (STOP `:51`) / revisit pick (STOP `:85`) — no paused arm | PM | HANDOFF | concluded → next | none |
| D8 | `skills/workflow-bridge/references/cross-cutting-continuation.md:91-110` (`:100`) | `/workflow-{target_phase}-entry cross-cutting {work_unit}` (paused) | automatic (`:29-33`) | PM | HANDOFF | paused → what it waits on | yes, possible (E5/E6/E7) |
| D9 | `skills/workflow-bridge/references/cross-cutting-continuation.md:114-133` (`:123`) | `/workflow-{target_phase}-entry cross-cutting {work_unit}` | gate empty / `y/yes` (STOP `:57`) / revisit pick (STOP `:75`) | PM | HANDOFF | concluded → next | yes, possible after E4/E8 |
| D10 | `skills/workflow-bridge/references/epic-continuation.md:153` | loads `workflow-continue-epic/references/epic-display-and-menu.md` with `new_arrivals` (cross-skill ref, returns selection) | sections A–F (§3) | IP | (today) in place; H6 replaces with a handoff to a fresh epic menu | concluded phase → menu | yes, possible (E4–E8) |
| D11 | `skills/workflow-bridge/references/epic-continuation.md:169-188` (Next Step `Invoke {route}` `:178`) | the stored route verbatim (topic present) | epic menu pick in D10 | PM | HANDOFF | menu pick → work | yes, possible (E4–E8) |
| D12 | `skills/workflow-bridge/references/epic-continuation.md:192-211` (`:201`) | the stored route verbatim (topic absent: `/workflow-discovery epic {wu}`, `/workflow-{specification\|discussion\|research}-entry epic {wu}`) | epic menu pick in D10 | PM | HANDOFF | menu pick → work | as D11 |

Terminal bridge exits (no transition): linear `next_phase` = `done` → `workunit complete` + receipt + STOP (`feature-continuation.md:13-27`, `bugfix-…:13-27`, `quickfix-…:13-27`, `cross-cutting-…:13-27`); `d/done` at the review hop (`feature-…:63-77`, `bugfix-…:63-77`, `quickfix-…:57-71`); epic all-done `yes` (`epic-continuation.md:93-107`).

### 1E. Phase exits into the bridge (all `IP`, Skill tool)

Class for every row: **into the bridge stays in place** (H1 note: "A concluding phase still invokes the bridge in place — the bridge … ends in the handoff"). The handoff itself is the bridge's (§1D).

| # | Source file:line | Exact args | What precedes | Agents at that moment |
|---|---|---|---|---|
| E1 | `skills/workflow-discovery/references/conclude-discovery.md:36` | `/workflow-bridge {work_unit} discovery {next_phase}` — next_phase from `first-phase-routing.md` (`research\|discussion\|investigation\|scoping`) or literal `none` for epic (`:34`) | Step 14 compliance + A final-sweep commit; automatic | none |
| E2 | `skills/workflow-scoping-process/references/complexity-check.md:108` | `/workflow-bridge {work_unit} discovery {next_phase}` — `investigation` (bugfix promote, `:73`) or `research\|discussion` (feature promote, first-phase-gate STOP `:92`, set `:94`) | complexity-gate `feature\|bugfix` (STOP `:35`); a fake `discovery` completed_phase (§5.13) | none |
| E3 | `skills/workflow-scoping-process/references/conclude-scoping.md:19` | `/workflow-bridge {work_unit} scoping` | `render phase-completed … --paths`; automatic | none |
| E4 | `skills/workflow-research-process/references/conclude-research.md:86` | `/workflow-bridge {work_unit} research` | research-conclude-gate `yes`/`dead-end` (`topic-completion.md:79-97`), commits, recap | **yes** — `in-flight-agents-gate` `proceed` (`epic-session.md:97-101`, `feature-session.md:73-77`) reaches here with deep dives still running; nothing stops them |
| E5 | `skills/workflow-research-process/references/topic-completion.md:59` | `/workflow-bridge {work_unit} research none paused` | wait-gate `yes` (STOP `:41`) + cadence commit | **yes** — same `proceed` path as E4 |
| E6 | `skills/workflow-shared/references/experiment-spawn.md:75` | `/workflow-bridge {work_unit} {phase} none paused`, phase ∈ `research\|discussion` | experiment-spawn-gate `yes` (STOP `:63`); reachable any time in the session loop | **yes** — no in-flight check on this path at all (research dives; discussion review/perspective agents) |
| E7 | `skills/workflow-discussion-process/references/discussion-session.md:198` | `/workflow-bridge {work_unit} discussion none paused` | wait-gate `yes` (STOP `:176`) in **G. Concluding**, which runs before the map gate and before closing-gates **E. In-Flight Agent Check** (`closing-gates.md:175`) | **yes** — no in-flight check before this exit |
| E8 | `skills/workflow-discussion-process/references/conclude-discussion.md:74` | `/workflow-bridge {work_unit} discussion` | conclude-gate `yes` (STOP `:31`) | **yes** — closing-gates in-flight gate `proceed` (`closing-gates.md:203-205`) leaves agents running |
| E9 | `skills/workflow-shared/references/cancelling-the-topic.md:114` | `/workflow-bridge {work_unit} {phase} none cancelled`, phase ∈ `research\|discussion\|specification\|planning` (epic only: `:25-36`) | cancel-gate `yes` + `topic cancel` + receipt | no — TaskStop + `agent incorporate` first (`:80-92`) |
| E10 | `skills/workflow-shared/references/postponing-the-topic.md:129` | `/workflow-bridge {work_unit} {phase} none postponed`, phase ∈ `research\|discussion` (only when `own`, `:27-29`, `:127-129`) | postpone-gate `yes` + `topic postpone` + receipt | no — TaskStop + `agent incorporate` first (`:97-111`) |
| E11 | `skills/workflow-experiment-process/references/next-experiment.md:29` | `/workflow-bridge {work_unit} experiment` | automatic — no live top-level record | none (legs run foreground: `run-experiment.md:47`) |
| E12 | `skills/workflow-experiment-process/references/next-experiment.md:59` | `/workflow-bridge {work_unit} experiment` | next-gate `yes` then picker `b/back` (select-record STOP) | none |
| E13 | `skills/workflow-experiment-process/references/next-experiment.md:69` | `/workflow-bridge {work_unit} experiment` | next-gate `menu` (STOP `:39`) | none |
| E14 | `skills/workflow-specification-process/references/spec-completion.md:204` | `/workflow-bridge {work_unit} specification` (cross-cutting) | automatic after completion | none (review passes sequential) |
| E15 | `skills/workflow-specification-process/references/spec-completion.md:214` | `/workflow-bridge {work_unit} specification` | automatic | none |
| E16 | `skills/workflow-specification-process/references/promote-to-cross-cutting.md:49` | `/workflow-bridge {work_unit} specification` (the epic, not the cc unit) | automatic after `workunit promote` + receipt | none |
| E17 | `skills/workflow-planning-process/references/conclude-plan.md:37` | `/workflow-bridge {work_unit} planning none paused` | wait-gate `yes` (STOP `:19`) + commit | none (every planning agent is awaited — e.g. `define-phases.md:49`, `plan-review.md:96,116`) |
| E18 | `skills/workflow-planning-process/references/conclude-plan.md:109` | `/workflow-bridge {work_unit} planning` | conclude-gate `yes` (STOP `:63`) | none |
| E19 | `skills/workflow-planning-process/references/resolve-spec-gap.md:302` | `/workflow-bridge {work_unit} planning none paused` | wait-gate `yes` (STOP `:292`); planning lanes only — the implementation lane stops terminally (`:255-266`) | none |
| E20 | `skills/workflow-roadmap/references/pull.md:127` | `/workflow-bridge {work_unit} discovery {routing}` — routing ∈ `research\|discussion` held at `:39` | roadmap-shape-gate `yes` (STOP `:49`), create + join; feature arm | none |
| E21 | `skills/workflow-investigation-process/references/conclude-investigation.md:72` | `/workflow-bridge {work_unit} investigation` | automatic after completion | none (validation agents synchronous: `root-cause-validation.md:51`, `fix-validation.md:25`) |
| E22 | `skills/workflow-implementation-process/references/conclude-implementation.md:53` | `/workflow-bridge {work_unit} implementation` | conclude-gate `yes` | none (every implementation dispatch is awaited) |
| E23 | `skills/workflow-review-process/references/close-review.md:66` | `/workflow-bridge {work_unit} review` | automatic, from the pass / clean / no-approved arms (`review-actions-loop.md:37,91,205`) | none |

### 1F. Other phase exits (not through the bridge)

| # | Source file:line | Target + exact args | What precedes | Today | Class | Reasoning | Agents |
|---|---|---|---|---|---|---|---|
| F1 | `skills/workflow-review-process/references/review-actions-loop.md:271-306` (Next Step `:288`) | `/workflow-implementation-entry {work_type} {work_unit} {topic}` — topic passed for every type | F task writer returned (CHECKPOINT); `topic reopen` + commit; automatic | **PM (its own, not the bridge)** | HANDOFF | review fail → implementation | none |
| F2 | `skills/workflow-specification-process/references/resolve-source-incoherence.md:263` | `/workflow-continue-epic {work_unit}` \| `/workflow-continue-feature {work_unit}` \| `/workflow-continue-bugfix {work_unit}` \| `/workflow-continue-cross-cutting {work_unit}` (Skill tool) | gap exit acknowledged; pause commit (`:255-259`); automatic | IP | STAY (paused phase → menu) | destination is a menu; note the linear menus auto-route (B2–B5) when nothing is revisitable, so the next hop clears | none |
| F3 | `skills/workflow-discovery/references/shape-and-confirm.md:31` | `/workflow-roadmap genesis` (Skill tool) | shape-gate `yes` with a product-altitude read (STOP `:23`); holds `import_paths` (`:29`) | IP | SPECIAL (§5.1) | mid-conversation work→work; genesis persists the live conversation | none |
| F4 | `skills/workflow-discovery/references/shape-and-confirm.md:51` | `/workflow-roadmap genesis` | shape-gate `other` settled as product road; holds `import_paths` (`:47`) | IP | SPECIAL (§5.1) | as F3 | none |
| F5 | `skills/workflow-discovery/references/detection-core.md:137` | `/workflow-roadmap pull` (Skill tool) | user accepts a conversational recognition offer (`:134`), no engine gate | IP | SPECIAL (§5.2) | pull reads the live shaping conversation | none |
| F6 | `skills/workflow-roadmap/references/pull.md:115` | `/workflow-discovery none {work_unit} none` (Skill tool) | shape gate `yes` (STOP `:49`), create + join + roadmap-view; holds `pull_continuation` = true, `session_number` = `001` (`:113`) | IP | SPECIAL (§5.3) | "a continuation, not a cold open"; context-held flags | none |
| F7 | `skills/workflow-experiment-process/references/next-experiment.md:43` | loads `workflow-experiment-entry/references/select-record.md`, then "Return to the skill for Step 1" (`:49`) | next-gate `yes` (STOP `:39`) | IP (ref load) | STAY | next sibling record in the same context by design (`:13`) | none |
| F8 | `skills/workflow-implementation-process/references/task-loop.md:162` | loads `workflow-planning-process/references/resolve-spec-gap.md` with lane = `implementation`; reads `verdict` back | executor `blocked` | IP (ref load) | STAY | subroutine; tier three is a terminal STOP inside it (`resolve-spec-gap.md:255-266`) | executor finished |

### 1G. Entry → process (same phase, all `IP`, Skill tool with a fenced free-text payload)

Class: STAY (same-phase step; payload is free text by design — §5.8). Agents: none.

| Source file:line | Target | Payload fields |
|---|---|---|
| `skills/workflow-research-entry/references/invoke-skill.md:15` / `:30` / `:50` | `workflow-research-process` | `Research session for:`, `Work unit:`, `Work type:`, `[Source: existing research]`, `Output:`, `[Context: Prompted by / Already knows / Starting point / Constraints]` (`:39-43`) |
| `skills/workflow-discussion-entry/references/invoke-skill.md:17` / `:31` / `:47` | `workflow-discussion-process` | session/work unit/type, output, interview context |
| `skills/workflow-investigation-entry/references/invoke-skill.md:17` / `:32` / `:42` | `workflow-investigation-process` | incl. Bug context from gather-context answers (`:15`) |
| `skills/workflow-specification-entry/references/invoke-skill.md:15` / `:29` / `:45` / `:64`; `references/handoffs/continue.md:11`, `continue-completed.md:11`, `create.md:11`, `create-with-incorporation.md:11`, `unify.md:9`, `unify-with-incorporation.md:9` | `workflow-specification-process` | sources, consult references, variant |
| `skills/workflow-planning-entry/references/invoke-skill.md:15` / `:28` | `workflow-planning-process` | |
| `skills/workflow-implementation-entry/references/invoke-skill.md:26` | `workflow-implementation-process` | Format, External ID, Specification, Implementation, Dependencies (`:28-38`) |
| `skills/workflow-review-entry/references/invoke-skill.md:16` | `workflow-review-process` | |
| `skills/workflow-scoping-entry/references/invoke-skill.md:9` | `workflow-scoping-process` | |
| `skills/workflow-experiment-entry/references/invoke-skill.md:13` | `workflow-experiment-process` | |

### 1H. Capture-skill side excursions (return to the caller)

Class: STAY (subroutine; it reads the calling conversation — `workflow-log-idea/SKILL.md:9` "If there's already conversation context about an idea, synthesise it straight into the file"). No args. Agents: whatever the caller had running.

| Source file:line | Target(s) |
|---|---|
| `skills/workflow-discovery/references/detection-core.md:108` | `/workflow-log-idea` \| `/workflow-log-bug` \| `/workflow-log-quickfix` |
| `skills/workflow-shared/references/backlogging.md:109` | same three |
| `skills/workflow-implementation-process/references/ad-hoc-plan-changes.md:31` | same three |
| `skills/workflow-review-process/references/decide-out-of-scope.md:53` | same three, per kept finding |
| `skills/workflow-roadmap/references/roadmap-guidelines.md:45` | same three (offered) |
| `skills/workflow-discussion-process/references/off-topic-non-epic.md:21` | `workflow-log-idea` |
| `skills/workflow-research-process/references/feature-session.md:97` | `workflow-log-idea` |

### 1I. Cross-skill reference loads that act as transitions ("back" and borrowed screens)

| Source file:line | Loads | Trigger | Class |
|---|---|---|---|
| `skills/workflow-roadmap/SKILL.md:161` | `workflow-start/references/start-menu.md` | roadmap home `b/back` | STAY (back to start) |
| `skills/workflow-roadmap/references/pull.md:25` | `workflow-start/references/start-menu.md` | pull working-set `back` when `$0` is `pull` (else back to roadmap Step 3, `:29`) | STAY — but from F5 this abandons the discovery shaping (§5.2) |
| `skills/workflow-baseline/references/manage-baseline.md:59` | `workflow-start/references/start-menu.md` | manage `back` | STAY |
| `skills/workflow-baseline/references/scope-areas.md:60` | `workflow-start/references/start-menu.md` | fresh-assessment scope gate `back` | STAY |
| `skills/workflow-help/references/home.md:37` | `workflow-start/references/start-menu.md` | help home `back` | STAY |
| `skills/workflow-start/references/start-menu.md:29` / `:35` | then `empty-state.md` / `active-work.md` — whose picks run A1–A14 **from inside** roadmap/baseline/help | | STAY, then per A-row |
| `skills/workflow-help/references/home.md:25` | `walk.md` (same skill) with origin `help` | `w/walk` | STAY |
| `skills/workflow-bridge/references/epic-continuation.md:153` | `workflow-continue-epic/references/epic-display-and-menu.md` | §3 | D10 |
| `skills/workflow-start/SKILL.md:211` | `workflow-help/references/walk.md` | A15 | STAY |

Content-only cross loads (not transitions): `workflow-roadmap/references/pull.md:55` (`workflow-discovery/references/name-resolution.md`), `pull.md:75` (discovery `template.md`), `roadmap-guidelines.md:9`, `session-loop.md:86`; `workflow-shared/references/answering-how-it-works.md:11` (help `glossary.md`); `workflow-planning-process/references/review-*.md` → implementation `finding-floor.md`; `review-actions-loop.md:213` → implementation `invoke-task-author.md`; `workflow-scoping-process/references/select-format.md:47`; `workflow-start/references/view-plan.md:60`.

### 1J. Text that tells the user to move (not a transition)

`workflow-continue-{epic,feature,bugfix,quickfix,cross-cutting}/SKILL.md:68` ("Run /workflow-start to begin a new one."); `workflow-implementation-entry/references/check-dependencies.md:81`; `workflow-continue-epic/references/backfill-checks.md:70` ("Run `/clear`, then `/workflow-start`"); `workflow-continue-epic/SKILL.md:139`; `workflow-legacy-research-split/SKILL.md:63`, `:143`, `:173`, `:183`; `workflow-start/SKILL.md:180`.

### 1K. Engine-side route builders

| Builder | file:line | Shape |
|---|---|---|
| `CONTINUE_SKILL` table | `skills/workflow-engine/scripts/domain/projections/start.cjs:63-69` | feature→`workflow-continue-feature`, bugfix→`…-bugfix`, `quick-fix`→`…-quickfix`, `cross-cutting`→`…-cross-cutting`, epic→`…-epic` |
| start menu numbered rows | `start.cjs:211` | `` `/${CONTINUE_SKILL[s.type]} ${u.name}` `` (`continue_work_unit`) |
| roadmap row | `start.cjs:116` | `'/workflow-roadmap open'` (`open_roadmap`; only when the roadmap exists, `:114`) |
| help row | `start.cjs:120` | `'/workflow-help'` (`open_help`) |
| baseline rows | `start.cjs:220` (start menu, in-progress), `:296` / `:298` / `:304` (empty state: in-progress / completed / skipped) | `'/workflow-baseline'` (`open_baseline`) |
| start-new rows | `start.cjs:225-230`, `:309-314` | `route: null`, `pre_seed` ∈ `none\|feature\|epic\|bugfix\|quick-fix\|cross-cutting` — the prose builds A5/A9 |
| inbox / view / manage | `start.cjs:233`, `:236`, `:238`, `:318`, `:321` | `route: null` |
| start ACTIONS emission | `skills/workflow-start/scripts/gateway.cjs:110-111` | `key word action work_unit → route [(pre_seed: …)]` |
| `entryRoute` | `skills/workflow-engine/scripts/domain/projections/workunit.cjs:35-37` | `` `/workflow-${phase}-entry ${cfg.workType} ${workUnit}` `` |
| linear continue / finalise / revisit | `workunit.cjs:135` (continue → `next_phase`), `:144` (revisit_phase), `:130` finalise `route: null`, `:140` revisit `route: null` | |
| linear ACTIONS emission | `workunit.cjs:188` (`workUnitData`) | `key word action topic → route` |
| `PHASE_ENTRY_SKILL` | `skills/workflow-engine/scripts/domain/projections/epic.cjs:82-90` | research, experiment, discussion, specification, planning, implementation, review → `workflow-{phase}-entry` |
| `ACTION_PHASE` | `epic.cjs:94-106` (+ `CONVERSATION_ACTIONS`, `skills/workflow-engine/scripts/domain/derivations.cjs:1167-1170`) | `start_research`/`continue_research` → research; `start_discussion`/`start_discussion_after_research`/`continue_discussion` → discussion; `continue_experiment`; `start_/continue_` specification/planning/implementation/review |
| `topicRoute` | `epic.cjs:549-551` | `` `/${PHASE_ENTRY_SKILL[ACTION_PHASE[action]]} epic ${workUnit} ${topic}` `` |
| topicRoute callers | `epic.cjs:613` (map row research/discussion entries), `:649` (experiment rows), `:687` (continue rows), `:720` (gated start rows, `START_GATE` `:116-121`), `:1219` (completed sub-view, `continue_${phase}`) | |
| topic-less epic routes | `epic.cjs:739` (`s/spec` `analyze_discussions` → `/workflow-specification-entry epic ${wu}`), `:749` (`i/discovery` `continue_discovery` → `/workflow-discovery epic ${wu}`), `:764` (`d/discuss` `new_discussion` → `/workflow-discussion-entry epic ${wu}`), `:769` (`r/research` `new_research` → `/workflow-research-entry epic ${wu}`) | |
| internal epic rows | `epic.cjs:774`, `:779`, `:782`, `:785`, `:791`, `:796`, `:802`, back `:1126` | `route: null` |
| sub-view key copy | `epic.cjs:1169` | carries `r.route` |
| epic ACTIONS emission | `skills/workflow-continue-epic/scripts/gateway.cjs:262-263` (view), `:332-333` (sub-views) | `→ ${route \|\| '(internal)'}` + `(recommended)` / `(in session: …)` / `(code session: …)` / `(dep: …)` / `(item: …)` |
| ACTIONS formatter | `skills/workflow-engine/scripts/domain/projections/surfaces.cjs:509-514` | `actionsTable` |
| bridge next phase | `skills/workflow-bridge/scripts/gateway.cjs:38` (`computeNextPhase`, `derivations.cjs:752-`), emitted `:76` | `next_phase: <phase\|done>`; the continuation composes the route string itself |

No `/workflow-…` route string exists in any other engine or skill script (grep of `skills/**/*.{cjs,js,ts}` beyond the above finds only a comment at `walkthrough-diagrams.cjs:288`).

---

## 2. Argument contracts of every handoff target

All targets except the capture skills are `user-invocable: false` (frontmatter); `workflow-start` is `disable-model-invocation: true` (`skills/workflow-start/SKILL.md:3`) — it is never a Skill-tool target. Engine-side shape rules worth reusing: work-unit name legality `assertLegalWorkUnitName` (`skills/workflow-engine/scripts/domain/workunit-create.cjs:61-71`: no `.` or `/`, not a phase name, not `project`/`baseline`/`roadmap` — `kernel/manifest-schema.cjs:220-224`); topic names: no `.` or `/` (`domain/discovery-map.cjs:473-478`), kebab is convention only; live inbox path `parseInboxPath` (`domain/inbox.cjs:37-60`: exactly `.workflows/.inbox/{ideas|bugs|quickfixes}/{file}.md`); work types `VALID_WORK_TYPES` (`kernel/manifest-schema.cjs:13`); pipelines `WORK_TYPE_PIPELINES` (`manifest-schema.cjs:26-32`).

| Skill | `$0` | `$1` | `$2` | `$3` | Quoted from |
|---|---|---|---|---|---|
| `workflow-bridge` | work_unit — existing (`manifest get {work_unit} work_type`, `SKILL.md:48`) | completed_phase: "`discovery` or any later phase; the one that concluded, or the one pausing when `$3` is `paused`" | next_phase (optional): "supplied when the caller already knows the destination — discovery handing a single-phase work type to its first phase … Absent or the literal `none` means the continuation computes the next phase" | outcome (optional): "`paused` … with `$2` as `none`; … `cancelled` … or `postponed` …, both with `$2` as `none`. … Absent means the phase completed." | `skills/workflow-bridge/SKILL.md:17-21` |
| | | observed values: `discovery` (E1, E2, E20), `research`, `discussion`, `experiment`, `investigation`, `scoping`, `specification`, `planning`, `implementation`, `review` | observed: `research\|discussion\|investigation\|scoping` with `$1=discovery` (non-epic); `none` with `$1=discovery` (epic, E1) or with any `$3`; absent otherwise | `paused` with `$1` ∈ `research\|discussion\|planning` (E5–E7, E17, E19; `render phase-paused` refuses others: `domain/render.cjs:4131-4133`); `cancelled` with `$1` ∈ `research\|discussion\|specification\|planning`, epic only (E9); `postponed` with `$1` ∈ `research\|discussion`, epic only (E10) | |
| `workflow-discovery` | "work_type pre-seed: one of `epic` / `feature` / `bugfix` / `quick-fix` / `cross-cutting`, or `none`" | "work_unit: an existing epic's name … or `none` (new work)" | "inbox_seeds: comma-joined path(s) to inbox file(s) … or `none`. Absent `$2` is treated as `none`. Split on commas" | — | `skills/workflow-discovery/SKILL.md:55-57`; mode by `$1` (`:59-71`) |
| | observed: `none\|feature\|epic\|bugfix\|quick-fix\|cross-cutting` (A5/A9), `bugfix\|quick-fix\|none` (A10), `epic` (epic menu `epic.cjs:749`), `none` with an existing epic (F6) | `none` (A5/A9/A10) or an existing epic (epic menu, F6) | quoted `"{inbox_seeds}"` (A5/A9/A10 — literal `"none"` there), absent (epic menu), `none` (F6) | | |
| `workflow-roadmap` | "mode: `genesis` (from discovery's shaping gate — the conversation is live), `open` (from the workflow-start menu), or `pull` (from a recognition offer …)"; any other value falls to Step 3 like `open` (`:72-74`) | — | — | — | `skills/workflow-roadmap/SKILL.md:54-56`; `pull.md:23` branches on `$0` for `back` |
| `workflow-help` | "Any argument is ignored — the entry is the home." | | | | `skills/workflow-help/SKILL.md:27` |
| `workflow-baseline` | none — "All state it needs is fetched at initialisation; the caller passes nothing." (self-routes on `project.baseline.status`, `:65-81`) | | | | `skills/workflow-baseline/SKILL.md:13` |
| `workflow-continue-epic` | work_unit, optional: "If `work_unit` argument `$0` provided" → Step 4; absent → Step 3 selection; unknown name → terminal `DISPLAY: not found` (`references/validate-selection.md:9-19`) | — | — | — | `skills/workflow-continue-epic/SKILL.md:73-81` |
| `workflow-continue-feature` / `-bugfix` / `-quickfix` / `-cross-cutting` | work_unit, optional — same wording (`SKILL.md:73-81` in each) | | | | each `SKILL.md:73` |
| `workflow-research-entry` | work_type — epic, feature, cross-cutting (Workflow Context `SKILL.md:17-19`) | work_unit | topic optional; epic + no topic → asks for one + `direct-entry-gate` (`:46-74`) | | `SKILL.md:33-34`: "Arguments: work_type = `$0`, work_unit = `$1`, topic = `$2` (optional). Resolve topic: topic = `$2`, or if not provided and work_type is not `epic`, topic = `$1`." |
| `workflow-discussion-entry` | epic, feature, cross-cutting (`:17-19`) | work_unit | optional; epic topic-less → asks (`:44-…`) | | `SKILL.md:33-34` (same sentence) |
| `workflow-experiment-entry` | epic, feature, cross-cutting (`:17-19`) | work_unit | topic — epic always passes it (`epic.cjs:649`) | | `SKILL.md:35-37` |
| `workflow-specification-entry` | epic, feature, bugfix, cross-cutting (`:17-20`) | work_unit | optional; epic topic-less → scoped grouping path (`:43-…`) | | `SKILL.md:34-35` |
| `workflow-planning-entry` | epic, feature, bugfix (`:17-19`) | work_unit | topic — required for epic in practice ("Planning, implementation, review always receive a topic", `CLAUDE.md:86`) | | `SKILL.md:33-34` |
| `workflow-implementation-entry` | epic, feature, bugfix, quick-fix (`:17-20`) | work_unit | topic — required for epic; F1 passes it for every type (= work_unit when linear) | | `SKILL.md:34-35` |
| `workflow-review-entry` | epic, feature, bugfix, quick-fix (`:17-20`) | work_unit | topic — required for epic | | `SKILL.md:34-35` |
| `workflow-investigation-entry` | "Investigation is always bugfix work_type." | work_unit | optional (= `$1`) | | `SKILL.md:31-34` |
| `workflow-scoping-entry` | quick-fix only (Workflow Context "the quick-fix pipeline", `:13-15`) | work_unit | optional (= `$1`) | | `SKILL.md:31-32` |
| `workflow-legacy-research-split` | none positional — "Work unit (required) — the epic to normalise. Passed by `workflow-continue-epic` Step 5." (context) | | | | `SKILL.md:9-11` |
| `workflow-log-idea` / `-bug` / `-quickfix` | none; reads conversation context | | | | `workflow-log-idea/SKILL.md:9` |
| `workflow-*-process` | fenced free-text block (§1G), never positional | | | | `CONVENTIONS.md:812-815` |

Observed route shapes per target (what a validator must accept):
- `/workflow-continue-{feature|bugfix|quickfix|cross-cutting|epic} {wu}` (A1); `/workflow-continue-epic {wu}` (D1, F2); `/workflow-continue-{epic|feature|bugfix|cross-cutting} {wu}` (F2); `/workflow-continue-epic` bare (A13, A14).
- `/workflow-{phase}-entry {type} {wu}` for `phase` in the type's pipeline (`workunit.cjs:35-37`, D2–D9) — `type` spelled `quick-fix` / `cross-cutting` as the manifest value.
- `/workflow-{phase}-entry epic {wu} {topic}` (`epic.cjs:549-551`); `/workflow-{specification|discussion|research}-entry epic {wu}` (`epic.cjs:739,764,769`).
- `/workflow-implementation-entry {type} {wu} {topic}` (F1, any type).
- `/workflow-discovery {type|none} none "{paths|none}"`; `/workflow-discovery epic {wu}`; `/workflow-discovery none {wu} none`.
- `/workflow-roadmap open|genesis|pull`; `/workflow-help`; `/workflow-baseline`.
- `/workflow-bridge {wu} {completed_phase} [{next_phase|none} [paused|cancelled|postponed]]`.

---

## 3. The bridge in depth

### 3.1 Per continuation reference — every exit

| Reference | Menus shown first | Exits |
|---|---|---|
| `discovery-continuation.md` | none | B (epic) → PM `/workflow-continue-epic {wu}` (`:23-41`); C (other) → PM `/workflow-{next_phase}-entry {work_type} {wu}` (`:45-63`). No banner, no all-done, no gateway run (bridge `SKILL.md:51-55` skips it). |
| `feature-continuation.md` | `render next-phase-gate {wu} --prev {completed_phase} --next {next_phase}` (`:46`; skip-review row on the review hop, revisit row where an earlier phase completed; empty → no stop); `render revisit-phases {wu}` (`:88`) | A `done` → `workunit complete` + receipt, terminal (`:13-27`); A `paused` → D paused PM (`:29-33`, `:107-126`); B empty → D (`:49-51`); B `y` → D (`:59-61`); B `d/done` → complete (skipped review) + receipt, terminal (`:63-77`); B `r` → C; C `back` → B (`:93-95`); C pick → D (`:97-101`); D otherwise PM (`:130-149`). |
| `bugfix-continuation.md` | same as feature (byte-identical structure; `bugfix` substituted) | same lines as feature; the paused arm is unreachable (no bugfix phase pauses). |
| `quickfix-continuation.md` | next-phase-gate (`:40`), revisit-phases (`:82`; spec/plan never revisit targets) | A `done` terminal (`:13-27`); no paused arm; B empty/`y` → D; `d/done` terminal (`:57-71`); `r` → C; D PM (`:99-118`). |
| `cross-cutting-continuation.md` | next-phase-gate (`:46`, revisit row only — no review hop), revisit-phases (`:72`) | A `done` terminal (`:13-27`); A `paused` → D paused PM (`:29-33`, `:91-110`); B empty/`y` → D; `r` → C; D otherwise PM (`:114-133`). |
| `epic-continuation.md` | `epic-all-done-gate` (E), the epic dashboard + menu (G), and every sub-menu of `epic-display-and-menu.md` | E `yes` → `workunit complete` + receipt, terminal (`:93-107`); G pick → H PM with the stored route (`:169-188` topic present, `:192-211` topic absent). |

### 3.2 `epic-continuation.md` — what runs before the menu

1. **A. Run Epic Discovery** (`:11-21`) — `workflow-continue-epic/scripts/gateway.cjs {wu}` (the scoped dump: `all_done`, `analysis_caches`, `needs_sequencing`, `build_order_needs_sequencing`, discovery map). No not-found validation (continue-epic has one, `validate-selection.md:9-19`).
2. **B. Topic Discovery** (`:23-29`) — loads `workflow-shared/references/topic-discovery-dispatch.md`: cache-status check; on `stale`, `presence scan` (defers with `DISPLAY: presence deferral` when `held_sources > 0`, `topic-discovery-dispatch.md:42-52`; the caller's own rows are excluded, `domain/presence.cjs:275`, `kernel/process.cjs:62-66`); else `topic-discovery.md` (gap analysis: stage → present → approve → write → stamp, the approval gate STOPs) and a re-run of the scoped dump. Populates the in-conversation `new_arrivals` tracker.
3. **C. Sequence Map** (`:31-53`) — `sequence-discovery-map.md` when `needs_sequencing`, then re-run discovery.
4. **D. Sequence Build Order** (`:55-77`) — `sequence-build-order.md` when `build_order_needs_sequencing`, then re-run discovery.
5. **E. Check All-Done** (`:79-115`) — `render epic-all-done-gate {wu}`; `yes` completes the epic (terminal); `no` → F.
6. **F. Phase Banner** (`:117-149`) — `paused` → `render phase-paused {wu} --phase {completed_phase}` (names what the paused item awaits, derived from the manifest: `domain/render.cjs:4128-4139`); `cancelled` / `postponed` → no banner (the session's own receipt already rendered); otherwise → `render phase-completed {wu} --phase {completed_phase}` (`render.cjs:4103-4116`; experiment reads "session complete").
7. **G. Display and Menu** (`:151-157`) — loads continue-epic's `epic-display-and-menu.md` with `new_arrivals`.
8. **H. Enter Plan Mode** (`:161-211`) — the stored route verbatim.

### 3.3 Compared with `workflow-continue-epic`'s own steps

| Concern | Bridge `epic-continuation.md` | `workflow-continue-epic/SKILL.md` |
|---|---|---|
| Title | — (bridge renders `□ Read Work Type…` / `□ Route to Continuation Reference`, `SKILL.md:36,80`) | `■ Continue Epic` (Step 0, `:22`) |
| Index + count/arg handling | — | Step 1 unscoped index (`:31`), Step 2 count 0 terminal / `$0` (`:59-81`), Step 3 selection (`:85-101`) |
| Validation (unknown epic) | — | Step 4 (`validate-selection.md:9-19`) |
| tmux label | bridge Step 1 `session label {wu}` (`SKILL.md:30`) | Step 5 `session label {wu}` (`:118`) |
| Legacy split + summary backfill | — | Step 5 (`:121-141`; can be terminal, `backfill-checks.md:55-73`) |
| Gap analysis (`topic-discovery-dispatch.md`) | B | Step 6 (`:145-151`) |
| Sequence map | C (re-runs discovery after) | Step 7 (re-runs, `:175-181`) |
| Build order | D (re-runs discovery after) | Step 8 (does not re-run; the view reads fresh) |
| **All-done gate / epic completion** | **E** | **absent** — the dump carries `all_done` (`gateway.cjs:183`; listed at `SKILL.md:51`) but no step reads it; the epic menu has no completion row (`epic.cjs` has none) |
| **Phase banner** | **F** (`phase-completed` / `phase-paused` / none) | **absent** |
| Menu | G (same reference) | Step 9 (same reference) |
| Route | H — plan mode | Step 10 — in place |

**Would handing off from the bridge to a fresh `/workflow-continue-epic {wu}` lose anything?**
- **The all-done gate.** Nothing else in the epic flow offers to complete an epic whose reviews are all done; continue-epic never acts on `all_done`. Needs no argument — it is state-derived from the scoped dump (`gateway.cjs:183`), so continue-epic could run it itself.
- **The phase banner.** `phase-completed` needs the completed phase; `phase-paused` needs the phase and the fact of the pause (its "awaits …" text is derived from manifest waits). Carrying it takes the bridge's own `$1` (`completed_phase`) and `$3` (`outcome`) — continue-epic accepts only `$0` today (`SKILL.md:73`). `cancelled`/`postponed` render no banner, so they need nothing — but the receipts the session rendered before the bridge are in the cleared context (and possibly off screen, §5.15).
- **The gap analysis, sequencing, build order — not lost**: continue-epic Steps 6–8 run the same references; `new_arrivals` is rebuilt in the fresh context.
- **Gained**: Step 4 validation, Step 5 backfill (which may terminate the flow and ask for a manual `/clear` + `/workflow-start`), the `■ Continue Epic` title.
- D1 (discovery's epic conclusion) already hands off to a fresh `/workflow-continue-epic {wu}` today, and loses the all-done gate the same way (edge: an existing-epic re-shape on an otherwise all-done epic).

---

## 4. Tests and docs that depend on these transitions

### 4.1 Prose harness

| file:line | What it encodes |
|---|---|
| `.claude/agents/prose-walker.md:111-118` | "Crossing a skill boundary is done by reading" — no Skill tool in a walk; continue only where the act sanctions it |
| `.claude/agents/prose-walker.md:152-159` | "Plan mode does not exist here" — resolve the plan content, write it to `.plan-handoff.md` at the project root, stop at `ExitPlanMode` |
| `.claude/agents/prose-asserter.md:134-140` | a handoff read rather than invoked is correct |
| `.claude/agents/prose-asserter.md:148-156` | `.plan-handoff.md` capture and the stop at `ExitPlanMode` are correct |
| `tests/prose/lib/cases.cjs:39-46`, `:183-200` (`entryErrors`) | legal walk entries justified by "what the bridge's plan file invokes after a context clear" |
| ~200 fixture/assertion `.claude/settings.json` files under `tests/prose/cases/*/` | `"showClearContextOnPlanAccept": true` (migration 034's output, part of every snapshot) |

### 4.2 Prose cases

**Walk into the bridge and end at plan mode (`.plan-handoff.md` claims):**

| Case | case.json | act.md | assert.md |
|---|---|---|---|
| `bridge-hands-off-to-planning` | `:2` origin ("plan-capture mechanism"), files `:31-32`, `calls_include`/`calls_in_order` `:47`, `:57` (`workflow-bridge/scripts/gateway.cjs pay`), `:48`, `:58` next-phase-gate | `:5` | `:7-27` (step 7 "plan mode"), `:31-37` (template verbatim: `/workflow-planning-entry feature pay`, no User instructions), `:40-42` |
| `discussion-spawns-an-experiment-and-continues` | files `:37-38`, `:61`, `:69` | `:5` | `:46-60` (pause → bridge → "straight to plan mode"), `:65-` (plan-handoff template) |
| `implementation-concludes-into-review` | `:2`, files `:37-38`, `:69`, `:87` | `:5` | `:72-86`, `:115-` |
| `implementation-resumes-a-converged-analysis` | files `:35-36`, `:57`, `:73` | `:5` | `:51-65`, `:91-` |

**Walk into the bridge and end at a terminal (assert "no plan mode"):**

| Case | case.json | act.md | assert.md |
|---|---|---|---|
| `bridge-completes-the-feature` | files `:36-37`, `:62`, `:76` | `:4-5` | `:26-43` (`:37` "no plan mode, no plan file", `:43` "no EnterPlanMode") |
| `spec-completes-the-cross-cutting` | files `:31-32`, `:51`, `:61` | `:5-6` | `:21-46` (`:31` "no plan mode", `:46`) |

**Walk through the bridge into the in-place epic menu (would end at the epic-menu handoff under H6):**

| Case | case.json | assert.md |
|---|---|---|
| `discussion-cancels-its-topic-mid-session` | files `:34-35`, `:52`, `:60` (`workflow-continue-epic/scripts/gateway.cjs view …`) | `:47-64` |
| `discussion-postpones-its-own-topic` | files `:35-36`, `:55`, `:65`, `:78` | `:58-70` |
| `research-cancels-its-topic-mid-session` | files `:31-32`, `:49`, `:57` | `:43-` |

**Stop at the bridge invocation ("do not follow into it" / "do not invoke the bridge")** — their final claim is the invocation:
act.md lines — `discussion-close-waits-on-a-running-review:4`, `discussion-corrects-a-stale-reference:5`, `discussion-close-resumes-after-a-findings-walk:4`, `discussion-concludes-over-unwalked-findings:4`, `discussion-reroutes-a-carry-note:5`, `discussion-dead-row-still-owes-review:4`, `discussion-review-corrects-a-false-claim:4`, `discussion-redecision-lands-timeline:5`, `discussion-drains-a-full-agenda:5`, `discussion-sweeps-a-dead-peers-leavings:6`, `discussion-requeues-a-research-concern:5`, `discussion-reroutes-to-research:5`, `experiment-abandoned-returns-open:4`, `experiment-walks-to-verdict:5`, `experiment-frozen-after-results:5`, `experiment-amended-before-results:5`, `experiment-series-continues-at-the-gate:5`, `research-dead-ends-at-conclusion:5`, `research-folds-a-landed-dive-on-resume:5`, `research-concludes-with-open-threads:5`, `research-resumes-on-the-verdict:5`, `research-spawns-an-experiment:5` ("do not run /clear"), `planning-concludes-with-a-question:4`, `planning-resumes-a-review-mid-walk:4`, `planning-review-stops-on-churn:5`, `planning-declines-and-picks-a-choice:5`, `planning-review-lands-a-spec-gap-under-auto:4`, `planning-routes-a-gap-and-pauses:4` (assert `:65-66` `/workflow-bridge pay planning none paused`), `planning-concludes-into-the-wait-gate:4` (assert `:41`, `:50`, `:55`), `planning-review-declines-a-builders-finding:5`, `planning-reviews-and-concludes:4`, `planning-review-removes-an-invented-how:4`, `planning-settles-a-derivable-choice:4`, `review-approves-the-work:4`, `review-corrects-a-blocking-issue:4`, `review-preps-and-applies-findings:4`, `review-measures-the-change-set:4`, `scoping-defines-the-quickfix:4` (case.json `calls_exclude` `:59` `workflow-bridge`), every `spec-*` case naming "do not invoke the bridge" (`spec-auto-applies-settled-stops-on-choice:5`, `spec-auto-settles-a-derivable-choice:5`, `spec-dispose-sees-through-an-analogy:5`, `spec-discuss-promotes-a-settled-call-to-a-choice:5`, `spec-gap-declines-a-builders-rule:5`, `spec-auto-declines-a-preference-at-dispose:5`, `spec-gap-exit-parks-on-the-roadmap:5`, `spec-gated-batches-the-settled-lane:5`, `spec-derives-an-unsourced-decision:5`, `spec-repairs-a-measured-conclusion:5`, `spec-review-routes-a-source-defect:5`, `spec-discusses-and-declines-a-finding:5`, `spec-extracts-the-discussion:5`, `spec-gap-settles-a-call-in-the-discussion:5`, `spec-measures-a-false-claim:5`, `spec-resolves-a-source-conflict:5`, `spec-review-stops-on-churn:5`, `spec-routes-an-unsourced-decision:5`).

**Bridge must not fire:** `feature-discussion-cancels-the-unit` (case.json `calls_exclude` `:59-60`; assert `:33`), `implementation-routes-a-block-and-pauses` (assert `:90`), `research-postpones-a-sibling` (assert `:45`), `epic-harvest-routes-and-briefs-from-the-record` (assert `:32`).

**Walk across a menu→work boundary in place (start → continue → entry → process, start → discovery, etc.) — under H11 these end at the recorded handoff instead:**
`start-continues-a-feature-into-discussion` (act `:1-3`; case.json `:36-37`, `:47-50`), `start-continues-an-epic-into-discussion` (`:39-43`, `:54-58`), `discussion-direct-entry-refuses-a-mapped-topic` (`:28-36`; act "Stop … or hands off to another skill"), `discovery-commits-new-epic`, `discovery-commits-new-feature`, `discovery-other-waits-for-the-named-shape` (case.json `calls_exclude` `:47` `workflow-roadmap`), `start-promotes-inbox-ideas` (`:37`, `:45`), `discovery-parks-a-staged-capability` (start → continue-epic → discovery), `epic-discovery-resume-edits-the-open-log` (`:38-50`), `roadmap-genesis-lays-out-the-map` (start → discovery → genesis, §5.1), `roadmap-add-gate-returns-after-a-question` (start → roadmap), `start-shows-the-harvested-roadmap` (`:27-43`), `roadmap-pull-fences-the-epic` (start → roadmap → pull → discovery in place; assert `:20-22` "never as an interrupted-session resume", case.json `calls_exclude` `:53-60` incl. `render resume-gate`, `workflow-bridge`) — depends on §5.3, `roadmap-pull-reads-a-postponed-record` (entry `workflow-roadmap`, case.json `calls_exclude` `:57` `workflow-bridge`; act "do not invoke the skill the pull hands off to").
Menu-only walks that stay in place (start → continue-epic, help): `epic-backfill-waits-for-a-provided-summary` (stops at the manual-`/clear` terminal, act: "do not re-run anything it tells the user to run"), `epic-entry-resequences-a-stale-order`, `gap-analysis-gate-walks-straight-in`, `gap-gate-approve-writes-a-brief`, `gap-gate-postpones-a-candidate`, `epic-menu-*` (5 cases), `help-opens-a-card-and-returns-to-the-start-menu`, `start-walk-takes-lets-move-on-as-ready`, `start-walks-two-screens-answers-a-question-and-stops`.

Mainlines (`tests/prose/mainlines/*.cjs`) are recipe code only — no transition claims.

### 4.3 Node / shell suites

| file:line | Dependency |
|---|---|
| `tests/scripts/test-pipeline-simulation.cjs:224-227` | every audit runs the bridge gateway (`BRIDGE.discover/format`) |
| `test-pipeline-simulation.cjs:497-523` | `arrive`/`label`: "A process skill is only ever entered from a place that labelled itself first — the bridge, or the work unit's continue menu" |
| `test-pipeline-simulation.cjs:798-800` | "the bridge's gate renders empty and the continuation goes straight to plan mode" |
| `test-pipeline-simulation.cjs:835-842` | the review-hop next-phase gate |
| `test-pipeline-simulation.cjs:866-906`, `:956`, `:2881-2892`, `:2924` | `BRIDGE.discover(...).next_phase` after pauses / reconcile |
| `test-pipeline-simulation.cjs:873-877` | "The wait gate's yes hands the session to the bridge as a pause" — renders `phase-paused` for a linear unit (no linear prose renders it today) |
| `test-pipeline-simulation.cjs:1358-1361` | "The discovery hand-off lands on the epic menu — the bridge's epic continuation into workflow-continue-epic" (`arrive`) |
| `test-pipeline-simulation.cjs:1787-1789` | the pause's bridge banner for an epic |
| `test-pipeline-simulation.cjs:2230-2232` | "Bridge continuation surfaces render at every state" (`phase-completed`, `epic-all-done-gate`) |
| `tests/scripts/test-gateway-for-bridge.cjs` (whole: `:17-260` discover, `:262-` format) | bridge gateway contract (`next_phase`, paused routing `:81-112`) |
| `tests/scripts/test-engine-render-surfaces.cjs:697` | "a linear pause lands in plan mode, never on a menu" |
| `tests/scripts/test-engine-start-projections.cjs:253`, `:269-274`, `:796` | start routes (`/workflow-continue-*`, `/workflow-help`) |
| `tests/scripts/test-engine-workunit-projections.cjs:101`, `:142`, `:331-333` | `entryRoute` shapes |
| `tests/scripts/test-engine-epic-projections.cjs:556-560`, `:713`, `:989-992`, `:1678-1680`, `:1745`, `:1884`, `:2192` | epic routes (`topicRoute`, topic-less rows, completed sub-view) |
| `tests/scripts/test-gateway-for-workflow-continue-epic.cjs:2093-2094` | ACTIONS line with route + markers |
| `tests/scripts/test-conventions-lint.cjs:1391` | "→ Enter plan mode." listed as a non-canonical arrow (route-arrow lint); `:778-792` check 14 (buried `Invoke the workflow-` imperatives), `:1679-1685` |
| `tests/scripts/test-migration-034.sh` (whole) and `test-migration-042.sh:70-82`, `-044.sh:70-82`, `-046.sh:115-128`, `test-engine-session-label.cjs:679`, `:689` | `showClearContextOnPlanAccept` preserved/installed |

### 4.4 Docs and conventions

| file:line | Text |
|---|---|
| `CLAUDE.md:37` | discovery "routes out to `/workflow-roadmap genesis`"; gap analysis run by continue-epic Step 6 and bridge section B |
| `CLAUDE.md:39` | pause "invokes `/workflow-bridge {wu} {phase} none paused`"; "the linear continuations skip the revisit offer and enter plan mode at what `computeNextPhase` names"; "the laboratory starts in fresh context — isolation is a scientific control" |
| `CLAUDE.md:43` | spec gap exit "route the session to the work type's continue skill" |
| `CLAUDE.md:44` | planning "pauses the plan through the bridge" |
| `CLAUDE.md:52`, `:56`, `:58` | tiers: start routes into discovery / continue-*; navigation "triggers the analytical bridge enrichment"; entry skills "Invoked by discovery, `workflow-continue-*`, and the bridge" |
| `CLAUDE.md:64`, `:66`, `:68` | roadmap/baseline/help `back` load `start-menu.md` "across the skill boundary as the bridge loads the epic dashboard"; pull: "epic → discovery continues under `pull_continuation` …; feature → bridge" |
| `CLAUDE.md:74-86` | Phase Entry Skill Routing (`$0/$1/$2`) |
| `CLAUDE.md:133`, `:135` | cancel/postpone end through `/workflow-bridge … none cancelled|postponed` |
| `CLAUDE.md:139`, `:141`, `:151` | bridge never reads `done` past a moving record; bridge section D; bridge labels `session label {wu}` |
| `CONVENTIONS.md:804-819` | "Loading, Invoking, and the Bridge": invoking adds instructions, "nothing is cleared"; `:819` "**The bridge** owns the only context-clearing handoff: phase → phase via plan mode … The bridge's plan content is a verbatim template" |
| `CONVENTIONS.md:810-815`, `:904`, `:935` | invocation forms; terminal exit pattern; `invoke-skill.md` naming |
| `docs/how-it-fits-together.md:20`, `:35`, `:37-41` | "Bridge — The clean hand-off"; "The bridge, and why phases start fresh"; epic hand-off returns to the dashboard |
| `docs/experiments.md:11`, `:15` | pause hands to the laboratory "through the epic menu or, on a feature, straight into the experiment"; "An experiment always begins in a fresh session" |
| `docs/research-and-discussion.md:45` | "the bridge hands you to specification" |
| `docs/review.md:31` | "re-opens implementation and hands off to a fresh session" |
| `docs/roadmap.md:11`, `:19` | genesis "the conversation simply continues at product altitude — nothing is lost"; pull "right into its discovery, arriving warm" |
| `docs/discovery.md:33` | "An epic does not stop at all; the same conversation deepens into shaping the epic itself" (internal, no boundary) |
| `docs/configuration.md:29` | the session-end hook (fires on a clear) |
| `README.md` | nothing on transitions |
| Skill-side user-facing text naming plan mode / clean context: `workflow-bridge/SKILL.md:7-9`, `:86`, `:117-126`; `workflow-discovery/SKILL.md:294`; `workflow-discovery/references/conclude-discovery.md:7`, `:31`; `workflow-scoping-process/references/complexity-check.md:105`; `workflow-roadmap/references/pull.md:124`; `workflow-continue-epic/references/epic-display-and-menu.md:11`; `workflow-shared/references/experiment-spawn.md:67`; `workflow-review-process/references/review-actions-loop.md:18`, `:271`, `:301`, `:306`; every bridge template's "To the human" line | |
| `skills/workflow-migrate/scripts/migrations/034-show-clear-context-on-plan-accept.sh:5-7` | the setting "the workflows rely on … to clear context between phases via the bridge skill" (frozen) |

---

## 5. Surprising

1. **Discovery → `/workflow-roadmap genesis` carries the conversation itself.** `shape-and-confirm.md:29`/`:47` hold `import_paths` in context; genesis lands them (`workflow-roadmap/SKILL.md:94`) and writes "a strong-summary of the shaping conversation so far" into the session log (`:118`, `:120`). Pre-confirm shaping is ephemeral (nothing on disk). Neither "menu → work" nor "concluded phase → work"; a clear here loses the whole conversation. `docs/roadmap.md:11` promises "nothing is lost".
2. **Discovery's recognition pull → `/workflow-roadmap pull` (F5) relies on the live conversation.** `pull.md:67` "Read every named log not already current in this conversation's context … a same-session pull has nothing to read"; `pull.md:75` backfills Exploration from "the live conversation". Also `pull.md:23-25`: `back` with `$0 = pull` loads the start menu, silently abandoning the discovery shaping (and any `inbox_seeds` it held).
3. **Roadmap epic pull → `/workflow-discovery none {wu} none` (F6) relies on context-held flags**, and is in place, not plan mode (`design/mod-handoff.md:21-22` lists "the roadmap's pull" under plan mode — true only for the feature arm, E20). `pull_continuation` + `session_number` are held (`pull.md:113`) and read by `workflow-discovery/SKILL.md:69`, `:177`, `resume-detection.md:9`, `session-loop.md:17`. `workunit create` sets `phases.discovery.active_session = '001'` for an epic (`domain/workunit-create.cjs:205`), so a cleared discovery would treat its own session as interrupted and render the resume gate (`resume-detection.md:13-…`). `roadmap-pull-fences-the-epic/assert.md:20-22` and its `calls_exclude` `render resume-gate` pin the current behaviour. Note `$0` is `none` here while the epic menu passes `epic` for the same mode.
4. **Background agents survive into a handoff.** E4/E8 (`proceed` at the in-flight gates), E5 (pause after `proceed`), E6 (experiment-spawn pause — no check at all), E7 (discussion wait-gate pause — runs before closing-gates' in-flight check). The next session's dead-row logic keys on "dispatched by an earlier session" via the row's `created` timestamp (`epic-session.md:67`, `feature-session.md:43`, `closing-gates.md:177`) and closes such rows with `agent incorporate`, after which "a report that lands later is ignored" (`cancelling-the-topic.md:86`). After a same-process clear the agent can still be alive, so a dive's report could be discarded. Only cancel/postpone stop agents first (TaskStop).
5. **Free text crosses every plan-mode handoff today.** Each bridge template sanctions "anything the user explicitly asked to carry forward … under a final `## User instructions` heading" (`discovery-continuation.md:23,45`; `feature-continuation.md:107,130`; `bugfix-continuation.md:107,130`; `quickfix-continuation.md:99`; `cross-cutting-continuation.md:91,114`; `epic-continuation.md:169,192`), plus descriptive "Arguments:" lines. `review-actions-loop.md:271-306` writes its own free-text `## Summary` and `## Context` (task counts, phase). The bridge's stated reason for plan mode is a handoff "that survives context compaction" (`workflow-bridge/SKILL.md:9`).
6. **`/workflow-continue-epic` invoked with no argument** after pivot (`manage-work-unit.md:98`) and absorb (`absorb-into-epic.md:137`). Continue-epic then shows its epic selection (Step 3) unless the model fills in the unit from context — `{selected.name}` / `{target_epic}` live only in context.
7. **`{selected_phase}` is never defined.** `epic-continuation.md:172`, `:174`, `:195`, `:197` use it; `epic-display-and-menu.md` stores `action`/`topic`/`route` (`:150`) or `phase`/`topic`/`route` (`:174`). The completed sub-view's `action` is `resume` (`epic.cjs:1222`), so the `@if(action == continue_discovery)` text branch keys on a value the D path never sets to that.
8. **Entry → process carries session-only input.** Interview answers ride the fenced block, "the one input only this session holds" (`workflow-research-entry/references/invoke-skill.md:28`; investigation `invoke-skill.md:15`). In place today; relevant to the "entry folds into process" next stack.
9. **Baseline and roadmap open on their own menus.** `/workflow-baseline` self-routes: `completed` → manage menu (`SKILL.md:73-75` → Step 4), `in-progress` → resume interview, else → scope areas (work). `/workflow-roadmap open` → the roadmap home menu first (`SKILL.md:72-74`). H1 classes both as work; a handoff into them lands on a menu in a cleared context. Baseline's back (`manage-baseline.md:59`, `scope-areas.md:60`) and the roadmap's back (`SKILL.md:161`) return to the start menu in place.
10. **Loops that return across a skill boundary.** `backfill-checks.md:19-27` invokes `workflow-legacy-research-split` (work unit by context, `SKILL.md:9-11`) and expects it to return; then ends on a manual "Run `/clear`, then `/workflow-start`" (`:70`) — a hand-rolled clear whose natural target (`workflow-start`) cannot be model-invoked. Capture skills (§1H) return to their callers. `next-experiment.md:43-49` loads the entry's `select-record.md` and loops back to the process's Step 1. `task-loop.md:162` borrows planning's `resolve-spec-gap.md`. The five `select-*.md` load start's `manage-work-unit.md`, which can invoke `/workflow-baseline` or `/workflow-continue-epic` from inside a continue skill. `start-menu.md` runs the start menu inside the roadmap/baseline/help skill, whose picks then invoke A1–A14 from there.
11. **The epic can only be completed through the bridge.** `all_done` is computed for continue-epic (`gateway.cjs:183`, listed `SKILL.md:51`) but nothing there acts on it, and the menu has no completion row; manage's `d/done` needs `implementation_completed`. A handoff from the bridge to a fresh epic menu drops the only completion offer (§3.3).
12. **The experiment's scientific control depends on the clear.** `experiment-spawn.md:67` "its handoff is the laboratory's fresh context"; `CLAUDE.md:39`; `docs/experiments.md:15` "always begins in a fresh session". Under H7 (no mod → inline) the laboratory runs inside the spawning conversation (feature: D3/D8 straight to `/workflow-experiment-entry …`; epic: the menu pick).
13. **Scoping's type change fakes `completed_phase = discovery`** (`complexity-check.md:108`) for a unit mid-scoping whose type was just rewritten (`:41-47`, `:58-73`); the bridge reads the new `work_type` (`SKILL.md:48`) and uses the discovery arm (`discovery-continuation.md` C). A validator must accept `discovery` for any linear unit, not only a fresh one.
14. **The bridge's `$2` contract contradicts itself.** `workflow-bridge/SKILL.md:20`: absent/`none` "means the continuation computes the next phase from discovery output"; `discovery-continuation.md:9` and `SKILL.md:51-55`: for `discovery` the destination is "given, not derived" and the gateway is skipped. A non-epic `discovery` handoff with `none` would render `/workflow-none-entry …` (`discovery-continuation.md:54`); nothing guards it. `conclude-discovery.md:34` passes `none` for epic and says "the bridge treats `none` as absent and computes the destination itself".
15. **What a clear wipes besides context.** The bridge renders banners (`phase-completed`/`phase-paused`) and the cancel/postpone receipts render just before E9/E10 — all before the handoff; plan mode's approval left them on screen above the dialog. Whether the mod's `clear` also clears the screen is unverified here. The lab notes (`design/mod-handoff.md:34-38`) confirm SessionEnd hooks run on the mod's clear: `presence cleanup` (drops the ending conversation's rows), `session cleanup` (restores the tmux name; every next skill relabels), `conversation end` (records the transcript); the gate mod's own `session.end` handling (`skills/workflow-gates/hooks/register.ts:757-770`) keeps the band's gate for the old conversation.
16. **`none` is a sentinel but not a reserved name.** Discovery `$1` (`SKILL.md:56`) and bridge `$2` use the literal `none`; `assertLegalWorkUnitName` (`workunit-create.cjs:61-71`) and `RESERVED_WORK_UNIT_NAMES` (`manifest-schema.cjs:224`) do not reserve it. A work unit named `none` would be indistinguishable from "new work" at discovery.
17. **Inbox seeds are comma-split.** `workflow-discovery/SKILL.md:57` splits `$2` on commas; `parseInboxPath` (`domain/inbox.cjs:37-60`) does not forbid a comma in the file name.
18. **`CONVENTIONS.md:819` says the bridge owns the only context-clearing handoff**, but `review-actions-loop.md:271-306` enters plan mode itself (F1). `review-actions-loop.md:7` says every arm that ends the review ends through `close-review.md`; the fail arm leaves the review item open and hands off directly.
19. **The bridge's paused arm for linear types skips any banner**, yet `test-pipeline-simulation.cjs:873-877` renders `phase-paused` for a linear unit — the engine supports a surface no linear prose reaches.
20. **The linear continue menus route without a stop** when nothing is revisitable (`*-display-and-menu.md:30-34`), so start → continue-feature → entry is two skill hops with one user pick; F2 (spec gap pause → continue menu) likewise flows straight on into the reopened phase.

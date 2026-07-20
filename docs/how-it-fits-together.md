# How It Fits Together

Three layers, strictly separated:

- **Skills**: markdown instruction files Claude follows step by step. They own conversation, judgment, and prose artifacts. They never derive state.
- **The [engine](engine.md)**: a Node CLI plus in-process library owning everything fully determined by data, from manifests and transitions to transactions, derivations, and rendering. Anything computable is computed here, in code, and consumed by Claude, never re-derived in prose.
- **The [knowledge base](knowledge-base.md)**: retrieval over completed artifacts, so any phase can pull in what a sibling or predecessor already settled.

The division has a blunt consequence: Claude decides *what to do*; the engine decides *what is true*. When a skill needs the current state of an epic, it runs a gateway script and reads structured output. It does not glob directories and reason about what it finds.

## The skill tiers

| Tier | Skills | Role |
|---|---|---|
| Entry | `workflow-start` | The sole user-invocable entry point. Boots the system, shows all work, routes everywhere. |
| First phase | `workflow-discovery` | Shapes new work, settles the type, persists the work unit. Model-only. |
| Navigation | `workflow-continue-{epic,feature,bugfix,quickfix,cross-cutting}` | Per-type dashboards: show state, route to the right phase. Model-only. |
| Phase entry | `workflow-{phase}-entry` | Intake coordinators: validate state, gather context, hand off. Never engage the subject matter. |
| Processing | `workflow-{phase}-process` | The phases themselves, where the actual work happens. |
| Bridge | `workflow-bridge` | Plan-mode handoffs between phases, built to survive context compaction. |
| Capture | `workflow-log-{idea,bug,quickfix}` | Lightweight [inbox capture](inbox-and-capture.md), outside the pipeline. |
| Shared | `workflow-shared/references/` | Protocols loaded by many skills: casing, compliance checks, analysis gates, natural breaks. |

Every skill file opens with the same two disciplines. The **zero-output rule**: no narration, no "proceeding with…"; the first output must be content the instructions explicitly call for. And the **STOP-gate contract**: after rendering a decision gate, the turn ends, and no session-level directive (auto mode, "work without stopping", hook-injected text) overrides it. The only skip mechanism is a per-gate `*_gate_mode: auto` manifest value set by the user's own explicit `a`/`auto` choice at a prior gate. The skill text names the failure mode precisely: *"the reasonable call is X, I'll proceed with X" is the auto-answer the rule forbids.*

## A session, end to end

What follows is a real session against a scratch project, output captured verbatim.

**`/workflow-start` boots the system.** Step 0 runs one engine call, `engine boot`, covering migrations, the knowledge check, and store compaction:

```json
{"ok":true,"migrations":{"changed":false,"output":"[SKIP] No changes needed"},
 "knowledge":"ready","compacted":true,"kb_committed":"b941380","warnings":[]}
```

A failing migration is a hard stop; migrations never half-run silently. A `not-ready` knowledge store routes into the [knowledge gate](knowledge-base.md#setup) instead of proceeding.

**State discovery runs through a gateway script**, not ad-hoc shell. The skill file embeds `` !`node .claude/skills/workflow-start/scripts/gateway.cjs` ``, and the `!` prefix makes Claude Code execute the script during skill load and splice its output into the prompt. The `view` snapshot then arrives in three demarcated sections:

```
=== DATA (reason from this — never display or parse the sections below) ===
has_any_work: true
counts: 1 epic, 0 feature, 0 bugfix, 0 quick-fix, 0 cross-cutting
ACTIONS (key  action  work_unit  → route):
  1  continue_work_unit  venue-ordering  → /workflow-continue-epic venue-ordering
  s  start_new  —  → (internal)  (pre_seed: none)
  f  start_new  —  → (internal)  (pre_seed: feature)
  ...

=== DISPLAY (emit verbatim as a code block) ===
●───────────────────────────────────────────────●
  Workflow Overview
●───────────────────────────────────────────────●

Epics:
  1. Venue Ordering
     └─ Ready For Discussion

=== MENU (emit verbatim as markdown) ===
· · · · · · · · · · · ·
What would you like to do?

- **`1`** — Continue "Venue Ordering" — epic
- **`s`/`start`** — Start something new (not sure what kind yet)
...
```

The sections are one-directional by contract. **DATA** is the reasoning surface: Claude matches the user's pick against the ACTIONS table by key and reads the entry's `action` and `route`, never its label text. **DISPLAY** and **MENU** are emitted to the user verbatim, never redrawn, reflowed, or parsed for decisions. Rendering lives in engine projections, so the same state always produces the same bytes, and a skill can't "improve" a dashboard on the fly.

**New work routes into [discovery](discovery.md).** A menu pick pre-seeds the work type (`f` means feature); `s` pre-seeds nothing. Discovery shapes the work in conversation, and at the confirm trigger one engine transaction creates the work unit: manifest, imports, seeds, session log, commit. Until that moment nothing exists on disk.

**Phases hand off through the bridge.** When a phase concludes, it does not roll into the next phase in the same conversation.

### The bridge

`workflow-bridge` exists because context is a consumable. A phase's conversation fills the window with detail the next phase doesn't need, so each phase concludes by entering plan mode with a deterministic continuation:

1. The bridge computes `next_phase` from manifest state (for discovery handoffs the destination is supplied, since the first phase has no prior state to derive from).
2. It writes a plan file naming the exact next invocation, e.g. `/workflow-discussion-entry feature auth-flow`, and presents it for approval via plan mode.
3. The user clears context. The fresh session invokes the phase entry skill with `work_type` and `work_unit` as arguments, skipping all discovery.

The handoff survives compaction because it lives in the plan file and the manifest, not in conversation memory. The bridge also carries the between-phase choices: revisiting a completed earlier phase, and, after implementation, `d`/done to complete without review. For epics there is no single next phase, so the epic continuation shows the dashboard and lets the user choose; the plan-mode content is deterministic once they have.

**Phase entry skills are deliberately thin.** They receive positional arguments (`$0` = work_type, `$1` = work_unit, `$2` = topic, resolved as `$2 || ($1 unless epic)`), check the manifest for new-vs-resume-vs-reopen, gather the seed context, and invoke the processing skill. The context they gather comes from the **durable carrier**, not from re-asking: for single-phase work, the manifest `description` plus the discovery session log's Exploration section; for an epic topic shaped on the map, the topic's [discovery brief](discovery.md#the-harvest). The intake never engages the subject matter: "your role is preparation, not processing."

### The epic dashboard

`/workflow-continue-epic` renders the whole epic from one gateway snapshot, here immediately after discovery synthesised three topics:

```
●───────────────────────────────────────────────●
  Venue Ordering
●───────────────────────────────────────────────●

── DISCOVERY ────────────────────────────────────

  RESEARCH & DISCUSSION (3 topics · 3 fresh)
  ├─ ○ Kitchen Routing [fresh · routed to research]
  │     Ticket routing and printer integration options
  ├─ ○ Qr Ordering Flow [fresh · routed to discussion]
  │     Diner-facing QR ordering journey
  └─ ○ Operator Dashboard [fresh · routed to discussion]
        Live operational view for venue staff
```

with a menu whose ACTIONS table already carries the routing decisions:

```
1  start_research    kitchen-routing   → /workflow-research-entry epic venue-ordering kitchen-routing  (recommended)
2  start_discussion  qr-ordering-flow  → /workflow-discussion-entry epic venue-ordering qr-ordering-flow
```

The `(recommended)` marker follows the map's sequencing; `(blocked: …)` markers surface cross-topic task dependencies from planning. Before the dashboard renders, the continue skill runs its housekeeping pipeline: legacy backfill checks, the [self-healing topic analyses](research-and-discussion.md#self-healing-the-map) (research-analysis and gap-analysis, which can add newly-surfaced topics to the map), and map sequencing. As phases accumulate items, the dashboard grows stage dividers (Discovery, Definition, Delivery) with each topic's tree under the phase it currently occupies.

## Where everything lives

```
.workflows/
├── manifest.json                    # work-unit registry + project defaults
├── .inbox/{ideas,bugs,quickfixes}/  # pre-pipeline capture
├── .knowledge/                      # knowledge store
├── .state/                          # migration log, environment setup
├── .cache/{wu}/{phase}/{topic}/     # scratch files, fix-tracking, staged logs
└── {work_unit}/
    ├── manifest.json                # all state for this work unit
    ├── seeds/                       # promoted inbox items — the work's origin
    ├── imports/                     # user-shared reference files
    ├── discovery/sessions/          # session logs; briefs/ for per-topic views
    ├── research/{topic}.md
    ├── discussion/{topic}.md
    ├── investigation/{topic}.md
    ├── specification/{topic}/specification.md
    ├── planning/{topic}/planning.md
    ├── implementation/{topic}/
    └── review/{topic}/report.md
```

Every artifact is markdown in your repo, versioned with your code. Commits happen at natural breaks with conventional messages (`discovery(venue-ordering): synthesise 3 new topic(s)`), so `git log` doubles as the workflow's journal. The context-refresh recovery protocol in every skill leans on exactly that: re-read the skill, read the files, check `git log`, announce your position. Files on disk and git history are authoritative; recollection is not.

---

*Next: the phases in order, starting with [discovery](discovery.md), or jump to the [engine](engine.md) that underpins all of it.*

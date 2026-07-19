# Discovery

Every piece of work — a two-line config tweak or a six-month platform rebuild — enters through the same door. Discovery shapes what the user is bringing, settles what kind of work it is, persists it in one transaction, and routes it into the right pipeline.

It runs in two modes:

- **New mode** — invoked from [`workflow-start`](how-it-fits-together.md). Nothing exists yet. Decide the work type, shape the outline, create the work unit, route to the first phase.
- **Existing-epic mode** — invoked from the epic dashboard. The work type is settled; this session re-shapes the epic's [discovery map](#the-discovery-map): new exploration threads, edits to existing topics, or resuming an interrupted sketch.

## Shaping new work

### The opener

Discovery opens by reading whatever the user already brought. Promoted [inbox items](inbox-and-capture.md) arrive as seeds — pre-captured thoughts that become this work unit's origin. The opener synthesises them into a one-line sketch and asks a targeted question; it never dumps them back verbatim. File imports are woven into the same opening line ("if you have notes or files, share the path(s)") — there is no standalone import gate, and the no-files path costs zero extra turns.

### Detecting the shape

A detection core (`workflow-discovery/references/detection-core.md`) governs the conversation. It resolves two levels simultaneously — the work type, and whether the work has one topic or many — but commits them in dependency order. The discriminator tree settles cheap, terminal shapes first:

1. **Something that worked is now failing** — specific symptoms, root cause unknown → bugfix.
2. **A small, known, mechanical change** — "bump the timeout", no behaviour debate → quick-fix.
3. **Otherwise, something to build or define**: a pattern or principle with nothing ship-able → cross-cutting; ship-able and coherent → feature; ship-able and the topics keep multiplying → epic.

Topic count is a macro discriminator, not a post-commit step — you cannot tell epic from feature without surfacing whether topics multiply, so by the time "epic" commits, the topic seeds are already on the table. The bucket names stay internal until the commit moment: the user hears "several distinct things — more than one feature in scope", not "epic".

The conversation carries three standing disciplines:

- **Tentative reads surface mid-loop**, soft and easy to redirect — never silently accumulated to a verdict.
- **Pivots stay live.** A pre-seeded type (the user picked `f`/feature from the menu) is a hint, never a lock; the same detection core watches for competing shapes ("this is shaping bigger than one feature") throughout.
- **Tangents scope down to the inbox.** A concern that doesn't fit the current shape gets offered to the [capture skills](inbox-and-capture.md) instead of creeping the scope — and the capture is committed immediately, so it survives even if the discovery session is abandoned.

While the type is being determined, the conversation shapes rather than resolves: mechanism, feasibility, and design decisions belong to the phase the work routes into. If the conversation tunnels into substance, discovery notes the thread for the right later phase and returns to shaping.

The commit move has three parts: state the read in plain terms, give the specific signals that drove it — concrete enough that the user can challenge a cue, not just accept or reject the whole — and render the confirm gate (`y`/yes · `o`/other · keep shaping).

### The confirm trigger — the durability boundary

Until the work type commits, everything is ephemeral. Nothing is on disk — no directory, no manifest, no log. The confirm trigger is the single persistence hinge, and it fires for every work type identically:

1. **Resolve the name** (collision-checked against existing work units).
2. **Author the session log** to a staging path — description, seeds, imports, and an Exploration section back-filled from the shaping conversation.
3. **One engine transaction**:

```bash
engine workunit create {work_unit} {work_type} --description "…" \
  --session-log-file {staged-log} [--import {path} …] [--seed {path} …]
```

The transaction creates the manifest, copies imports into `imports/`, moves inbox seeds into `seeds/`, installs the staged log verbatim as `discovery/sessions/session-001.md`, indexes seeds and imports into the [knowledge base](knowledge-base.md), and commits — validation completes before any mutation, so a missing import path fails the whole call with nothing created. The [engine](engine.md) owns the mechanics; the log content is model-authored — the engine never writes prose.

From here the pipeline branches. An epic continues into topic exploration in the same conversation. Feature and cross-cutting pick research or discussion at a one-question gate (research for open unknowns, discussion when the shape is clear and the open questions are trade-offs). Bugfix routes to investigation, quick-fix to scoping — no choice to make. Every type concludes through the [bridge](how-it-fits-together.md#the-bridge) into a clean context.

## Epic exploration — the session loop

For an epic, the shaping conversation deepens rather than restarts. The register is collaborative challenge — two senior engineers throwing an idea around, not an interviewer running a checklist:

- **Sparring, not mirroring.** Engage the shape: disagree, push on the weak point, offer a sharper framing. *"If the kitchen printer is the source of truth, the dashboard is just a cache — and that changes what happens when a venue drops offline. Buy that?"*
- **One thread at a time.** No rapid-fire question lists, no monologues. Each answer shapes the next move.
- **Topics are the output, never the agenda.** No inline decomposition ("I'm hearing X, Y, Z as topics") mid-loop. Topics fall out at the harvest, when the user pulls.
- **Conversational, not autonomous.** Substance and soft decisions are welcome; autonomous research runs are not — a background agent spins up only if the user asks.

The **Exploration** section of the session log is the running record: the ideas, objections, pivots, false paths with why they were dropped, soft decisions, answers to in-session questions. Prose, not transcript — layered forward at natural pauses, never summarised away. The log survives context compaction; conversation memory does not. Session logs are created lazily via `engine discovery-session open` on the first write, so a browse-only session leaves no file, no marker, no commit.

Discovery makes real decisions and records them plainly — no hedging. They are soft not because of wording but because of **where they live**: firmness is conferred by position on the gradient — discovery (soft) → discussion (hardened) → specification (golden) → plan. The per-topic discussion still ratifies everything, so discovery explores substance freely without bypassing anything.

### The harvest

Convergence has proxies — the conversation circles back to covered ground, turns produce confirmation rather than new ground, the user's energy flags. When they show, discovery surfaces an ambient nudge woven into the turn; it never pushes synthesis. Only the user's pull ("that covers it", "let's wrap") triggers the harvest.

Synthesis cross-references three sources — the Exploration log (durable), conversation memory (richer but volatile), the existing map (the anchor) — then identifies **surfaces**: parts of the product with their own user interaction, decision space, and boundary. Granularity rules merge surfaces that share a domain or data model and resist splitting one surface into its implementation concerns — the map item is the unit of future research or discussion, not the unit of implementation. Routing is inferred per topic (research vs discussion) from how the user framed it, and the proposed set renders over the existing map for one confirmation gate: `y`/yes · `e`/explore · adjust (split, merge, rename, re-route, drop).

On confirm, brief synthesis runs while the whole exploration is still in context. A **brief** (`discovery/briefs/{topic}.md`) is one topic's slice of the discovery record — soft decisions with reasoning, rejected paths with why, open questions. It is a projection, regenerated at every harvest that touches its topic, never a record. When a regenerated brief post-dates in-flight downstream work, the engine flags that work with `reconcile_needed` — a signal, never a rewrite. Soft can prompt re-examination; it can never overwrite hard.

Persistence closes the session: each confirmed topic lands via `engine discovery-map add`, the log's Topics Identified and Conclusion sections are written, and `engine discovery-session close` clears the active-session marker, indexes the finalised log into the knowledge base, and commits — one call covering everything the session left dirty.

## The discovery map

The map lives in the epic's manifest at `phases.discovery.items.{topic}` and drives auto-routing for research and discussion. Rendered live from the fixture:

```
── DISCOVERY ────────────────────────────────────

  RESEARCH & DISCUSSION (3 topics · 3 fresh)
  ├─ ○ Kitchen Routing [fresh · routed to research]
  │     Ticket routing and printer integration options
  ├─ ○ Qr Ordering Flow [fresh · routed to discussion]
  │     Diner-facing QR ordering journey
  └─ ○ Operator Dashboard [fresh · routed to discussion]
        Live operational view for venue staff
```

Map items carry `routing`, `summary`, `description`, a suggested execution `order`, a `brief_path`, and a `source` provenance field recording how the topic arrived: `discovery` (user-surfaced), `research-analysis`, `gap-analysis`, `research-split:{parent}`, `discussion-elevation:{parent}`, `direct-start`, `migration-seeded`, `legacy-split:{parent}`, or `reroute:{origin}`. Multi-source items comma-accumulate.

Deliberately, a map item has **no status field**. Lifecycle — `fresh`, `researching`, `ready for discussion`, `discussing`, `decided`, `handled`, `cancelled` — is computed at render time by joining the map item against the per-phase items that actually exist. State that can be derived is never stored.

### Editing the map

A populated-map session takes edits conversationally — *"remove X"*, *"rename X to Y"*, *"re-route Y to discussion"*, *"edit the summary of Z"*, *"mark X handled"*. Operations group by destructiveness: contiguous summary/description edits batch into one gate and one commit; each remove, rename, or re-route stands alone. The engine enforces the lifecycle gates, so prose pre-validation and the write path can never disagree:

- **Remove, rename, re-route** require a `fresh` item — one with no research or discussion work. Once phase work exists, the map item is that work's historical anchor and is preserved. The refusal names the block and the recovery path: `"kitchen-routing" can't be removed — research is in flight on it; cancel from the epic menu instead.`
- **Removal is not deletion into the void.** The name lands on a dismissed list so the self-healing analyses won't auto-re-add the topic. Any session can say "show dismissed"; re-adding a dismissed name requires the user's explicit confirmation, carried to the engine as `--force-dismissed`.
- **Handled** marks a topic whose substance fanned out into differently-named discussions — visible on the map, out of the actionable set, reversible via unhandle.

## Resuming

The `active_session` manifest marker is the authoritative in-progress signal — set at the log's first write, cleared at session close. On the next epic entry, resume detection offers `c`/continue (the on-disk log becomes the working state, and a continuity pass briefs across prior session logs) or `r`/restart (discard the interrupted log; map edits already applied stay applied). After context compaction mid-session, the protocol is explicit: re-read the skill, determine from disk whether the confirm trigger fired, check `git status` and recent commits, and announce the recovered position before continuing — files and git history are authoritative, recollection is not.

---

*Next: where a routed topic goes first — [research and discussion](research-and-discussion.md).*

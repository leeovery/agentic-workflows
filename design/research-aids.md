# Research Aids — what helps research, and what only audits it

Research feeds discussion. It answers what the seed, the brief, the user, and the conversation set out to learn, and it moves on. It is not meant to be comprehensive — a hole in the record is discussion's to find, and discussion's review is the instrument that finds it. Research carries **aids**: things that help the researching itself. Nothing in the phase audits the record. Opened 2026-09-11.

## Motivation

- **A reviewer pointed at the wrong phase.** The research review agent reads the document with a clean slate and reports gaps — the discussion review's instrument, run over material that is deliberately partial. Its second and later reads on a topic return bookkeeping (superseded figures unmarked, stale labels) or scope expansion (eleven "you didn't look at X" findings, none taken up). The one read that produced real work — twelve of fifteen findings engaged — did so by naming threads the session then dug, which is the deep dive's job.
- **The loop churns where discussion is quiet.** Discussion's background review arms on map movement and settles triage folds into the arming anchor; research's checklist ticks on any meaningful commit, so a drain-only sitting dispatches a review, and the close dispatches another over the same ground without asking. Fumi's `space-homing` conclusion did both in one sitting (session 99574fb8).
- **Measurement has its own phase now.** Fumi's research measured because nothing else could; the experiment phase is the shape for a number a decision rests on. A research aid never runs the probe.

## Rulings

- **R1 — No review in research.** No review agent, no trigger checklist, no closing final review. The research phase's agent store holds `deep-dive` rows only; `agent dispatch --kind review` is refused in research. Discussion is untouched: its review, arming gate, closing gates, and the requeue back to research stay exactly as they are.
- **R2 — The deep dive is the learning instrument.** A dive answers a brief. Its report folds into the research file as dated, sourced material and the user hears what came back; nothing it returns is a finding to walk, accept, or dismiss. What a dive surfaces that wants a decision or more digging is written as a thread for discussion to pick up, never asked in the room.
- **R3 — The return follows the brief.** A brief that asks questions gets its answers in conversation, in full — they are what was asked. A survey, read, or landscape brief gets a digest: what was asked, what came back, what it opened. In both cases the material folds and the opened questions become threads. The digest is the floor, not the ceiling.
- **R4 — A dive never measures.** Kinds: **survey** (how do N implementations do X), **read** (a source, import, or document against the thread's questions), **feasibility** (can the platform do X, from its documentation and code), **landscape** (what exists, what it costs, where the gaps are), **verify** (a claim, against sources — never by running it). Where the answer is a number a decision would rest on, the dive reports the measurement it would take under Opened, and the session makes the laboratory offer the experiment phase already provides.
- **R5 — The thread register is a lens, not a plan.** A manifest-backed list of what the topic set out to learn. A thread enters from the seed, the brief, the user, the conversation, or a dive's opened list — never from an auditor. Threads reframe, split, merge, and park freely; a result that reshapes its question is the normal case. States are descriptive — `open`, `digging`, `learned`, `parked` — and nothing gates on any of them. The register is rendered at transitions, never every exchange, and the conclusion renders it as the hand-off.
- **R6 — Open is a fine way to conclude.** The conclude gate shows the register and asks the same question it asks today. Open and parked threads land in the research file's Open Threads, which discussion reads in full. No thread state blocks the close.
- **R7 — The in-loop dispatch check goes.** The session loop commits after each write and evaluates nothing at the commit. Deep dives are offered where the conversation reaches a question neither party can answer from the room — the session's judgment, at the moment, with the register as its anchor.
- **R8 — Shared is what two skills load.** A reference research stops loading and discussion alone still loads moves into discussion's references. The surfacing protocol and its dependents become discussion-owned; the phase-agnostic references research still shares (triage landing, rerouted concerns, experiment spawn, compliance, closing recap) stay shared.
- **R9 — Legacy rows are tolerated, never migrated.** The agent store is cache — ephemeral, gitignored. A research `review` row from before this design reads as closed and is never surfaced; no migration touches the cache. `dismissed_grounds` on a research item is not schema-pinned and stays where it is, unread.

## The thread register

**Storage** — `phases.research.items.{topic}.threads`, an object keyed by kebab slug, mirroring the Discussion Map's `subtopics`:

```json
{
  "space-identity": { "question": "Does a Space identify a home alone, or is home a display+Space pair?", "status": "learned", "origin": "seed", "parent": null },
  "placement-routes": { "question": "Which routes place a window on a non-active Space?", "status": "learned", "origin": "brief", "parent": "space-identity" },
  "launch-placement": { "question": "How do Chrome and Rectangle place a window at launch?", "status": "digging", "origin": "deep-dive-001", "parent": null },
  "cold-login": { "question": "Cold-login placement", "status": "parked", "origin": "conversation", "parent": null, "note": "needs a machine cycle; laboratory candidate" }
}
```

- `question` — the thread as asked, a sentence. Reframing rewrites it in place; the file carries the history.
- `status` — `open` | `digging` | `learned` | `parked`. Any state to any state is legal.
- `origin` — `seed` | `brief` | `user` | `conversation` | a deep-dive id (`deep-dive-NNN`) | a topic name (a concern rerouted in). Recorded at add, never rewritten.
- `parent` — a top-level slug or `null`; two levels, like the map. A split adds children under the thread that bent.
- `note` — optional, one line; the reason a thread is parked.

**Verbs** — `domain/research-threads.cjs`, one transaction each under the work-unit manifest lock, no commit (the session's cadence commit carries the change):

```
engine research-threads add <wu> <topic> <slug> --question <text> --origin <origin> [--parent <slug>]
engine research-threads set <wu> <topic> <slug> <state> [--note <text>]
engine research-threads set <wu> <topic> <slug>=<state> [<slug>=<state> …]
engine research-threads reframe <wu> <topic> <slug> --question <text>
engine research-threads remove <wu> <topic> <slug>
```

`remove` is the merge's mechanical half: the survivor's file section carries the folded substance, the absorbed row goes. `--note` is legal with `parked` alone. `add` refuses a slug already present and a parent that is itself a child.

**Display** — `engine render research-threads <wu>.research.<topic>`, one `DISPLAY: research threads` section, a plain code block: the kernel tree under a `treeHeader`, glyph column from the item-state family (`○` open · `◐` digging · `●` learned · `◌` parked, a `RESEARCH_GLYPH` table beside `DISCUSSION_GLYPH` in `conventions.cjs`), the question as the row title, the origin as the right-aligned `[term]` column, a parked row's note as a `↳` line beneath it. Rows rank live first — `digging`, `open` — then `learned`, then `parked`; insertion order within a rank; children sort by the same rule under their parent. The header breakdown lists every non-zero category in rank order and is omitted when only one is present.

```
Research Threads — Space Homing (4 threads — 1 digging · 2 learned · 1 parked)
├─ ◐ How do Chrome and Rectangle place a window at launch?                 [deep-dive-001]
├─ ● Does a Space identify a home alone, or is home a display+Space pair?  [seed]
│  └─ ● Which routes place a window on a non-active Space?                 [brief]
└─ ◌ Cold-login placement                                                  [conversation]
     ↳ needs a machine cycle; laboratory candidate
```

**Emission points** — the initialisation after the seed and brief threads land; a natural break where a thread changed state since the last render; a dive's fold; the resume; the conclude gate, where `render research-conclude-gate` prepends the display section above its menu whenever the register is non-empty. Never after every exchange, never twice for one state.

## The deep dive

**Offer** — where the conversation reaches a question neither party can answer from the room and the answer is worth more than a lookup. The register is the anchor: the offer names the thread, adding it first when the question is new. The user's own ask skips the offer.

**Brief** — self-contained: the thread's question and why it matters, the kind (R4), the questions to answer where the brief carries any, what is already known, the boundaries, and the standing rule that nothing is measured.

**Dispatch** — `agent dispatch … --kind deep-dive --label {slug}`; the thread goes `digging`. Concurrency as today (three to four in flight).

**Report contract** — pure markdown, no frontmatter, `.txt`-then-rename:

```markdown
# Deep Dive: {question}

## Brief
{what was investigated and why — one paragraph}

## Answers
### A1: {question from the brief}
{the answer, sourced; or "Not answered — {why}"}

## Material
{facts organised for someone who wasn't there; sources inline}

## Opened
- {a question the investigation raised, one line each}
- {a number a decision would rest on — named as the measurement it would take}

## Limitations
{what could not be verified}

## Sources
- {URL or source — description}
```

`## Answers` is present only when the brief asked questions; `## Opened` may be empty. Status block: `STATUS: complete · THREAD: {slug} · ANSWERED: {n} of {m} · OPENED: {k} · SUMMARY: {one sentence}`.

**Fold** — on landing (a natural break, the in-flight gate, or the resume), one transaction of judgment:

1. Read the report in full.
2. Write a section into the research file — `## {question} — deep-dive-NNN, {date}` — Answers first, then Material, sources kept inline. Commit with the dive's id in the subject (`research({wu}/{topic}): fold launch placement (deep-dive-001)`).
3. `research-threads set {slug} learned`.
4. For each Opened line: a question this topic will carry becomes a thread (`add`, origin the dive's id, parent the folded thread); one already covered or belonging elsewhere is folded as a note in the section instead. A measurement line becomes a thread the same way — what the measurement would settle — and is the laboratory's cue: the session makes the experiment offer now, or at the next natural break when the fold ends on a question.
5. Speak to the user: the Answers in full when the brief asked questions — every answer's substance whole, told at product altitude, never the report's code pasted; otherwise a digest of what was asked, what came back in three to five lines, and what it opened. A question only the user can answer — their environment, their intent — is asked here, once, with the session's lean beside it.
6. Render the register.

The report is never pasted into the conversation. No announce menu, no lanes, no not-now, no dismissal — a dive returns what was asked for.

## The session

**Initialisation** seeds the register: the seed material's and the brief's questions as threads (origins `seed`, `brief`), judged — a question discovery already settled is inherited ground, not a thread.

**The loop** — engage, explore, synthesise, document, commit. A thread enters when the conversation opens a question worth carrying (origin `user` or `conversation`); a thread reframes when its answer reshapes it; a thread parks when the user sets it aside, with the reason. The deep-dive offer rides the moment the register makes visible. At natural breaks the session checks for landed dives and folds them.

**The close** — triage queue → waits → in-flight dives (wait or proceed, as today) → document review → compliance → the register rendered above the conclude gate. The conclusion writes open and parked threads into the file's Open Threads. No review, no movement judgment, no decline to remember.

## Implementation plan

Design doc standalone; the stack is five slices, each one agent, each reviewed against the tree before the next opens.

- **PR1 — engine: the strip.** `agent-state.cjs`: research kinds `deep-dive` only, `--kind review` refused in research, scan reads a legacy research `review` row as closed and never buckets it into `pending`/`in_flight`; `latestReview` and `review-findings-gate` narrow to discussion; `in-flight-agents-gate` and `finding-announce` untouched. Tests: `test-engine-agent-state.cjs` (research review dispatch cases become refusals; a legacy-row tolerance case), `test-engine-render-surfaces.cjs` (the findings gate on a research address throws), `test-pipeline-simulation.cjs` (research review legs re-pinned as refusals; surfacing legs move to discussion). `references/commands.md`, engine `SKILL.md`, `engine.cjs` usage.
- **PR2 — engine: the register.** `domain/research-threads.cjs` + `projections/research-threads.cjs`, `RESEARCH_GLYPH` in `conventions.cjs`, the five verbs in `engine.cjs`, `render research-threads`, the conclude gate's prepended display, the schema's research item `threads` shape in `kernel/manifest-schema.cjs`. Tests: a `test-engine-research-threads.cjs` suite (add/set/reframe/remove, batch set, refusals, ranking, two-level nesting, breakdown omission, note rendering, width pin), render-surface tests, simulation legs through every verb on the research mainline. `commands.md` and the engine `SKILL.md`.
- **PR3 — the research prose.** Delete `review-agent.md`, `final-review.md`, `agents/workflow-research-review.md`. Rewrite `deep-dive-agent.md` (offer, brief, dispatch, fold — no Lanes, no surfacing delegation) and `agents/workflow-research-deep-dive.md` (kinds, the no-measurement rule, the report contract). Edit `session-loop.md` (step 1 deep-dive check only, step 6 commit only, dismissed-grounds paragraph gone, thread moves in the loop), `epic-session.md` and `feature-session.md` (no review load, in-flight wording), `initialize-research.md` (seed the register), `topic-completion.md` (no final review; render the register before the gate), `conclude-research.md` (Open Threads from the register), `template.md`, `research-guidelines.md`, the research `document-review.md` where it names the review, `SKILL.md`. `rerouted-concerns.md`'s research branch loses its dispatch-check clause. Cases: retire `research-review-walks-the-lanes`, `research-review-corrects-a-false-claim`, `research-review-routes-to-new-topic`; re-fixture or retire `research-raises-a-code-shaped-finding` by what it walks; `research-dead-ends-at-conclusion`'s file list drops the deleted references. `CLAUDE.md` phase 2 and the skill-architecture paragraph; `docs/research-and-discussion.md` ("Two kinds of review" becomes research's aids and discussion's review), `docs/agents.md`, `README.md` where it names the reviewer.
- **PR4 — shared references re-homed.** `final-review-menu.md`, `background-agent-surfacing.md`, `natural-breaks.md`, `composing-a-raise.md`, and `making-it-land.md` where measurement shows discussion alone loads it, move into `workflow-discussion-process/references/`; every loader path updated; `agent_type` narrows to `review` | `synthesis`; attribution lines take the single-parent form; every prose case `files` list naming a moved file updated. A reference another skill still loads stays shared.
- **PR5 — cases.** `research-deep-dive-answers-the-brief` (a question brief: answers surface in full, the section folds, the thread goes learned), `research-threads-bend` (reframe, split, park through a session; the register renders at transitions only), `research-concludes-with-open-threads` (the conclude gate carries the register; open and parked land in Open Threads; no review dispatched). Snapshots regenerated with `node tests/prose/run.cjs snap`.

Design docs rewritten in place with this one: `review-maturity.md` (research no longer a review host), `review-cadence.md` (C6 resolves — research has no reviews), `review-finding-lanes.md` (research lanes gone), `concurrent-discussions.md` where it names research reviews.

## Log

- 2026-09-12 — Stack #1135 open: #1133 engine strip, #1134 register, #1136 research prose, #1137 shared references re-homed, plus the three cases. Fold step 4 gains the measurement thread (a fold that ends on a question kept no durable cue) and step 5 says in full at product altitude, never verbatim.
- 2026-09-11 — Opened from the Fumi `space-homing` conclusion. Rulings R1–R9 agreed in conversation; the register's flexibility ("research can thread and bend and move based on results") and the answers-in-full return (R3) are the user's own framing.

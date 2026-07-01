# Deep Discovery — Feature Overview & Planning Index

This directory is the **durable, committed plan** for the Deep Discovery feature. It is the source of truth for a fresh agent: read `00-overview.md` (this file) for the design and the orchestration model, then the relevant `pr-N-*.md` for the slice you're implementing. Nothing here depends on the chat session that produced it.

Files:
- `00-overview.md` — this file: design, glossary, scope, the 6-PR stack, cross-cutting constraints, orchestration model, research provenance.
- `pr-1-sessions-layout.md` … `pr-6-downstream.md` — one detailed, self-sufficient plan per PR.

---

## How this gets built — the orchestration model (read first)

This feature ships as a **stack of 6 dependent PRs**, planned and implemented **one at a time**, never all at once. The mechanism:

1. **Base branch (PR0).** `feat/deep-discovery-pr0-docs` (this branch) is off `main` and holds these planning docs. It is the **base of the stack**, opened as **PR0**. The docs ride through every PR branch and merge to `main` with the stack at the end. (The branch is `feat/deep-discovery-pr0-docs`; the docs **directory** is `deep-discovery/` — distinct, and the directory name does not change.)
2. **Branch & PR naming convention** — consistent so the set visibly groups and orders in any branch/PR list:
   - **Base/docs branch (PR0):** `feat/deep-discovery-pr0-docs` (off `main`) — holds these docs.
   - **PR branches:** `feat/deep-discovery-pr{N}-{slug}`.
   - **PR titles:** `Deep Discovery PR{N}: {Title}`.
   - **Prose shorthand:** PR0 … PR6.

   **Branch topology** (git base, not necessarily GitHub target):
   - `feat/deep-discovery-pr0-docs` (docs, PR0) → base `main`
   - `feat/deep-discovery-pr1-sessions-layout` → base PR0
   - `feat/deep-discovery-pr2-conversation` → base PR1
   - `feat/deep-discovery-pr3-reentry` → base PR2
   - `feat/deep-discovery-pr4-kb-indexing` → base PR3
   - `feat/deep-discovery-pr5-briefs` → base PR4
   - `feat/deep-discovery-pr6-downstream` → base PR5
3. **One PR per session, planned in plan mode.** For each PR, a session enters Claude Code **plan mode** and writes the executable plan for *that PR only* — reading its `pr-N-*.md` here as the substance, and adding the operational contract: branch name, base branch, what it builds on, the plan, verification, and the **hand-off**.
4. **Approve, do NOT merge.** When the user approves a PR, it is **not merged**. The stack stays open; it lands root-first at the very end (via the `pr-stacked` skill + `stack` CLI).
5. **Recursive hand-off (the key).** The last section of every PR's plan instructs the agent: once the user approves this PR, **confirm the approval and immediately plan the next PR** in plan mode (reading `deep-discovery/pr-{N+1}-*.md`) — same session, no merge, and **the agent never clears context itself**. The context clear belongs to the user: accepting the next plan triggers the harness's *clear-and-proceed*, which carries that plan into a fresh session that executes it. PR6's hand-off instead lands the whole stack. This makes each session self-propagating — no external driver needed.
6. **Landing.** After PR6 is approved, land the stack root-first (`feat/deep-discovery-pr0-docs` → PR1 → … → PR6), squash-merging into `main`. The planning docs merge through as the feature's record (strip the `deep-discovery/` directory in a final commit only if the user asks).

**Why per-PR plans, not one mega-plan:** a single document covering all six slices forces glossing. Each PR deserves its own full-depth plan. These committed docs hold that depth; the plan-mode pass per PR turns the relevant doc into an executable contract with the operational hand-off.

---

## Context — why this feature exists

Today, **epic** discovery is structurally shallow and closes down fast. It asks "what are the topics?" almost immediately, it **mirrors rather than challenges**, and it forbids substance ("don't tunnel in, no decisions, stay in your lane"). The eager *"ready to synthesise?"* STOP gate keeps pushing toward topic-splitting.

But for an epic — especially greenfield, or a rebuild of an existing system — you **cannot name topics before you've thought about the whole.** Topic decomposition is the *output* of understanding, not the input. The holistic, idea-level thinking currently has nowhere to live: discovery bans it, and per-topic research/discussion can't host it (no topics exist yet).

**Deep Discovery** widens epic discovery into an open-ended, challenging, exploratory phase where **topics are the OUTPUT, not the input** — synthesised on a **user-pulled "harvest,"** never Claude-pushed. The other work types (feature/bugfix/quick-fix/cross-cutting) keep the current thin shape-and-route path, behaviour unchanged.

The decisive insight (arrived at independently in two parallel design sessions): in a greenfield epic, topics are *separable*, so early siloing is tolerable; in a rebuild, the decisions are *mutually entangled* (data model ⇄ event sourcing ⇄ state machine ⇄ infra ⇄ every journey), so siloing early severs the coupling you need to reason across. The *coupling* of the problem sets how long discovery must stay holistic before topics decouple enough to silo. **One mechanism — user-pulled harvest — covers both; the project sets the tempo.**

---

## The design (the north star — settled; implement, do not redesign)

- **Two movements, one phase.** Discovery always opens with **determination** — a brief, universal conversation that settles *what kind of work this is* (epic / feature / bugfix / quick-fix / cross-cutting). "Shape it, don't dive into substance yet" applies **here**, to every type. Once settled, the pipeline branches: non-epic routes straight out to its linear pipeline (depth is its discussion / investigation / scoping phase's job); **epic** opens into **deep discovery** — the open-ended, substantive exploration this feature adds. Both movements live in one skill; nothing extra is bolted on for non-epic.
- **Polymorphism via progressive disclosure — never inline carve-outs.** One skill serves five types, so type-specific behaviour lives in **files loaded only on that type's path**, not in `if epic / else` conditionals inside shared, always-loaded files. The always-loaded backbone carries **no substance prohibition that is false for an epic**: stating "do not research / investigate / decide" up front is premature (the type isn't known yet) and contradicts deep discovery once it is. Determination owns the "shape, don't dive" discipline in its own references; the epic-only deep-discovery files own the open stance, stated positively. **Anti-pattern (do not):** an "except epic" exception bolted onto the backbone — it reads as "do not decide… but for an epic you may," the exact ambiguity this rule exists to kill.
- **Topics are the output.** Synthesis happens on a user-initiated **harvest**. Claude never pushes synthesis.
- **Stance (epic deep discovery).** The epic exploration stance is collaborative **challenge / sparring** — opinionated, willing to disagree and counter-frame, surface tensions, propose "what if" alternatives — **not** interrogation (rapid-fire questions) and **not** lecturing (monologue); one live thread at a time, like two senior engineers throwing an idea around. Substance is allowed: exploration, half-decisions, even spikes. It is **conversational by default — no automatic research or deep-dive**; spin up a background agent only if the user asks. This stance lives only in the epic-only file; non-epic never loads it.
- **Soft-by-location.** Discovery makes real decisions — and records them **plainly, as decisions**. They are soft not because of how they're worded but because of **where they live**: firmness is conferred by position on the gradient — **discovery (soft) → discussion (hardened via convergence) → spec (golden) → plan**. State this principle **once** in the skill; later phases infer it — a brief or log consumed by research/discussion, or surfaced from the knowledge base, is *already* soft by virtue of its origin. So **do not weave hedging language ("leaning…", "maybe…") through the record** — make the decision, word it naturally, let position carry the softness. Discovery explores substance freely; the per-topic discussion still ratifies, so nothing trustworthy is bypassed.
- **Harvest = user-pulled, via an arc-aware nudge.** Replace the eager STOP gate with an **ambient, non-blocking nudge** that surfaces only at the conversation's **convergence**. A design conversation has an arc: **diverge** (throw ideas, widen) → **tension** (conflicts/tradeoffs surface) → **converge** (things settle, decisions decouple). The nudge belongs at convergence; convergence **is** the "decoupled enough to silo" signal. The user can ignore it and keep talking. The nudge is **rare and unobtrusive** — a light aside ("say when you want to pull topics out of this — for now, let's keep going"), **never** a recurring "I'm hearing N topics — what now?" check-in that breaks the conversation's flow. Harvest is **non-terminal and re-enterable** — synthesise topics, then keep exploring or route into a topic.
- **Records vs views** (the architectural spine):
  - A **record** is append-only, immutable truth. The session **log** is a record.
  - A **view** is a recomputable projection *of* records. The **map** is a view (already edited freely). The KB index is a view. A per-topic **brief** is a view.
  - Append-only purity binds **records only**. Views regenerate freely — that is *not* rewriting history, because the log stays the source of truth. (This dissolves the append-only-vs-maintained-surface tension.)
- **The log (record).** Append-forward, a **constant running record of the conversation — not verbatim, but not summarised either; nothing of substance is lost.** Capture the whole journey: ideas, objections, pivots, the route taken, **false paths and failed designs**, the soft decisions reached, and the **answers to any research or investigation done in-session**. That journey — *including* what was rejected and why — is the provenance the downstream discussion inherits, so it re-opens intelligently instead of re-deriving. Lossiness defeats the point: if the detail of the discovery is lost, the session was wasted. You add depth by **layering down** the document, never by editing back.
- **Briefs (views — the handoff).** At harvest, synthesis extracts each topic's **brief** — its soft decisions + reasoning + rejected paths + open questions — **while the whole exploration is in context** (you pay the linking cost once, at the moment you have the full picture). The brief is the topic's **read-in-full** seed for its research/discussion. It is a *view*: regenerated at each harvest that touches the topic; never the source of truth (the log is).
  - Stored at `.workflows/{wu}/discovery/briefs/{topic}.md`, tracked by `brief_path` on the discovery item.
  - **Naming:** internally `brief`; downstream it is a *discovery brief*. **Do NOT reuse the word `seed`** — `seed` is the inbox-promoted origin of a *work unit*. The brief plays a parallel *role* (read-in-full origin for the next phase) but is a distinct concept: `brief : epic-topic :: seed : work-unit`.
- **Continuity.** Discovery is **one fluid, re-enterable process**, not discrete sessions. On re-entry, read **prior session logs** (not just the map): the map always, the most recent session(s) in full, older sessions one-line-indexed / pulled from KB on demand. Re-entry should feel like *resuming a conversation* ("last time we were circling X, you were leaning Y, Z was still open"), not reading a summary.
- **KB.** Index discovery session **logs** (records) under a new `discovery` phase as the full-fidelity fallback for later phases (and for sibling-epic cross-pollination). Topic = **work_unit** (a log spans many topics). Read-in-full applies to your *own* discovery; *other* epics' discovery is KB-sliced — the same read-in-full vs KB-slice principle the system already uses for seeds vs imports.
- **Propagation (flag, don't overwrite).** Late discovery knowledge regenerates briefs automatically (views). But downstream research/discussion artifacts are where soft became **hard** — so they are **flagged to reconcile** (`reconcile_needed`), **never overwritten**. Soft can prompt re-examination; it can never silently overwrite hard. In-flight downstream work re-reads the updated brief on its next session; concluded work gets the flag.
- **Handoff retrieval is curate + retrieve, never link.** Don't try to link a topic to where it's woven through the logs — that's the hard problem done backwards. Curate the slice at harvest (the brief) and let KB semantic retrieval find the long-tail across sessions. No manual keyword/line-number provenance for narrative; coarse session-level citation in the brief suffices. File/line provenance is only for *code* artifacts (future system-map docs).

### Scope

- **Deep mode is epic-only.** The decomposition problem — needing a holistic space before topics exist — is unique to epics. Feature/bugfix/quick-fix are born focused (topic = work unit); their "explore before committing" need is served by their existing **discussion** phase, not by discovery. Their discovery path stays the thin shape-and-route it is today.
- **But the `sessions/` path move (PR1) affects ALL work types** — four non-epic entry points read the discovery log at a hard path. The path changes for everyone; behaviour stays identical.
- **KB indexing is epic-only** (non-epic single-phase logs are thin shape-and-route — not indexed).

---

## Glossary

| Term | Meaning |
|---|---|
| **Discovery** | The universal first phase. Unchanged name. |
| **Deep discovery** | The widened, open-ended, challenging epic mode of discovery introduced by this feature. |
| **Exploration** | The activity inside deep discovery — holistic, substantive, challenging conversation. |
| **Surface** | A candidate region of the product named during exploration (not yet a topic). |
| **Harvest** | The user-pulled synthesis that turns exploration into topics + briefs. |
| **Topic** | A map item — the unit of future research/discussion. The *output* of harvest. |
| **Record** | Append-only immutable truth. The session log. |
| **View** | A recomputable projection of records. The map, the briefs, the KB index. |
| **Brief** (downstream: *discovery brief*) | A per-topic view extracted at harvest; the topic's read-in-full handoff. NOT a `seed`. |
| **Soft-by-location** | Discovery's decisions are provisional because of *where* they live; hardening is discussion's job. |

---

## The 6-PR stack

Dependency-ordered. Each links to its detailed doc.

| # | Branch | Base | Delivers | Doc |
|---|--------|------|----------|-----|
| PR0 | `feat/deep-discovery-pr0-docs` | `main` | These planning docs (feature plan + 6-PR stack + design-session transcript) — the design-log base of the stack. | this dir |
| PR1 | `feat/deep-discovery-pr1-sessions-layout` | PR0 | Move logs → `discovery/sessions/`; migration 045; touch all readers incl. 4 non-epic entry points. Pure mechanical. | `pr-1-sessions-layout.md` |
| PR2 | `feat/deep-discovery-pr2-conversation` | PR1 | Epic deep-discovery stance (challenge, substance, soft-by-location) via progressive disclosure — backbone carries no premature prohibition; arc-aware nudge replacing the eager gate; non-lossy running-record log. | `pr-2-conversation.md` |
| PR3 | `feat/deep-discovery-pr3-reentry` | PR2 | Re-entry reads prior logs (map + recent-in-full + older KB-on-demand). | `pr-3-reentry.md` |
| PR4 | `feat/deep-discovery-pr4-kb-indexing` | PR3 | Index discovery logs under a `discovery` phase; rewrite the `conclude-discovery` anti-pattern; bundle rebuild; tests. | `pr-4-kb-indexing.md` |
| PR5 | `feat/deep-discovery-pr5-briefs` | PR4 | Harvest → per-topic briefs (views); `brief_path`; merge/split/drop lifecycle; set downstream `reconcile_needed`. | `pr-5-briefs.md` |
| PR6 | `feat/deep-discovery-pr6-downstream` | PR5 | `read-brief-context.md`; research/discussion consume the brief; `brief_incorporated`; surface `reconcile_needed`. | `pr-6-downstream.md` |

**Dependency notes:** PR2 and PR4 both ultimately need only PR1, but the stack is linear, so PR4 bases on PR3. PR5 genuinely needs **PR3** (multi-session context to synthesise a complete brief) and **PR4** (KB fallback for late regen). PR6 needs PR5 (briefs must exist to be consumed).

---

## Cross-cutting constraints (apply to every PR)

- **CONVENTIONS.md is mandatory.** Read `CONVENTIONS.md` IN FULL before editing any `SKILL.md` or reference file. This has produced silently non-compliant skills when skipped. Core rules each PR must honour:
  - **Prose economy** — write as if the feature was always there: **no "(new)" / "formerly" / historical markers**, cut the WHY when the WHAT suffices, but keep every instruction/path/distinction the agent needs.
  - **Display tiers & rendering** — every *user-facing* fenced block is preceded by `> *Output the next fenced block as a code block:*` (or the markdown variant). Model-instruction blocks (bash, paths) are exempt.
  - **Markers** — phase title (bullet box), step `── Name ──`, sub-step `·· Name ··`; signpost blockquotes (every line `>`-prefixed).
  - **STOP gates** — exact `**STOP.**`. The arc nudge must be genuinely **non-blocking** — *removing* the eager STOP, not renaming it. Reconcile with the "don't invent stops" / ZERO OUTPUT rules (`SKILL.md` Instructions block).
  - **Structure** — H1 title, H2 steps, H4 `#### If` conditionals; `→ Proceed` / `→ Return` / `→ Load` arrows only.
  - **Reference files** — header `*Reference for **[parent](../SKILL.md)***` + `---`; single-exit ends `→ Return to caller.`; name by purpose.
- **Extract, don't inline.** New logic goes into **new reference files** (`harvest-nudge.md`, `continuity-load.md`, `brief-synthesis.md`, `read-brief-context.md`). This is both a convention and the chief mitigation for stack rebase pain: edits to delicate shared files (`session-loop.md`, `SKILL.md`) shrink to single `→ Load` directive swaps.
- **KB bundle.** Any `src/knowledge/` change requires `npm run build` to regenerate `skills/workflow-knowledge/scripts/knowledge.cjs`, committed **in the same PR** (AGNTC installs the bundle; there is no build step at install).
- **Manifest fields** (`brief_path`, `brief_incorporated`, `reconcile_needed`) are **opaque** — set via dot-path `set`; no schema validation; do not modify the `create-discovery-topic` builder (`manifest.cjs:849`). Migration scripts must read/write `manifest.json` directly with `node`/`jq`, never the manifest CLI; bash 3.2; idempotent.
- **Testing.** Never run against the user's real `.workflows/`. Copy a fixture work unit to the scratchpad and exercise there. Conversation behaviour is verified in the **engine sandbox** (Mint copy) — TUI paste clips lines, so use screenshots / raw bytes as fidelity evidence. Run the **full test suite** before landing each slice.

---

## Research provenance (verified integration points)

Gathered by diligent exploration of the actual code (3 Explore agents + 1 Plan validation agent). Per-PR docs cite the specific seams; the load-bearing facts:

- **Discovery skill** `skills/workflow-discovery/`: log template `references/template.md` (path ~line 6; lazy-creation ~85–95; Exploration = strong-summary prose ~51–56). Eager STOP gate: `references/session-loop.md` §C (~185–233). Endpoint detection: `references/discovery-guidelines.md` §C (~45–54). Synthesis: `references/topic-synthesis.md` (A–E); persistence `references/confirm-and-persist.md` (calls `manifest.cjs create-discovery-topic`). "Mirror, not challenge": `discovery-guidelines.md` §B ~line 41. "Stay in your lane / no decisions": `SKILL.md` ~30–31, hard rules `discovery-guidelines.md` §D ~56–63. Map item fields: `phases.discovery.items.{topic}` = {status, routing, source, summary?, description?, handled?, order?}; lifecycle computed in `scripts/discovery.cjs` via `workflow-shared/scripts/discovery-utils.cjs`. Re-entry: `references/resume-detection.md` reads `active_session`; `session-loop.md` §A resume branch reads ONLY the active log.
- **Non-epic readers of the log path (PR1 must touch):** `workflow-research-entry/SKILL.md:165`, `workflow-discussion-entry/SKILL.md:147`, `workflow-investigation-entry/SKILL.md:122`, `workflow-scoping-entry/references/invoke-skill.md:21`.
- **Downstream seeding:** `workflow-research-entry/SKILL.md` Step 4 (epic) reads `manifest.cjs get {wu}.discovery.{topic} description`; `workflow-discussion-entry/SKILL.md` Step 3 same. Process skills load `references/initialize-research.md` / `initialize-discussion.md`, which load shared `workflow-shared/references/seed-context.md` (reads `manifest.seeds[]`). New `read-brief-context.md` is the sibling for brief consumption.
- **KB** `src/knowledge/index.js`: `INDEXED_PHASES` ~line 22 = ['research','discussion','investigation','specification','imports','seeds','analysis']; `deriveIdentity()` ~260–381 path-parses identity, phase regex enum ~line 296; per-phase chunk config loaded by name at ~497, `fs.existsSync` guard at ~498 **throws** if absent. Bundle build `build/knowledge.build.js` via `npm run build`. Tests `tests/scripts/test-knowledge-*`.
- **Migration:** next id is **045** (last on disk `044-allow-workflows-mv.sh`). Test harness pattern in `tests/scripts/test-migration-*.sh`.
- **Key corrections caught in validation:** (a) migration id is 045 not 046; (b) the path move is NOT epic-only — 4 non-epic readers; (c) `references/conclude-discovery.md:9–12` **actively forbids** `knowledge index` ("session logs are journey records, not retrievable") — PR4 must **rewrite** this, not append; (d) `chunking/discovery.json` is **mandatory** or the indexer throws; (e) `map-operations.md` has no merge/split — merge/split/drop happen at synthesis (`topic-synthesis.md` §E), so brief lifecycle is a synthesis-time concern (PR5); (f) work-unit cancel already cascades `knowledge remove --work-unit` across all phases — covers a new `discovery` phase for free (add a test); (g) `brief_path` is set via a post-create `set`, not a builder change.

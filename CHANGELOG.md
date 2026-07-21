# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.3] - 2026-07-21

🔧 Changed

- Investigation resumes now skip the symptom interview and recon pass when a plan already exists, re-rendering the agreed hypotheses board instead of starting over.
- Resuming an investigation plan asks to confirm or revise the existing hypotheses, depth, and trace lines rather than re-running recon from scratch.

## [0.6.2] - 2026-07-21

✨ Added
- Investigation now includes a collaborative fix-exploration phase — after root cause sign-off, the agent proposes fix options and discusses direction with you before an independent agent pressure-tests it for side effects and risks.
- Investigation gains an upfront planning step — a quick recon pass proposes hypotheses and a checkpoint depth (straight-through or check-ins) for you to confirm before deep tracing starts.
- A live hypothesis ledger tracks each suspected cause through `suspected` → `tracing` → `confirmed`/`ruled-out` as the investigation proceeds, with optional check-in gates when a hypothesis resolves.
- Findings now get a dedicated sign-off step, separated from the fix discussion that follows it.

🔧 Changed
- Step markers (the `── Name ──` headers) now appear only on steps with real user-facing activity — pure plumbing steps render silently, cutting visual noise from routing-heavy skills.
- Root cause validation is now a standalone agent focused solely on the root cause, run before findings sign-off — fix-direction risk assessment moved to the new dedicated fix-validation agent that runs after a direction is agreed.
- Step routing footers now distinguish "on return" hand-offs (after a loaded reference completes) from immediate next-step transitions, clarifying control flow across nearly every skill.

## [0.6.1] - 2026-07-20

✨ Added
- New docs pages: capture and the inbox, the collaboration model, investigation and scoping, lifecycle operations, and how the system stays reliable.
- Epic dashboard now offers discovery as a menu option in every state, including a resume prompt when a discovery session was left open mid-flight — no more dead-ending on a map-less epic.

🔧 Changed
- Documentation rewritten wholesale in a warmer, second-person voice aimed at the person using the system rather than the system's internals.
- The engine, agents, discovery, and other reference pages trade exhaustive technical detail for a narrative walkthrough of what each part does and why.
- `docs/timeline.md` merged into a shortened `docs/history.md`; `docs/inbox-and-capture.md`, `docs/lifecycle-tools.md`, and `docs/output-formats.md` split and folded into the new capture, lifecycle, and configuration pages.

🐛 Fixed
- A brand-new epic with no discovery map no longer shows a dead-end "No work started yet." message — it now points you at running discovery.
- The start-page work list no longer misreports a map-less, phase-less epic as ready for its first empty phase; it correctly shows it as still in discovery.

## [0.6.0] - 2026-07-20

✨ Added
- Added a full documentation site under `docs/`, covering the engine, the knowledge base, every phase, and all 23 agents.
- Knowledge base setup can now run non-interactively (`--from-system`, `--keyword-only`, `--provider`, `--key-only`) — `/workflow-start` can walk you through setup in chat instead of dropping to a terminal wizard.
- Discussion Map subtopics can now be marked `deferred` — a discussion can conclude with items explicitly set aside instead of forced to a decision.

🔧 Changed
- Replaced the manifest CLI and a scattered set of per-skill state scripts with a single deterministic engine — dashboards, maps, and menus now render consistently every time.
- Off-topic concerns raised mid-discussion now land in the target topic's queue instead of automatically spawning a new discussion.
- `/workflow-start` boots faster — migrations, the knowledge-base check, and store compaction now run as a single step.
- Feature-to-epic pivot, absorption, and specification promotion are now atomic engine transactions — an interruption can no longer leave things half-migrated.
- README trimmed to a quick pitch, with full detail moved into the new documentation site.

🗑️ Removed
- Removed the standalone `workflow-manifest` skill — its state management now lives in the workflow engine.

🐛 Fixed
- Fixed a crash when indexing files containing very long unbroken text runs, like base64 blobs or minified code.
- Fixed cross-cutting work units failing to enter the specification phase correctly.
- Fixed a race condition that could let two writers acquire the same workflow-state lock at once.
- Fixed a task's fix-attempt count sometimes leaking into a different task during implementation.
- Fixed review incorrectly flagging quick-fix tasks for missing acceptance criteria they were never meant to have.
- Fixed embedding-provider setup to catch model/dimension mismatches immediately instead of failing later mid-index.

🔒 Security
- Fixed upstream API error responses being able to leak bearer tokens into error messages — they're now redacted.
- Fixed indexed file content with terminal escape sequences being echoed unescaped into knowledge-base search output.
- API keys can no longer be passed as a command-line flag to knowledge base setup, closing off a path where they'd land in shell history.

## [0.5.13] - 2026-07-16

🔧 Changed
- Removed the now-dead `Write(.workflows/**)` permission rule that triggered a startup warning after Claude Code changed how file permission rules are matched.

## [0.5.12] - 2026-07-01

✨ Added

- Discovery now synthesizes a per-topic "brief" at harvest time — soft decisions, rejected paths, and open questions — read in full by that topic's research or discussion session so context carries forward instead of starting cold.
- Epic discovery conversations are now indexed into the knowledge base, so past discovery sessions are searchable alongside research and discussions.

🔧 Changed

- Discovery conversations go deeper — sparring, challenging framing, and working through real decisions — before topics are harvested, rather than lightly sketching a map.
- Resuming a discovery session now briefs you on the prior sessions' thinking, not just the current topic map.
- If a discovery brief is regenerated after downstream research or discussion has already started, that work is now flagged to reconcile against the new context instead of drifting silently.
- Simplified the README's getting-started flow and condensed the knowledge-base setup instructions.

🗑️ Removed

- The interactive Workflow Explorer visualization and its GitHub Pages deploy workflow.

## [0.5.11] - 2026-06-17

🔧 Changed

- The hand-rolled `release` script is replaced by `mint release` — the script now delegates entirely to the `mint` CLI.
- A `.mint.toml` configuration file is added to tune mint for this project — raises the diff limit to 60 000 lines, excludes the knowledge bundle and lockfile from AI diffs, and runs `npm ci && npm run build` before tagging to keep the shipped knowledge bundle fresh.

## [0.5.10] - 2026-06-11

✨ Added

- Sub-agents now write report-shaped files as `.txt` then rename to `.md` — works around the harness block on direct `.md` writes from background agents.
- New `Bash(mv .workflows/:*)` permission rule added automatically via migration 044, allowing sub-agents to perform the rename without triggering a permission prompt.

## [0.5.9] - 2026-06-11

✨ Added

- All background agents now carry a "never lose your work" durability guarantee — if a file write fails, agents quote the error verbatim rather than silently dropping output, with full content fallback as a last resort.

## [0.5.8] - 2026-06-10

🐛 Fixed

- Epics with one topic through review no longer appear as pipeline-complete when other topics are still mid-pipeline — completion now requires explicit status, not phase aggregation.
- The bridge's all-done check now validates the full set of conditions (no in-progress topics, no pending next phases, settled convergence state) rather than checking review status alone.

## [0.5.7] - 2026-06-10

🐛 Fixed

- A completed implementation now satisfies cross-topic dependencies even when the referenced task ID is absent or stale — prevents topics from being incorrectly blocked at the implementation gate.
- Dependency resolution for epic topics now reads from the current manifest instead of loading a separate manifest per dependency topic, fixing a broken lookup when dep topics live in the same work unit.

## [0.5.6] - 2026-06-10

✨ Added

- Proposed specification groupings — grouping analysis now persists results as `proposed` manifest items immediately, so pending specs appear in the epic tree, map, and menu without waiting for the user to start them.
- Epic menu now lists proposed groupings as numbered "Start specification" entries, ranks them ahead of planning in the recommendation, and gates planning with a soft warning when ungrouped specs remain.
- Completed specifications move to a `c`/`completed` submenu in the spec menu, keeping the primary list focused on actionable work.
- `b`/`back` replaces numbered Back options in all phase-revisit and submenu flows — consistent keyword navigation across every work type.

🔧 Changed

- `unaccounted_discussions` now means discussions not yet grouped into any spec item (proposed or started), rather than not yet in a created spec file.
- The `s`/`spec` epic command is relabelled "Analyze / regroup discussions" and remains available even when all discussions are grouped, enabling re-analysis or regrouping at any time.
- Specification items with status `proposed` are excluded from phase-completion and next-phase-ready aggregation, so a phase of only proposed items reads as not started.
- Planning's soft gate now fires when any specification items are in-progress or proposed, with updated copy reflecting the broader condition.
- Grouping analysis writes the checksum to the manifest last, after all reconcile mutations, so a mid-run crash leaves the cache stale rather than falsely valid.

## [0.5.5] - 2026-06-09

✨ Added

- Specification consult references — a sibling discussion that owes a correction to another spec can now be declared as a consult reference, read narrowly for just that slice, and tracked to completion without being extracted as a full source.
- Knowledge-base advisory query at specification entry surfaces candidate consult references across groupings before the user confirms inputs.
- Consult reference status (`pending`/`addressed`) is shown in the grouping and spec menus, and blocks spec sign-off until every owed correction is reconciled.

🔧 Changed

- Specification handoffs now include a `Consult references` block alongside sources, propagated through all four handoff paths (create, continue, continue-completed, create-with-incorporation); unify absorbs them wholesale and emits no separate block.
- Spec entry's `allowed-tools` now includes the knowledge CLI to support the new advisory query step.
- The KB usage rule for the specification phase is narrowed — the blanket "do not query" becomes "do not query while authoring," with a documented exception for the single intake-time advisory query.

## [0.5.4] - 2026-06-09

✨ Added

- New `create-discovery-topic` manifest CLI command — atomically spawns a topic onto an epic's discovery map and optionally seeds its initial phase item in a single write, eliminating the half-built-topic hazard of the previous multi-command sequence.
- New `## Triage` section in research and discussion artefact templates — a fixed landing zone where off-topic concerns rerouted from other topics accumulate until the target topic's next session drains them.
- Triage drain at session start — concerns rerouted into a topic are folded into its working content (Discussion Map subtopics or research threads) before the session loop runs, then the section resets to `(none)`.
- Conclusion gate blocks finishing a topic while its `## Triage` section is non-empty, ensuring no rerouted concern is silently abandoned.
- New `reroute` off-topic flow in research and discussion sessions — surfaces a menu when a concern belongs to a different topic, letting the user send it to an existing topic, a new topic, or the inbox instead of burying it in the wrong artefact.
- New `triage-landing.md` shared reference — classifies a target topic as new, fresh, or existing and writes the rerouted concern into its `## Triage` section, reopening a concluded target as needed.
- New `create-discovery-topic.md` shared reference — wraps name validation, dismissed-list clearing, and the atomic CLI call into a single reusable sequence for all interactive topic-spawn sites.
- New `pivot-to-epic.md` shared reference — extracts the feature→epic conversion core so off-topic pivot flows and the manage menu share one implementation.

🔧 Changed

- Topic-splitting and discussion elevation migrated onto `create-discovery-topic` — six previously scattered multi-command spawn sequences replaced with the atomic CLI call.
- `analysis-approval-gate.md` and `absorb-into-epic.md` updated to use `create-discovery-topic` for their discovery-item writes.
- `ensure-discovery-item.md` similarly consolidated to the atomic CLI call.
- `manage-work-unit.md` pivot now delegates to `pivot-to-epic.md` rather than inlining the conversion steps.
- Topic elevation (`elevate` verb, `↑ Elevated:` map markers) replaced by `reroute` — off-topic concerns are sent to a Triage section rather than spawning a sibling discussion mid-session.
- Discovery gap analysis drops the "elevated but uncreated" gap category, now that elevation no longer creates `↑ Elevated:` markers.
- `reroute:{origin}` added as a valid discovery-map provenance value, rendering as "from {origin}" in map displays.

## [0.5.3] - 2026-06-07

🔧 Changed

- Resume detection for research, discussion, investigation, and specification phases is now handled by a shared `resume-detection.md` reference — consistent continue/restart behaviour across all phases.
- Planning and review resume prompts now render as markdown with bold topic names, matching the style of other phases.
- Specification entry no longer resets gate mode on resume — the redundant manifest writes before loading the process skill have been removed.
- In-progress specification entry no longer offers a "start fresh" option — resuming an existing spec goes straight to continuing it.

## [0.5.2] - 2026-06-06

✨ Added

- Specification construction now supports an `a`/`auto` gate mode — approve the first topic and all remaining topics log automatically without further stops.

## [0.5.1] - 2026-06-06

🔧 Changed

- Absorbed features now have their `source` field explicitly set to `discovery` on the map item — prevents the value from being lost when summary-backfill runs next session.
- Feature-to-epic pivot registers the absorbed topic on the discovery map immediately, with routing derived from whether the feature had prior research.

## [0.5.0] - 2026-06-05

✨ Added

- Knowledge base chunks are now stamped with the source document's modification date rather than index time — query result headers show when the work was authored, not when the store was last built.
- Knowledge base decay now uses a progress clock instead of wall-clock time — context ages by how much work has completed since, so a dormant project keeps its context sharp indefinitely.
- Soft down-rank in query results: older context sinks in relevance as the project moves forward rather than being deleted, and specifications never decay.
- `compact` is now a storage backstop rather than a TTL sweep — it prunes only chunks whose retrievability has fallen below a configurable floor (`decay_prune_below`), replacing the old `decay_months` setting.
- Significance-weighted progress clock: quick-fixes, bugfixes, features, and epics each advance the clock at different rates, so trivial work doesn't over-age older context.

🔧 Changed

- `decay_months` config key replaced by `decay_prune_below` (a 0–1 retrievability floor) and `decay_base_stability` (controls decay speed in feature-equivalents).
- `compact --dry-run` output now reports retrievability threshold rather than a month count.
- Research-review agent boundary clarified in ideas backlog: flagging an unmade decision as a research gap is out of scope for that agent.

## [0.4.24] - 2026-06-04

✨ Added

- The epic dashboard now groups all phases under three stage dividers — DISCOVERY, DEFINITION, and DELIVERY — so the arc of an epic is clear at a glance.
- Knowledge base chunk timestamps now derive from the source document's modification time rather than index time, preventing bulk or fresh indexing from stamping every legacy document with today's date.
- `.claude/worktrees/` is now gitignored.

🔧 Changed

- Discovery map callouts (seed, imports, new arrivals) moved to sit between the stage divider and the topic header, and the convergence state is now encoded in the topic-count suffix rather than as a separate callout line.
- Phase headers in the epic dashboard are now uppercased (`SPECIFICATION`, `PLANNING`, etc.) and the tree indentation rules are unified across all branches of the display.
- The README documents the three-stage grouping (Discovery, Definition, Delivery) and how it maps to the phases.

## [0.4.23] - 2026-06-04

✨ Added

- New `⊙` (handled) tier for discovery map topics — marks a research umbrella that has fanned out into differently-named discussions as terminal, stopping it from prompting for a next action without removing it from the map as historical anchor.
- `mark handled` and `reactivate` map operations in discovery sessions — say "mark X handled" or "reactivate X" to toggle the marker, with confirmation gates and per-item commits.
- Analysis approval gate for research-analysis and gap-analysis — candidate topics are now staged for per-topic review before landing on the discovery map, with options to approve, skip, defer the whole batch, or auto-approve the remainder.
- Migration 043 backfills the handled marker on legacy migration-seeded research umbrellas and re-stamps missing analysis caches for epics that are past the planning phase, eliminating stale-nag re-fires on reopened epics.

🔧 Changed

- Convergence and sequencing logic now treat `handled` topics as terminal — they count toward "settled" state and are excluded from the needs-sequencing check, the same as cancelled.
- Discovery map tier breakdown and summary counters now include a `handled` bucket alongside decided, in-flight, ready, fresh, and cancelled.
- Analysis-approval-gate fan-out offer prompts to mark the parent research topic handled when research-analysis derives a candidate from it, so the umbrella stops prompting to be discussed.
- Sequence discovery map skips handled topics when building the execution order, the same as cancelled.

## [0.4.22] - 2026-06-03

✨ Added

- The release script now creates a GitHub Release automatically after pushing the tag — no manual `gh release create` step needed.
- A preflight check verifies the GitHub CLI is installed and authenticated before any mutation, so a missing or unauthenticated `gh` aborts loudly before any tag is created.
- Git operations during release now survive contended or stale lock files — the script waits out a live lock and removes a stale one rather than aborting mid-release.

## [0.4.21] - 2026-06-03

✨ Added

- Epic discovery maps now auto-sequence topics — when a new topic arrives without an execution order, Claude assigns a suggested numbered order across all live topics before display.
- Topic cancellation now clears the discovery map order so reactivation renumbers cleanly.

🔧 Changed

- Discovery map sort within a tier now follows suggested execution order instead of alphabetical — topics with no order assigned sort last.

## [0.4.20] - 2026-06-03

🔧 Changed

- Work-type confirmation gate now shows the plain read above the prompt box rather than inside it, and simplifies the gate to a static "Have I read this right?" question.

## [0.4.19] - 2026-06-03

🔧 Changed

- Discussion and research entry skills now correctly seed from the discovery map description for epic topics, and fall back to gathering context when the session log's Exploration is absent or the topic was started fresh via `direct-start`.

## [0.4.18] - 2026-06-03

✨ Added

- Background sub-agents can now write to `.workflows/` without triggering permission prompts — a new migration adds scoped allow-rules to `.claude/settings.json` automatically.

🔧 Changed

- The review task verifier agent no longer attempts to run the test suite — it judges test adequacy by reading test code only.

## [0.4.17] - 2026-06-03

🔧 Changed

- Inbox working set accepts natural-language commands in addition to shorthand keys — e.g. "add 2 and 4" or "drop the bug" routes directly without re-prompting.
- Named items in add/drop messages are resolved immediately against the working set, skipping the numbered picker when the reference is unambiguous.
- Single-item working sets no longer render a dangling `└─` connector — the branch prefix is omitted entirely for lone items.
- Mixed-type flag (`⚑`) now has consistent spacing above and below regardless of whether it renders.
- Summary sub-lines indent two columns past the title text to read as subordinate content rather than a peer.

## [0.4.16] - 2026-06-03

✨ Added

- Review findings now support a `[do-now]` category — zero-risk fixes (docs, wording, comment edits) can be applied immediately from the review menu without routing through the pipeline.
- New `d`/`do-now` review menu action applies all zero-risk fixes in place, runs linters and tests, and reverts any item that fails verification (demoting it to `[quickfix]`).
- Discovery map idea #31 captured — covers legacy `exploration` catch-all terminal state, analysis approval gating, and past-discovery suppression for mature epics.

🔧 Changed

- Review classifier now distinguishes `[do-now]` (zero-risk, no executable logic) from `[quickfix]` (mechanical but logic-touching), with concrete decision rules for each boundary call.
- Non-blocking notes must propose a concrete change to survive — pure observations with no action ("acceptable as-is", "worth confirming") are dropped before categorization.
- Recommendations in the review display now include `file:line` references and preserve sub-bullet detail so users can judge each item without opening the report.
- Review recommendations are clustered by target file or theme before numbering, collapsing related notes into one item with sub-bullets and source tags.
- Surfacing a `[do-now]` item to the inbox files it as a quick-fix, since the user chose to defer rather than apply it immediately.
- Review report template and produce-review logic updated to include `### Do now` as the first recommendations subsection.

## [0.4.15] - 2026-06-03

✨ Added

- Inbox working set — select one or more items of the same type to promote together into discovery as combined seed material.
- Archived inbox view — items can be archived out of the inbox, then restored or permanently deleted from a dedicated archived view in `/workflow-start`.
- Multi-seed discovery — promoting several inbox items at once passes all of them as seeds into the work unit, with a combined opening sketch and description-derived name suggestion.

🔧 Changed

- Inbox promotion is now single-type gated — archiving works across types, but starting work requires all selected items to share one type since different types route to different pipelines.
- Discovery's `$2` argument renamed from `inbox_seed` to `inbox_seeds` and now accepts a comma-joined list of paths, enabling multi-item promotion from a single working set.

## [0.4.14] - 2026-06-02

🔧 Changed

- All navigation skills renamed from `continue-{type}` to `workflow-continue-{type}` — skill names, script paths, internal references, and test files updated consistently across epic, feature, bugfix, quick-fix, and cross-cutting work types.

## [0.4.13] - 2026-06-02

✨ Added

- Discovery is now the universal first phase for every work type — `/workflow-start` routes all new work (feature, epic, bugfix, quick-fix, cross-cutting) through discovery, which shapes the work, confirms its type, and routes it into the pipeline.
- Promoted inbox items now become the work unit's **seed** — moved to `seeds/`, tracked in `manifest.seeds[]`, and KB-indexed under a new `seeds` phase so verbatim captured content travels with the work through every downstream phase.
- New `s`/`start` option in the `/workflow-start` menu starts work without knowing the type up front — discovery classifies it conversationally.
- Inbox ideas can now resolve to any work type (including bugfix and quick-fix) rather than only feature, epic, or cross-cutting.
- Knowledge base now indexes `seeds/` artifacts alongside research, discussion, and other phases.
- New `seed-context.md` shared reference lets research, discussion, investigation, and scoping processing skills read the work unit's seed as their opening context.

🔧 Changed

- `/workflow-start` is now the sole user-invocable entry point — `start-feature`, `start-epic`, `start-bugfix`, `start-quickfix`, and `start-cross-cutting` are removed; all new work flows through discovery.
- `continue-epic`, `continue-feature`, `continue-bugfix`, `continue-quickfix`, and `continue-cross-cutting` are now model-only (`user-invocable: false`) with trimmed Step 0 — migrations and knowledge-check run once at `/workflow-start`, not on every re-entry.
- `workflow-discovery-entry` and `workflow-discovery-process` are collapsed into a single `workflow-discovery` skill with two modes: new work (from `workflow-start`) and existing-epic map refinement (from `continue-epic`).
- The epic display now shows a "seeded from the inbox" callout when `seeds_count > 0`, and the imports callout wording changes from "imported seeds" to "imports".
- `continue-epic` delegates all conversational map-shaping to the discovery skill rather than implementing it internally.
- The `can_start_discussion` gating flag (which required completed research) is removed — discussion can now begin without prior research.
- First-phase entry skills (discussion, research, investigation, scoping) now read the discovery session log and manifest description as a durable seed carrier instead of re-gathering context from scratch.
- Feature absorption (`absorb-into-epic`) now moves the feature's seed alongside its discussion, research, and imports.
- The `workflow-bridge` discovery-continuation reference handles both epic (return to menu) and single-phase (hand off to first phase) in plan-mode so each starts in a clean context.

🗑️ Removed

- `skills/start-bugfix`, `skills/start-epic`, `skills/start-feature`, `skills/start-quickfix`, `skills/start-cross-cutting` — all five per-type start skills are deleted; their responsibilities are absorbed by `workflow-discovery` and `workflow-start`.
- `skills/workflow-discovery-entry` and `skills/workflow-discovery-process` — replaced by the unified `workflow-discovery` umbrella skill.
- The `latest_session` field from the discovery script output — callers read session logs directly; the field is no longer needed.
- The `import` source branch for research entry (`source = import` path in `research-gating.md`) — imports are now folded into the discovery opener universally.

## [0.4.12] - 2026-05-29

✨ Added

- New `openai-compatible` embedding provider supports any local or self-hosted OpenAI-compatible `/v1/embeddings` endpoint (LM Studio, Ollama, vLLM, LiteLLM) — the API key is optional for open servers.
- The `knowledge setup` wizard now presents a numbered provider menu and collects `base_url`, model, and dimensions for the `openai-compatible` path, with a test-embed validation and retry loop.
- Release script now writes a `CHANGELOG.md` entry (Keep a Changelog format) on every release, prepending the AI-generated bullet list above prior entries.

🔧 Changed

- Knowledge base wire logic extracted into a shared `OpenAIEmbeddingsEngine` so the cloud `OpenAIProvider` and the new `openai-compatible` driver share a single implementation — `openai-compatible` omits the `dimensions` request param and makes the API key optional.
- Release diff now excludes the minified knowledge bundle (`knowledge.cjs`), eliminating token budget waste from the generated file and raising the diff size limit to 60,000 lines.
- `resolveProvider` no longer silently degrades to keyword-only mode when `provider: openai-compatible` is configured but `base_url` is missing — it throws a clear configuration error instead.
- Setup toolkit refactored so each provider driver owns its own `SETUP_DESCRIPTOR` with a `collect()` function, making it possible to add new providers without touching the setup orchestrator.

## [0.4.11] - 2026-05-29

✨ Added

- Analysis cycle counter is now split into two fields — `analysis_cycle_total` tracks file naming monotonically across sessions while `analysis_cycle_session` resets on each resume, preventing findings files from being overwritten when re-entering implementation.

🔧 Changed

- Migration 041 upgrades existing manifests to the new two-counter model, inferring the true total from on-disk findings files when a prior completion had reset the stored value to zero.

## [0.4.10] - 2026-05-29

✨ Added

- Final review menu — a new shared `final-review-menu.md` reference presents a three-option review/skip prompt at phase conclusion, replacing the generic background-agent surfacing protocol with a dedicated end-of-phase interaction flow.

🔧 Changed

- Research and discussion final-review references now delegate to the new `final-review-menu.md` instead of loading the generic surfacing protocol directly — findings are still raised one at a time, but the menu wording is tailored to phase conclusion.
- The `acknowledged` state description is simplified: the "announce menu / user picked later" path is removed now that the dedicated menu handles that case explicitly.

## [0.4.9] - 2026-05-28

✨ Added

- The Discussion Map now renders as a structured tree with branch glyphs (`┌─` `├─` `└─` `│`), state glyphs per subtopic (`○` `◐` `→` `✓`), a header showing total subtopic count, and an optional state breakdown — giving a precise, scannable snapshot of discussion progress at a glance.

🔧 Changed

- Elevated subtopics are now marked with `↑ Elevated:` instead of `→ Elevated:`, preserving their original slot and branch position in the tree rather than appearing as a loose footer entry.
- Discussion file template updated to match the new structured map format, including inline state glyphs on state definitions and a connected tree example with elevation marker.

## [0.4.8] - 2026-05-28

🔧 Changed

- The first phase of an epic is now called **Discovery** instead of Inception — the name better reflects what the phase builds (the discovery map) and avoids the awkwardness of re-entering an "inception" phase in later sessions.
- A migration (`040-rename-inception-to-discovery`) automatically renames `phases.inception` to `phases.discovery` in all existing manifests, moves the `inception/` session directory to `discovery/`, renames the `inception-gap-analysis.md` state cache to `discovery-gap-analysis.md`, and rewrites `source` provenance values from `inception` to `discovery`.
- Skills no longer invent stops — unprescribed pauses between tasks, courtesy check-ins, and mid-loop summaries that end the turn are now explicitly prohibited alongside the existing gate rules.

## [0.4.7] - 2026-05-28

🔧 Changed

- Implementation review agents are now dispatched with clean context only — prior cycle findings and summaries are explicitly excluded to prevent cross-cycle bias.

## [0.4.6] - 2026-05-27

🔧 Changed

- Discovery Map header now shows a tier breakdown only when topics span multiple states — a single-state map renders as `Discovery Map (N topics)` without the redundant breakdown.
- Topic rows now use square brackets around the lifecycle label and a `┌─/├─/└─` branch prefix, with a single space between segments instead of two.
- Summary text in topic rows is now hard-wrapped at 65 characters, with a continuous `│` gutter on non-last topics so the tree never breaks across multi-line summaries.
- The imports callout is now suppressed when every topic is itself an import, since per-row provenance already conveys this on every line.

## [0.4.5] - 2026-05-27

✨ Added

- New `topic-synthesis.md` reference — inception sessions now synthesise topics as a dedicated endpoint ceremony rather than incrementally during the loop.
- New `topic-discovery-dispatch.md` shared reference — extracts the cache-status check and conditional analysis dispatch into one reusable reference loaded by both `continue-epic` and `workflow-bridge`.

🔧 Changed

- Inception sessions no longer distinguish between "first" and "refinement" modes — every entry runs the same unified loop; the session detects its own state (empty map, populated map, or resumed session) at Step 0.
- Resume detection now uses a manifest `active_session` marker instead of reading session log file contents — the marker is set lazily on first state change and cleared at conclusion.
- Session logs are created lazily on the first state change (exploration note, edit, or synthesis) rather than up-front at session start; browse-only sessions leave no file.
- The epic menu command for entering inception is now `i`/`inception` (was `f`/`refine`) — label updated everywhere including the routing table and display reference.
- `map-operations.md` no longer handles Add operations — new topics are synthesised at endpoint only, not added mid-loop as discrete operations.
- Inception guidelines rewritten to emphasise open exploration and endpoint observation, with topic decomposition deferred to synthesis rather than surfaced inline during the loop.
- Session log template unified across all session numbers; `Exploration` (narrative) and `Edits` (structured) replace the former `Considered and Discarded` and `Changes` sections.
- `discovery.cjs` now surfaces `active_session` from the manifest and drops the `is_refinement`, `is_in_progress`, and `conclusion_text` fields from `latest_session`.

🗑️ Removed

- `first-session-resume.md` and `refinement-session.md` — superseded by the unified session loop in `session-loop.md`.
- `refinement-template.md` — merged into the single `template.md` which now covers all session numbers.

## [0.4.4] - 2026-05-27

✨ Added

- Epic discovery map now shows each topic's summary as a sub-line in the continue-epic display — visible directly under the topic name, above the provenance line.

🔧 Changed

- Discovery script exposes `summary_present` and `description_present` boolean flags per map item so the backfill check can filter reliably without the agent reading underlying files.
- Continue-epic backfill step now filters by `summary_present`/`description_present` instead of checking raw field nullability — eliminating the stalling behaviour where agents went searching for data the script never surfaced.

## [0.4.3] - 2026-05-26

🔧 Changed

- Legacy research split now warns that the source file is replaced on apply — every piece of content must be transcribed into a theme or it is lost.
- Theme identification now follows the source's natural structure (headings, subject shifts, seams) rather than a generic "identify distinct themes" instruction.
- Topic granularity guidance no longer anchors to a two-to-six topic target — the source's actual structure determines the count.

## [0.4.2] - 2026-05-26

✨ Added

- Legacy research split backfill now advises a `/clear` + `/workflow-start` restart after committing recovery work — prevents a context-heavy backfill pass from bleeding into the normal epic flow.

🔧 Changed

- Legacy research split topics always route to `research` — per-theme routing selection is removed, and all themes split from a legacy file are seeded at research stage regardless of their source content.

## [0.4.1] - 2026-05-26

✨ Added

- New `workflow-legacy-research-split` skill decomposes migration-seeded broad research files into topic-scoped files via a user-guided session, then removes the source from the discovery map.
- Inception gap analysis (`inception-gap-analysis.md`) replaces the former discussion-gap-analysis, now reading both completed research and completed discussion files and assigning per-candidate routing.
- New `routing-decision.md` and `topic-granularity.md` shared references extract routing and granularity guidance so all three analysis paths apply the same criteria consistently.
- Migration 039 drops the legacy `phases.discussion.gap_analysis_cache` field and deletes the on-disk `discussion-gap-analysis.md` cache file; analyses repopulate at their new location on next run.

🔧 Changed

- `manifest.cjs get` now returns empty stdout with exit 0 for missing work units, fields, and wildcard matches — callers detect absence by checking output instead of catching exit code 2.
- Research-analysis and gap-analysis now self-gate on completed material: analyses are skipped entirely (no cache stamp, no manifest writes) when no completed research or discussion items exist.
- Per-candidate routing replaces the hardcoded `routing: discussion` in research-analysis and gap-analysis — each surfaced theme is independently routed to research or discussion based on content depth.
- `continue-epic` Step 5 now runs the legacy-bridge check and summary backfill before topic-discovery analyses, so analyses see richer map state and legacy epics are normalised first.
- `superseded` added as a valid research phase status; superseded items are excluded from phase aggregation and do not count as in-progress.
- Gap-analysis cache checksum is now computed from completed research and discussion files only, no longer including the `research-analysis.md` cache file.
- "Self-Healing" renamed to "Topic Discovery" throughout skill prose, session log templates, and commit messages.
- Research topic-split trigger changed from "distinct threads emerging" to "sustained off-topic content over multiple exchanges" — splitting now requires observed drift, not clean thematic separation.
- Investigation findings review restructured: findings are now presented first with a confirmation gate before the synthesis-validation offer, and a feedback loop allows corrections before agreeing on fix direction.

🐛 Fixed

- Analysis caches no longer report `stale` when completed input files are absent — they now correctly report `absent`, preventing analyses from firing when there is nothing to analyse.
- Legacy epics with migration-seeded broad research files no longer trigger a category-error research-analysis run that produces domain-decomposition topics hardcoded to `routing: discussion`.
- Knowledge base `remove` and `getWorkUnitMeta` callers updated to handle the new empty-stdout-on-miss contract instead of catching exit code 2.

## [0.4.0] - 2026-05-23

- Add inception phase and discovery map for epics — curatorial first phase that names topics, classifies routing (research/discussion), and drives auto-routing across the pipeline
- Add `workflow-inception-entry` and `workflow-inception-process` skills with initial-session and refinement-session flows
- Replace open-mode research with per-topic scoped research; drop `e`/`explore` and `route-first-phase`
- Add self-healing analyses (research-analysis, discussion-gap-analysis) that auto-add topics to the map with `source` provenance and dismissed-list filtering
- Add imports machinery: `.workflows/{wu}/imports/` directory, manifest `imports[]` field, KB indexing on import, surfaced via contextual query
- Add two-tier provenance (`summary` + `description`) on inception items; entry skills load description as opening context
- Add topic-splitting and elevation that write inception items alongside per-phase artefacts with collision validation
- Add direct-entry auto-add: `d`/`discuss` and `r`/`research` for unmapped topics auto-create inception items with `source: direct-start`
- Add migration 038 to seed inception items for legacy in-progress epics
- Index research-analysis and gap-analysis caches into knowledge base as `analysis` phase (low confidence)
- Add `continue-epic` discovery map render with tier ordering (→ ◐ ✓ ○ ⊘), summary backfill, and convergence signal
- Add `workflow-bridge` inception-continuation handoff back to `/continue-epic`
- Handle imports in feature absorption flow with KB chunk rewriting under target identity
- Surface `imports_count` in `continue-feature` display
- Add `base_url` config support for OpenAI-compatible embedding providers (LM Studio, Ollama)

## [0.3.3] - 2026-05-09

🔧 Changed

- Skill authoring conventions (display, structural, file layout, navigation) extracted from CLAUDE.md into a standalone CONVENTIONS.md — CLAUDE.md now references it rather than inlining the full ruleset.
- Pending discussion topics menu now shows the source of each item (`[from research]` or `[from gap analysis]`) inline on the option rather than in a separate list above.

🐛 Fixed

- STOP gate override protection hardened across all workflow skills — "work without stopping" session instructions, system-reminders, hook-injected text, and `/loop` continuation hints no longer allow the agent to auto-answer a gate on the user's behalf.
- Stored manifest values (project defaults, prior preferences) are now explicitly excluded as justification for skipping a STOP gate — stored values are suggestions, not consent for the current run.
- After rendering a gate block the turn must end immediately; no further tool calls are permitted in the same turn before the user responds.

✨ Added

- New idea file documenting STOP gate override protection — includes root cause analysis of a real failure, the three concrete edits applied, and a sample failure transcript for future reference.

## [0.3.2] - 2026-04-30

🔧 Changed

- Auto mode in Claude Code's harness can no longer bypass workflow STOP gates or select menu options (including `a`/`auto`) — the only permitted skip mechanism is the manifest `auto` field, scoped to the specific gate and topic it was set on.

## [0.3.1] - 2026-04-28

✨ Added

- Perspective agents now operate as polarity pairs drawn from a fixed lens table — matching on decision keywords guarantees orthogonal, non-redundant angles rather than ad-hoc positions.
- Each perspective agent must restate the decision through its lens before arguing — a Problem Restate Gate that forces wrong-question detection before any tradeoff analysis begins.
- Synthesis now opens with an `Unresolved Questions` section so readers see what the council could not answer before what it concluded.
- Synthesis runs a framing check across perspective restatements and surfaces significant scope divergence as a `T1: Framing alignment` tension, ensuring wrong-question failures are caught before the user acts.

🗑️ Removed

- Dropped three deferred idea docs — Dynamic Discovery Engine, Loop-Based Surfacing Nudge, and Project Memory — along with their Phase 5 grouping in the ideas index.

## [0.3.0] - 2026-04-27

✨ Added

- Knowledge base — every completed research, discussion, investigation, and specification is automatically indexed into a local semantic-search store; phases query it as you work to surface prior decisions, rejected approaches, and cross-work-unit context without manual hunting.
- OpenAI embedding provider — configure `text-embedding-3-small` (or any OpenAI model) for hybrid vector + keyword search; stub/keyword-only mode (BM25) is available when no API key is provided.
- `knowledge setup` wizard — interactive first-run setup handles system config, credentials (stored at `~/.config/workflows/credentials.json`, mode 0600), project initialisation, and initial indexing in one flow.
- `knowledge query` — natural-language search across the store with `--boost:<field>` re-ranking, hard filters (`--work-unit`, `--phase`, `--topic`, `--work-type`), batch multi-term queries, and a two-step retrieval pattern that keeps context lean.
- `knowledge index`, `remove`, `compact`, `rebuild`, `status`, and `check` commands — full CLI for managing the store, with a pending-queue for transient failures and TTL-based decay that exempts specifications.
- All entry-point and processing skills now gate on `knowledge check` in Step 0 and index completed artifacts at phase conclusion — the knowledge base is live infrastructure, not an add-on.
- Migrations 036 and 037 backfill `completed_at` on completed work units so TTL-based compaction has dates to work with.
- Release script now runs `npm ci` and `npm run build` before tagging, committing the `knowledge.cjs` bundle when it changes — installed projects get a fresh bundle at every tagged release with no build step required.
- `--help` / `-h` / `help` subcommand added to the knowledge CLI — exits 0 so scripts can probe usage without treating help as a failure.

🔧 Changed

- Step 0 in all entry-point skills is now decomposed into numbered sub-steps (0.1 Casing Conventions, 0.2 Migrations, 0.3 Knowledge Check) with explicit routing arrows between them.
- Cross-cutting context in planning now uses a semantic KB query (`--work-type cross-cutting --phase specification`) instead of reading every completed spec file, so only genuinely relevant specs surface.
- `--work-unit` on `knowledge query` is now a hard filter (consistent with `--phase`, `--topic`, `--work-type`); proximity re-ranking is now expressed via `--boost:work-unit <name>` — cross-work-unit context is preserved by default.
- `manifest.cjs` exit codes now distinguish expected misses (exit 2) from real errors (exit 1) — knowledge-base helpers and callers can tell a "key not found" from a corrupt manifest without parsing stderr text.
- Corrupt project manifests now abort with a clear error rather than silently returning an empty object and clobbering all registered work units.
- Lock acquisition in the knowledge store is now async (event-loop-yielding sleep instead of a busy spin), and the timeout has been raised to 30 seconds.
- Store enumeration in `status` and `compact` is now paginated, replacing a fixed `limit: 100000` cap that silently truncated very large stores.
- `removeByFilter` passes `batchSize = ids.length` to Orama's `removeMultiple` so the returned count is accurate for batches larger than 1000.
- Migration test scripts 001–028 standardised to `set -euo pipefail`.

🐛 Fixed

- `knowledge index` with no arguments now runs bulk mode (discovers all unindexed completed artifacts) instead of printing usage and exiting 1.
- Empty and whitespace-only `knowledge query` terms are now rejected with a clear error instead of silently returning arbitrary chunks via Orama's wildcard behaviour.
- Bulk index now validates provider/dimension consistency before the per-file loop, preventing a silent "N already indexed" no-op when the config has drifted from the stored schema.
- Setup no longer writes `provider: openai` to disk before the API key is validated — a bad key no longer produces a misleading "provider/model changed, run rebuild" error on the next index.
- Partial-state recovery (store present, metadata absent) is now detected and surfaces a `knowledge rebuild` prompt instead of writing mismatched metadata.
- `knowledge status` orphan detection now resolves source file paths relative to the project root rather than `process.cwd()`, so invoking status from a subdirectory no longer reports every chunk as orphaned.
- OpenAI 401/403 responses now throw `AuthError` and bypass `withRetry` — a bad or expired API key no longer burns 7 seconds of backoff before surfacing.
- `cmdRebuild` now renames existing store and metadata to `.bak` before the bulk-index pass and restores them on failure, so a transient error (network outage, Ctrl-C) no longer leaves the user with no index.
- `pending_removals` was missing from the `writeMetadata` whitelist, causing it to be silently stripped on every metadata write — the field now round-trips correctly.

## [0.2.18] - 2026-04-14

✨ Added

- Cancel and reactivate individual topics within an epic — use `a`/`cancel` and `e`/`reactivate` from the epic menu to pause a topic without losing its history, restoring it later to its prior status.

🔧 Changed

- Cancelled topics are excluded from phase aggregation, gating flags, next-phase-ready logic, and discussion/specification entry discovery — they stay visible in the display but no longer block progress.
- Phase status headers now show `cancelled` alongside other counts when cancelled items are present.

## [0.2.17] - 2026-04-13

✨ Added

- Absorb a feature into an existing epic — the feature's discussion and research move into the epic as a new topic and the feature work unit is removed.

## [0.2.16] - 2026-04-13

✨ Added

- Import existing research files at phase start — choose `i`/`import` when starting a feature or epic to ingest files verbatim into the research phase without summarization or restructuring.

## [0.2.15] - 2026-04-12

🔧 Changed

- Discovery format output now includes a `=== GAP CACHE ===` section alongside the existing cache sections.

## [0.2.14] - 2026-04-12

✨ Added

- Discussion gap analysis for epics — after discussions complete, the system holistically reads all of them to surface cross-discussion themes, integration gaps, elevated-but-uncreated topics, and emergent concerns that research alone couldn't anticipate.
- Gap analysis topics appear in the epic menu and pending topics list alongside research-surfaced topics, with separate source labels and skip routing per origin.
- Knowledge base `index`, `query`, and `check` commands are now implemented — index workflow artifacts into the store, search with keyword or hybrid semantic mode, and verify readiness.
- `manifest resolve` command maps a dot-path (`work_unit.phase[.topic]`) to the artifact file path on disk, used by the knowledge CLI for artifact discovery.
- Two-level config system for the knowledge base — system config (`~/.config/workflows/config.json`) and project config (`.workflows/.knowledge/config.json`) merge with project values taking precedence.

🔧 Changed

- Re-indexing a file replaces its previous chunks rather than duplicating them, and preserves the `pending` retry queue in metadata across re-index operations.
- The refresh action in the discussion options menu now clears both the research analysis cache and the gap analysis cache, and routes back to the correct step depending on whether research exists.
- Pending topic counts in the epic menu and soft gate warnings now include topics from gap analysis alongside research-sourced topics.

## [0.2.13] - 2026-04-12

✨ Added

- New shared `background-agent-surfacing.md` protocol centralises how background-agent findings are presented — enforcing a two-phase announce-then-raise flow so findings are never dumped as walls of text.
- New shared `natural-breaks.md` reference defines when it is and isn't safe to interrupt the conversation with a background-agent result.
- Review and deep-dive agent output files now carry stable finding IDs (`F1`, `F2`, …) in both frontmatter and section headings — the surfacing protocol uses these IDs to track exactly which findings have been raised across turns.

🔧 Changed

- Final-review steps in research and discussion now raise one finding at a time via the shared protocol and bounce back to the session, rather than dumping all findings and forcing an immediate proceed/explore decision.
- Background-agent check-for-results sections in research and discussion session loops now delegate entirely to the shared surfacing protocol instead of surfacing findings inline.
- Review-agent trigger now blocks dispatch while any prior review is undrained (`status: incorporated` required), preventing stale analysis from overlapping with an in-progress findings conversation.
- Synthesis and perspective-agent files updated to use stable tension IDs (`T1`, `T2`, …) and the shared surfacing protocol for presenting synthesis findings.

## [0.2.12] - 2026-04-11

✨ Added

- Knowledge base subsystem — a new retrieval-augmented store backed by Orama + MsgPack that chunks, embeds, and indexes completed workflow artifacts so Claude can query prior work during future phases.
- Markdown chunking engine driven by per-phase JSON configs — splits workflow artifacts at H2/H3 boundaries, handles `own-chunk`/`skip`/`merge-up` special sections, and preserves content verbatim through merge operations.
- `StubProvider` embedding implementation with deterministic hash-based vectors — enables fully offline testing without an embedding API.
- Orama store layer with fulltext (BM25), vector, and hybrid search — includes metadata filtering, file-locking, atomic MsgPack persistence, and `metadata.json` tracking for provider/model/dimensions.
- `npm run build` pipeline using esbuild — bundles the knowledge CLI into a single committed `knowledge.cjs` file so AGNTC installs it from git tags with no build step required.
- `knowledge-repl.js` dev scratchpad — a Node REPL pre-loaded with a fresh in-memory store and fixture corpus for interactive exploration.
- Phase task files and implementation planning docs under `knowledge-base/`.

🔧 Changed

- Research and discussion conclusion steps now run a **document review** pass that reconciles the session conversation against the saved file to catch substance discussed but never captured — added as a mandatory step before the compliance check in both phases.
- `knowledge rebuild` confirmation changed from a yes/no prompt to a type-the-word-`rebuild` gate, matching the Terraform destroy / GitHub repo deletion pattern.
- Provider mismatch detection now also blocks `knowledge query` (not just `knowledge index`), since querying embeds the search term and a mismatch would produce garbage results or crash on dimension differences.
- Cancelled work-unit removal failures now surface a clear error with a manual recovery command rather than silently queuing for retry — the cancellation itself still completes.
- Memory decay boundary corrected to `<=` (chunks expire on their expiry date, not the day after).
- `KNOWLEDGE-BASE-DESIGN.md` moved to `knowledge-base/design.md`.

## [0.2.11] - 2026-04-07

✨ Added

- New `KNOWLEDGE-BASE-DESIGN.md` design document capturing the full architecture, decisions, and implementation plan for the upcoming RAG-based knowledge base feature — covering storage (Orama + MsgPack), phase-aware chunking, embedding providers, CLI commands, retrieval integration, memory decay, and a phased rollout plan.

## [0.2.10] - 2026-04-06

🔧 Changed

- Pending topics menu now lists each topic as a numbered option so you can start a discussion directly — no more two-step select-then-action flow.
- Skipping a pending topic now prompts you to name which topic to remove rather than acting on a pre-selected item.

## [0.2.9] - 2026-04-06

✨ Added

- Mandatory final gap review before concluding research or discussion phases — dispatches a fresh review agent if the session has progressed since the last one, with a choice to explore gaps or proceed with them noted.
- Epic dependency map view (`m`/`map` command) — shows a summary matrix and phase-by-phase tree of cross-phase progress across all pipelines in an epic, with insights for critical path, unassigned discussions, and blocked plans.
- Convergence diagnostic at review/fix cycle escalation thresholds — instead of a plain "escalating" message, shows resolved vs. recurring vs. new findings with a trend assessment (converging, stable, or diverging) and a root-cause hypothesis for recurring items.

🔧 Changed

- Epic menu restructured into numbered items (topic-targeting actions) and lettered command options (`s`/`spec`, `d`/`discuss`, `p`/`pending`, `r`/`research`, `c`/`completed`) — the recommended action always appears first regardless of section.
- Review agent dispatch in research and discussion sessions is now a mandatory checkpoint after every commit, not an optional consideration — the session loop blocks responding to the user until the dispatch check is complete.
- Fix tracking cache is persisted across attempts and cleared per task at start, giving the convergence diagnostic the data it needs to classify recurring vs. new issues.
- Specification sources stored in object format are now normalised to arrays in the epic discovery script, fixing unaccounted-discussion tracking and format output for older manifests.

## [0.2.8] - 2026-04-05

✨ Added

- Specification review findings now capture a **Current** field for Enhancement findings, enabling before/after comparison when resurfacing changes.
- Plan review findings now show inline diffs (with 2 lines of context) for task-level changes, and a `v`/`view full` option to expand the full content on demand.
- Specification review findings now show inline diffs for Enhancement findings that include a Current field, with the same `v`/`view full` escape hatch.

🔧 Changed

- Resurfacing already-logged specification topics during extraction now presents changes as a focused diff view rather than re-presenting the full updated topic — with `y`/`view full`/feedback options inline.
- After user feedback on a plan or spec review finding, the finding is re-presented in its original format (diff or full) rather than always showing full content.

## [0.2.7] - 2026-04-04

✨ Added

- Discussion entry now offers a `f`/`fresh` shortcut to start a topic not derived from research, and a `b`/`back` shortcut to return to the epic menu.

🔧 Changed

- Item-level statuses throughout the UI now use square brackets `[term]` instead of parentheses `(term)` — parentheses are reserved for phase-level count summaries like `(3 completed, 1 pending)`.
- Phase headers in the epic state display now include a count summary — e.g., `Discussion (3 completed, 1 pending)`.
- Tree connectors in item lists now use proper `├─` / `└─` grammar instead of `└─` for every item.
- Advisory and gating callouts inside code blocks are now prefixed with `⚑` and indented, visually separating them from data lines.
- Planning items in the epic display now show format separated by a middle dot — `[in-progress] · linear` — instead of brackets after status.

## [0.2.6] - 2026-04-03

🔧 Changed

- Migration is skipped when already run earlier in the same conversation — resuming any work type no longer re-runs migrations redundantly.
- All entry skills now explicitly instruct the model to continue after migration completes rather than stopping, preventing a common stall after a no-op migration run.

## [0.2.5] - 2026-04-03

✨ Added

- Quick-fix work type is now fully represented in the Workflow Explorer — sidebar navigation, pipeline overview, and phase timeline all include `/start-quickfix`, `/continue-quickfix`, and the Scoping phase.
- Research and discussion background agents (review, deep-dive, perspective, synthesis) are now browsable in the Explorer with flowcharts and descriptions.
- `status` and `view-plan` utility commands are now linked in the Explorer sidebar.

🔧 Changed

- Selection menus across all work types now use `- **`N`** —` formatting for numbered items, giving them a unified visual style with command options — prompts no longer say "enter number".
- Discussion topic display condenses each research topic's summary to a single line and unifies topics and standalone discussions into one numbered list, simplifying how you pick what to discuss next.

## [0.2.4] - 2026-04-03

✨ Added

- Research phase now runs two background agents — a periodic review agent that scans for coverage gaps and unvalidated assumptions, and a deep-dive agent that investigates independent threads (competitor analysis, API feasibility, market landscape) in parallel while the main conversation continues.
- Two new agent definitions ship with the system: `workflow-research-review` and `workflow-research-deep-dive`, bringing the total specialized agent count to 23.
- Epic dashboard now surfaces pending discussion topics identified during research under the Discussion heading, and recommendations account for them — specification is not suggested while pending topics remain.
- Investigation phase gains an optional synthesis agent (`workflow-investigation-synthesis`) that independently traces code, validates the root cause hypothesis, checks symptom coverage, and explores alternative explanations before findings review.
- Workflow Explorer updated with full flowcharts for the quick-fix pipeline: `start-quickfix`, `continue-quickfix`, the scoping phase entry, and the scoping processing skill — alongside the new investigation synthesis agent.

## [0.2.3] - 2026-04-02

✨ Added

- Review findings are now categorized as quick-fixes, ideas, or bugs — non-blocking notes are tagged by type so reviewers can act on them without conflating severity with category.
- Surface non-blocking recommendations directly to the inbox from the review verdict screen — select by number, and each item is written as a ready-to-promote inbox file.
- Discussion skill now documents background agent dispatch — review, perspective, and synthesis agents are explicitly part of the session loop, with convergence detection and topic elevation for epics.

🔧 Changed

- Review report template splits Recommendations into three subsections (`### Quick-fixes`, `### Ideas`, `### Bugs`), with items numbered sequentially across all categories.
- Epic dashboard "Stop here" option removed from the standing menu — use `/workflow-start` to resume at any time.
- "Start new discussion topic" menu item now shows `(from research)` when research exists, clarifying the source of pending topics.
- Epic dashboard key display indented consistently to align with surrounding code block content.
- Workflow Explorer discussion flowchart updated to reflect the agent-assisted session loop with convergence and elevation paths.
- Workflow Explorer planning flowchart updated to show cycle management and re-loop gate between integrity review and sign-off.

## [0.2.2] - 2026-04-02

✨ Added

- Research analysis now tracks surfaced discussion topics in the manifest — the epic menu shows how many are pending and offers a "Manage Pending" screen to discuss or skip them one by one.
- A soft gate warns before starting specification if research-identified topics have not yet been discussed.
- Manifest CLI gains a `pull` command to remove the first occurrence of a value from an array field at work-unit, phase, or topic level.

🔧 Changed

- Research analysis instructions restructured into labeled steps (A–E) with explicit guidance to prefer fewer, coarser discussion topics over fine-grained per-theme splits.
- Discussion entry display labels topics with no discussion as "pending from research" instead of "(no discussion)".
- Soft gate messages are now self-contained sentences; count prefixes are composed into the message rather than prepended by the display template.

## [0.2.1] - 2026-03-31

✨ Added

- Phase title boxes — bullet-bordered frames (`●──…──●`) replace plain text headers across all skills, giving each skill invocation a clear top-level anchor.
- Step markers — em-dash progress indicators (`── Step Name ──────`) appear at every step boundary in every skill, labelling Claude's visible activity even when no explicit output follows.
- Sub-step markers — lighter dot-framed indicators (`·· Sub-step ··`) for stages within a step.
- Signpost blockquotes — markdown blockquotes appear after phase titles, before menus, and at phase transitions to explain what's happening and why.
- Workflow banner upgrade — the `/workflow-start` ASCII art banner now uses the bullet-border convention, widened to fit the art.
- Context-setting blurbs added to research/discussion routing menus — a short signpost now explains the difference between research and discussion before asking the user to choose.
- Work-type menu descriptions now include the full pipeline sequence so users can see exactly what each work type entails before selecting.

🔧 Changed

- All `Specification Overview`, `Discussion Overview`, `Workflow Overview`, `Manage`, `Inbox`, and similar status displays now open with a phase title box instead of a plain first line.
- Old `Output Formatting` sections (which instructed `── ── ── ── ──` separators) removed from all process skills; step markers embedded directly at each step boundary replace them.
- Spacing rules updated: one blank line after the closing phase title border, no `---` separators between sequential code blocks.
- Empty-state and active-work menu option labels now show the pipeline steps inline rather than a short description phrase.
- Scoping `write-tasks` reference now sets `external_id` at the plan level in addition to per-task entries, and clarifies where both IDs come from.

## [0.2.0] - 2026-03-29

✨ Added

- New `quick-fix` work type for trivially scoped mechanical changes (find-and-replace, API renames, syntax updates) — follows a three-phase Scoping → Implementation → Review pipeline.
- `/start-quickfix` and `/continue-quickfix` entry-point skills to begin and resume quick-fix work.
- `/workflow-log-quickfix` capture skill to log quick-fixes to the inbox for later promotion.
- Scoping phase collapses context gathering, specification, and planning into a single pass — producing 1-2 tasks directly without agents or review cycles.
- Complexity check during scoping automatically promotes to feature or bugfix if the change turns out to be more involved than expected.
- Verification workflow for quick-fix implementation — baseline tests before the change, systematic application, regression check after — replacing TDD for mechanical changes.
- Quick-fix inbox category at `.workflows/.inbox/quickfixes/` with full support in `/workflow-start` for promotion, archival, and restore.

🔧 Changed

- Implementation task executor and reviewer now support both TDD and verification workflow modes, dispatching based on work type.
- `workflow-start` dashboard, empty state, and manage menu now surface quick-fix work units alongside features, bugfixes, and epics.
- Manifest CLI now accepts `quick-fix` as a valid work type and `scoping` as a valid phase with `in-progress`/`completed` statuses.
- Pipeline completion for feature, bugfix, and quick-fix all offer early completion after implementation (skip review).
- Idea for routing review agents to Codex when available added to the project ideas backlog.

## [0.1.5] - 2026-03-28

✨ Added

- Discussion phase now has a live Discussion Map that tracks subtopics through `pending → exploring → converging → decided` states, giving you a real-time picture of what's settled and what's still open.
- Subtopics can be elevated to sibling discussion topics when they grow beyond the scope of the current discussion — Claude detects this and prompts you to promote them (epic work types only).
- Convergence is now detected automatically when all subtopics reach `decided`, offering a natural conclusion prompt rather than requiring manual wrap-up.

🔧 Changed

- Discussion sessions follow organic conversation flow rather than a rigid question-by-question checklist — threads branch, converge, and circle back naturally while the Discussion Map maintains coverage.
- Background review and perspective agents now feed findings back as `pending` Discussion Map subtopics instead of appending to a flat questions list.
- Context-refresh recovery now renders the current Discussion Map state before asking you to confirm position, so you can orient immediately.
- When concluding with unresolved subtopics, Claude shows which items are still `pending` or `exploring` and lets you proceed anyway or continue — unresolved items are recorded in the Summary's Open Threads section.
- The discussion file template replaces the `## Questions` checklist with a `## Discussion Map` section and structured subtopic documentation.
- Tick is now listed first in the plan output format ordering, reflecting it as the primary option.

## [0.1.4] - 2026-03-28

✨ Added

- Investigation synthesis agent — an independent agent validates root cause hypotheses by tracing code fresh, catching flawed reasoning before it propagates into the fix.
- Synthesis gaps surface in the findings review — if the synthesis agent identifies issues, they appear alongside the root cause summary so the user can weigh them before proceeding.

🔧 Changed

- Investigation phase gains a new Step 5 for root cause validation before the existing findings review, shifting the compliance check and conclusion to Steps 7 and 8.
- Agent count rises from 17 to 21, with discussion and investigation now each contributing dedicated subagents for review, perspective, synthesis, and root cause validation.

## [0.1.3] - 2026-03-28

✨ Added

- Background review agent dispatches during discussion sessions to identify gaps, shallow coverage, and missing edge cases — findings surface as practical questions in the discussion.
- Parallel perspective agents argue for competing technical approaches when a decision has genuine ambiguity, followed by a synthesis agent that maps tradeoffs and decision criteria without picking a winner.
- Three new agent definitions (`workflow-discussion-review`, `workflow-discussion-perspective`, `workflow-discussion-synthesis`) in a new `agents/` directory.

🔧 Changed

- Discussion session loop now checks for completed agent results at each natural break and prompts to wait or proceed when agents are still in flight at conclusion time.

## [0.1.2] - 2026-03-25

✨ Added

- All 7 processing skills now run a compliance self-check before concluding — the model re-reads its own instructions and audits the session for skipped steps, manifest errors, and artifact correctness, surfacing any significant issues before the phase closes.

## [0.1.1] - 2026-03-25

✨ Added

- New `ideas/` directory with 13 sequenced improvement proposals — covering quality gates, discussion evolution, UX visibility, implementation improvements, and infrastructure changes.

🔧 Changed

- Review resume flow now checks actual coverage before prompting — shows unreviewed task count and offers targeted continue vs full restart, rather than a generic continue/restart choice.
- Review initialization logic inlined directly into the skill, removing the separate `initialize-review.md` reference file.
- Task filter in `invoke-task-verifiers` now keys off `unreviewed_tasks` being set rather than a `review_mode` string, simplifying the branching logic.
- Implementation skill and task loop now explicitly enforce that the analysis loop runs after every task loop completion, not just the first pass.
- All entry-point and continue skills now include an explicit `→ Proceed to Step 1` navigation after migration, removing implicit flow-through.
- Skip-step parentheticals removed from navigation directives — `→ Proceed to Step N` is now used without annotations.

## [0.1.0] - 2026-03-22

Initial release.

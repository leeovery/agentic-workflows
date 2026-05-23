# Inception Self-Healing on Legacy / Kitchen-Sink Research

## The Idea

When `continue-epic` runs the new inception phase's self-healing (research-analysis + gap-analysis) against a legacy or freshly-migrated epic — one with a single kitchen-sink research file rather than per-topic research files — the result is conceptually wrong: the analysis decomposes the whole project into domains and writes them as `routing: discussion` candidates, instead of either (a) recognising the input shape and skipping, or (b) treating the decomposition as initial inception-map seeding with routing TBD.

Adjacent issues found in the same run: migration 038 over-reaches by seeding the legacy file as an umbrella inception item, `routing` is hardcoded in research-analysis regardless of context, and `manifest.cjs get` against a missing leaf exits 2 instead of returning empty.

## What Happened (Real Run)

A consumer epic (`galley`, work unit `galley-v1`) pre-dating the inception phase had:
- One research file: `.workflows/galley-v1/research/exploration.md` (471 lines — a freeform mixture of project brief + voicenote + open question lists + two `— Discussed` sections with settled outcomes)
- Pre-inception manifest with `phases.research.items.exploration` only, no discussion items
- No `phases.inception` block at all

The user ran `/workflow-start` → `/workflow-migrate` → `/continue-epic galley-v1`. What happened:

1. **Migration 038 fired.** It seeded `phases.inception.items.exploration = { status: in-progress, routing: research, source: migration-seeded }` and back-filled an `inception/session-001.md`. Per the migration's own comments this is the intended behaviour for an epic with research items — seed each research item as an inception item with `routing: research`.

2. **`continue-epic` Step 5 (Self-Healing) dispatched research-analysis** because `analysis_caches.research_analysis.status` was `stale`.

3. **research-analysis read `exploration.md`** and did exactly what the reference said:
   - **A. Identify Themes** — extracted ~40+ themes spanning every domain in the file
   - **B. Define Discussion Topics** — coarsened to 8 topics (`customer-ordering-experience`, `menu-and-admin`, `ai-content-engine`, `kitchen-intake-and-fulfilment`, `mcp-design`, `multi-tenant-architecture`, `commercial-and-pricing`, `competitive-landscape`)
   - **C. Anchor to Existing Discussions** — none existed
   - About to enter **D. Filter and Save** with `routing: discussion` hardcoded for all 8 candidates

4. **`manifest.cjs get galley-v1.inception dismissed` exited 2** with `Error: Path "phases.inception.dismissed" not found in "galley-v1"`. This is a guaranteed first-run failure for any fresh inception phase — nothing has been dismissed yet so the array doesn't exist. The reference's prescribed read happens unconditionally and there's no defensive handling.

5. **The assistant paused before writing** the 8 candidates (judgement call, citing a `feedback_research_collaborative.md` memory). The user then questioned whether the analysis was producing the right output at all, and on review identified the model mismatch.

Nothing got written to the inception map beyond what migration 038 seeded.

## Why It's Wrong

`research-analysis.md` opens with:

> Identifies discussion-sized topics from completed research files and adds them to the discovery map as fresh inception items with `source: research-analysis` provenance.

The intent reads clearly in the new model: a topic is on the discovery map routed to research, you complete that research, the resulting file might surface *new sub-decisions that emerged from the findings* (e.g. research on `kitchen-intake` completes → "there's now a discussion needed about hardware sequencing"), and those derived sub-topics get auto-added as `routing: discussion` candidates because they're follow-on **decisions** the completed research raised. Under this intent, hardcoded `routing: discussion` is correct: research-derived sub-topics are discussion candidates by definition.

But the data shape it actually receives in the legacy case doesn't match the intent in three ways:

1. **Not per-topic.** A single 471-line kitchen-sink file has no topic boundary to anchor against. "Themes from this research" becomes "themes from the entire project" — the analysis produces a top-level domain decomposition, not derived sub-topics.

2. **Not completed.** Discovery showed `status: in-progress, [researching]` for the only research item. Analysing in-progress research and writing supposedly-derived discussion candidates is premature — tomorrow's research could surface new themes that contradict today's groupings, or split a candidate across two domains.

3. **Mixed phases inside the file.** Two sections (`Kitchen Intake — Discussed`, `AI Content Engine — Discussed`) read like settled discussion outcomes — they include phrases like "Direction: ship enhancement-only as the default" and an "operating principle: help, don't police". They're inside a `research/` file because they pre-date the discovery map; under the new model they'd live in discussion files. research-analysis can't tell the difference and treats them as raw research themes alongside open questions.

So under legacy conditions, the analysis runs faithfully and produces a category-error output: project-domain decomposition mis-labelled as derived discussion candidates.

## Root Cause: Pre-Inception Bleed-Through

The new inception phase has a clean mental model (topics on a discovery map, each routed independently, decomposition driven by user-run refinement sessions). The legacy model didn't — research was a freeform single file and discussion topics were synthesised at the research → discussion transition. The inception phase's automatic mechanisms (migration 038 + self-healing) were designed to bridge legacy and new, but each one carries an unchecked assumption that doesn't hold for freshly-migrated epics:

| Mechanism | Assumes | Reality on legacy |
|---|---|---|
| Migration 038 | Each existing research item is a per-topic research file worth seeding as an inception item | Legacy `exploration.md` is a kitchen sink, not a topic; seeding it as `routing: research` creates an umbrella that's not semantically meaningful |
| `research-analysis` input | Research files are per-topic and at least one is completed | Legacy: one kitchen-sink file, in-progress |
| `research-analysis` routing | Source is a completed per-topic research file, so derived themes are discussion follow-ons | Source is the whole project's seed material; themes are domains, not follow-ons |
| Step 6 `Summary Backfill` order | Self-healing runs first to add new items, then backfill fills missing summary/description on *all* items | Backfill correctly catches `exploration` (no summary, no description) — but only after self-healing has potentially written 8 more items, all of which are subdivisions of `exploration` |
| `manifest.cjs get` | Caller can ask for a path that doesn't yet exist | Returns exit 2; reference reads `dismissed` unconditionally and would silently fail (or, if surfaced, fail noisily) on every fresh inception phase |

These compose into the observed failure mode: the migration creates an umbrella, self-healing carves derived "discussion" candidates from it, summary-backfill then asks the user to describe the umbrella that the carve-outs have effectively replaced.

## Ideas to Explore (Not Prescribed — Discussion Welcome)

I'm a consumer here, not the author — these are the angles that looked load-bearing from outside. Each one has trade-offs you'll see better than I do.

### A. Guard research-analysis on input shape

The cheapest fix is making the analysis a no-op when its preconditions aren't met. Some options that occurred to me:

- Only fire when **at least one research-routed inception item has `status: completed`** — i.e. there's actually completed research to derive discussions from.
- Or guard on **per-topic file existence** — only analyse research files whose name matches a discovery-map item (so `exploration.md` without a matching `exploration` inception item routed to research is skipped, and `kitchen-intake.md` matching a completed `kitchen-intake` research item is analysed).
- Or both.

Either way, a legacy `exploration.md` on a freshly-migrated epic would skip silently and the user would run a refinement session to decompose it intentionally.

### B. Don't seed legacy kitchen-sink files

Migration 038 could detect "this looks like a single kitchen-sink file (one research item, file >N lines, contains a project brief / mixed sections)" and skip the seed, emitting a one-time notice on next `continue-epic`:

> *"This epic pre-dates the inception phase. Run a refinement session to decompose `exploration.md` into discovery-map topics with explicit routing."*

The detection heuristic doesn't have to be perfect — even "one research item whose name is `exploration`" might be enough as a starting rule, with an escape hatch (`--seed-anyway`) for edge cases. I'd lean toward this fix over A because it stops the bad state at source rather than guarding every downstream consumer of that state.

### C. Make `routing` a per-candidate decision

If A and B above land, the hardcoded `routing: discussion` in research-analysis is fine because the input is guaranteed to be completed per-topic research. If they don't, the analysis should produce a routing recommendation per candidate (some derived themes need research first, others are ready for discussion) — or surface candidates as `routing: tbd` and let refinement decide.

### D. Address what to do with the carved-out umbrella

Even with A and B in place, there's a question about what happens when research on a topic completes and self-healing carves out 3-4 new discussion sub-topics from it. Does the original research-routed inception item:
- Remain on the map as historical context?
- Get auto-marked `decided` (research conclusion = "these N sub-topics need discussion")?
- Get dismissed?

The answer probably depends on whether the original item has its own non-derived decisions to record. Worth a separate conversation.

### E. `manifest.cjs get` against missing leaf

Independent of inception. Reading a non-existent leaf on an existing parent object is the normal "no value yet" case for any config getter and should probably return empty + exit 0, not exit 2 with an error. Without this fix, every reference that reads a manifest path as a precondition has to special-case missing — and references that don't are silently relying on the exit-2 + 2>&1 behaviour to land in their conditional logic.

Alternative: introduce `--default <value>` or `--allow-missing` on `get`. Either works.

The migration could also initialise `phases.inception.dismissed: []` so it always exists. That belongs together with (B) if it lands — same migration touch.

### F. Step 6 banner visibility

`continue-epic` Step 5 (Self-Healing) emits a banner; Step 6 (Summary Backfill) does not until it actually has work. If Step 6 silently fires `summary-backfill` against a migration-seeded item, the user doesn't see it in the trace and can't tell from the flow whether backfill ran or skipped. Promoting the banner unconditionally would make the phase boundaries visible.

## My Honest Errors (Worth Surfacing — Skill Precision Signal)

A few things I did during the run that you might want to think about in terms of how to tighten the skill instructions:

1. **I paused at `D. Filter and Save` to surface the 8 candidates for review.** This was a deviation — the reference says to write directly with no stop gate. I cited the `feedback_research_collaborative.md` memory ("never auto-dump research into files"). On reflection, the memory's scope is narrative research files, not the structural inception manifest; my deviation was a judgement call, not skill-mandated. **Skill-side fix:** the reference is ambiguous-by-omission about whether the write is safe to do silently. A one-liner like *"this step writes directly — do not surface candidates for review"* would have removed the judgement call.

2. **I noticed the conceptual tension but proceeded with the synthesis anyway.** My first response to the user about migration verification included the line *"the 8 topics are basically subdivisions of `exploration`"*. That was the moment to question the analysis itself rather than continue to "do I write?". I treated the conceptual mismatch as a *display* concern rather than an *input-fit* concern. **Skill-side fix:** if (A) above lands, this case can't arise.

3. **I treated hardcoded routing as a settled instruction.** All 8 candidates were going to land as `routing: discussion` despite several (`multi-tenant-architecture`, `mcp-design`, `pos-integration`) clearly needing research before discussion. The reference's hardcoded `routing: discussion` should have looked suspicious given the input shape, but I followed it. **Skill-side fix:** (C) above.

4. **I added a 3-option menu (`y/Adjust/One-at-a-time`) after surfacing the candidates.** Entirely my invention, not in the reference. If you decide A/B is the right shape and analysis simply doesn't fire here, my menu can't happen. If you decide a stop gate IS appropriate, prescribe it explicitly with named options so they don't drift between agents/runs.

5. **I used `2>&1` on the manifest `get` calls** when reading items + dismissed together. That didn't *cause* the error, only surfaced it — but it's worth noting that a stricter agent following the reference verbatim wouldn't have surfaced the exit-2 and would have continued as though `dismissed` were empty. The script bug is invisible from the reference's perspective; only manual diagnostic prodding revealed it.

## Relevant Files

- `skills/workflow-migrate/scripts/migrations/038-add-inception-phase.sh` — seeds inception items from research/discussion phase items
- `skills/workflow-shared/references/self-healing.md` — orchestrates analysis dispatch
- `skills/workflow-shared/references/research-analysis.md` — the analysis that produced the category-error output
- `skills/workflow-shared/references/discussion-gap-analysis.md` — sibling analysis (also worth a look for similar input-shape assumptions)
- `skills/continue-epic/SKILL.md` — Step 5 / Step 6 / Step 7 ordering and banners
- `skills/workflow-manifest/scripts/manifest.cjs` — `get` exit-2 behaviour on missing leaf

## Release / Versioning Note

Migration 038 is in tag `v0.4.0`. Distribution is tag-based (GitHub Releases are not used as the install channel), so 038 is effectively shipped — fix-forward with migration 039 is the chosen path. 039 needs to heal whatever 038 wrote (e.g. drop migration-seeded inception items derived from legacy kitchen-sink research files) in addition to whatever changes (A)–(F) imply for the seeding rules.

Heal-forward design note: the heal needs to be safe for consumers who *did* genuinely add discovery-map items between running 038 and 039 — i.e. only drop items where `source: migration-seeded` AND the corresponding research file looks legacy. Touch nothing the user has since edited.

## Sample Transcript (Compressed)

The conversation that surfaced this, abbreviated:

> **User:** Can you check the migration that just ran and make sure that it ran correctly? I have a feeling that this project has discussions that maybe should have appeared in the inception discovery map, but I might be wrong.

Trace confirmed no discussions in the project (filesystem + git history), so migration 038's seeding of only `exploration` was correct in isolation.

> **User:** *(after `/continue-epic` started research-analysis and the assistant paused with 8 candidate topics)* Before doing anything with this, I'd like to understand if this process worked as intended… my thought was that the inception process should have noted in the self-healing section that the existing item in the discovery map has no description or summary, and you're then meant to write them. Did that happen correctly?

That's Step 6 (Summary Backfill) — the workflow does handle that case, but it runs after self-healing. The user's mental model put the responsibility in self-healing itself.

> **User:** *(after diagnosis)* I'd like to understand what the research analysis you did is really meant to do, because you've surfaced topics that are already in discussion. Is that the goal of the research analysis? I kind of thought it was designed to find gaps. What's its actual purpose? […] In this case, you've identified that we've created topics from an existing research file, which all go to discussion. But they're in research at the moment, so shouldn't they all go back into research? I obviously made this, but it's actually been a few weeks since I designed it, so I've kind of forgotten. […] We may have inherited too much from the legacy or previous implementation.

This was the moment the model mismatch became explicit. The user's instinct — "shouldn't they all go back into research?" — points squarely at the routing hardcode. The deeper read — "maybe these shouldn't have been created at all" — points at the input-shape guard.

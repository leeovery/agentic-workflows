# Spec-Side Coherence — remove the analysis, absorb incoherence where it's consumed

The epic coherence analysis runs after every discussion conclusion, judges
the corpus at its least-converged moment, and repairs what it finds by
reopening completed discussions. This programme removes it entirely and
relocates its value into specification, where incoherence is met at the
moment of consumption and resolved in the flow of construction — no batch
findings, no reopens, no cache. Design log for the stack. Opened
2026-08-10 from live evidence in fumi.

## Motivation (2026-08-10)

- **The treadmill, measured.** fumi ran five rounds of coherence findings
  in nine days (Aug 2, 3, 4, 9, 10), each landing reopens through triage.
  note-model completed six times; storage-and-sync five; note-window
  three — fourteen completions across three topics that needed three.
  After the Aug 10 round, two of the three completed discussions were
  reopened again, the cache's input set was down to one file, and topic
  four had barely started. Reopen → re-complete → checksum change →
  re-run: mid-epic there is always a next conclusion, so it never
  settles.

- **The entire yield of the latest round.** Two findings.
  `version-attribution-you-vs-agent` — a real decision-layer conflict
  (note-window's version panel labels an actor the storage model
  deliberately cannot determine) — but both documents sit in the same
  future spec's input set, so the don't-guess discipline at construction
  meets it head-on for free. `creation-default-cites-superseded-minimum`
  — the cache's own words: *"The conclusion survives; the citation does
  not."* A justification sentence went stale; specification extracts
  decisions, not journey justifications; a full reopen-and-re-complete
  cycle bought a repair with zero downstream consequence.

- **The analysis's own notes prove natural convergence.** The same run
  recorded that the geometry chain "holds across all three" documents and
  note-window's upstream folds are "coherent at both ends" — the corpus
  converged on its own, as later discussions consciously built on earlier
  ones. The analysis mostly verified coherence, then reopened two topics
  for what remained.

- **The architecture already sides with removal.** Specs are the golden
  record; every other artifact decays and is never corrected
  (correcting-historical-artifacts). Polishing mutual coherence into
  decaying discussion documents is effort invested against that ruling.
  And specification-principles already carries the rule this design
  builds on: *"Surface conflicts: when sources contain conflicting
  decisions, flag the conflict to the user. Don't silently pick one."*
  A principle with no machinery — this stack gives it the machinery.

## The decision

1. **Coherence analysis is removed** — the analysis reference, the
   findings gate, the dispatch branch, the cache, the dismissed-findings
   list, the spec-entry advisory. Gap analysis and research analysis are
   untouched.
2. **Specification absorbs incoherence as-you-go.** Not a batch check —
   a discipline woven into chunk construction: every chunk must be
   derivable from its sources; a chunk that requires silently picking a
   side stops and asks. Timeline-resolvable supersession (the top entry
   governs) is not incoherence and never stops.
3. **Specification makes decisions clear; it never makes decisions.**
   When sources genuinely conflict, the user chooses — always, on every
   gate mode. When nothing was ever decided, that is a gap, and gaps
   route backwards to discussion.
4. **Resolutions flow back into the discussion documents naturally** —
   updated as if decided then, no corrigendum (corrigenda are for closed
   units), single-file reindex so the knowledge base serves current
   knowledge for the rest of the epic. A deliberate, owned narrowing of
   the no-gap-editing rule: the edit records a resolution the user just
   made in a phase session with full context, never an analysis's opinion
   applied from two quotes.

## The discipline (specification construction)

Lands as a named section in spec-construction, sibling to Context
Resurfacing, triggered from stage A (extraction) whenever source material
disagrees with itself or another source, or is too unclear to extract
without assumption. Three-way classification:

- **Trivially resolvable — apply, note, record.** Strictly defined: no
  decision changes. Timeline-obvious supersession consumed silently (the
  existing rule), and repairs of record — a citation of a value another
  document has since moved, where the citing conclusion survives. The
  session applies the doc repair + reindex + action-scoped commit, and
  the next chunk presentation carries a one-line note above the gate —
  outside the spec content block, never written into the spec. Auto mode
  keeps rendering the presentation, so the note survives auto; the doc
  diff and commit are the durable record.
- **Decision-worthy — stop, always.** The raise presents both sides
  (verbatim quotes, cited), what breaks if extraction proceeds, options
  with a recommendation. **This stop overrides `auto`** — the third
  member of the existing stays-gated family (Context Resurfacing,
  Reconcile Stale Sources): no choice is ever made without the user.
  The agreed resolution is written into the owning discussion doc(s)
  as if decided then, reindexed, committed; then the chunk proceeds
  against the updated source.
- **Genuine gap — pause and route back.** Nothing was decided; there is
  nothing to make clear. The concern lands in the owning discussion's
  triage queue (`topic triage` — reopens it, stales this spec's source
  row), the session commits its work and stops, telling the user
  conclusion waits on that discussion (the deferred-stale stop shape
  from spec-completion). No document review, no spec review, no
  conclusion runs. The reopened discussion surfaces on the epic map;
  the user has the discussion; re-entering the spec reconciles the
  re-decided source before construction resumes.

Upfront awareness rides the existing entry-side grouping analysis, which
already reads every completed discussion in full: cross-source tensions
noticed during that read are recorded as advisory notes in the
consolidation cache the construction already consults — raised when the
relevant chunk arrives, or immediately if structural. Awareness upfront,
resolution as-you-go, one mechanism.

## Resolution mechanics

- **The doc update.** Targeted: the resolution lands in the owning
  document's decision layer (and the citing prose it invalidates), as if
  decided in that session — no meta-narration of where it came from.
  Then `knowledge index <path>` (single-file re-chunk) and an
  action-scoped commit naming the repair.
- **Presence guard.** Discussions can be live in concurrent sessions.
  Before any spec-side doc update: `presence scan`; if the target
  discussion is held and live, do not edit — land the resolution as a
  triage concern for that session to fold in instead.
- **Cross-spec staleness (the safety valve).** `row.status = 'stale'`
  currently has exactly one assignment site: the reverse join on
  reopen/triage. A quiet doc edit would leave *other* specs'
  `incorporated` rows current-looking while their source moved. New
  engine verb — `sources stale <wu> <discussion> [--except <spec-topic>]`
  — runs the same reverse join minus the reopen: flips other specs'
  incorporated rows for that discussion to `stale`, flags completed
  specs `reconcile_needed`, skips terminal items, excludes the invoking
  spec (its extraction of the resolution is happening live). The
  resolution flow calls it after the doc update.
- **Re-entry reconciliation.** Today an in-progress spec's stale rows
  first become actionable at the pre-sign-off sweep. New rule in the
  spec process's session setup: stale source rows reconcile up front —
  Reconcile Stale Sources runs before construction resumes, so a spec
  that paused for a discussion pulls the re-decided knowledge in at
  re-entry, not at the end.
- **Conclusion hardening.** The stale/pending block at sign-off is
  prose-only; `topic complete` will complete a spec over stale rows.
  The engine gains the refusal for specification items: `topic complete`
  errors while any source row is `pending` or `stale` (override absent —
  the prose flow resolves rows first; restart's reset path is unaffected
  because it resets rows to `pending` only while the spec is
  in-progress, never at complete).

## What stays

- Gap analysis and research analysis, on their current cadence.
- The triage system, staleness hops, and reconcile advisories — the
  machinery is untouched; coherence simply stops being an automatic
  caller of it. Reopens become a judgment (the gap route, the held-topic
  fallback), never an automatism.
- `triage-landing.md` widens its raising-phase contract to admit
  specification (engine-side nothing changes — the raising phase was
  never transmitted; the `coherence-review` origin precedent already
  proved non-topic provenance).

## Removal plan

Full enumeration lives in the strip-out PR. Shape: delete
`coherence-analysis.md` + `coherence-findings-gate.md`; excise the
dispatch branch (topic-discovery D, with section renumbering) and the
tracker/`analysis_caches` plumbing; engine cache/derivations/projection
entries and both gateways' composition lines; the spec-entry advisory
(gateway, domain, projections); knowledge whitelist entry (+ bundle
rebuild); CLAUDE.md's coherence sentences. **Migration 056** deletes per
work unit: `phases.discovery.coherence_analysis_cache`,
`phases.discovery.dismissed_findings` (the map's `dismissed` survives),
the `coherence-analysis` key inside `analysis_staging` (container
dropped only if emptied), the two `.state` files, and the cache file's
KB chunks (precedent: migration 050's purge). CHANGELOG history stays.

## Test plan

- Engine: suites for `sources stale` (join, except, terminal skip,
  flag-no-clobber) and the `topic complete` refusal; removal edits per
  the enumeration (cache, derivations, projections, gateways,
  simulation's coherence arm out; a `sources stale` + refusal arm in).
- Migration 056 gets its node:test suite (happy path, skip, idempotency,
  content preservation, sibling-key survival).
- Prose: `start-coherence-finding-reopens-discussion` deleted;
  `discussion-corrects-a-stale-reference` and
  `discussion-redecision-lands-timeline` re-premised on a rerouted
  concern origin (the concern mechanism survives the removal); one new
  case walking the construction discipline — a seeded source conflict
  raised at the chunk, resolved, pushed back, `sources stale` fired.
  Snapshots regenerated through the runner; walks on command, never in
  the gate.

## Stack

1. **PR 1 — this design.**
2. **PR 2 — strip-out + migration 056**: the removal enumeration, KB
   purge, docs, test-surface updates, prose-case deletion/re-premising.
3. **PR 3 — engine groundwork**: `sources stale`, `topic complete`
   hardening, presence docstring correction (it claims a triage consumer
   that does not exist), simulation arms.
4. **PR 4 — the discipline**: spec-construction section + principles +
   session-setup re-entry reconcile + triage-landing widening + grouping
   analysis awareness note + chunk-gate note line + CLAUDE.md; the new
   prose case.

fumi carries two live coherence landings (note-model, note-window) —
drained as the final coherence round before updating; migration 056
cleans the residue either way.

## Rework (2026-08-11) — the corrected classification model

Live review of the built discipline found it drifted from the agreed
model in two ways: it drew the classification line at
decided-vs-undecided (the agreed line is **brief-chat-vs-real-
discussion**), and it added gate ceremony the model rejects (a y/n
consent before routing, a `g/gap` menu option putting classification
in the user's hands). The corrected model, agreed 2026-08-11:

1. **Resolvable from the record** (timeline supersession, repair of
   record): Claude resolves it, calls it out, moves on. Pushback is
   conversational.
2. **Small — settleable here**: an ambiguity, incoherence, or minor
   undecided point a brief exchange settles. Raise it (the conflict
   menu where documented sides exist — **without any `g/gap`
   option** — a plain conversational question where they don't), the
   user answers or discusses, the resolution lands in the owning
   document (timeline entry, reindex), construction continues.
3. **Genuine gap — needs real discussion work**: **no choice, no
   consent gate, no user classification.** Claude states the
   classification and its intent — the raise display plus "routing
   this to {doc} and pausing the spec" — and acts on it; the user's
   pushback lever is conversational, in the moment, before it acts on
   their word if they object. Epic: triage landing (keep the `result`
   contract — a cancelled landing means the user pushed back inside
   it; continue conversationally). Non-epic: direct `topic reopen` of
   the owning source. Several gaps → one concern per owning document,
   then pause once. The classification test is Lee's original words:
   route back only when it needs *more than a brief discussion*.

Checklist for the fresh session (all on PR #873) — **completed
2026-08-11**, settled choices recorded inline:

- [x] `resolve-source-incoherence.md`: restructured per the model —
      first-match classify (timeline / repair / brief-exchange with
      documented sides → conflict menu / brief-exchange without →
      plain conversational question / genuine gap); `g/gap` removed
      (Comment absorbs "neither stands" — Claude re-classifies); the
      gap exit has no consent gate — stated-intent raise, then the
      routing runs, conversational pushback honoured before it lands;
      several gaps land one concern per owning document, one pause.
- [x] `incoherence-gate` surface: conflict menu is numbered sides
      (recommended-first) + Comment; `gap-route` is **display-only**
      with the stated routing intent as its closing line (engine-
      rendered, keeping the user-facing wording deterministic);
      `held-doc` unchanged.
- [x] Quote shape: **Lee chose B** — the finding-surface idiom. Raise
      bodies render `**Conflict/Gap — {title}**`, one
      `- **{doc} · {section}**: "{quote}"` meta bullet per citation,
      `**Details**: {context}`, stakes beneath.
- [x] Entry-side surfacing: **Lee chose hard block, two levels.**
      Phase level: any open discussion blocks the structure-building
      scenarios (analyze / analysis-rerun / single into a fresh or
      itself-blocked spec) — `blocked-discussions-open` terminal
      display. Spec level: a spec whose source discussion is back
      in-progress renders on the menu as a `blocked_spec` row
      (visible, refused with the holding discussions named); the
      analysis actions (analyze/unify/re-analyze) are withheld while
      the record is open; the epic entry-gate refuses direct topic
      entry ("Sources for X are back open"). Non-epic re-entry was
      already hard-blocked by the existing discussion-status gate.
      This is the deliberate exception to the epic soft-gate norm.
- [x] Prose case `spec-resolves-a-source-conflict`: re-checked —
      assert step 5 and conduct pin sides/recommendation/quotes, not
      the removed option; no changes needed.
- [x] CLAUDE.md phase-6 sentence, epic-soft-gates bullet, and
      docs/specification.md (entry + incoherence paragraphs)
      re-aligned.
- [x] Full gates green (npm test 2072, typecheck, cli, migrations
      untouched); commits on feat/spec-side-coherence.

Presentation rule for the session (Lee's standing ask): anything shown
as example/rendered output is bracketed with explicit markers (▼ begins
/ ▲ ends); commentary never inside the markers.

## Review rulings (2026-08-11, second pass) — the final model

The post-rework review pass (8 finders) surfaced seams between the new
hard blocks and the surfaces that route into them, plus flow holes in
the gap exit. Lee's rulings, settled in conversation:

**The three moves (replaces the earlier classification tiers):**

1. **Derivable → silent.** Anything Claude can settle from the record
   (timeline supersession, stale cross-references, any no-brainer):
   read, derive, write the spec chunk, move on. No raise, no mention,
   no document edits, no reindex. This DELETES the repair-of-record
   machinery — the silent tier never touches a historical artefact,
   so the quiet doc-edit, its reindex, its `sources stale --except`,
   and the "Resolved along the way" note all go. Historical artefacts
   change only through the collaborative door (move 2).
2. **Settleable stop.** Quick exchange; Claude takes a stance
   (conflict menu where sides are documented, plain question where
   not). The canonical decision mirrors back to the owning document
   (timeline entry), reindexes, stales sibling extractions,
   construction continues. Can escalate into move 3 mid-conversation.
3. **Gap stop.** "We found a gap; we must stop." A real STOP gate —
   acknowledgement, not choice (`y/yes` confirms; an objection drops
   into move 2's conversation; there is no "no"). On confirm:
   liveness check first (is this spec item still live? a parallel
   session may have collapsed it — if dead, say so and exit), then
   land the gap in the owning discussion's triage queue (one landing
   per owning document, several gaps pause once), pause the spec,
   and route to the work type's navigation layer — epic: invoke
   workflow-continue-epic (menu shows the reopened discussions; the
   pause message names them: "re-conclude ABC; the spec unblocks");
   feature/bugfix: invoke their continue skill the same way.

**Queues are universal for gap routing.** The triage queue machinery
is epic-only at its *source* (cross-topic reroutes), not in the
engine or the consuming session loop. A feature's gap lands in its
own discussion's queue; a bugfix's in its investigation's queue —
context-clear-proof, surfaced at re-entry, conclusion-blocking.
(Check: the investigation process must surface queues like the
discussion process does; extend if missing.)

**Cancel cascades with confirm.** Cancelling a discussion named in a
live specification's sources collapses that spec. The engine refuses
the bare cancel naming the affected spec(s); a cascade flag cancels
discussion + specs in one transaction; the menu prose confirm-gates
with the collapse warning. This makes the failed-landing loop
unreachable (a cancelled source can only coexist with a dead spec,
which the liveness check catches).

**Epic menu hard-blocks, two regimes.** (i) No groupings/specs yet:
the spec route is hard-blocked until every discussion is concluded —
the soft gate's "proceeding now is safe" dies. (ii) Specs exist: a
spec whose source discussion reopened is blocked (named reason);
settled specs pass; the route itself blocks when nothing behind it
is workable — which makes the all-blocked scoped menu unreachable,
so it needs no special handling.

**Bugfix flip.** `flagDownstream`'s reverse join extends to
investigation sources: reopening an investigation stales the spec
rows naming it, so the pause's "engine refuses to conclude" promise
is true for bugfixes too.

**Vocabulary.** "back open" dies — existing terms only: a discussion
is `in-progress` again / `reopened`. No new stored state: blocked
and paused are derived (source rows + discussion status), never
written to the manifest.

Unambiguous review fixes riding along: sourceRows exported and
reused by the entry gate (single decoder); `pending, reopened` tag
(pending no longer short-circuits the reopened cue); SpecRow typedef
lists every tag; record-open derived once on the detail; blocked
info emitted in DATA (prose never re-derives); menu blocked rows
keep their verb; validate-source/commands.md/route-scenario/
display-analyze premises updated; docs/lifecycle-operations.md
warn-not-wall paragraph corrected; adapter/sim/golden coverage for
the new states; docs/specification.md re-told (silent tier edits
nothing; gap stop acknowledges then routes to the menu).

## Delta-review fixes (2026-08-11, third pass)

Three finders on ea6d0473..HEAD. Fix list (all on #873): epic gap
branch gets its routing (landed → pause; per-gap raise, one pause);
cancelled-landing branch properly routed (terminal collapse vs back
to Classify); liveness check keys on terminal statuses only (a
completed spec mid-refine is live); cross-cutting added to the pause
return; held-doc delivery universal (linear via direct topic triage)
and its next-branch wording made implementable. Epic menu: in-session
confirm points at the hard gate; analyze refusal regime-aware (only
when no spec items exist); E. Cancel Topic drives the cascade (bare
cancel → refusal → collapse confirm naming what falls → --cascade);
blocked groupings/specs visible with blocked-by cue (Lee's ruling),
refusal names holders. Engine: cascade discards proposed rows,
cancels started specs (name-collision residue); computeNextPhase
returns the earliest in-progress phase (paused linear specs route to
their reopened source); all-blocked scoped menu falls back to
blocked-discussions-open (bridge plan-file residual route); epic
recommendation string matches the hard gate. Bugfix reconcile:
reconcile-stale-sources generalised by source phase, reconcile-
advisory's investigation branch routes to it; resume-detection counts
investigation queues; investigation surfaces its queue on both resume
branches; conclude-investigation gate gets legal routing. Docs:
commands.md queue claims (3), docs/specification.md bugfix wording,
sim comment vocabulary.

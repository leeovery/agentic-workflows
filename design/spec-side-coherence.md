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

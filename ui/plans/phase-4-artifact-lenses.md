# Phase 4 — Artifact lenses

**Goal:** artifacts readable and decidable at human scale. Every document gains Read
(Phase 1), **Structure**, and **History** lenses — with structure sourced from wherever it
*actually* lives: the manifest where the manifest owns it, template headings only where
they are genuinely stable. Plus the roadmap surface the coverage audit found missing.

**Duration:** 2–3 weeks.

**Corrected premise (from review):** templates are model-followed guides, not engine-
maintained forms ("this is a guide, not a form" — discussion template; "structure is
flexible" — spec format; the engine never parses markdown artifacts). Heading-keyed
extraction is reliable only for investigation, review reports, and briefs. Discussion and
specification structure comes from the manifest.

## Deliverables

1. **Structure sources, per type:**
   - **Discussion** — subtopic rail and lifecycle chips from the manifest
     (`phases.discussion.items.{topic}.subtopics` — `domain/discussion-map.cjs`), with
     document headings used as anchors when they match; the dated revision timeline
     parsed best-effort. Never from session cache (gitignored, purged at close).
   - **Specification** — sources panel wholly from the manifest
     (`sources.{name}.status`), **including consult references**
     (`consult_references.{name}.status` — they block completion exactly as pending
     sources do; a sign-off surface without them shows ready when the engine will
     refuse). Measured claims (`` `cmd` `` → result) found by pattern, rendered as chips.
   - **Investigation / review report / brief** — heading-keyed extractors (structures
     verified stable), with golden fixtures copied from the shipped template references;
     CI (Phase 0 skeleton) fails when upstream templates change shape.
   - **Research** — Read lens with light annotation only; low structure is honest.
   Hard rule everywhere: **graceful degradation** — unparsed structure renders as a clean
   Read lens with the Structure tab absent, never an error.
2. **History lens** — file timeline from git; "what moved since your sign-off" as
   `git diff <read-ref> HEAD -- <artifact>` using the Phase 3 `artifact_read_refs`
   (recorded HEAD-at-render per human per artifact; diff base = newest recorded ref).
3. **Spec sign-off surface** — typeset body, the manifest-joined sources + consult
   references panel, claim chips rendered with their recorded command and result and a
   **copy button — no re-run**. (Review verdict, accepted: executing recorded free-text
   shell commands from a browser button is unsound scope; re-measurement already lives in
   the product's own claims-verification pass, in a session.) The affordance says what it
   is — "copy to verify in a terminal" — so the fallback is signposted, not silent; where
   the work unit's review report exists, chips carry the claims-verification pass outcome
   as a best-effort badge. Gate cards deep-link to the section they concern.
4. **Roadmap surface** — horizons and items with lifecycle (waiting / pulled → the
   joined work unit / shipped), item provenance (`origin`), and links into the sessions
   record. Read-and-navigate; grooming and the pull run as lobby sessions (Phase 2).
5. **Verdict and brief cards** — review reports as verdict-first cards (findings by
   bucket, scope + blast-radius badges, commit links); briefs as three-panel cards badged
   "regenerable — not a record", linking to the session log that is. Baseline docs render
   their observed / stated / open layers distinctly.

## Explicitly out of scope

- Editing artifacts in the browser. Corrections flow through the process.
- Executing anything found inside an artifact. Ever.
- The plan DAG and delivery surfaces (Phase 5).

## Done means

- A spec sign-off gate is decidable entirely in the browser: read the spec, scan sources
  *and consult references* live from the manifest, see each claim's recorded measurement,
  see what moved since your last read.
- Deleting a template heading in an investigation fixture degrades that file to Read-only
  lens with no error anywhere else; a discussion with freeform subtopic headings still
  gets its full rail (manifest-sourced).
- The Phase 4 exit decision (live discussion map) is made on the named evidence: did
  anyone drive a discussion from the browser during dogfooding and want the rail live?

## Risks

- **Manifest-field coupling.** The discussion-map and spec-sources joins read named
  manifest fields; the Phase 0 version handshake is what bounds the blast radius when
  upstream renames one.
- **Claim-chip pattern fragility.** Measured claims are a prose convention; the chip
  finder is best-effort and its misses cost nothing (the text still renders in the body).

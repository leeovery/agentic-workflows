# Coherence Analysis

*Shared reference. Loaded by `workflow-shared/references/topic-discovery.md`.*

---

Reads all completed discussions of one epic and finds decisions that no longer cohere — unacknowledged conflicts, stale references to since-changed decisions, and owned ambiguities — and **stages** them as findings for per-finding approval. The orchestrator ([topic-discovery.md](topic-discovery.md)) handles the cache check and invokes this reference only when the cache is `stale`; it then runs the findings gate ([coherence-findings-gate.md](coherence-findings-gate.md)) and, once the gate completes, re-enters this reference at **E. Update Cache** to stamp.

This reference does not write to the discovery map and does not touch any discussion — approved findings land through the gate's triage delivery, which reopens the yielding discussion. Findings are staged from the **full corpus on every run** — coherence is a global property, so no delta-focus; cost control lives in the cache checksum (the analysis doesn't run when nothing changed) and the dismissed fingerprints (noise suppression on the output side only).

## Parameters

The caller provides these via context before loading:

- `work_unit` — the epic's work unit name.

**Precondition.** Collect `completed_discussion` (discussion items with `status: completed`). If fewer than 2, return — no staging, no cache stamp, no manifest writes.

## A. Read Artifacts

> *Output the next fenced block as a code block:*

```
Analyzing completed discussions for conflicting or stale decisions...
```

Read `.workflows/{work_unit}/discussion/{name}.md` for each `completed_discussion` name. Skip files missing on disk. Items with `triaged`, `in-progress`, or `cancelled` status are not in the input set.

For each discussion, note:
- The subtopic map — final states live in the work unit manifest under `phases.discussion.items.{name}.subtopics` (`decided` / `deferred` for completed discussions; legacy files may instead carry a Discussion Map section inline)
- Every decision made, with the section it lives in and any qualifiers or conditions attached — where a Decision block holds dated timeline entries, the top entry is the current decision and earlier entries are lineage
- References to other topics' decisions — citations, assumptions, "as decided in …" prose
- Terms and assumptions the document relies on without defining

Cross-reference across all documents — pairs of decisions that interact, prose citing another document's conclusion, and terms used differently between documents are the primary targets.

→ Proceed to **B. Identify Findings**.

## B. Identify Findings

Discussions document the journey to a decision — false paths, reversals, positions later abandoned. That record is supposed to disagree, with itself and with other documents; coherence is a property of the **settled decisions**, never the prose around them. Findings target the decision layer only.

Analyse the artifacts from A to identify findings across three categories:

1. **Unacknowledged conflict** — two documents decide incompatibly and neither cites the other. Decisions only: a position explored and walked back in journey or options prose is not a side of a conflict, however flatly it contradicts the other document. Distinguish deliberate supersession: when the newer document acknowledges it is changing an earlier decision, the conflict is acknowledged — any prose still citing the old decision is a stale reference (category 2), not a conflict. A timeline block's earlier entries are acknowledged supersession *within* the document; prose elsewhere still citing a superseded entry as current is a stale reference.

2. **Stale reference** — prose (cross-document, or within one document) that relies, as current, on a decision that has since changed, where the newer document acknowledges the change. The decision record is coherent; the citing prose is out of date. Narration of what was believed at the time is history, not staleness.

3. **Owned ambiguity** — a term or assumption used inconsistently across documents, with a clear home document that owns the definition. The inconsistency would propagate into specification if left unresolved.

**Evidence discipline.** A finding exists only with verbatim quotes from **both** locations, each cited as file + section. No quote, no candidate — drop it.

For each finding, record:
- The category (from the three above)
- Both quotes with their file + section citations
- The **target** — the yielding document: the one to reopen and correct (for a conflict, the document whose decision should be re-decided against the other; for a stale reference, the document carrying the outdated prose; for an ambiguity, the home document that owns the definition)
- The **counterpart** — the other document in the pair. A single-document finding (both quotes from one document — stale prose beside its own changed decision) has none: record `(none)`
- Why it matters — what breaks downstream if specification extracts both sides as-is

An observation that has no owning document — an ambiguity with no clear home, a theme suggesting new work — is not a finding. Note it in the cache file (**E**) only; new topics are gap-analysis's lane.

→ Proceed to **C. Fingerprint and Filter**.

## C. Fingerprint and Filter

Compute each finding's fingerprint: `{docA}|{docB}|{slug}` — the two document basenames (without `.md`) sorted alphabetically, plus a short kebab-case slug naming the finding. A single-document finding uses `{doc}|{slug}`.

Read the filter input:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.discovery dismissed_findings
```

Drop a finding when it matches an entry in `dismissed_findings` — match semantically against the entry's docs + slug (the same issue re-surfaced under a rephrased slug is still dismissed), not by string equality alone.

Dropped findings still appear in the cache file (**E**) — filtering shapes what the gate presents, never the analysis record.

→ Proceed to **D. Stage**.

## D. Stage

Initialise the staging file fresh (overwrite any prior pass) at `.workflows/{work_unit}/.state/coherence-analysis-candidates.md` — pure markdown, content only; the gate state lives in the manifest and is initialised after staging (below). This reference is only invoked for staging when no pending candidates remain from a deferred run, so overwriting is safe.

Append one block per surviving finding:

```markdown
## {slug}
category: {conflict|stale-reference|ambiguity}
docs: {docA}.md, {docB}.md
summary: {one-line statement of the finding}
target: {the yielding doc, without .md}
counterpart: {the other doc, without .md}

> {docA}.md · {section}: "{verbatim quote}"

> {docB}.md · {section}: "{verbatim quote}"

{full context paragraphs — what each side decided, how they collide or drifted, and what resolving it in the target means}
```

Carry everything the reopened session needs to resolve the finding from cold — the quotes anchor it, the context paragraphs explain it. A single-document finding lists the one document on `docs:`, cites both quotes from it, and carries `counterpart: (none)`.

Once all findings are staged, register the gate state — one batched write, one row per staged finding (skip the call when nothing was staged):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.discovery analysis_staging.coherence-analysis.gate_mode=gated analysis_staging.coherence-analysis.candidates.{slug}.status=pending …
```

→ Return to caller.

## E. Update Cache

Invoked by [topic-discovery.md](topic-discovery.md) after the findings gate has run, regardless of how many findings were approved — a skip-all pass still stamps, so the analysis won't re-fire on every boot. Not reached when the gate is deferred (the host skips this section so the staging file is re-presented next boot).

Update the cache file at `.workflows/{work_unit}/.state/coherence-analysis.md` (pure markdown, no frontmatter):

```bash
mkdir -p .workflows/{work_unit}/.state
```

Overwrite with the findings list:

```markdown
# Coherence Analysis Cache

## Findings

### {slug}
- **Category**: {conflict|stale-reference|ambiguity}
- **Docs**: {docA}.md, {docB}.md
- **Summary**: {one-line statement}
- **Target**: {yielding doc}

### {another slug}
- **Category**: {conflict|stale-reference|ambiguity}
- **Docs**: {docA}.md, {docB}.md
- **Summary**: {one-line statement}
- **Target**: {yielding doc}

## Notes

- {unowned observations from B — ambiguities with no home doc, themes suggesting new topics}
```

List every finding from **B**, including those filtered in **C** — the cache file is the analysis output, not the diff. Omit the Notes section when there are none. If re-entered on a reuse boot where **B** did not run this session (a deferred staging file was picked up), source the findings list from the staging file's blocks instead — that file holds only the surviving findings, so the rebuilt cache is narrower than a fresh pass; the next content change re-runs the full analysis.

Stamp the manifest's coherence_analysis_cache — one command checksums the completed discussion files, writes `checksum`, `generated`, and `input_files`, and indexes the cache file into the knowledge base so its content surfaces in future contextual queries:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs cache stamp {work_unit} coherence-analysis
```

**If the response is `ok: false`:**

Landings reopened every completed discussion, leaving nothing to checksum. Skip the stamp — the cache re-arms on its own once the reopened discussions re-complete. Not an abort; continue.

→ Return to caller.

**Otherwise:**

If the response carries `warnings`, surface them to the user but do not abort — the cache file is already on disk and the manifest is updated; indexing retries on the next analysis re-run.

→ Return to caller.

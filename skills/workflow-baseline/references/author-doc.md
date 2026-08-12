# Author the Area Doc

*Reference for **[interview-loop](interview-loop.md)** — loaded per drained area with area = `{area}`.*

---

Weave the area's dossier and interview record into `.workflows/.baseline/{area}.md`, get the user's skim, then index and commit it.

## A. Weave

Write the doc from the dossier (observed layer) and the agenda (stated layer + open threads):

```markdown
# {Area title}

## Verdict

{One paragraph: what this thing actually is.}

## Observed

{The structure the code shows — boundaries, lifecycles, invariants, integrations. Anchored to stable names: classes, enums, subsystems, pipelines — never file:line, which churns.}

## Decisions

{The stated layer — one entry per captured decision: what was decided, and the why in the user's words, each tagged `(stated)`. Candidate rationales the user rejected are worth a clause — a named wrong path is knowledge too.}

## Open Questions

- OPEN: {asked and unanswered, or never asked — each specific enough that a future session knows what would settle it}
```

Rules:

- **Three layers, structurally separated** — observed claims never migrate into Decisions, and nothing fills an `OPEN:` with a plausible guess. The section a claim sits in is its provenance.
- **Code outranks memory on mechanism.** A `**Correction**:` from the interview is verified against the code before Observed carries it; where the code contradicts the recollection, the observation stands and the user's view is recorded `(stated)` beside it. Intent has no such check — the user is its only source.
- **Open Questions collects every open thread** — the agenda's `open` rows and its `### Open Threads` entries (the un-asked tail, unresolved inferences, uncovered boundary ground).
- **Stable names only** — a future agent greps and semantically matches on names; line numbers rot.
- **Hold what a fresh session won't rebuild** — identity, vocabulary, lifecycles, the WHY, the unknowns. Structure an agent can re-derive by reading code earns a line, not a section.
- **A deepened area extends its existing doc, never replaces it** — new observed material merges into Observed, new decisions append, Open Questions reconcile (answered ones leave, new ones join); existing Decisions entries are never dropped.

→ Proceed to **B. Skim**.

## B. Skim

Summarise the doc in two or three sentences of prose — the verdict, and what it holds (how many observed claims, captured decisions, open questions). The full text stays on disk behind `v/view`; never dump it unasked.

Fetch the gate and emit its `MENU: baseline doc gate` section verbatim as markdown (not a code block):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render baseline-doc-gate
```

**STOP.** Wait for user response.

**If `view`:**

Render the doc file verbatim as markdown, then re-fetch and emit the gate.

**STOP.** Wait for user response.

**If the user adjusts:**

Apply the changes to the doc, restate the summary, then re-fetch and emit the gate.

**STOP.** Wait for user response.

**If `approve`:**

→ Proceed to **C. Land**.

## C. Land

Index the doc, mark the area, and commit:

```bash
node .claude/skills/workflow-knowledge/scripts/knowledge.cjs index .workflows/.baseline/{area}.md
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set project.baseline.areas.{area} completed
node .claude/skills/workflow-engine/scripts/engine.cjs commit --workflows -m "baseline({area}): document the {area} baseline"
```

A failed `index` is queued by the CLI for retry on its next call — note it to the user in one line and continue; the doc and commit still land.

→ Return to caller.

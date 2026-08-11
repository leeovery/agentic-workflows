# Resolve Source Incoherence

*Reference for **[workflow-specification-process](../SKILL.md)** — loaded by [spec-construction.md](spec-construction.md) when source material disagrees or cannot be extracted without assumption.*

---

Specification makes decisions clear; it never makes them. `{doc}` throughout is the owning source's topic name; its artifact path resolves per the source ladder in **[spec-review.md](spec-review.md)** (sources can be investigations or research files, not only discussions). `{work_unit}` and `{topic}` are in context from the construction session.

Classification is yours, never the user's — no raise asks them to name what kind of problem this is. The line between settling here and routing back is effort: a brief exchange settles it here; anything needing real discussion work goes back to the phase that owns decisions. Every raise gives the user enough to weigh in from — the payload carries the situation, the evidence, and the stakes, and the engine renders it. Start at **A. Classify**.

## A. Classify

Pick by first match:

#### If the timeline resolves it

One side is acknowledged supersession — a dated Decision-block entry, or prose the newer decision names as changed. Not incoherence: extract the governing decision.

→ Return to caller.

#### If it is a repair of record

The decisions cohere; one document's prose relies, as current, on a value or mechanism another document has since moved, and the citing conclusion survives the correction. No choice exists — no stop, on either gate mode.

→ Proceed to **D. Landing a Resolution** with resolution = `{the repair}`, doc = `{the citing document's topic}`, origin = `repair`.

#### If a brief exchange settles it and the sources document the sides

The sources decide incompatibly, or frame the alternatives, and the user picking a side settles it. **This stop overrides `auto`** — no choice is ever made without the user. Write the raise-and-gate payload to `.workflows/.cache/{work_unit}/specification/{topic}/incoherence-gate.json` with the Write tool — `{"doc": "{doc}", "title": "{the collision, one line}", "context": "{what collides and how the documents drifted}", "quotes": [{"doc": "{name}", "section": "{section}", "quote": "{verbatim}"}, …], "stakes": "{what breaks if extraction proceeds anyway}", "sides": [{"summary": "{one line}", "recommended": true}, {"summary": "{one line}"}]}` — one entry per side, at most one recommended — and fetch the gate, emitting each section verbatim at its marked instruction (the numbered options render recommended-first; the branches below key on that order):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render incoherence-gate {work_unit}.specification.{topic} --file .workflows/.cache/{work_unit}/specification/{topic}/incoherence-gate.json --variant conflict
```

**STOP.** Wait for user response.

**If the user picks a side:**

→ Proceed to **D. Landing a Resolution** with resolution = `{the chosen decision}`, doc = `{the yielding document's topic}`, origin = `decision`.

**If comment:**

Work it through conversationally, then re-classify against what the exchange produced.

A settled resolution lands like a picked side:

→ Proceed to **D. Landing a Resolution** with resolution = `{the settled decision}`, doc = `{the yielding document's topic}`, origin = `decision`.

An exchange that moved the ground but left the choice open re-presents the gate (rewrite the payload, re-fetch):

→ Return to **A. Classify** (the gate above).

An exchange showing nothing can stand without work the sources never did — neither side survives, or the answer needs ground no source lays — is a genuine gap:

→ Proceed to **B. The Gap Exit**.

#### If a brief exchange settles it and no sides are documented

The material is unclear, or silent on a point a direct answer fills, and nothing in the record frames alternatives to choose between. **This stop overrides `auto`.** Put the question to the user in conversation — what the topic needs, where the sources stop short, what the answer unlocks. No engine surface: this is an exchange, not a gate.

**STOP.** Wait for user response.

On an answer that settles it:

→ Proceed to **D. Landing a Resolution** with resolution = `{the settled decision}`, doc = `{the owning source's topic}`, origin = `decision`.

If the exchange shows it needs more than this session can give:

→ Proceed to **B. The Gap Exit**.

#### If it is a genuine gap

Settling it needs real discussion work — exploration the sources never did, more than a brief exchange gives — whether nothing was ever decided or the decided positions collide too deeply to pick between here.

→ Proceed to **B. The Gap Exit**.

## B. The Gap Exit

The gap belongs to the phase that owns decisions. There is no consent gate: the raise states what is missing and where it is going, then the routing runs. The user's lever is conversational — an objection arriving before the routing lands is honoured: stop, work it per **A. Classify**. A session holding several distinct gaps runs this exit once per owning document — raise, land — and proceeds to **C. Pause the Specification** only after the last; the specification pauses once.

Write the raise payload to `.workflows/.cache/{work_unit}/specification/{topic}/incoherence-gate.json` with the Write tool — `{"doc": "{the owning source's topic}", "title": "{what is missing, one line}", "context": "{what the topic needs and why no source decides it}", "quotes": [{"doc": "{name}", "section": "{section}", "quote": "{verbatim, where sources frame the adjacent ground}"}, …], "stakes": "{what cannot be written until this is decided}"}` (`quotes` and `stakes` where they exist) — and fetch the raise, emitting its section verbatim at its marked instruction (display-only — the stated routing intent is its closing line):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render incoherence-gate {work_unit}.specification.{topic} --file .workflows/.cache/{work_unit}/specification/{topic}/incoherence-gate.json --variant gap-route
```

Then route the gap:

#### If the work type is `epic`

→ Load **[../../workflow-shared/references/triage-landing.md](../../workflow-shared/references/triage-landing.md)** with work_unit = `{work_unit}`, target = `{doc}`, concern = `{the gap: what the topic needs, both quotes where sources frame it, what was just explored}`, origin = `{topic}`, phase = `specification`, landing_phase = `discussion`, date = `{today}`.

On return, read `result`.

**If `result` is `cancelled`:**

The user pushed back inside the landing — nothing landed; the concern stays with this session.

→ Return to **A. Classify**.

**If `result` is `landed`:**

→ Proceed to **C. Pause the Specification**.

#### If the work type is not `epic`

Single-topic work types route back directly — reopen the owning source item (its phase is the source's own: `discussion`, or `investigation` for a bugfix):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic reopen {work_unit} {source phase} {doc}
```

Tell the user what the reopened session must settle — the gap travels as conversation here, not as a queue file.

→ Proceed to **C. Pause the Specification**.

## C. Pause the Specification

An `incorporated` row for that source has flipped to `stale` and reconciles at re-entry; a still-`pending` row simply re-extracts the updated document when construction resumes — either way the engine refuses to conclude this spec until the source is current. Commit the session's work:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "spec({work_unit}): pause — gap routed to {doc}"
```

Tell the user: this specification waits on that discussion — have it there, re-enter the spec after. Do not run document dependencies, review, or conclusion.

**STOP.** Do not proceed — terminal condition.

## D. Landing a Resolution

The resolution is written into the owning source document in that phase's own idiom — no meta-narration, no reference to specification or to this session: the document reads as its own record.

1. **Check presence**: `node .claude/skills/workflow-engine/scripts/engine.cjs presence scan {work_unit}` — read the `sessions` rows only; the response's deferral section is scoped to the analysis dispatch and is not emitted here.

   **If a row matches `{doc}`'s phase and topic with `held` and `live` both true** — a live session owns that document. Do not edit. Write `{"doc": "{doc}"}` to `.workflows/.cache/{work_unit}/specification/{topic}/incoherence-gate.json` with the Write tool and fetch the gate, emitting its section verbatim at its marked instruction:

   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs render incoherence-gate {work_unit}.specification.{topic} --file .workflows/.cache/{work_unit}/specification/{topic}/incoherence-gate.json --variant held-doc
   ```

   **STOP.** Wait for user response. On `next`: for an epic, first deliver the resolution to that session's queue (the triage delivery in **B**, concern = the agreed resolution); → Return to caller — construction moves to the next topic. On `stop`: same delivery where the work type is `epic`, then commit the session's work and stop — terminal condition.

   **Otherwise** — no row holds `{doc}`:

   → Proceed to step 2.

2. **Edit the document** — targeted, in the owning phase's own idiom. A discussion's decided Decision block is revised as its format prescribes (**[../../workflow-discussion-process/references/template.md](../../workflow-discussion-process/references/template.md)** → Decision revisions): the new decision lands as a dated timeline entry above the prior prose, wrapped verbatim under `#### Initial`, with the `Trigger:` line citing the substantive cause — the colliding decision, never this session. Citing prose the resolution invalidates is repaired in place. Investigation and research documents carry no timeline rule — edit the affected passages directly.
3. **Reindex it**: `node .claude/skills/workflow-knowledge/scripts/knowledge.cjs index {the resolved artifact path}` — the knowledge base serves the resolution for the rest of the work.
4. **Stale the other extractions** — only when `{doc}` is a discussion (the reverse join covers discussion sources; single-topic work types have no sibling specs and skip this): `node .claude/skills/workflow-engine/scripts/engine.cjs sources stale {work_unit} {doc} --except {topic}`. When the response's `staled` is non-empty, tell the user in one line which specification(s) it named.
5. **Commit**: `node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "{source phase}({work_unit}/{doc}): {what the resolution settled}" --topic {source phase}/{doc} --kb`.

**If origin is `repair`:**

Carry a one-line note into the next **B** presentation in [spec-construction.md](spec-construction.md) — rendered after the content, above the gate (on `auto`, appended after the auto announcement), never inside the content block the specification logs: `Resolved along the way: {what was repaired}.`

→ Return to caller.

**If origin is `decision`:**

The topic continues against the updated source.

→ Return to caller.

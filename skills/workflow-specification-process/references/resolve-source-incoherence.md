# Resolve Source Incoherence

*Reference for **[workflow-specification-process](../SKILL.md)** — loaded by [spec-construction.md](spec-construction.md) when source material disagrees or cannot be extracted without assumption.*

---

Specification makes decisions clear; it never makes them — and classification is yours. `{doc}` throughout is the owning source's topic name; its artifact path resolves per the source ladder in **[spec-review.md](spec-review.md)** (sources can be investigations or research files, not only discussions). `{work_unit}` and `{topic}` are in context from the construction session.

Three moves, by effort. Anything the record settles is derived silently — that is the phase doing its job, and it earns no mention. A point a brief exchange settles stops for the user and lands their answer in the owning document. A gap needing real discussion work stops, routes back, and pauses the spec. Start at **A. Classify**.

## A. Classify

Pick by first match:

#### If the record settles it

One side is acknowledged supersession — a dated Decision-block entry, or prose the newer decision names as changed — or the mismatch is derivable without any real choice (one document's prose leans on a value another has since moved, and the citing conclusion survives). Extract the governing decision and move on: no raise, no mention, no edit to any source document.

→ Return to caller.

#### If a brief exchange settles it and the sources document the sides

The sources decide incompatibly, or frame the alternatives, and the user picking a side settles it. Take a stance — one side carries `recommended`. **This stop overrides `auto`** — no choice is ever made without the user. Write the raise-and-gate payload to `.workflows/.cache/{work_unit}/specification/{topic}/incoherence-gate.json` with the Write tool — `{"doc": "{doc}", "title": "{the collision, one line}", "context": "{what collides and how the documents drifted}", "quotes": [{"doc": "{name}", "section": "{section}", "quote": "{verbatim}"}, …], "stakes": "{what breaks if extraction proceeds anyway}", "sides": [{"summary": "{one line}", "recommended": true}, {"summary": "{one line}"}]}` — one entry per side, at most one recommended — and fetch the gate, emitting each section verbatim at its marked instruction (the numbered options render recommended-first; the branches below key on that order):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render incoherence-gate {work_unit}.specification.{topic} --file .workflows/.cache/{work_unit}/specification/{topic}/incoherence-gate.json --variant conflict
```

**STOP.** Wait for user response.

**If the user picks a side:**

→ Proceed to **C. Landing a Resolution** with resolution = `{the chosen decision}`, doc = `{the yielding document's topic}`.

**If comment:**

Work it through conversationally, then re-classify against what the exchange produced.

A settled resolution lands like a picked side:

→ Proceed to **C. Landing a Resolution** with resolution = `{the settled decision}`, doc = `{the yielding document's topic}`.

An exchange that moved the ground but left the choice open re-presents the gate (rewrite the payload, re-fetch):

→ Return to **A. Classify** (the gate above).

An exchange showing nothing can stand without work the sources never did — neither side survives, or the answer needs ground no source lays — is a genuine gap:

→ Proceed to **B. The Gap Exit**.

#### If a brief exchange settles it and no sides are documented

The material is unclear, or silent on a point a direct answer fills, and nothing in the record frames alternatives to choose between. **This stop overrides `auto`.** Put the question to the user in conversation — what the topic needs, where the sources stop short, what the answer unlocks — and take a stance. No engine surface: this is an exchange, not a gate.

**STOP.** Wait for user response.

**If the answer settles it:**

→ Proceed to **C. Landing a Resolution** with resolution = `{the settled decision}`, doc = `{the owning source's topic}`.

**If the exchange shows it needs more than this session can give:**

→ Proceed to **B. The Gap Exit**.

#### If it is a genuine gap

Settling it needs real discussion work — exploration the sources never did, more than a brief exchange gives — whether nothing was ever decided or the decided positions collide too deeply to pick between here.

→ Proceed to **B. The Gap Exit**.

## B. The Gap Exit

First check the specification is still live — a parallel session can collapse it from under this one:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.specification.{topic} status
```

#### If the status is `cancelled`, `superseded`, or `promoted`

The specification collapsed while this session held it. Tell the user what happened and stop — nothing routes, nothing lands.

**STOP.** Do not proceed — terminal condition.

#### Otherwise

Raise the gap and its acknowledgement gate — a confirm, not a choice: the gap must be filled, and the gate exists so the stop is seen before anything moves. Write the payload to `.workflows/.cache/{work_unit}/specification/{topic}/incoherence-gate.json` with the Write tool — `{"doc": "{the owning source's topic}", "title": "{what is missing, one line}", "context": "{what the topic needs and why no source decides it}", "quotes": [{"doc": "{name}", "section": "{section}", "quote": "{verbatim, where sources frame the adjacent ground}"}, …], "stakes": "{what cannot be written until this is decided}"}` (`quotes` and `stakes` where they exist) — and fetch the gate, emitting each section verbatim at its marked instruction:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render incoherence-gate {work_unit}.specification.{topic} --file .workflows/.cache/{work_unit}/specification/{topic}/incoherence-gate.json --variant gap-route
```

**STOP.** Wait for user response.

**If `yes`:**

Land the gap in the owning document's triage queue — its item reopens and the queued concern survives any context clear; the reopened session surfaces it and cannot conclude without folding it.

**If the work type is `epic`:**

→ Load **[../../workflow-shared/references/triage-landing.md](../../workflow-shared/references/triage-landing.md)** with work_unit = `{work_unit}`, target = `{doc}`, concern = `{the gap: what the topic needs, both quotes where sources frame it, what was just explored}`, origin = `{topic}`, phase = `specification`, landing_phase = `discussion`, date = `{today}`.

On return, read `result`.

**If `result` is `landed`:**

The delivery committed itself.

→ Proceed to **D. Pause the Specification**.

**If `result` is `cancelled`:**

Re-read the spec item's status as at the top of this section; a terminal status takes the collapse exit there. Otherwise the concern stays with this session — work it through with the user:

→ Return to **A. Classify**.

**If the work type is not `epic`:**

Write the concern (what the topic needs, the quotes where sources frame it, what was just explored) to `.workflows/.cache/{work_unit}/specification/{topic}/gap-concern.md` with the Write tool, then deliver it — the transaction reopens the source item, queues the concern, and commits itself (`{source phase}` is the source's own: `discussion`, or `investigation` for a bugfix):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic triage {work_unit} {source phase} {doc} --concern .workflows/.cache/{work_unit}/specification/{topic}/gap-concern.md --slug {kebab-case gap name} -m "spec({work_unit}): gap routed to {doc}"
```

→ Proceed to **D. Pause the Specification**.

**If comment:**

The objection is the conversation — work it per the settleable branches.

→ Return to **A. Classify**.

## C. Landing a Resolution

The resolution is written into the owning source document in that phase's own idiom — no meta-narration, no reference to specification or to this session: the document reads as its own record.

1. **Check presence**: `node .claude/skills/workflow-engine/scripts/engine.cjs presence scan {work_unit}` — read the `sessions` rows only; the response's deferral section is scoped to the analysis dispatch and is not emitted here.

   **If a row matches `{doc}`'s phase and topic with `held` and `live` both true** — a live session owns that document. Do not edit. Write `{"doc": "{doc}"}` to `.workflows/.cache/{work_unit}/specification/{topic}/incoherence-gate.json` with the Write tool and fetch the gate, emitting its section verbatim at its marked instruction:

   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs render incoherence-gate {work_unit}.specification.{topic} --file .workflows/.cache/{work_unit}/specification/{topic}/incoherence-gate.json --variant held-doc
   ```

   **STOP.** Wait for user response. Either answer first delivers the agreed resolution to the held session's queue — epic: load **[../../workflow-shared/references/triage-landing.md](../../workflow-shared/references/triage-landing.md)** with work_unit = `{work_unit}`, target = `{doc}`, concern = `{the agreed resolution}`, origin = `{topic}`, phase = `specification`, landing_phase = `discussion`, date = `{today}`; other work types: the `topic triage` transaction shown in **B**, concern = the agreed resolution. Then, on `next`: → Return to caller — construction sets this topic's remaining extraction aside and continues with others; its unextracted rows hold conclusion until the resolution lands. On `stop`: commit the session's work and stop — terminal condition.

   **Otherwise** — no row holds `{doc}`:

   → Proceed to step 2.

2. **Edit the document** — targeted, in the owning phase's own idiom. A discussion's decided Decision block is revised as its format prescribes (**[../../workflow-discussion-process/references/template.md](../../workflow-discussion-process/references/template.md)** → Decision revisions): the new decision lands as a dated timeline entry above the prior prose, wrapped verbatim under `#### Initial`, with the `Trigger:` line citing the substantive cause — the colliding decision, never this session. Citing prose the resolution invalidates is repaired in place. Investigation and research documents carry no timeline rule — edit the affected passages directly.
3. **Reindex it**: `node .claude/skills/workflow-knowledge/scripts/knowledge.cjs index {the resolved artifact path}` — the knowledge base serves the resolution for the rest of the work.
4. **Stale the other extractions** — only when `{doc}` is a discussion (the reverse join covers discussion sources; single-topic work types have no sibling specs and skip this): `node .claude/skills/workflow-engine/scripts/engine.cjs sources stale {work_unit} {doc} --except {topic}`. When the response's `staled` is non-empty, tell the user in one line which specification(s) it named.
5. **Commit**: `node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "{source phase}({work_unit}/{doc}): {what the resolution settled}" --topic {source phase}/{doc} --kb`.

The topic continues against the updated source.

→ Return to caller.

## D. Pause the Specification

#### If another gap awaits its raise

Each gap gets its own raise, acknowledgement, and landing; the specification pauses once, after the last.

→ Return to **B. The Gap Exit**.

#### Otherwise

An `incorporated` row for each routed source has flipped to `stale` and reconciles at re-entry; a still-`pending` row simply re-extracts the updated document when construction resumes — either way the engine refuses to conclude this spec, and its entry blocks, until every routed source re-concludes. Commit the session's work:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "spec({work_unit}): pause — gap routed to {doc}"
```

Tell the user: this specification is blocked until the reopened item(s) re-conclude — name them (`{doc}`, each of them). Do not run document dependencies, review, or conclusion.

Invoke the work type's navigation skill (Skill tool) so the user lands back on their menu with the reopened work in view: `/workflow-continue-epic {work_unit}` for an epic, `/workflow-continue-feature {work_unit}` for a feature, `/workflow-continue-bugfix {work_unit}` for a bugfix, `/workflow-continue-cross-cutting {work_unit}` for a cross-cutting concern.

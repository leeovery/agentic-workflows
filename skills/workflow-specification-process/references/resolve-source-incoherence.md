# Resolve Source Incoherence

*Reference for **[workflow-specification-process](../SKILL.md)** — loaded by [spec-construction.md](spec-construction.md) and [process-review-findings.md](process-review-findings.md) when source material disagrees — with itself, another source, or the codebase it describes — or cannot be extracted without assumption.*

---

Specification makes decisions clear; it never makes them — and classification is yours. `{lane}` is the calling flow's lane — `construction` from spec construction, `review` from the findings walk — set by the caller's Load directive; its gate mode field (`construction_gate_mode` / `finding_gate_mode`) is the one every auto check here reads. `{doc}` throughout is the owning source's topic name; its artifact path resolves per the source ladder in **[spec-review.md](spec-review.md)** (sources can be investigations or research files, not only discussions). `{work_unit}` and `{topic}` are in context from the calling session. A caller routing a review finding also names its `category`; construction, which routes material rather than a finding, names none.

Four moves, by effort. A measured falsehood is never a silent derivation — reality corrects the record, and the correction lands in the owning document, never in the spec alone. Anything else the record settles is derived silently — that is the phase doing its job, and it earns no mention. A point a brief exchange settles stops for the user and lands their answer in the owning document. A gap needing real discussion work stops, routes back, and pauses the spec. Start at **A. Classify**.

## A. Classify

Pick by first match:

#### If direct measurement contradicts it

A claim about the codebase or toolchain fails against the tree. Re-run the measurement before classifying — quote the command and its result in the exchange that follows; a remembered figure, or one asserted as verified earlier in the session, is not a measurement.

**If every conclusion, decision, and insight citing the claim survives the corrected value** — or nothing cites it at all:

Tell the user in one line what was measured and what it corrects — no gate; the measurement made the choice.

→ Proceed to **C. Landing a Resolution** with resolution = `{the corrected claim, carrying its command and result}`, doc = `{the owning source's topic}`.

**Otherwise** — the corrected value undermines a conclusion, decision, or insight built on the claim:

**This stop overrides `auto`.** Where `{lane}`'s gate mode holds `auto` — re-read it if it is not current in context (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.specification.{topic} {construction_gate_mode|finding_gate_mode}`) — open with the announcement verbatim — **Auto is on — stopping anyway:** this is one of the calls auto never makes for you. Then put the measurement to the user in conversation — what the document asserts, what the command measured, which conclusion leans on it — and take a stance on whether the conclusion survives. No engine surface: this is an exchange, not a gate.

**STOP.** Wait for user response.

**If the answer settles it:**

→ Proceed to **C. Landing a Resolution** with resolution = `{the settled position, carrying the corrected measurement}`, doc = `{the owning source's topic}`.

**If the exchange shows it needs more than this session can give:**

→ Proceed to **B. The Gap Exit**.

#### If the record settles it

One side is acknowledged supersession — a dated Decision-block entry, or prose the newer decision names as changed — or the mismatch is derivable without any real choice (one document's prose leans on a value another has since moved, and the citing conclusion survives). Extract the governing decision and move on: no raise, no mention, no edit to any source document.

→ Return to caller.

#### If a brief exchange settles it and the sources document the sides

The sources decide incompatibly, or frame the alternatives, and the user picking a side settles it. The sides are quoted from the documents, never composed here: where you would have to write the alternatives yourself, they are not documented and this is not the branch. `category` = `Unsourced decision` excludes it outright — a point no source decides has no documented sides — and so does any material whose collision you cannot cite. Take a stance — one side carries `recommended`. **This stop overrides `auto`** — no choice is ever made without the user. Write the raise-and-gate payload to `.workflows/.cache/{work_unit}/specification/{topic}/incoherence-gate.json` with the Write tool — `{"doc": "{doc}", "lane": "{lane}", "title": "{the collision, one line}", "context": "{what collides and how the documents drifted}", "quotes": [{"doc": "{name}", "section": "{section}", "quote": "{verbatim}"}, …], "stakes": "{what breaks if extraction proceeds anyway}", "sides": [{"summary": "{one line}", "recommended": true}, {"summary": "{one line}"}]}` — one entry per side, at most one recommended — and fetch the gate, emitting each section verbatim at its marked instruction (the numbered options render recommended-first; the branches below key on that order):

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

The material is unclear, or silent on a point a direct answer fills, and nothing in the record frames alternatives to choose between. An **Unsourced decision** lands here whenever a brief exchange can settle it: the specification decided something its sources never did, and the question is what the sources should have said. **This stop overrides `auto`.** Where `{lane}`'s gate mode holds `auto` — re-read it if it is not current in context (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.specification.{topic} {construction_gate_mode|finding_gate_mode}`) — open with the announcement verbatim — **Auto is on — stopping anyway:** this is one of the calls auto never makes for you. Then put the question to the user in conversation — what the topic needs, where the sources stop short, what the answer unlocks — and take a stance. No engine surface: this is an exchange, not a gate.

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

Raise the gap and its acknowledgement gate — a confirm, not a choice: the gap must be filled, and the gate exists so the stop is seen before anything moves. Write the payload to `.workflows/.cache/{work_unit}/specification/{topic}/incoherence-gate.json` with the Write tool — `{"doc": "{the owning source's topic}", "lane": "{lane}", "title": "{what is missing, one line}", "context": "{what the topic needs and why no source decides it}", "quotes": [{"doc": "{name}", "section": "{section}", "quote": "{verbatim, where sources frame the adjacent ground}"}, …], "stakes": "{what cannot be written until this is decided}"}` (`quotes` and `stakes` where they exist) — and fetch the gate, emitting each section verbatim at its marked instruction:

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

   **If a row matches `{doc}`'s phase and topic with `held` and `live` both true** — a live session owns that document. Do not edit. Write `{"doc": "{doc}", "lane": "{lane}"}` to `.workflows/.cache/{work_unit}/specification/{topic}/incoherence-gate.json` with the Write tool and fetch the gate, emitting its section verbatim at its marked instruction:

   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs render incoherence-gate {work_unit}.specification.{topic} --file .workflows/.cache/{work_unit}/specification/{topic}/incoherence-gate.json --variant held-doc
   ```

   **STOP.** Wait for user response. Either answer first delivers the agreed resolution to the held session's queue — epic: load **[../../workflow-shared/references/triage-landing.md](../../workflow-shared/references/triage-landing.md)** with work_unit = `{work_unit}`, target = `{doc}`, concern = `{the agreed resolution}`, origin = `{topic}`, phase = `specification`, landing_phase = `discussion`, date = `{today}`; other work types: the `topic triage` transaction shown in **B**, concern = the agreed resolution. The delivery flags the source's extractions stale (and reopens a completed source); this specification cannot conclude while its row for `{doc}` is `pending` or `stale`. A `cancelled` result from the landing delivered nothing — the point stays with this session: → Return to **A. Classify**. Then, on `next`: → Return to caller — the resolution is queued, not landed: construction sets this topic's remaining extraction aside and continues with others; a findings walk leaves the specification's copy untouched and continues with its remaining findings. On `stop`: commit the session's work and stop — terminal condition.

   **Otherwise** — no row holds `{doc}`:

   → Proceed to step 2.

2. **Edit the document** — targeted, in the owning phase's own idiom. A discussion's decided Decision block is revised as its format prescribes (**[../../workflow-discussion-process/references/template.md](../../workflow-discussion-process/references/template.md)** → Decision revisions): the new decision lands as a dated timeline entry above the prior prose, wrapped verbatim under `#### Initial`, with the `Trigger:` line citing the substantive cause — the colliding decision, or the failed measurement as its command and result — never this session or the specification: the record explains itself in its own terms. Citing prose the resolution invalidates is repaired in place — and the claim rarely lives in one place: whatever the document type, search it for the claim's terms and repair every restatement — in a discussion, check the Summary's Key Insights and Current State. A resolved document that still asserts what the resolution invalidated — a disproven measurement or a superseded position alike — is not resolved. A correction that revises no decision — a measured value and the prose citing it — is repaired in place wherever it sits. A decision the document never made lands as a new subtopic section in the template's subtopic shape — Context, Options Considered where sides were weighed, Journey, Decision — with no timeline entry and no `#### Initial` (there is no prior block to revise), and no Discussion Map registration: the map tracks live sessions, and the completed record gains the section alone. The section speaks in the document's own voice throughout: Context and Journey state why the record needed this ground in the topic's own terms — no sentence names the specification, a review, or this session as what raised it. Investigation and research documents carry no timeline rule — edit the affected passages directly; the every-restatement sweep applies to them all the same.
3. **Reindex it**: `node .claude/skills/workflow-knowledge/scripts/knowledge.cjs index {the resolved artifact path}` — the knowledge base serves the resolution for the rest of the work.
4. **Stale the other extractions.** Single-topic work types skip this step — no sibling specs exist — and so does a non-discussion `{doc}` (the reverse join covers discussion sources). For an epic whose `{doc}` is a discussion, run `node .claude/skills/workflow-engine/scripts/engine.cjs sources stale {work_unit} {doc} --except {topic}`; when the response's `staled` is non-empty, tell the user in one line which specification(s) it named.
5. **Commit**: `node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "{source phase}({work_unit}/{doc}): {what the resolution settled}" --topic {source phase}/{doc} --kb --sweep`. `--kb` carries the reindex; `--sweep` says the topic is somebody else's.

The caller continues against the updated source.

→ Return to caller.

## D. Pause the Specification

#### If another gap awaits its raise

Each gap gets its own raise, acknowledgement, and landing; the specification pauses once, after the last.

→ Return to **B. The Gap Exit**.

#### Otherwise

An `incorporated` row for each routed source has flipped to `stale` and reconciles at re-entry; a still-`pending` row simply re-extracts the updated document when construction resumes — either way the engine refuses to conclude this spec, and its entry blocks, until every routed source re-concludes. Commit the session's work:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "spec({work_unit}): pause — gap routed to {doc}" --topic specification/{topic}
```

Tell the user: this specification is blocked until the reopened item(s) re-conclude — name them (`{doc}`, each of them). Do not run document dependencies, review, or conclusion.

Invoke the work type's navigation skill (Skill tool) so the user lands back on their menu with the reopened work in view: `/workflow-continue-epic {work_unit}` for an epic, `/workflow-continue-feature {work_unit}` for a feature, `/workflow-continue-bugfix {work_unit}` for a bugfix, `/workflow-continue-cross-cutting {work_unit}` for a cross-cutting concern.

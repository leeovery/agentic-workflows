# Correcting Historical Artifacts

*Shared reference for all workflow skills.*

---

Load this when a **concluded specification** — surfaced by a knowledge query, read directly, or named in a downstream phase's findings — carries a claim you have verified is wrong or has shifted. The specification is the golden record: its knowledge-base chunks stay live at full confidence, so a wrong claim left standing is re-served as validated context to every future query — and an edit that skips the re-index leaves the store serving the old content indefinitely. No other phase artifact is corrected this way — research, discussion, and investigation feed the spec and decay in the knowledge base; a wrong claim in one is superseded by current work and left to age out.

Derive the owning work unit and the topic from the specification's path (`.workflows/{owning_work_unit}/specification/{topic}/specification.md`). Whose specification it is, and where this session stands to it, pick the route.

**If the owning work unit is not the one this session is working:**

→ Proceed to **A. Another Work Unit's Specification**.

**If it is this work unit's own specification and this session's phase is implementation or review:**

→ Proceed to **B. This Work Unit's Specification**.

**If it is this work unit's own specification and this session's phase is anything else:**

Corrections flow through the owning phase: re-entering that topic's specification reopens the item, and re-completion re-indexes the knowledge base. Tell the user what you found and where it belongs.

→ Return to caller.

## A. Another Work Unit's Specification

Read the unit's status:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {owning_work_unit} status
```

#### If `in-progress`

Do not edit the specification from outside — corrections to live work flow through the owning unit's own phase. Tell the user what you found and where it belongs: re-entering that unit's specification for the topic reopens the item, and re-completion re-indexes the knowledge base automatically. A claim that stems from a decision (not a factual error) belongs in the owning unit's discussion, not the spec that inherited it.

→ Return to caller.

#### If `cancelled`

Cancellation removed the unit's chunks from the knowledge base, and reactivation re-indexes from disk. Edit the specification freely — no corrigendum, no re-index.

→ Return to caller.

#### If `completed`

Present the wrong claim, the evidence, and the proposed correction in the conversation, then confirm — editing another work unit's record is never silent. Present a large correction set as its shape — what moved, which sections, counts — with the full list available on request. Skip the confirmation only when executing an already-approved plan task that names these steps.

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render correction-gate {owning_work_unit}.specification.{topic}
```

Emit the call's MENU section verbatim per its marker.

**STOP.** Wait for user response.

**If `view`:**

Present the full correction list — each wrong claim, its evidence, and its proposed correction — then re-present the gate.

**STOP.** Wait for user response.

**If `no`:**

→ Return to caller.

**If `yes`:**

1. **Edit in place.** Replace the wrong claims in the affected sections with corrected content. The live file is current truth; git history is the historical record — never keep wrong content in the body for posterity.

2. **Corrigenda section.** Append the entry to the end of the `## Corrigenda` section at the bottom of the file, appending the section as the file's last when absent. One entry per correction — and a mechanical, uniform substitution landing across many lines (a rename, a moved path) is a single correction: one entry stating the mapping — old term → new term, throughout — never an entry per edited line:

   ```markdown
   > **Corrigendum {YYYY-MM-DD}** (from `{correcting_work_unit}`): {original claim, quoted} — corrected: {what is true}.
   ```

3. **Re-index.** Replaces the file's existing chunks in one idempotent call:

   ```bash
   node .claude/skills/workflow-knowledge/scripts/knowledge.cjs index {specification path}
   ```

4. **Commit.** Scoped to the corrected topic in the owning unit — one specification file and the store the re-index dirtied, nothing else of a unit this session is not working in. `--kb` carries the store; `--sweep` says the topic is somebody else's:

   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {owning_work_unit} -m "specification({owning_work_unit}): corrigendum from {correcting_work_unit}" --topic specification/{topic} --kb --sweep
   ```

The owning unit's manifest is never touched — no reopen, no status change; the unit stays completed.

→ Return to caller.

## B. This Work Unit's Specification

A downstream phase found the defect. The route edits a golden record with no gate, so it verifies its ground first — read the item's status and scan presence, then check in order:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {owning_work_unit}.specification.{topic} status
node .claude/skills/workflow-engine/scripts/engine.cjs presence scan {owning_work_unit}
```

#### If the status is anything but `completed`

The document is live in its own phase — corrections flow through it. Tell the user what was found and where it belongs; the entry stays unsettled.

→ Return to caller.

#### If a presence row matches `specification`/`{topic}` with `held` and `live` both true

A session holds that document. Leave the entry alone this pass — it stays unsettled, and a later pass re-finds it.

→ Return to caller.

#### Otherwise

Classify the defect — **if in doubt, treat it as open**, and doubt inside the open class means return it open: a derivation or call you are unsure of is not one you can stand behind. First match below wins.

#### If the record settles it

An approved, landed change supersedes the claim, or the repair is a factual value derivable by direct measurement against the tree.

Apply it silently — no gate, no raise. This is the one place a downstream phase edits another phase's artifact: the corrigenda entry and the re-index are the audit trail that replaces the gate. `{correcting_phase}` below is the phase that found it — `implementation/{topic}` or `review/{topic}`.

1. **Edit in place.** Replace the wrong claim in its section with corrected content — or, where the defect is an omission, add the missing content to the section that owns the ground. The live file is current truth; git history is the historical record — never keep wrong content in the body for posterity.

2. **Corrigenda section.** Append the entry to the end of the `## Corrigenda` section at the bottom of the file, appending the section as the file's last when absent. One entry per correction — and a mechanical, uniform substitution landing across many lines (a rename, a moved path) is a single correction: one entry stating the mapping — old term → new term, throughout — never an entry per edited line:

   ```markdown
   > **Corrigendum {YYYY-MM-DD}** (from `{correcting_phase}`): {original claim, quoted} — corrected: {what is true}.
   ```

3. **Re-index.** Replaces the file's existing chunks in one idempotent call:

   ```bash
   node .claude/skills/workflow-knowledge/scripts/knowledge.cjs index {specification path}
   ```

4. **Commit.** Scoped to the corrected topic — one specification file and the store the re-index dirtied. `--kb` carries the store; `--sweep` always rides here — the session's working topic is its own implementation or review topic, never this specification topic:

   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {owning_work_unit} -m "specification({owning_work_unit}): corrigendum from {correcting_phase}" --topic specification/{topic} --kb --sweep
   ```

The specification item is never touched — no reopen, no status change.

→ Return to caller.

#### If the code is wrong and the specification is right

Not a specification correction — the tree owes the change. Return that verdict; the caller routes it as the work it is.

→ Return to caller.

#### If it is genuinely open

Neither the record nor a measurement settles it directly.

**If a defensible derivation from precedent or constraints — or, for a technical point, an honest call you can stand behind — picks the side** (a derivable gap, or a technical parameter):

Settle it here — apply the four record-settled steps above, the corrigendum entry recording the derivation or the call's reasoning; where the defect is an omission, the entry states the point the specification left open in place of a quoted claim.

→ Return to caller.

**Otherwise** — the tie-break is product intent (appetite, or a fact only the user holds), or the call is not one you can stand behind:

Return the open verdict; the caller puts the decision to the user.

→ Return to caller.

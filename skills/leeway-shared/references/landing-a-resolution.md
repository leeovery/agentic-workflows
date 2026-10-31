# Landing a Resolution

*Shared reference. Loaded by `resolve-source-incoherence.md` (the specification's landings) and `resolve-spec-gap.md` (planning's and implementation's).*

---

The resolution is written into the owning source's record in its own terms — no meta-narration, no reference to the phase that raised it or to this session: the record reads as its own. The caller has already scanned presence and found no session holding the document; the response to a held one is the caller's own.

## Parameters

The caller provides these via context before loading:

- `work_unit` — the work unit the source document belongs to. Always present.
- `topic` — the caller's own topic, which names a specification item (a plan or an implementation carries its specification's name). Used by the `--except` in step 3 and nothing else.
- `doc` — the owning source's topic name.
- `source_phase` — the source's own phase: `discussion`, or `investigation` for a bugfix.
- `resolution` — what lands, carrying whatever settled it: a measurement's command and result, a derivation, the side the user picked.

## Land It

#### If `source_phase` is `discussion`

1. **Read the record** — `node .claude/skills/leeway-engine/scripts/engine.cjs ledger record {work_unit} {doc}` — for the entries the resolution touches: the decision it revises, and every entry that restates the claim it invalidates.
2. **Land it on the ledger**, content on stdin, stated in the topic's own terms — what was decided and what determined it, the colliding decision or the failed measurement as its command and result — never this session or the phase that raised it:
   - a decision the record holds, replaced: `node .claude/skills/leeway-engine/scripts/engine.cjs ledger replace {work_unit}.discussion.{doc} --replaces {id} --reason {other-topic|was-wrong}` — `was-wrong` where a measurement disproved it;
   - a decision the record never made, asked and answered: `node .claude/skills/leeway-engine/scripts/engine.cjs ledger ask {work_unit}.discussion.{doc}`, then `node .claude/skills/leeway-engine/scripts/engine.cjs ledger decide {work_unit}.discussion.{doc} --answers {id}` with the question's id.

   Each write commits itself and re-renders the record the knowledge base serves.
3. **Stale the other extractions.** Single-topic work types skip this step — no sibling specs exist. For an epic, run `node .claude/skills/leeway-engine/scripts/engine.cjs sources stale {work_unit} {doc} --except {topic}`; when the response's `staled` is non-empty, tell the user in one line which specification(s) it named.

→ Return to caller.

#### If `source_phase` is `investigation`

1. **Edit the document** — targeted, in the investigation's own idiom: edit the affected passages directly. The claim rarely lives in one place: search the document for the claim's terms and repair every restatement. A resolved document that still asserts what the resolution invalidated — a disproven measurement or a superseded position alike — is not resolved.
2. **Reindex it**: `node .claude/skills/leeway-engine/scripts/engine.cjs knowledge index {the resolved artifact path}` — the knowledge base serves the resolution for the rest of the work. A failed index never blocks: tell the user in one line that the next start retries it, and continue.
3. **Commit**: `node .claude/skills/leeway-engine/scripts/engine.cjs commit {work_unit} -m "investigation({work_unit}/{doc}): {what the resolution settled}" --topic investigation/{doc} --sweep`. `--sweep` says the topic is somebody else's.

→ Return to caller.

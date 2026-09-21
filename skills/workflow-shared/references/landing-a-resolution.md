# Landing a Resolution

*Shared reference. Loaded by `resolve-source-incoherence.md` (the specification's landings) and `resolve-spec-gap.md` (planning's and implementation's).*

---

The resolution is written into the owning source document in that phase's own idiom — no meta-narration, no reference to the phase that raised it or to this session: the document reads as its own record. The caller has already scanned presence and found no session holding the document; the response to a held one is the caller's own.

## Parameters

The caller provides these via context before loading:

- `work_unit` — the work unit the source document belongs to. Always present.
- `topic` — the caller's own topic, which names a specification item (a plan or an implementation carries its specification's name). Used by the `--except` in step 3 and nothing else.
- `doc` — the owning source's topic name.
- `source_phase` — the source's own phase: `discussion`, `investigation`, or `research`.
- `resolution` — what lands, carrying whatever settled it: a measurement's command and result, a derivation, the side the user picked.

## Land It

1. **Edit the document** — targeted, in the owning phase's own idiom. A discussion's decided Decision block is revised as its format prescribes (**[../../workflow-discussion-process/references/template.md](../../workflow-discussion-process/references/template.md)** → Decision revisions): the new decision lands as a dated timeline entry above the prior prose, wrapped verbatim under `#### Initial`, with the `Trigger:` line citing the substantive cause — the colliding decision, or the failed measurement as its command and result — never this session or the phase that raised it: the record explains itself in its own terms. Citing prose the resolution invalidates is repaired in place — and the claim rarely lives in one place: whatever the document type, search it for the claim's terms and repair every restatement — in a discussion, check the Summary's Key Insights and Current State. A resolved document that still asserts what the resolution invalidated — a disproven measurement or a superseded position alike — is not resolved. A correction that revises no decision — a measured value and the prose citing it — is repaired in place wherever it sits. A decision the document never made lands as a new subtopic section in the template's subtopic shape — Context, Options Considered where sides were weighed, Journey, Decision — with no timeline entry and no `#### Initial` (there is no prior block to revise), and no Discussion Map registration: the map tracks live sessions, and the completed record gains the section alone. The section speaks in the document's own voice throughout, the Decision line included: Context and Journey state why the record needed this ground in the topic's own terms, the Decision names what determined it as the deciding decision and its rule, and nothing in it — no sentence, no parenthetical, no reference — names the phase that raised it, a review, a tracking file or finding, or this session, whether as what raised it or as where the derivation was recorded. Investigation and research documents carry no timeline rule — edit the affected passages directly; the every-restatement sweep applies to them all the same.
2. **Reindex it**: `node .claude/skills/workflow-knowledge/scripts/knowledge.cjs index {the resolved artifact path}` — the knowledge base serves the resolution for the rest of the work.
3. **Stale the other extractions.** Single-topic work types skip this step — no sibling specs exist — and so does a non-discussion `{doc}` (the reverse join covers discussion sources). For an epic whose `{doc}` is a discussion, run `node .claude/skills/workflow-engine/scripts/engine.cjs sources stale {work_unit} {doc} --except {topic}`; when the response's `staled` is non-empty, tell the user in one line which specification(s) it named.
4. **Commit**: `node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "{source_phase}({work_unit}/{doc}): {what the resolution settled}" --topic {source_phase}/{doc} --kb --sweep`. `--kb` carries the reindex; `--sweep` says the topic is somebody else's.

→ Return to caller.

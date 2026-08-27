# Offer the Out-of-Scope Findings

*Reference for **[present-review.md](present-review.md)** — loaded from the review gate's `i/inbox` branch, which only renders on a pass*

---

An out-of-scope finding is a genuine improvement in territory this feature's work never touched — neighbouring features, other specs' documents, code the change-set only reads. It is **never filed automatically** — filing costs a whole pass through the pipeline, and whether that is worth spending is the user's call, not the review's. Offering it and being told no is a complete outcome.

The findings accumulate in the manifest across review cycles — a cycle that fails contributes its discoveries and moves on, and the whole set is decided once, here, when the review passes.

## A. Re-Check the Accumulated Set

Read the set:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.review.{topic} out_of_scope
```

Findings from an earlier cycle were judged against code that remediation has since changed — some may now be done, moot, or wrong. Dispatch **one assessor** over the set before offering anything:

- **Agent path**: `../../../agents/workflow-review-finding-assessor.md`

Write the set to `.workflows/.cache/{work_unit}/review/{topic}/oos-recheck.txt` (one block per finding, opening with its id) and pass it as the findings path, with the code standard path and an output path of `…/oos-recheck.jsonl`. Anything the verdicts return as `already-done`, `stale` or `wrong` is dropped from the offer, with its reason noted.

#### If nothing survives

State in one markdown sentence that the accumulated findings no longer hold against the code, and why.

Delete the field — the set is decided:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest delete {work_unit}.review.{topic} out_of_scope
```

→ Return to caller.

#### Otherwise

→ Proceed to **B. Offer**.

---

## B. Offer

Present each surviving finding as markdown — its summary, its kind (a feature, a bug worth investigating, or a standalone quick-fix), the failure or gap it names, and what taking it up would cost (a full pass through the pipeline as its own piece of work). Then ask, conversationally, which to keep — the user may take all, some, or none, and may answer in prose.

**STOP.** Wait for user response.

File what they chose, taking the next available number in each directory:

- `bug` → `.workflows/.inbox/bugs/{NNN}-{slug}.md`
- `feature` → `.workflows/.inbox/ideas/{NNN}-{slug}.md`
- `quick-fix` → `.workflows/.inbox/quickfixes/{NNN}-{slug}.md`

Each file carries the finding's summary, the failure or gap it names, the files it concerns, and where it came from — `{work_unit}` review, and the source finding ids. An item arriving in the inbox months later is read by someone with none of this session's context, so it states the problem rather than referring to it.

Commit any filed items — the inbox has its own scope:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit --inbox -m "review({work_unit}): file out-of-scope findings to inbox"
```

Delete the field — offered and decided, whichever way each went:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest delete {work_unit}.review.{topic} out_of_scope
```

State in one markdown sentence what was filed and what was declined.

→ Return to caller.

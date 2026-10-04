# Banner and Completion Offer

*Reference for **[workflow-continue-epic](../SKILL.md)***

---

What the menu leads with: the banner for a phase that just concluded or paused, and the offer to complete an epic whose work is all done.

## A. Phase Banner

#### If `outcome` is `completed`

Render and emit the section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render phase-completed {work_unit} --phase {completed_phase}
```

→ Proceed to **B. Completion Offer**.

#### If `outcome` is `paused`

The phase left on a wait — the banner names what it awaits, never a completion. Render and emit the section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render phase-paused {work_unit} --phase {completed_phase}
```

→ Proceed to **B. Completion Offer**.

#### Otherwise

No banner: the epic arrived from no phase, or from a session that cancelled or postponed its topic and rendered its own receipt.

→ Proceed to **B. Completion Offer**.

## B. Completion Offer

Read `all_done` from the most recent discovery output — true once every topic has completed review and nothing is left open.

#### If `all_done` is `true`

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Epic Completion`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Completing it closes the epic — it moves to the start menu's completed work, where it can be reactivated if more turns up.
```

Render and emit the section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render epic-all-done-gate {work_unit}
```

**STOP.** Wait for user response.

**If user chose `y/yes`:**

Complete the work unit — one command sets `status: completed`, stamps `completed_at`, and commits:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs workunit complete {work_unit} -m "workflow({work_unit}): complete epic pipeline"
```

Fetch and emit the receipt's `DISPLAY: confirmation` section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render workunit-receipt {work_unit} --verb complete --pipeline
```

**STOP.** Do not proceed — terminal condition.

**If user chose `n/no`:**

→ Return to caller.

#### Otherwise

→ Return to caller.

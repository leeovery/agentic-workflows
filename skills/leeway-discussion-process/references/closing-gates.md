# Closing Gates

*Reference for **[discussion-session](discussion-session.md)** — loaded when the discussion reaches its close, with every subtopic settled (deferrals already applied) and the topic's waits already checked.*

---

The passage from conversation to conclusion runs two gates: the **review gate** — is a review still owed, or one more worth offering, and does the user want it — then the **conclude gate**. Nothing here proceeds silently: whatever the classification, the user hears what comes next and answers.

The mailbox precedes both gates — a waiting message is work the conclusion cannot pass, and a review dispatched over it would read a document the walk is about to move. Check it first:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic mailbox {work_unit} discussion {topic}
```

**If `count` is non-zero and this entry is the user's signal:**

Render the blocker and emit both its sections verbatim per their markers — the red blocker line, then its guidance:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render mail-block {work_unit}.discussion.{topic}
```

→ Return to caller for **B. Session Loop**.

**If `count` is non-zero:**

The map settled, or the ceremony resumed, over a waiting message — it is raised before the gates, never refused: the session loop's mailbox check offers the mailbox at this break (the close holds over an earlier `later`), and the drain's last fold re-enters the close.

→ Return to caller for **B. Session Loop**.

**If `count` is `0`:**

→ Proceed to **A. Classify**.

## A. Classify

Read the agent store:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent scan {work_unit} discussion {topic}
```

Classify what the final-review step still owes — first match wins:

1. Any `review`, `synthesis`, or `perspective` row is `pending` or `acknowledged` → **findings-owed**
2. Any `review` row is `in-flight` → **review-running**
3. No `review` row exists → **never-reviewed**
4. Otherwise the highest-numbered `review` row is `incorporated` — classify by movement, anchored on the last **real** review: the highest-numbered `review` row whose report exists on disk (`.workflows/.cache/{work_unit}/discussion/{topic}/{id}.md`, non-empty). An `incorporated` row with no report is a killed dispatch closed as bookkeeping, never a review — anchoring on it would hide every commit between the real review and the kill. If no review row has a report, no review has ever completed → **never-reviewed**. Otherwise run `git log --since='{created}' --format='%h %s' -- .workflows/{work_unit}/discussion/{topic}.md` (`{created}` = the anchor row's `created` timestamp; git does the time comparison), then drop commits whose subject carries a `review-` or `synthesis-` drain marker (e.g. `(review-003 F2)`) or a `(deferral)` marker — engagement writes and the conclusion's own deferral write are not new work. Classify the residue:
   1. No commits remain → **satisfied**: the final review is up to date — no judgment
   2. A remaining commit is meaningful — a decision documented, a subtopic explored; not typo fixes, not bookkeeping (document-review reconciliation, summary maintenance) → **re-review**: the discussion has moved since the last review
   3. Otherwise → **satisfied** — doubt resolves here; declining forfeits nothing, a later attempt reclassifies

   A commit carrying both — a decision documented alongside bookkeeping in one write — is meaningful; the bookkeeping it travels with does not neutralise it. Genuine doubt about whether the substance is a decision at all still resolves at 4.3.

Step 6 (Final Gap Review) is the executor and re-derives state itself — a classification mismatch here is cosmetic, never state-corrupting.

#### If the classification is `re-review`

→ Proceed to **B. Review Gate — Optional**.

#### If the classification is `satisfied`

No review to offer — the conclude gate is next.

→ Proceed to **D. Conclude Gate**.

#### Otherwise

`findings-owed`, `review-running`, and `never-reviewed` all mean the final review still owes its mandatory pass.

→ Proceed to **C. Review Gate — Mandatory**.

## B. Review Gate — Optional

A review has already run and drained; declining another forfeits nothing owed. Fetch the gate and emit its MENU section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render closing-gate {work_unit}.discussion.{topic} --variant re-review
```

**STOP.** Wait for user response.

**If `yes`:**

→ Proceed to **E. In-Flight Agent Check**.

**If `no`:**

One more review is declined for this ceremony — Step 6 honours the decline, a resumed ceremony does not re-offer it, and a later ceremony classifies afresh and offers again.

→ Proceed to **D. Conclude Gate**.

**If keep going:**

→ Return to caller for **B. Session Loop**.

## C. Review Gate — Mandatory

At least one full review pass belongs to every discussion — this one cannot be skipped, only postponed by keeping the conversation open.

#### If the classification is `findings-owed`

Nothing new runs on `yes` — background findings have already come back, and Step 6 walks them. The gate says that plainly, so "another review" is never the reading the user answers to. Fetch it and emit its MENU section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render closing-gate {work_unit}.discussion.{topic} --variant findings-owed
```

**STOP.** Wait for user response.

**If `yes`:**

→ Proceed to **E. In-Flight Agent Check**.

**If keep going:**

→ Return to caller for **B. Session Loop**.

#### If the classification is `review-running`

Nothing new runs on `yes` — the pass in flight is the mandatory one, and `yes` is the decision to wait for it. The gate says that plainly, so "another review" is never the reading the user answers to. Fetch it and emit its MENU section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render closing-gate {work_unit}.discussion.{topic} --variant review-running
```

**STOP.** Wait for user response.

**If `yes`:**

The wait is chosen here — **E** asks no second time.

→ Proceed to **E. In-Flight Agent Check**.

**If keep going:**

→ Return to caller for **B. Session Loop**.

#### Otherwise

Fetch the gate and emit its MENU section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render closing-gate {work_unit}.discussion.{topic} --variant final-review
```

**STOP.** Wait for user response.

**If `yes`:**

→ Proceed to **E. In-Flight Agent Check**.

**If keep going:**

→ Return to caller for **B. Session Loop**.

## D. Conclude Gate

Fetch the gate and emit its MENU section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render closing-gate {work_unit}.discussion.{topic} --variant wrap-up
```

**STOP.** Wait for user response.

**If `yes`:**

→ Proceed to **E. In-Flight Agent Check**.

**If `no`:**

→ Return to caller for **B. Session Loop**.

## E. In-Flight Agent Check

The last gate before leaving the session, whichever path led here.

→ Load **[in-flight-agents.md](../../workflow-shared/references/in-flight-agents.md)** with work_unit = `{work_unit}`, topic = `{topic}`, phase = `discussion`, exit = `conclude`.

#### If `result` is `leave`

→ Return to **[the skill](../SKILL.md)** for **Step 6**.

#### If `result` is `stay`

The ceremony stays open: once what came back is walked, the session loop's check re-enters **G. Concluding** and these gates classify afresh.

→ Return to caller for **B. Session Loop**.

# Closing Gates

*Reference for **[discussion-session](discussion-session.md)** — loaded when the discussion reaches its close, with every subtopic settled (deferrals already applied).*

---

The passage from conversation to conclusion runs two gates: the **review gate** — is a final review owed, and does the user want it — then the **conclude gate**. Nothing here proceeds silently: whatever the classification, the user hears what comes next and answers.

## A. Classify

Read the agent store:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent scan {work_unit} discussion {topic}
```

Classify what the final-review step still owes — first match wins:

1. Any `review`, `synthesis`, or `perspective` row is `pending` or `acknowledged` → **findings-owed**: "background findings are still to be walked through"
2. Any `review` row is `in-flight` → **review-running**: "a dispatched review is still running"
3. No `review` row exists → **never-reviewed**: "no review has run yet"
4. The highest-numbered `review` row is `incorporated` and a meaningful discussion commit landed after its dispatch (`git log --oneline -- .workflows/{work_unit}/discussion/{topic}.md` — a decision documented, a subtopic explored, not typo fixes; discount commits the drain itself produced — engagement writes are not new work) → **re-review**: the discussion has moved since the last review
5. Otherwise → **satisfied**: the final review is up to date

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

A review has already run and drained; declining a fresh one forfeits nothing owed.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
The discussion has moved since the last review. A fresh gap review
can catch what the movement opened — or skip it and move on.

- **`y`/`yes`** — Run the fresh review
- **`s`/`skip`** — Skip it and go to the conclude gate
- **Keep going** — Tell me what else to explore
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `yes`:**

→ Proceed to **E. In-Flight Agent Check**.

**If `skip`:**

The fresh review is declined for this conclusion attempt — Step 6 honours the decline, and a later attempt classifies afresh and offers again.

→ Proceed to **D. Conclude Gate**.

**If keep going:**

→ Return to caller for **B. Session Loop**.

## C. Review Gate — Mandatory

At least one full review pass belongs to every discussion — this one cannot be skipped, only postponed by keeping the conversation open. `{reason}` is the matched classification's quoted description.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Next: a final gap review before concluding — {reason}.
Proceed?

- **`y`/`yes`** — Run the final review
- **Keep going** — Tell me what else to explore
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `yes`:**

→ Proceed to **E. In-Flight Agent Check**.

**If keep going:**

→ Return to caller for **B. Session Loop**.

## D. Conclude Gate

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Do you wish to conclude? I'll reconcile the document against our
conversation, then confirm before marking complete.

- **`y`/`yes`** — Conclude — begin wrap-up
- **`n`/`no`** — Continue the conversation
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `yes`:**

→ Proceed to **E. In-Flight Agent Check**.

**If `no`:**

→ Return to caller for **B. Session Loop**.

## E. In-Flight Agent Check

The last gate before leaving the session, whichever path led here. Run `node .claude/skills/workflow-engine/scripts/engine.cjs agent scan {work_unit} discussion {topic}` and read the response's `in_flight` list (agents dispatched but not yet returned). An agent dispatched by an earlier session cannot still be running — each row's `created` timestamp tells you which those are; close each (`agent incorporate`), re-scan, and count only this session's. A dead `synthesis` row is the exception: handle it per **D. Check and Surface** in **[perspective-agents.md](perspective-agents.md)** — closed *and* re-dispatched, so the council's tensions aren't lost.

#### If no agents are in flight

→ Return to **[the skill](../SKILL.md)** for **Step 6**.

#### If agents are still running

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
There are still {N} background agents working.

- **`w`/`wait`** — Wait for results before concluding
- **`p`/`proceed`** — Conclude now (results will persist in cache for reference)
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `wait`:**

Watch for `agent scan` to promote each in-flight row to `pending`. When none remain in flight, delegate surfacing to the shared protocol loaded by review-agent.md and perspective-agents.md. The protocol applies the never-dump rules: two-phase surfacing, one finding at a time. Treat the current moment as a natural break — we are at phase conclusion, so the break check will pass.

→ Return to caller for **B. Session Loop**.

**If `proceed`:**

→ Return to **[the skill](../SKILL.md)** for **Step 6**.

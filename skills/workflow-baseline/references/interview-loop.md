# Interview

*Reference for **[workflow-baseline](../SKILL.md)***

---

Walk the areas' agendas with the user, one themed round at a time, recording every answer as it lands. The interview is exitable at any moment — progress is written per round and an abandoned session resumes exactly where it stopped.

## A. Position

Read the area map:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get project.baseline.areas
```

#### If any area is `pending`

Research hasn't covered it yet.

→ Return to **[the skill](../SKILL.md)** for **Step 2**.

#### If any area is `completed`

A resumed interview — fetch the progress snapshot and emit its `DISPLAY: baseline progress` section:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render baseline-progress
```

→ Proceed to **B. Next Area**.

#### Otherwise

A fresh interview — render nothing.

→ Proceed to **B. Next Area**.

## B. Next Area

Pick the next `researched` area — `overview` first (its answers frame everything after it), then `boundaries`, then `glossary`, then the concern areas, most load-bearing first.

#### If none remain

Every area is `completed`.

→ Return to **[the skill](../SKILL.md)** for **Step 5**.

#### Otherwise

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Interviewing {area:(titlecase)} ({n} of {total})`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> {One line: what this area covers and what the questions are after.} Answer in your own words, pick a candidate, or say "don't know" — an unanswered question is recorded as open, never guessed at.
```

→ Proceed to **C. Rounds**.

## C. Rounds

Read the area's agenda (`.workflows/.baseline/.state/agenda-{area}.md`) and interview in rounds until no `pending` questions remain:

1. **Compose the round** — 1–4 pending questions that are independent of one another. A question whose premises could be reshaped by another's answer waits for a later round.
2. **Ask via the AskUserQuestion tool** — this is the prescribed interface for interview rounds (the questions are synthesised per project; they are not a prescribed gate, and no rendered block exists for them — flow gates in this skill stay rendered menus). Per question:
   - `question` — the agenda question with its evidence woven in: the observation first, then the ask. Evidence is what jogs memory; "why polling?" retrieves nothing, "the dispatcher polls behind four separate guards — that layering usually accretes from incidents; what's the story?" retrieves everything.
   - `options` — the agenda's candidate answers (short labels, a sentence of description each), plus a **Don't know** option ("Leave this open — recorded as an open question, no cost"). A wrong candidate jogs memory better than an open prompt; the user's own words arrive via the tool's Other field.
   - `header` — the area, abbreviated.
3. **Record the round** — immediately after the answers land, update each asked question in the agenda file: `**Status**: pending` becomes `answered` with an `**Answer**: {the user's answer — their words, condensed without being flattened}` line, or `open` when they don't know or it doesn't matter. An answer that corrects the observed layer is also noted on the question (`**Correction**: …`) for the doc weave. This write is the ledger — it happens every round, before anything else.
4. **Follow the thread when it earns it** — an answer that opens real ground (an incident story, a rejected alternative, a constraint nobody wrote down) is worth one conversational follow-up in prose before the next round. Capture what it yields on the same agenda entry. One follow-up, not an interrogation spiral.

#### If the user responds outside the tool

Answers in prose, digressions worth keeping, corrections to the evidence — honour them all: record them on the agenda exactly like tool answers.

**If the user asks to stop**, however phrased ("pause", "that's enough for now", "let's pick this up later"):

→ Proceed to **E. Pause**.

#### If pending questions remain

Next round.

→ Return to **C. Rounds**.

#### If the agenda is drained

→ Proceed to **D. Close the Area**.

## D. Close the Area

→ Load **[author-doc.md](author-doc.md)** with area = `{area}`.

On return, the area doc is written, indexed, and committed. Re-read the area map to see what remains:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get project.baseline.areas
```

#### If areas remain

Fetch the gate and emit its `MENU: baseline area gate` section:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render baseline-area-gate --area {area}
```

**STOP.** Wait for user response.

**If `continue`:**

→ Return to **B. Next Area**.

**If `pause`:**

→ Proceed to **E. Pause**.

#### If no areas remain

→ Return to **B. Next Area**.

## E. Pause

Commit whatever the ledger holds:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit --workflows -m "baseline: pause the interview ({completed}/{total} areas documented)"
```

Fetch the pause receipt and emit its `DISPLAY: baseline paused` section:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render baseline-paused
```

**STOP.** Do not proceed — terminal condition.

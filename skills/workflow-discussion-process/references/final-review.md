# Final Gap Review

*Reference for **[workflow-discussion-process](../SKILL.md)***

---

A final review ensures the discussion is thorough before moving to specification. Even if review agents ran during the session, the discussion may have progressed significantly since the last one. This step dispatches a fresh review covering the current state of the discussion.

The final review is foreground (results needed before concluding), but the **never-dump rules still apply**. Findings are presented one at a time via the shared surfacing protocol — no walls of text, no bulleted lists of gaps.

## A. Check Review State

Find the most recent review file in `.workflows/.cache/{work_unit}/discussion/{topic}/` by set number.

#### If the most recent review has `status: pending`

A review is in flight or just returned unread. Wait for completion.

→ Proceed to **C. Surface via Shared Protocol**.

#### If the most recent review has `status: acknowledged`

Findings were announced but not yet drained. Continue presentation.

→ Proceed to **C. Surface via Shared Protocol**.

#### Otherwise

This covers: no review files exist, or the most recent review has `status: incorporated` (findings were discussed but the discussion may have moved on since). In both cases, dispatch a fresh review.

→ Proceed to **B. Dispatch Final Review**.

---

## B. Dispatch Final Review

> *Output the next fenced block as a code block:*

```
·· Dispatch Final Review ························
```

> *Output the next fenced block as markdown (not a code block):*

```
> Dispatching a final review to catch any gaps before concluding.
> This ensures the discussion is thorough for specification.
```

Ensure the cache directory exists:

```bash
mkdir -p .workflows/.cache/{work_unit}/discussion/{topic}
```

Determine the next set number by checking existing files:

```bash
ls .workflows/.cache/{work_unit}/discussion/{topic}/ 2>/dev/null
```

Use the next available `{NNN}` (zero-padded, e.g., `001`, `002`).

**Agent path**: `../../../agents/workflow-discussion-review.md`

Dispatch **one agent** as a foreground task (omit `run_in_background` — results are needed before concluding).

The review agent receives:

1. **Discussion file path** — `.workflows/{work_unit}/discussion/{topic}.md`
2. **Output file path** — `.workflows/.cache/{work_unit}/discussion/{topic}/review-{NNN}.md`
3. **Frontmatter** — the frontmatter block to write:
   ```yaml
   ---
   type: review
   status: pending
   created: {date}
   set: {NNN}
   findings: []   # sub-agent populates with F1/F2/... IDs
   surfaced: []
   announced: false
   ---
   ```

When the agent returns:

→ Proceed to **C. Surface via Shared Protocol**.

---

## C. Surface via Shared Protocol

Because this is the final review at phase conclusion, treat the current moment as a natural break. The shared protocol's B → C → D/E path will read the file, skip the break check (we're already at a break), and begin presentation.

→ Load **[background-agent-surfacing.md](../../workflow-shared/references/background-agent-surfacing.md)** with agent_type = `review`, cache_dir = `.workflows/.cache/{work_unit}/discussion/{topic}`, cache_glob = `review-*.md`, findings_key = `findings`.

When the protocol returns (either because all findings have been drained to `incorporated`, or the user has engaged with the queued findings naturally), proceed to **D. Conclude or Return**.

---

## D. Conclude or Return

After the shared protocol returns, determine the next step.

#### If the user wants to return to discussion (e.g., they asked to `explore` a finding that opened a new subtopic)

The new subtopic has been added to the Discussion Map as `pending`. The user is back in the flow.

→ Return to **[the skill](../SKILL.md)** for **Step 3**.

#### If all findings were drained (explored, skipped, or parked) without reopening the discussion

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Final review complete. Ready to conclude the discussion?

- **`y`/`yes`** — Conclude
- **`n`/`no`** — Return to discussion
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `yes`:**

Note any skipped findings in the Summary → Open Threads section of the discussion file. Commit.

→ Return to caller.

**If `no`:**

→ Return to **[the skill](../SKILL.md)** for **Step 3**.

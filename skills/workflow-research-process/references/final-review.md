# Final Gap Review

*Reference for **[workflow-research-process](../SKILL.md)***

---

A final review ensures the research is thorough before moving to discussion. Even if review agents ran during the session, the research may have progressed significantly since the last one. This step dispatches a fresh review covering the current state of the research.

## A. Check Review State

Find the most recent review file in `.workflows/.cache/{work_unit}/research/{topic}/` by set number.

#### If the most recent review has `status: pending`

A review is in flight or just returned unread. Wait for completion, then read the review file.

→ Proceed to **C. Surface and Assess**.

#### If the most recent review has `status: read`

Findings were just surfaced but not yet fully discussed. Assess them now.

→ Proceed to **C. Surface and Assess**.

#### Otherwise

This covers: no review files exist, or the most recent review has `status: incorporated` (findings were discussed but the research may have moved on since). In both cases, dispatch a fresh review.

→ Proceed to **B. Dispatch Final Review**.

---

## B. Dispatch Final Review

> *Output the next fenced block as a code block:*

```
·· Dispatch Final Review ································
```

> *Output the next fenced block as markdown (not a code block):*

```
> Dispatching a final review to catch any gaps before concluding.
> This ensures the research is thorough for discussion.
```

Ensure the cache directory exists:

```bash
mkdir -p .workflows/.cache/{work_unit}/research/{topic}
```

Determine the next set number by checking existing files:

```bash
ls .workflows/.cache/{work_unit}/research/{topic}/ 2>/dev/null
```

Use the next available `{NNN}` (zero-padded, e.g., `001`, `002`).

**Agent path**: `../../../agents/workflow-research-review.md`

Dispatch **one agent** as a foreground task (omit `run_in_background` — results are needed before concluding).

The review agent receives:

1. **Research file path(s)** — `.workflows/{work_unit}/research/{topic}.md` (for epic, include all research files in `.workflows/{work_unit}/research/` relevant to the current topic)
2. **Output file path** — `.workflows/.cache/{work_unit}/research/{topic}/review-{NNN}.md`
3. **Frontmatter** — the frontmatter block to write:
   ```yaml
   ---
   type: review
   status: pending
   created: {date}
   set: {NNN}
   ---
   ```

When the agent returns:

→ Proceed to **C. Surface and Assess**.

---

## C. Surface and Assess

1. Read the review file
2. Update its frontmatter to `status: read`
3. Assess the findings — which gaps, shallow areas, and assumptions are genuinely worth exploring?

**Do not dump the review output verbatim.** Digest it and present it conversationally. The review surfaces gaps — you turn them into productive research threads.

#### If gaps or questions were found

Surface the most impactful findings conversationally, then:

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
The final review identified gaps worth exploring before concluding.

- **`e`/`explore`** — Return to the research session to explore these gaps
- **`p`/`proceed`** — Proceed to conclusion (gaps noted in research file)
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `explore`:**

Note the gaps in the research file for exploration. Update the review file to `status: incorporated`. Commit.

→ Return to **[the skill](../SKILL.md)** for **Step 4**.

**If `proceed`:**

Note unaddressed gaps in the research file. Update the review file to `status: incorporated`. Commit.

→ Return to caller.

#### If no gaps found

> *Output the next fenced block as a code block:*

```
Final review — no gaps identified. Research is thorough.
```

Update the review file to `status: incorporated`.

→ Return to caller.

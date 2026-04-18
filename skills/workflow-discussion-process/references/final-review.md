# Final Gap Review

*Reference for **[workflow-discussion-process](../SKILL.md)***

---

A final review ensures the discussion is thorough before moving to specification. Even if review agents ran during the session, the discussion may have progressed significantly since the last one.

This step runs once per "user signals done" entry. It dispatches a fresh review if needed, raises one finding via the shared protocol, then bounces back to the discussion session so the user can engage naturally. The next time the user signals done, Step 6 re-runs — eventually all findings are drained and the file transitions to `incorporated`, at which point Step 6 returns to the backbone to proceed toward conclusion.

The **never-dump rules apply in full**. Findings are raised one at a time via the shared surfacing protocol.

## A. Check Review State

Find the most recent review file in `.workflows/.cache/{work_unit}/discussion/{topic}/` by set number.

#### If no review files exist

→ Proceed to **B. Dispatch Final Review**.

#### If the most recent review has `status: incorporated`

The prior review was fully drained. Dispatch a fresh one to catch anything that emerged since.

→ Proceed to **B. Dispatch Final Review**.

#### If the most recent review has `status: pending`

A review is in flight or just returned unread.

→ Proceed to **C. Surface via Shared Protocol**.

#### If the most recent review has `status: acknowledged`

Findings from the current review are still being drained.

→ Proceed to **C. Surface via Shared Protocol**.

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

Dispatch **one agent** as a foreground task (omit `run_in_background` — results are needed before continuing).

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

Because this is final review at phase conclusion, the current moment IS a natural break — the shared protocol will render the announce menu (first entry) or raise the next unsurfaced finding (subsequent entries).

→ Load **[background-agent-surfacing.md](../../workflow-shared/references/background-agent-surfacing.md)** with agent_type = `review`, cache_dir = `.workflows/.cache/{work_unit}/discussion/{topic}`, cache_glob = `review-*.md`, findings_key = `findings`.

When the protocol returns, proceed to **D. Route Next**.

---

## D. Route Next

Re-read the most recent review file's `status:` and `surfaced:` fields.

#### If `status: incorporated`

All findings have been raised (or the review came back with zero gaps). The final-review gate is satisfied.

→ Return to caller.

#### If `status: acknowledged`

Either a finding was just raised, or the announce menu was just shown and the user picked `later`. Control belongs to the conversation — return the user to the discussion session so they can engage naturally. The session loop's check-for-results will pick up subsequent findings at natural breaks. When the user signals done again, Step 6 re-runs and this flow resumes.

→ Return to **[the skill](../SKILL.md)** for **Step 5**.

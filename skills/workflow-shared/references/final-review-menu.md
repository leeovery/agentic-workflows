# Final Review Menu

*Shared reference for end-of-phase final reviews (research, discussion). Wraps the background-agent-surfacing protocol with phase-conclusion menu wording.*

---

This reference is loaded at phase conclusion when a final-review agent has produced a cache file. It renders a three-option menu (review / skip / back) and delegates the raise-one-finding loop to the shared surfacing protocol.

**Parameters** (provided by caller via Load directive):

- `cache_dir` — agent's cache directory (work-unit scoped)
- `cache_glob` — glob pattern for cache files (e.g. `review-*.md`)
- `findings_key` — frontmatter key containing the finding ID list (typically `findings`)

The **never-dump rules apply in full**. Findings are raised one at a time.

## A. Check Review State

Find the most recent file in `{cache_dir}` matching `{cache_glob}` by set number.

#### If status is `incorporated`

→ Return to caller.

#### If status is `pending`

Read the file completely. Count findings in the frontmatter `{findings_key}` list. Transition the frontmatter: `status: pending` → `status: acknowledged`. The `surfaced: []` and `announced: false` fields were set by the orchestrator at dispatch time.

**If the finding count is 0:**

> *Output the next fenced block as a code block:*

```
Background review returned — nothing new beyond what we've already covered.
```

Transition the file directly to `status: incorporated`.

→ Return to caller.

**Otherwise:**

→ Proceed to **B. Decide Action**.

#### If status is `acknowledged`

→ Proceed to **B. Decide Action**.

## B. Decide Action

Read `surfaced:` from the cache file frontmatter. Compute the unsurfaced set: IDs in `{findings_key}` not in `surfaced:`.

#### If the unsurfaced set is empty

Transition `status: acknowledged` → `status: incorporated`.

→ Return to caller.

#### If `surfaced:` is non-empty

The user opted in via the `review` option on a prior iteration. Continue raising findings via the shared protocol — its state machine sees `surfaced:` non-empty and routes directly to its raise-one-finding step.

→ Load **[background-agent-surfacing.md](background-agent-surfacing.md)** with agent_type = `review`, cache_dir = `{cache_dir}`, cache_glob = `{cache_glob}`, findings_key = `{findings_key}`.

→ Return to caller.

#### If `surfaced:` is empty

→ Proceed to **C. Render Menu**.

## C. Render Menu

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Final review returned — flagged {N} area(s).

- **`r`/`review`** — Walk through them one at a time
- **`s`/`skip`** — Acknowledge and conclude the topic
· · · · · · · · · · · ·
```

Set `announced: true` in the cache file frontmatter.

**STOP.** Wait for user response.

#### If `review`

Apply the raise-one-finding step inline this turn (do not re-prompt):

1. Read `{findings_key}` and `surfaced:` from the cache file.
2. Compute the unsurfaced set.
3. Pick the single most contextually relevant unsurfaced finding. Contextual relevance outranks sub-agent order. If nothing is particularly relevant, pick the one with the broadest implications.
4. Append its ID to `surfaced:` in the cache file frontmatter.
5. Reframe the finding as one concrete concern tied to the current context, phrased as a single question. Do not read it out verbatim.
6. Raise it in the current turn. One question, no lists, no bundled follow-ups, no menu.

→ Return to caller.

#### If `skip`

Transition `status: acknowledged` → `status: incorporated`. The cache file is preserved on disk for the record.

→ Return to caller.

## Never-Dump Checklist

Before producing any surfacing output, verify:

- □ Raising AT MOST one finding this turn
- □ Asking AT MOST one question this turn
- □ No bulleted list of gaps
- □ Not reading the cache file contents verbatim

If any box is unchecked, stop and reframe.

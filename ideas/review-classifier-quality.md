# Review Classifier Quality

## The Idea

Tighten how the review task verifier tags non-blocking notes as `[quickfix]` / `[idea]` / `[bug]`. The current rules under-fit `[quickfix]` and over-default to `[idea]`, producing review reports where 80-90% of recommendations land in Ideas — most of which are actually mechanical changes with file:line targets and named assertions.

## Context

Tagging happens in `agents/workflow-review-task-verifier.md:92-98`:

```
- [quickfix] — Mechanical change with no logic impact. Typos, renames,
  linting, code style, find-and-replace. Achievable in minutes, no
  design decisions.
- [idea] — Requires discussion or design. Architectural suggestions,
  refactoring, new functionality, deduplication. Not trivially scoped.
- [bug] — Something is broken or incorrect but non-blocking.

If unsure, default to [idea] — it's the safest catch-all for anything
that needs human judgment.
```

The report-then-classify flow:

1. Per-task verifier writes `report-N-M.md` for each task, with `[quickfix]/[idea]/[bug]` tags on non-blocking notes.
2. `produce-review.md` groups them into `### Quick-fixes` / `### Ideas` / `### Bugs` sections of `report.md`.
3. `present-review.md` shows them to the user and offers `s`/`surface` to push to inbox, routing by section to `quickfixes/` / `ideas/` / `bugs/`.

The surfacing mechanism is fine. The classification at step 1 is the issue.

## Observed Distribution

Three recent portal reviews:

| Review | Quick-fixes | Ideas | Bugs |
|--------|---:|---:|---:|
| killed-sessions-resurrect-on-restart | 3 | 29 | 2 |
| daemon-merge-reintroduces-dead-sessions | 4 | 26 | 0 |
| multiple-state-daemons-running-concurrently | 4 | 13 | 0 |

Items in `### Ideas` that are textbook quick-fixes:

- "Add a test assertion in `panekey_test.go` pinning the filtered character set" — file specified, assertion specified, no design judgment.
- "EISDIR-via-mkdir fixture recurs twice; could extract a `seedUnreadableHookStore(t, dir)` helper" — explicit two-line refactor.
- "A one-line comment confirming X would short-circuit a future reviewer's read" — one-line doc change.
- "No multi-pane scenario asserting `pane A SendSignal fails, pane B still receives SendSignal`" — explicit test addition with named assertion.

And items that probably shouldn't have been recommendations at all:

- "Test relies on env inheritance through `tmux → daemon`. If `tmuxtest.New` were ever made explicit-env, this test would silently lose its `PORTAL_STATE_DIR`." — observation, no action proposed.
- "Worth confirming planning doc updated." — note-to-self, no concrete change.
- "Plan listed single combined helper; implementer split into two with documented rationale." — observation, accepted as-is.

## Root Causes

Three compounding factors:

1. **`[quickfix]` is narrowly worded.** "Typos, renames, linting, code style, find-and-replace" doesn't pattern-match mechanical test additions, doc-staleness fixes, or single-line refactors with explicit targets. The verifier reads "no logic impact, achievable in minutes, no design decisions" but anchors on the example list.

2. **`[idea]` is the explicit default.** Line 98 says "If unsure, default to `[idea]`." Combined with #1, anything not obviously matching a typo/rename pattern flows to Ideas.

3. **No severity floor.** The verifier captures every observation. There's no rule like "skip notes that propose no action" or "skip pure observations." The synthesizer (`agents/workflow-review-findings-synthesizer.md:28`) filters at *synthesis* time for in-plan tasks — but surfacing happens directly from `report.md`, bypassing that filter.

## What I'd Change

Three edits to `agents/workflow-review-task-verifier.md:92-98`:

### Edit 1: Broaden `[quickfix]`

Replace the current bullet with:

```
- [quickfix] — Mechanical change with file:line targets and no design
  judgment left. Includes: typos, renames, linting, code style,
  find-and-replace, mechanical test additions with named assertions,
  doc-staleness fixes, one-to-three-line refactors, comment additions.
  The user could act on it with no further reasoning required.
```

### Edit 2: Tighten `[idea]`

Replace with:

```
- [idea] — Requires genuine discussion or design judgment. Open
  questions about approach, architectural trade-offs, new
  functionality, deduplication strategy, scope decisions. If the
  next step is "decide how" or "decide whether", it's an idea.
  If the next step is "edit this file", it's a quick-fix.
```

### Edit 3: Replace the "default to idea" fallback

Replace line 98 ("If unsure, default to `[idea]`...") with:

```
Decide by the next step:
- next step is a concrete edit at a known location → [quickfix]
- next step is "decide whether / how" → [idea]
- next step is "fix incorrect behaviour" → [bug]

If still genuinely unsure, prefer [quickfix] for items with
file:line targets, [idea] otherwise.
```

### Edit 4: Add a severity floor

Add a new top-level bullet under "Categorise Non-Blocking Notes":

```
Drop notes that propose no action. A note must point at a specific
change (add X, remove Y, rename Z, document W). Pure observations
("worth confirming", "could be relevant if scale grows", "test
relies on env inheritance") are not findings — discard them. If
the observation is genuinely load-bearing, convert it to a
concrete action.
```

## Why This Works

- Edit 1 unblocks the largest current miscategorisation: mechanical test/doc additions that today fall to `[idea]` because they don't pattern-match typos.
- Edit 2 raises the `[idea]` bar to "genuine design question," matching its name.
- Edit 3 replaces the unsafe fallback with a deterministic decision rule based on what the user would do next.
- Edit 4 removes the noise tier entirely — the user shouldn't see "worth confirming" notes as recommendations.

Combined effect: the Ideas bucket should drop from 80-90% to maybe 20-30%, with the rest split between Quick-fixes (mechanical) and dropped (pure observations).

## Relevant Files

- `agents/workflow-review-task-verifier.md:92-98` — primary edit site
- `agents/workflow-review-findings-synthesizer.md:28` — note that synthesizer filtering does NOT apply to inbox surfacing; this idea fixes the upstream tagging
- `skills/workflow-review-process/references/produce-review.md:18-26` — consumes the tags; no change needed if tagging improves
- `skills/workflow-review-process/references/present-review.md:165-180` — surface mechanism; no change needed

## Implementation Notes

- This idea is independent of [[review-finding-grouping]] but synergistic: better classification + grouping together produces a much shorter, more actionable recommendations list.
- Could pair with a smoke test: run the updated verifier prompt against the existing portal reviews and check whether the human eye agrees with the new distribution before rolling out.
- The verifier prompt is read by Sonnet/Opus during a Task tool dispatch — the rule wording matters a lot. Worth iterating on the exact phrasing once before committing.

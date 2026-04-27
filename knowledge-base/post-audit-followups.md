# Post-Audit Follow-ups

Items surfaced by the six-agent re-audit on `feat/knowledge-base-phase-8` that were **not** resolved during the cleanup pass. Each entry has full context so a fresh agent can pick it up without backreading the conversation.

The agent picking these up should:
- Read `CLAUDE.md` first (especially "Conditional Routing" and "Skill File Structure" sections — both have load-bearing rules for the markdown items below).
- Read `knowledge-base/deferred-issues.md` for the closed audit ledger (do not reopen items there; they're decided).
- Run the test suite (CLI, store, integration, smoke) before and after each fix.
- Each fix gets its own commit. Commit messages reference the item number from this file.

---

## Branch context

`feat/knowledge-base-phase-8` is the head of a 4-PR stack (5 → 6 → 7 → 8). Phases 1–4 are merged to main. Phases 5–8 stack open against each other; none merge to main until go-live. The branch had a 26-commit cleanup pass following an initial multi-agent audit. A second six-agent re-audit ran after the cleanup. This file logs what the re-audit surfaced that hasn't been fixed.

---

## Pre-merge musts (the four "tightly scoped" items I batched and then failed to land)

### #1 — `view-completed.md` reactivation flow has a double-nested bold + missing announcement on edge case (✅ commit `a8152e1d`)

**File:** `skills/workflow-start/references/view-completed.md:115-137`

**Context.** When a user reactivates a completed work unit (chooses `r`/`reactivate` in the manage menu), the file flips status to in-progress, then branches on whether the prior status was `cancelled` or `completed`. The completed branch was added during Minor #6 of the cleanup pass (commit `87109d98`) to clear a stale `completed_at` field. Two issues:

1. **Double-nested bold conditional.** Structure today:
   - Outer (line 95): `#### If user chose r/reactivate` (H4)
   - First-level bold (line 115): `**If selected.status was completed:**`
   - Second-level bold (line 125): `**If the output is true:**` ← double-nest

   `CLAUDE.md` line 622-629 + 639 forbids this. The canonical fix per CLAUDE.md is to flatten by combining conditions into a single bold conditional. The example in CLAUDE.md (lines 624-628) literally shows:

   ```
   **If work_type is not set and other discussions exist:**
   ...
   **If work_type is not set and no discussions remain:**
   ...
   ```

2. **Announcement only renders on the `true` path.** The `"{name} reactivated."` block is indented inside `**If the output is true:**` (line 131-135). If `manifest exists completed_at` returns `false`, control falls from line 124 → line 137 (`→ Return to caller.`) without rendering the announcement. The cancelled branch (line 103) renders unconditionally.

   When `completed_at` is absent in real life:
   - Pre-migration-036 projects (migration not yet run).
   - Completed WU with no artifact files (migrations 036/037 skip backfill — `latestMtime === 0`).
   - Hand-edited manifests.

**Fix shape (per CLAUDE.md canonical pattern):**

The H4 `#### If user chose r/reactivate` stays. Underneath, three peer bold conditionals (matching the three real cases):

- `**If selected.status was cancelled:**` — existing, unchanged
- `**If selected.status was completed and completed_at is set:**` — delete + announce + return
- `**If selected.status was completed and completed_at is not set:**` — announce + return

The `manifest exists completed_at` probe sits **before** the bold branches (shared setup, like the canonical example's "1. Shared setup steps..." at CLAUDE.md line 611). It's harmless to run on the cancelled path (output ignored). Lead-in narrative ("Completed work units retain their chunks") moves into each completed-X bold branch where it's relevant.

**Severity.** Convention violation, not a runtime bug. The flow works on the common path. Edge case (completed-without-completed_at) loses the announcement but the user sees the WU reappear in the in-progress list.

**Why I failed to land this.** I iterated edits while reasoning instead of writing the full target block first and applying once. Each correction introduced new drift. Multiple attempts violated the convention I was trying to fix.

**Acceptance criteria for the fix:**
- Zero double-nested bolds.
- Announcement renders on every reactivation path.
- Pattern matches the CLAUDE.md example at lines 622-629 (compound-condition bold siblings).
- All other tests still pass.

---

### #2 — Review process signpost still invites proactive querying (✅ commit `40ce4038`)

**File:** `skills/workflow-review-process/SKILL.md:254-257`

**Context.** During Important #11 of the cleanup pass, I rewrote the "Knowledge Usage" step signposts in `workflow-planning-process/SKILL.md` and `workflow-implementation-process/SKILL.md` because they invited proactive querying while the loaded reference (`knowledge-usage.md` Section E) explicitly forbade it for those phases. I missed `workflow-review-process/SKILL.md` — its signpost still reads:

```
> Loading the usage guide for the knowledge base so
> proactive querying is available while verifying decisions.
```

But `knowledge-usage.md:89` Section E says:

> *"Review — query only for cross-work-unit consistency checks ('does this mirror how similar decisions were made elsewhere?'). Consistency with the current spec is already in scope — no KB needed for that."*

**Fix shape.** Rewrite the signpost to match the planning/implementation pattern — frame as "rules for narrow use", not "green light to query". Reference the planning + implementation rewrites (commit `00419cd2`) as the pattern.

Suggested wording:

```
> Loading the usage guide for the knowledge base. Review against the
> current spec is in scope without the KB — the guide documents the
> narrow case where a cross-work-unit consistency check is warranted.
```

(Or whatever wording the agent considers cleaner; structural goal is "frames the reference as 'rules for when use is warranted', not 'use freely'".)

**Severity.** Cosmetic semantic drift. The reference still reaches the model with the correct guidance; the signpost just contradicts it. Worst case: model queries slightly more than the design wants.

**Acceptance criteria:**
- Signpost matches the spirit of the planning/implementation rewrites.
- Inline nudge later in the same skill (line ~283 area) is already correct — leave alone unless drift is found there too.

---

### #3 — `cmdIndexBulk` catch dumps stack for UserError (✅ commit `e7b9d018`)

**File:** `src/knowledge/index.js:755-763`

**Context.** During Important #7 of the cleanup pass (commit `646245b8`), I introduced a `UserError` class with three contracts:
1. `withRetry` skips it (no retry).
2. `main().catch` prints `Error: <message>` alone, no stack.
3. Thrown only at user-visible validation sites.

The third contract holds at `main().catch` but `cmdIndexBulk`'s per-file catch block writes `err.stack` unconditionally on every failure:

```js
} catch (err) {
  // All retries exhausted — add to pending queue. Write the stack to
  // stderr so debugging does not depend on users capturing it later.
  await addToPendingQueue(item.file, err.message);
  process.stderr.write(
    `Failed to index ${item.file} after 3 attempts: ${err.message}. Added to pending queue.\n`
  );
  if (err.stack) process.stderr.write(err.stack + '\n');
}
```

When `indexSingleFile` throws a `UserError` (chunking-config-not-found, empty-file refusal — both convert via the UserError rollout), the bulk loop dumps the full Node stack frames during a bulk run. Noisy output for what's a clean validation error.

**Fix shape.** Gate the stack write on `!(err instanceof UserError)`:

```js
if (err.stack && !(err instanceof UserError)) process.stderr.write(err.stack + '\n');
```

**Severity.** Cosmetic. Information is correct, just noisy.

**Acceptance criteria:**
- Stack still prints for genuine internal errors (TypeError, etc.).
- UserError instances print only the message line.
- A focused test could be added: index a directory containing a malformed file, assert no stack frames in stderr — but probably overkill for this small fix.

---

### #4 — `workflow-start/SKILL.md` Step 0.2 has paraphrased signpost (✅ commit `374ac15d`)

**File:** `skills/workflow-start/SKILL.md:67-69`

**Context.** During Minor #4 of the cleanup pass (commit `8c6fd446`), I added the canonical "already invoked" gate to Step 0.2. While doing so I left the existing two-line signpost intact:

```
> Running migrations to keep workflow files in sync.
> This ensures everything is up to date before we proceed.
```

The other 9 entry-point sites (`start-bugfix`, `start-cross-cutting`, `start-epic`, `start-feature`, `start-quickfix`, `continue-bugfix`, `continue-cross-cutting`, `continue-epic`, `continue-feature`, `continue-quickfix`) all use a 1-line canonical signpost:

```
> Running migrations to keep workflow files in sync.
```

**Fix shape.** Drop the second line so workflow-start matches the canonical 1-line shape.

**Severity.** Pure consistency drift. No behavioural impact.

**Acceptance criteria:**
- All 10 entry-point sites have byte-identical Step 0.2 signpost text.

---

## Should-fixes (real correctness/UX issues, not introduced by the cleanup)

### #5 — OpenAI 401/403 errors are retried (✅ commit `6cd6ccba`)

**File:** `src/knowledge/providers/openai.js:136-148`, interaction with `src/knowledge/index.js:211-240`

**Context.** `_fetch` throws a plain `Error` for HTTP 401/403 (auth failures). `withRetry`'s class-based bypass list includes `UserError`/`TypeError`/`ReferenceError`/`SyntaxError`/`RangeError` but does not distinguish HTTP error types. So an invalid/expired API key burns the full backoff (1s + 2s + 4s ≈ 7s) on every embed call before surfacing.

429 (rate limit) **should** retry. 401/403 (auth) **shouldn't** — keys don't fix themselves between retries.

**Fix shape (two plausible options):**

1. **Promote 401/403 to UserError in `_fetch`.** They're user-config problems (bad key). The `withRetry` short-circuit + clean `main().catch` rendering then handle them correctly. Cleanest.

2. **Add a marker class** like `AuthError extends Error` in `providers/openai.js`, add it to `withRetry`'s skip list. More targeted but adds a class for one case.

Option 1 is consistent with how UserError is used elsewhere (validation failures, provider mismatch). The error message "OpenAI returned 401: invalid API key — check `~/.config/workflows/credentials.json` or `OPENAI_API_KEY` env var" is exactly the kind of actionable user-config message UserError exists for.

**Severity.** UX — wastes 7s on every bad-key call. Real but not blocking.

**Acceptance criteria:**
- Bad-key invocation surfaces the error in <100ms (no retry budget burned).
- 429s still retry as today.
- Test in `test-knowledge-openai.cjs` that mocks a 401 response, asserts `withRetry` calls the function exactly once.

---

### #6 — Setup writes openai config before validating the key (✅ commit `27a1b9f7`)

**Files:** `src/knowledge/setup.js:374-407` (`runSystemConfigStep`), `:543-552` (`runProjectInitStep`)

**Context.** `runSystemConfigStep` writes `provider:'openai', model, dimensions` to disk **before** `ensureOpenAIKey` validates. `ensureOpenAIKey` returns successfully even when the env-var key fails validation (line 408 returns without aborting). `runProjectInitStep` then writes `metadata.json` with `provider:'openai'` (line 545: `provider || null` evaluates `cfg.provider`, which is `'openai'`).

On the very next `knowledge index`, `resolveProviderState` (`index.js:343-388`) sees `metaProvider === 'openai'` but `provider === null` (resolveProvider returns null when api key is missing), and throws Case 3:

> *"Provider/model changed since last index. Run `knowledge rebuild` to reindex."*

The provider hasn't changed — the key is just bad. The user sees a misleading recovery hint.

**Fix shape.** Re-order setup so the key is validated **before** any config write. If validation fails, abort cleanly with an actionable error ("API key invalid — fix and re-run setup"). Do not write `provider:'openai'` to disk on a bad key.

Note: `validateApiKey` already exists and does a real test embed call. The bug is purely ordering.

**Severity.** Real UX bug. User goes through setup, gets through wizard, runs `index`, sees confusing "rebuild" advice that doesn't match their actual problem.

**Acceptance criteria:**
- Setup with a bad key aborts before writing system config.
- Setup with a good key works as before.
- Test in `test-knowledge-config.cjs` or a new setup-specific test exercises the validation-before-write ordering.

---

### #7 — Setup partial-state recovery gap (✅ commit `3ecd1f1e`)

**File:** `src/knowledge/setup.js:536-552`

**Context.** If `metadata.json` exists but `store.msp` does not (rare — partial cleanup, interrupted prior init, manual deletion), `detected.fullyInitialised === false` and `detected.metadataExists === true`. The conditional at line 543 (`!detected.metadataExists || detected.fullyInitialised`) is **false**, so metadata is **not** rewritten, but the store **is** re-created at line 536. Result: a fresh empty store paired with metadata still pointing at the prior run's provider/model/dimensions. First index after that path errors with the same misleading "Provider/model changed" message as #6.

**Fix shape.** Tighten the condition so metadata is rewritten whenever the store is being (re)created. Or detect partial-state and warn the user to run `rebuild` instead of trying to recover via setup.

**Severity.** Edge case but real. Same misleading error surface as #6.

**Acceptance criteria:**
- Partial-state (metadata-without-store) is detected and either recovered cleanly or surfaced with an actionable error.
- Test that simulates the state.

---

## Defer (real but non-blocking; log as deferred-issue or fix later)

### #8 — Whole-store enumeration capped at 100k

**Files:** `src/knowledge/index.js:1379, 1865`; `src/knowledge/store.js:128, 167, 187`

**Context.** `cmdStatus` and `cmdCompact` rely on `searchFulltext(db, { term: '', limit: 100000 })` returning **every** chunk. Beyond 100k chunks the cap silently truncates: status shows wrong totals, compact misses expired chunks. Per-topic `findInternalIdsByIdentity`/`removeByFilter` share the same cap — a topic with >100k chunks would leak chunks across re-indexes.

**Realistic at the project level for very long-lived bases.** Per-topic, only on pathological input.

**Fix shape options:**
1. Iterate via paged search until exhausted. Cleanest but more code.
2. Raise the cap to 1M with a comment explaining the assumption.
3. Add a status warning when chunk count approaches the cap.

**Severity.** Latent. Will bite some user, eventually. Defer to a deferred-issue entry; revisit when project sizes warrant.

---

### #9 — Empty-term `searchFulltext` is undocumented Orama behaviour with no test

**Files:** `src/knowledge/store.js:122, 165, 187`; `src/knowledge/index.js:635, 1379, 1865`

**Context.** Six call sites depend on Orama returning **all** matching docs for `term: ''`:
- `findInternalIdsByIdentity`
- `removeByFilter`
- `countByFilter` (added during Critical #2's `--dry-run` fix)
- `isIndexed`
- `cmdStatus`
- `cmdCompact`

No store/integration test pins down this contract. An Orama version bump that changed empty-term semantics would silently break all six paths.

**Fix shape.** Add a single store-level test: insert N docs, run `searchFulltext(db, { term: '', limit: 1000 })`, assert returns N. Pins the contract; if Orama changes behaviour, this test fails first instead of production breaking silently.

**Severity.** Latent test-coverage gap. Cheap fix.

---

### #10 — Test 81 Part B (pending-removal queue drain) has theatre risk on the negative path

**File:** `tests/scripts/test-knowledge-cli.sh:1638-1676` (Test 81)

**Context.** Test 81 was rewritten during Critical #1 to be a real regression guard for the `pending_removals` whitelist fix. Part A (the "queue survives an index write" assertion) is genuine. Part B's "queue drained after remove" assertion only passes because `performRemoval` deliberately omits the registry-existence check that `cmdRemove` enforces (per Important #9 design). The drain path silently succeeds against a non-existent `stale-wu`, deletes the queue entry. Test never proves a **real** failure (lock timeout, store I/O error) increments `attempts` or eventually evicts after `REMOVAL_MAX_ATTEMPTS`.

**Fix shape.** Add a test that simulates real removal failure (e.g. mock the store path to point at a read-only file, or stub `performRemoval` to throw N times), asserts attempts increment, asserts eviction at `REMOVAL_MAX_ATTEMPTS`. The current Test 81 Part B should be renamed to "queue drains on no-op success" so its purpose is clear.

**Severity.** Coverage gap on the eviction branch. Code path works; we just don't test it.

---

### #11 — README has zero mention of the knowledge base

**File:** `README.md` (238 lines)

**Context.** The user-facing entry point never mentions:
- The knowledge base feature.
- The OpenAI API key requirement.
- The hard-stop on first run after upgrade (existing users hit `Knowledge Base Not Ready` on next workflow invocation per `knowledge-check.md:39-65`).
- `knowledge setup`.

Per `knowledge-base/design.md:316-333`, the KB is **required infrastructure**. A user installing via `npx agntc add leeovery/agentic-workflows` will hit the hard stop with no warning in Getting Started.

**Fix shape.**
- `README.md:48-58` (Requirements section) should mention Node ≥ 18, optional OpenAI API key.
- A "Knowledge Base" section explaining what it is, the first-run setup, the stub-mode option for keyword-only.

**Severity.** Documentation gap. Real impact on first-time users post-merge.

---

### #12 — Manual `knowledge remove --work-unit <orphan>` errors with no escape hint

**File:** `src/knowledge/index.js:1740-1751`

**Context.** Important #9 added registry validation to `cmdRemove`. After absorption (`absorb-into-epic.md`), the WU's registry entry is deleted **after** the remove call. If chunks linger and the user later tries `knowledge remove --work-unit <absorbed>` manually, they hit `UserError: Work unit "..." not found in project manifest` with no actionable path. The error suggests `knowledge status`, not `knowledge compact` (which is the actual escape hatch via `processPendingRemovals`).

**Fix shape.** Update the error message in `cmdRemove`'s `catch (err) { if (err.status === 2) throw new UserError(...) }` block to mention `knowledge compact` as an option for orphaned WUs.

Or: when registry says "not found" but chunks exist for that WU in the store, route into a different message path that tells the user how to clean up.

**Severity.** UX — narrow scenario, but user lands in a dead-end with no clear next step.

---

## Minor / polish (skip-by-default unless paired with a related fix)

### #13 — `contextual-query.md:3` header stale (✅ commit `9b0ba424`)

Says "loaded at phase start in research, discussion, and investigation processing skills" — but is also loaded by scoping (per Minor #9 of the cleanup). Update header to include scoping.

### #14 — Phase task lists all-unchecked

`knowledge-base/phase-1-tasks.md` through `phase-8-tasks.md` (76 total checkboxes, 0 checked) despite branch being phase-8 with all features implemented. Either update post-implementation or document the convention as "checkboxes are author-time artefacts, not progress trackers".

### #15 — Setup integer parser is lenient

`src/knowledge/setup.js:366-370` — `parseInt('1536abc', 10)` returns `1536`; `Number.isInteger` then passes. Setup happily stores partly-valid input as the dimensions field. Add `/^\d+$/` regex check before `parseInt`.

### #16 — `cmdCompact` rejects `decay_months: null`

`src/knowledge/index.js:1842-1852`. Only `false` or non-negative integer accepted. A user hand-editing config and writing `null` intuitively (to disable) gets an error. Treat `null` as equivalent to `false`.

### #17 — `cmdStatus` orphan check is cwd-sensitive

`src/knowledge/index.js:1485`. `fs.existsSync(path.resolve(c.source_file))` against the relative path stored at index time. Status from a different cwd reports every chunk as orphaned. Resolve relative to the project root, not `process.cwd()`.

### #18 — Test convention drift

Migration tests 001-028 use `set -eo pipefail`; 029-037 use `set -euo pipefail`. Pick one (likely the stricter `-u`) and apply uniformly. Or add a comment explaining the intent.

### #19 — Bundle ~30% over design estimate

`knowledge-base/design.md:208` estimates ~110-120 KB minified. Current bundle is ~156 KB (well under the 200 KB ceiling). Update the design estimate to reflect current reality, or note that ESM-resolution + Orama version drift accounts for the increase.

---

## How to use this file

1. Pick an item (start with the pre-merge musts unless you have a reason).
2. Read the cited files end-to-end. Do not edit until you've understood the surrounding context.
3. Read CLAUDE.md sections relevant to the item type (markdown convention items: "Conditional Routing" + "Skill File Structure"; code items: no specific section, but project conventions in CLAUDE.md still apply).
4. Write the full target shape mentally, then apply as a single edit. Iterating edits while reasoning is the failure mode that left these items unfinished.
5. Run the test suite before and after.
6. One commit per item. Reference the item number from this file in the commit message.
7. Update this file: change `## #N — ...` to `## #N — ... (✅ commit `<sha>`)` so the next agent knows what's done.

When all pre-merge musts (#1–#4) are landed, the branch is ready to merge into the stack.

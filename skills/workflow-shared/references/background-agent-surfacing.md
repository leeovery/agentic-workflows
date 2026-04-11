# Background Agent Surfacing

*Shared reference for workflow skills with background agents (review, perspective/synthesis, deep-dive).*

---

This reference defines how to surface findings from background agents without dumping walls of text. It is loaded by agent reference files with parameters for the specific agent type.

**Parameters** (provided by caller via Load directive):

- `agent_type` — `review` | `synthesis` | `deep-dive` — human-readable name used in user-facing messages
- `cache_dir` — the agent's cache directory (work-unit scoped)
- `cache_glob` — glob pattern for this agent's cache files (e.g., `review-*.md`)
- `findings_key` — frontmatter key containing the finding ID list (`findings` for review/deep-dive, `tensions` for synthesis)

## The Core Rules

**Never dump findings.** Three hard rules govern every surfacing interaction:

1. **Two-phase surfacing.** First acknowledge the file exists (micro-menu, no content). Only after the user opts in, present content.
2. **One finding at a time.** Never present a list of gaps. Raise one, let the user engage, then offer the next at the next natural break.
3. **Mid-thread protection.** If Claude is mid-Q/A with the user, defer the announce menu until the next natural break. A one-line parenthetical acknowledgement is acceptable.

Natural-break detection is guidance, not hard-enforced.

→ Load **[natural-breaks.md](natural-breaks.md)** and follow its instructions as written.

## State Machine

Cache files move through these states:

**`pending`** → Sub-agent wrote the file. Claude hasn't read it yet.

**`acknowledged`** → Claude has read the file. Sub-states are distinguished by two frontmatter flags:
- `announced: false/true` — has the user been told the file exists? Prevents repeated parenthetical interruptions on silent re-checks.
- `surfaced: []` vs `surfaced: [F2]` — empty means no findings have been presented yet; non-empty means mid-presentation with more queued.

**`incorporated`** → All findings have been presented (explored, skipped, or parked). Terminal state.

---

## A. Check for Results

Scan `{cache_dir}` for files matching `{cache_glob}` with `status: pending` OR `status: acknowledged` in their frontmatter.

#### If no matching files

Nothing to surface.

→ Return to caller.

#### If a `pending` file exists

→ Proceed to **B. First Read**.

#### If an `acknowledged` file exists

Inspect its `surfaced:` list to route.

**If `surfaced:` is empty:**

→ Proceed to **C. Break Check**.

**If `surfaced:` is non-empty:**

The file is mid-presentation — more findings remain. Re-enter the presentation loop at the next natural break.

→ Proceed to **C. Break Check**.

---

## B. First Read

1. Read the cache file completely.
2. Count findings in the frontmatter `{findings_key}` list.
3. Transition the frontmatter: `status: pending` → `status: acknowledged`. Add `surfaced: []` and `announced: false` if not already present.

#### If the finding count is 0 (zero-gap case)

No menu needed. Append this single line at the end of your current turn:

> *Output the next fenced block as a code block:*

```
Background {agent_type} returned — nothing new beyond what we've already covered.
```

Then transition the file directly to `status: incorporated`.

→ Return to caller.

#### Otherwise

→ Proceed to **C. Break Check**.

---

## C. Break Check

Is the conversation at a natural break right now? Consult the natural-breaks checklist loaded above.

#### If yes — natural break

The file is `acknowledged`. Route based on the `surfaced:` list:

**If `surfaced:` is empty:**

→ Proceed to **D. Announce Menu**.

**If `surfaced:` is non-empty:**

→ Proceed to **E. Present Next Finding**.

#### If no — mid-thread

Route based on the `announced:` flag — the user is told ONCE, not on every re-check.

**If `announced: false`:**

Append this one-line parenthetical at the end of your current turn, then set `announced: true` in the cache file frontmatter.

> *Output the next fenced block as markdown (not a code block):*

```
*(Background {agent_type} just returned — I'll raise it when we pause.)*
```

→ Return to caller.

**If `announced: true`:**

The user already knows the file is waiting. Silent return — no output. The next natural break will pick it up.

→ Return to caller.

---

## D. Announce Menu

Render the announce menu. Do not describe findings, do not summarise, do not preview. Just the count and the menu.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Background {agent_type} returned — flagged {N} area(s).

- **`n`/`now`** — Walk through them one by one
- **`l`/`later`** — Keep pulling on the current thread, I'll raise them at the next pause
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `now`

→ Proceed to **E. Present Next Finding**.

#### If `later`

Leave the file as `acknowledged` with `surfaced: []`. The next natural break will re-raise this menu.

→ Return to caller.

---

## E. Present Next Finding

1. Read the cache file's `{findings_key}` list and the current `surfaced:` list from frontmatter.
2. Determine the unsurfaced set: findings whose IDs are NOT in `surfaced:`.
3. Pick the single most impactful unsurfaced finding. **Contextual relevance outranks sub-agent order.** If the current conversation has just touched on a related area, prefer that finding. If nothing is particularly relevant, pick the one with the broadest implications.
4. Digest the finding. Do NOT read it out verbatim. Reframe it as one concrete concern tied to the discussion/research context, phrased as a single question.
5. Raise it as a single turn. One question, no lists, no bundled follow-ups.

After you raise the finding and the user engages (even briefly), render the per-finding menu:

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
- **`e`/`explore`** — Dig into this one
- **`s`/`skip`** — Note it in Open Threads and move on
- **`p`/`park`** — Come back to it later
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `explore`

Continue the conversation naturally on this finding. When the finding is addressed or deliberately set aside, append its ID to `surfaced:` in the cache file frontmatter.

→ Proceed to **F. Check Remaining**.

#### If `skip`

Add the finding to the Open Threads section of the discussion/research file. Commit. Append its ID to `surfaced:` in the cache file frontmatter.

→ Proceed to **F. Check Remaining**.

#### If `park`

Append its ID to `surfaced:` in the cache file frontmatter. The user has been told it exists — if they want to return to it, they'll say so.

→ Proceed to **F. Check Remaining**.

---

## F. Check Remaining

Count unsurfaced findings: items in `{findings_key}` whose IDs are still not in `surfaced:`.

#### If unsurfaced findings remain

Do not chain the next finding immediately. The user has just engaged with one — give the conversation room to breathe. The next natural break will pick it up via the session loop's check-for-results mechanism. The file stays `acknowledged` with a partial `surfaced:` list.

→ Return to caller.

#### If no unsurfaced findings remain

Transition the cache file frontmatter: `status: acknowledged` → `status: incorporated`. No commit needed for cache file status changes.

→ Return to caller.

---

## Never-Dump Checklist

Before producing any surfacing output, verify:

- □ Raising AT MOST one finding this turn
- □ Asking AT MOST one question this turn
- □ No bulleted list of gaps
- □ Not reading the cache file contents verbatim

If any box is unchecked, stop and reframe.

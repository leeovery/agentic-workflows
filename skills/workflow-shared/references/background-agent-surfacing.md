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

1. **Two-phase surfacing.** First acknowledge the file exists (micro-menu, no content). Only after the user opts in, start raising findings one at a time.
2. **One finding per turn, then exit.** Each invocation of this protocol does at most one thing and hands control back. Never expect the protocol to "resume" after the user has engaged with a finding — the next session-loop check will pick up the next one at the next natural break.
3. **Mid-thread protection.** If you are mid-Q/A with the user, defer the announce menu until the next natural break. A one-line parenthetical is acceptable, but only the first time.

Natural-break detection is guidance, not hard-enforced.

→ Load **[natural-breaks.md](natural-breaks.md)** and follow its instructions as written.

## LLM Turn Semantics (IMPORTANT)

This protocol runs as a turn-level check, not a long-running state machine. Each invocation:
- Reads the cache file
- Updates frontmatter flags (`status`, `surfaced`, `announced`)
- Optionally produces a small output (parenthetical, menu, or one raised finding)
- **Exits back to the session loop**

Once you raise a finding, control belongs to the conversation. The user engages naturally — it may take five turns or fifty. Do NOT wait "inside the protocol" for that engagement to finish. The next iteration of the session loop's check-for-results will naturally re-enter this protocol at the next natural break, pick the next unsurfaced finding, and raise it.

**The cache file is the only state.** If it's not in frontmatter, it doesn't survive. Never expect cross-turn continuity within this protocol.

## State Machine

Cache files move through these states:

**`pending`** → Sub-agent wrote the file. You haven't read it yet.

**`acknowledged`** → You have read the file. Two frontmatter flags track sub-state:
- `announced: false/true` — has the user been told the file exists? Prevents repeated parenthetical interruptions on silent re-checks.
- `surfaced: [F1, F3, …]` — which finding IDs have been raised. Empty means nothing raised yet; partial means mid-presentation.

**`incorporated`** → All findings have been raised. Terminal state.

---

## A. Check for Results

Scan `{cache_dir}` for files matching `{cache_glob}` with `status: pending` OR `status: acknowledged` in their frontmatter.

#### If no matching files

Nothing to surface.

→ Return to caller.

#### If a `pending` file exists

→ Proceed to **B. First Read**.

#### If an `acknowledged` file exists

The file was first-read on an earlier iteration. C. Decide Action will read its flags and decide what to do next.

→ Proceed to **C. Decide Action**.

---

## B. First Read

1. Read the cache file completely.
2. Count findings in the frontmatter `{findings_key}` list.
3. Transition the frontmatter: `status: pending` → `status: acknowledged`. The `surfaced: []` and `announced: false` fields were set by the orchestrator at dispatch time and are already present.

#### If the finding count is 0 (zero-gap case)

No menu needed. Append this single line at the end of your current turn:

> *Output the next fenced block as a code block:*

```
Background {agent_type} returned — nothing new beyond what we've already covered.
```

Then transition the file directly to `status: incorporated`.

→ Return to caller.

#### Otherwise

→ Proceed to **C. Decide Action**.

---

## C. Decide Action

Read current `surfaced:` and `announced:` from the cache file frontmatter. Compute the unsurfaced set: IDs in `{findings_key}` not in `surfaced:`.

#### If the unsurfaced set is empty

All findings have been raised. Transition `status: acknowledged` → `status: incorporated`.

→ Return to caller.

#### If the unsurfaced set is non-empty and NOT a natural break

Consult the natural-breaks checklist. Route on the `announced:` flag.

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

#### If the unsurfaced set is non-empty and IS a natural break

Route on whether the user has already opted in. `surfaced:` is the signal: empty means we still need to announce; non-empty means the user picked `now` on a prior iteration and more findings remain.

**If `surfaced:` is empty (first time at a break):**

Render the announce menu. Do not describe findings, do not summarise, do not preview — just the count and the menu.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Background {agent_type} returned — flagged {N} area(s).

- **`n`/`now`** — Walk through them one at a time
- **`l`/`later`** — Keep pulling on the current thread, I'll raise them at the next pause
· · · · · · · · · · · ·
```

After rendering the menu, set `announced: true` in the cache file frontmatter.

**STOP.** Wait for user response.

**If `now`:**

→ Proceed to **D. Raise One Finding**.

**If `later`:**

Leave `surfaced:` empty. The next natural break will re-raise this menu.

→ Return to caller.

**If `surfaced:` is non-empty (user already opted in, more findings remain):**

Do not re-ask. The user has already committed to walking through the set.

→ Proceed to **D. Raise One Finding**.

---

## D. Raise One Finding

This section runs once per invocation and then exits. It never waits in-protocol for the user to finish engaging — that's the conversation's job.

1. Read `{findings_key}` and `surfaced:` from the cache file.
2. Compute the unsurfaced set.
3. Pick the single most contextually relevant unsurfaced finding. **Contextual relevance outranks sub-agent order.** If the current conversation has just touched on a related area, prefer that finding. If nothing is particularly relevant, pick the one with the broadest implications.
4. Append its ID to `surfaced:` in the cache file frontmatter.
5. Digest the finding. Do NOT read it out verbatim. Reframe it as one concrete concern tied to the current context, phrased as a single question.
6. Raise it in the current turn. One question, no lists, no bundled follow-ups, no menu.

After this, control belongs to the conversation. The user will engage (or deflect, or redirect) naturally. Handle their response as normal discussion — not as protocol-driven routing.

**Coverage guarantee**: the goal is natural flow during engagement AND eventual coverage of every finding. The `surfaced:` list ensures nothing is forgotten across turns — every natural break re-enters this protocol and raises the next unsurfaced finding. When the user has engaged with all of them, the next check transitions the file to `incorporated`.

→ Return to caller.

---

## When the User Wants Out

If during presentation the user explicitly says they're done with the review ("skip the rest", "we're good", "that's enough findings"), treat all remaining unsurfaced IDs as implicitly parked — append them to `surfaced:` in bulk, and the next check will transition the file to `incorporated`. If any skipped items are worth noting, add them to the phase's Open Threads / Open Questions section.

---

## Never-Dump Checklist

Before producing any surfacing output, verify:

- □ Raising AT MOST one finding this turn
- □ Asking AT MOST one question this turn
- □ No bulleted list of gaps
- □ Not reading the cache file contents verbatim

If any box is unchecked, stop and reframe.

# Background Agent Surfacing

*Shared reference for workflow skills with background agents (review, perspective/synthesis, deep-dive).*

---

This reference defines how to surface findings from background agents without dumping walls of text. It is loaded by agent reference files with parameters for the specific agent type. All lifecycle state lives in the engine's agent store — never in the content files, whose markdown is the report and nothing else.

**Parameters** (provided by caller via Load directive):

- `agent_type` — `review` | `synthesis` | `deep-dive` — human-readable name used in user-facing messages, and the row kind this invocation surfaces
- `work_unit`, `phase`, `topic` — the agent store address

## The Core Rules

**Never dump findings.** Three hard rules govern every surfacing interaction:

1. **Two-phase surfacing.** First acknowledge the report exists (micro-menu, no content). Only after the user opts in, start raising findings one at a time.
2. **One finding per turn, then exit.** Each invocation of this protocol does at most one thing and hands control back. Never expect the protocol to "resume" after the user has engaged with a finding — the next session-loop check will pick up the next one at the next natural break.
3. **Mid-thread protection.** If you are mid-Q/A with the user, defer the announce menu until the next natural break. A one-line parenthetical is acceptable, but only the first time.

Natural-break detection is guidance, not hard-enforced.

→ Load **[natural-breaks.md](natural-breaks.md)** and follow its instructions as written.

## LLM Turn Semantics (IMPORTANT)

This protocol runs as a turn-level check, not a long-running state machine. Each invocation runs one `agent scan`, does at most one thing with its answer (a parenthetical, a menu, or one raised finding), and exits back to the session loop. Once you raise a finding, control belongs to the conversation. The user engages naturally — it may take five turns or fifty. Do NOT wait "inside the protocol" for that engagement to finish. The next iteration of the session loop's check will re-enter here, scan again, and the response's `next` says exactly where things stand.

**The engine store is the only state.** Never track surfacing progress in conversation memory, and never write it anywhere else.

## A. Check for Results

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent scan {work_unit} {phase} {topic}
```

Consider only rows whose `kind` matches `{agent_type}` (other kinds belong to their own loaded reference; perspective rows are synthesis inputs and are never surfaced here).

#### If no matching row is pending or acknowledged

Nothing to surface.

→ Return to caller.

#### If a matching row is `pending`

→ Proceed to **B. First Read** with that row.

#### If a matching row is `acknowledged`

The report was first-read on an earlier iteration; the row carries `announced`, `surfaced`, and `remaining`.

→ Proceed to **C. Decide Action** with that row.

## B. First Read

Read the row's content file completely — `.workflows/.cache/{work_unit}/{phase}/{topic}/{id}.md` — and collect its finding ids (the `## {ID}` section headings).

#### If the report has no findings (zero-gap case)

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent ack {work_unit} {phase} {topic} {id} --clean
```

The engine incorporates the row. No menu needed — append this single line at the end of your current turn:

> *Output the next fenced block as a code block:*

```
Background {agent_type} returned — nothing new beyond what we've already covered.
```

→ Return to caller.

#### Otherwise

Record the findings on the row:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent ack {work_unit} {phase} {topic} {id} --findings {F1,F2,…}
```

→ Proceed to **C. Decide Action** with the response's row.

## C. Decide Action

The row's `remaining` list is the unsurfaced set; `announced` and `surfaced` route what happens now.

#### If NOT a natural break

Consult the natural-breaks checklist. Route on the row's `announced` flag.

**If `announced` is `false`:**

Append this one-line parenthetical at the end of your current turn, then record it:

> *Output the next fenced block as markdown (not a code block):*

```
*(Background {agent_type} just returned — I'll raise it when we pause.)*
```

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent announce {work_unit} {phase} {topic} {id}
```

→ Return to caller.

**If `announced` is `true`:**

The user already knows the report is waiting. Silent return — no output. The next natural break will pick it up.

→ Return to caller.

#### If a natural break

Route on the row's `surfaced` list: empty means the user has not yet opted in; non-empty means they picked `now` on a prior iteration and more findings remain.

**If `surfaced` is empty (first time at a break):**

Render the announce menu. Do not describe findings, do not summarise, do not preview — just the count and the menu.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Background {agent_type} returned — flagged {N} area(s).

- **`n`/`now`** — Walk through them one at a time
- **`l`/`later`** — Keep pulling on the current thread, I'll raise them at the next pause
· · · · · · · · · · · ·
```

After rendering the menu, record the announce:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent announce {work_unit} {phase} {topic} {id}
```

**STOP.** Wait for user response.

**If `now`:**

→ Proceed to **D. Raise One Finding**.

**If `later`:**

Nothing surfaced yet, so the next natural break re-renders this menu.

→ Return to caller.

**If `surfaced` is non-empty (user already opted in, more findings remain):**

Do not re-ask. The user has already committed to walking through the set.

→ Proceed to **D. Raise One Finding**.

## D. Raise One Finding

This section runs once per invocation and then exits. It never waits in-protocol for the user to finish engaging — that's the conversation's job.

1. Pick the single most contextually relevant finding from the row's `remaining`. **Contextual relevance outranks the list order** (the scan's `next.finding` is only the default). If the current conversation has just touched on a related area, prefer that finding. If nothing is particularly relevant, pick the one with the broadest implications.
2. Record it — the response confirms what remains, and raising the last finding incorporates the row automatically:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs agent surface {work_unit} {phase} {topic} {id} {finding}
   ```
3. Digest the finding from the content file. Do NOT read it out verbatim. Reframe it as one concrete concern tied to the current context, phrased as a single question.
4. Raise it in the current turn. One question, no lists, no bundled follow-ups, no menu.

After this, control belongs to the conversation. The user will engage (or deflect, or redirect) naturally. Handle their response as normal discussion — not as protocol-driven routing.

**Coverage guarantee**: the goal is natural flow during engagement AND eventual coverage of every finding. The store ensures nothing is forgotten across turns — every session-loop iteration re-enters this protocol, and at each natural break the next unsurfaced finding is raised. When all findings have been raised, the engine incorporates the row.

→ Return to caller.

## Never-Dump Checklist

Before producing any surfacing output, verify:

- □ Raising AT MOST one finding this turn
- □ Asking AT MOST one question this turn
- □ No bulleted list of gaps
- □ Not reading the content file verbatim

If any box is unchecked, stop and reframe.

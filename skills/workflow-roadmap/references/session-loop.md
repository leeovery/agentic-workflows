# Session Loop

*Reference for **[workflow-roadmap](../SKILL.md)***

---

Follow the stance and hard rules from **[roadmap-guidelines.md](roadmap-guidelines.md)** throughout. No background agents, no review cycles.

**A. Open** picks the opening shape from how the session arrived; **B. Session Loop** runs the exploration; **C. Harvest** sorts when the user pulls — an unconfirmed sort drops straight back into **B**.

## A. Open

If `.workflows/.baseline/overview.md` exists, read it in full — silent ambient context about the product the workflows were installed into. Never narrate it back.

#### If `genesis_continuation` is set (the shaping conversation just arrived here)

The conversation is already live and its record persisted at Step 2 — don't re-open with a cold prompt. Render a brief transition that moves from "what is this" into laying the product out:

> *Output the next fenced block as markdown (not a code block):*

```
This is product territory — we'll lay the whole thing out, then pull the first slice into delivery when you're ready. Nothing we say here commits you to building anything.

Where do you want to dig in?
```

Clear `genesis_continuation` — the transition is spent; any later pass through **A** takes the resume or fresh branch.

**STOP.** Wait for user response.

→ Proceed to **B. Session Loop**.

#### If `active_session` was set at Step 3 (an open session resumed)

The log at `.workflows/.roadmap/sessions/session-{session_number}.md` is the working state — read it in full. Then brief across the record before re-opening: read the most recent prior session log in full too (the `SESSIONS` table from the home snapshot lists them; older sessions contribute their `## Conclusion` line only), and synthesise a short catch-up — the threads being circled, what the user was leaning toward, what was left open.

> *Output the next fenced block as markdown (not a code block):*

```
Where we'd got to:

{2–4 lines from the recent session(s): the threads circled, what the user was leaning toward, what was still open}
```

> *Output the next fenced block as markdown (not a code block):*

```
Where do you want to take it from here?
```

**STOP.** Wait for user response.

→ Proceed to **B. Session Loop**.

#### Otherwise

A fresh session over the map just rendered at Step 3. Brief across the record first when prior sessions exist (most recent log in full, older Conclusions one line each — as the resume branch does), skipping silently when none do. Then open:

> *Output the next fenced block as markdown (not a code block):*

```
The map's above. You can open a new thread — something the product needs that we haven't shaped — or name changes to what's there: move, rename, remove, re-order horizons, groom an inbox idea on. Both in one go is fine. Say "show roadmap" anytime to pull it back up.

What's on your mind?
```

**STOP.** Wait for user response.

→ Proceed to **B. Session Loop**.

## B. Session Loop

No fixed cadence — follow the conversation, not a checklist. **The loop is the exploration.** Items and horizons are sorted at the harvest in **C**, when the user pulls.

1. **Listen.** Take in what the user just said.
2. **Recognise intent.** An **Edits** write below conjures the log first when none exists yet — the lazy rule, [session-template.md](session-template.md). The user's message may contain:
   - **Exploration content** — the product's shape, who it serves, what matters when. Continue the conversation per the guidelines' stance, the staging current running throughout.
   - **A map operation on an existing item or horizon** — *"move X to v2"*, *"rename X"*, *"merge those horizons"*. Run the matching engine verb (`roadmap move|rename|edit|remove`, `roadmap horizon …` — each validates and self-commits; a refusal on a pulled item is the authority split speaking: relay it, offer the epic-side path). Record the op under **Edits**. An add aimed at a horizon with any member in delivery takes the routed confirm first (guidelines **C**).
   - **A direct add** — a placed capability named mid-conversation with no more shaping owed: `roadmap add {name} --horizon {h} --summary "{one-liner}" --source .roadmap/sessions/session-{session_number}.md` (origin defaults to `harvest`; the same guidelines-**C** confirm applies when the horizon has a member in delivery). Most material waits for the harvest instead — add directly only when the user places it themselves.
   - **Grooming an inbox idea on** — archive first so the pointer is durable, then add with the archived path as the source: `engine inbox archive {path}`, then `roadmap add {name} --horizon {h} --summary "{one-liner}" --origin inbox:{slug} --source .inbox/.archived/ideas/{file}`.
   - **Shared files** — paths offered in conversation land via `engine roadmap import {path} …` (self-commits; on `missing_imports`, re-prompt); read them for the conversation and record under **Edits**.
   - **A request to see the map** — *"show roadmap"*. Re-run `gateway.cjs view` and emit its TITLE and DISPLAY sections per their markers (skip the menu — the conversation is live). No STOP; render and continue.
   - **A KB query for prior context** — when a thread would benefit from what shipped work recorded, invoke `knowledge query` with a query derived from the thread (see [contextual-query.md](../../workflow-knowledge/references/contextual-query.md) for the pattern).
   - **A harvest pull** — *"lay it out"*, *"that covers it"*, *"let's sort it"*, *"done"*. Route to **C. Harvest**.
3. **Continue the exploration.** One thread at a time.
4. **Read the arc for convergence.** When the conversation converges (the guidelines' proxies), surface the ambient nudge — a light aside offering the harvest, once, never a gate (see [harvest-nudge.md](../../workflow-discovery/references/harvest-nudge.md), reading "topics" as "the roadmap sort") — then stay in **B**.
5. **Keep the running record.** Write the **Exploration** section at natural pauses — the intent, the staging language, the soft decisions and rejected paths with why. Append-forward, prose not transcript; lossiness defeats the point. The lazy-creation rule applies (see [session-template.md](session-template.md)). After writing, commit:

   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit --roadmap -m "roadmap: exploration notes — session-{session_number}"
   ```

→ Proceed to **C. Harvest** when the user pulls (recognised in step 2); otherwise loop within **B**.

## C. Harvest

Reached from **B** step 2 when the user pulls. The sort is user-pulled — there is no Claude-side gate here.

→ Load **[harvest.md](harvest.md)** and follow its instructions as written. It owns its own confirmation and returns an outcome:

#### If the outcome is `confirmed`

→ Return to caller.

#### If the outcome is `explore`

The conversation continues where it left off — no re-open, no fresh chrome.

→ Return to **B. Session Loop**.

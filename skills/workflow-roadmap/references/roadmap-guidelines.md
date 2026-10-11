# Roadmap Guidelines

*Reference for **[workflow-roadmap](../SKILL.md)***

---

The product session runs on discovery's exploration stance — the register, the curatorial moves, the convergence reading, and the hard rules are the same craft one level up.

→ Load **[discovery-guidelines.md](../../workflow-discovery/references/discovery-guidelines.md)** and hold its guidance, reading "topics" as "items" and "the map" as "the roadmap". Then apply the deltas below — where they differ, the delta wins.

## A. Altitude

- **Ideas at capability grain, always.** An idea is one capability the user would move around a roadmap as one thing — "loyalty", "white-label". It may turn out to be a topic, three topics, or a whole epic; nobody knows yet and nobody needs to. The one grain test is the pull: the pull takes whole items, so anything the user could commit to separately is its own item. A launch scope narrated as a single closed loop ("ordering, menu upkeep, kitchen display") is a **horizon holding three items**, never one bundled item — a bundle can't be pulled as a slice, and its parts leave nothing to fold a later thought into, flag, or groom. Beyond that, no granularity discipline applies — the independence tests belong to the epic's harvest, after a pull. A bug or a quick-fix is one fix, never a capability.
- **Whether and when, not how.** The conversation decides what the product needs and what order it earns — mechanism, feasibility depth, and design decisions belong to the work units a pull creates. Substance is still welcome the way discovery welcomes it (soft decisions, rejected paths, recorded plainly); what changes is where the conversation anchors when a thread has given what it has.
- **No self-healing analysis runs at this level.** The roadmap fills through conversation, parks, and grooming alone — nothing auto-adds later, so harvest what the session actually surfaced. Documentation cadence and map operations live in the roadmap's own [session-loop.md](session-loop.md), never in the epic loop the imported guidance points at.

## B. The Staging Current

Listen for now/next/later throughout — staging language is this altitude's shape signal: *"eventually"*, *"down the line"*, *"for launch we just need"*, *"once we have revenue"*. Surface soft placement reads mid-loop the way discovery surfaces tentative type reads: *"Loyalty keeps landing after launch in how you talk about it — later, not first? "* Never a leading seed — the user's own language names the horizons, and the sort crystallises at the harvest, not before. When no staging language has emerged by harvest time, offer **Now / Next / Later** as a suggested default set.

## C. The Join in Conversation

Items joined to work units are windows, not material:

- A thread about a **waiting** item is this session's business — explore, re-sort, edit freely.
- A thread about a **pulled, in-flight** item belongs to its work unit. When the session materially deepens its ground, record the exploration in the log and flag the join so the epic re-examines (`engine roadmap flag {name}`). A flag that reaches nothing answers `committed: null` with a note saying so — relay the note as it stands; the thought stays in this session's log. Never treat the roadmap as the place to redirect in-flight work — re-bucketing or removing a pulled item is refused engine-side, and the refusal names the item's way back to waiting: relay it.
- **An idea's add fetches the add gate first** — a direct add, or an inbox idea groomed on ([session-loop.md](session-loop.md) **B**). A bug or a quick-fix is always a plain add: pull-forward takes ideas alone. Fetch the gate over the horizon the idea is going to:

  ```bash
  node .claude/skills/workflow-engine/scripts/engine.cjs render roadmap-add-gate --horizon "{h}"
  ```

  Empty output means no member of the horizon is in an epic underway: land the idea there, with no stop. Otherwise reason from its DATA, emit its MENU section verbatim per its marker, and **STOP.** Wait for user response.

  Route the answer. Each arm lands the idea the way it came — a direct add through `roadmap add`, a groomed idea through `roadmap add-batch` with its note, so the note moves with it and never stays in the inbox:
  - **Into the delivery** (`d/delivery`) — the item is delivery scope now: land it in the horizon, then `roadmap pull-forward {name} --into {unit} --routing {research|discussion, per the thread's need}`, `{unit}` from the DATA's `work_units` (when it names several, the user names which — ask when the answer does not). Record both under **Edits**.
  - **On the roadmap, waiting** (`w/waiting`) — land it in the horizon.
  - **Another horizon** (`h/horizon`) — the user names it (ask when the answer does not); the add there fetches this gate over that horizon.
  - **Ask** — answer it from what each row commits, as its route above states, naming both: the delivery row puts the item in that work unit's scope now, beside what it already holds; the others leave it on the roadmap for a later pull. How the work unit orders its own work is not the question the gate asks. Then talk it through. The question sets the gate aside; once the exchange looks settled, ask in conversation whether they are ready to move on, and on yes put it back — render the gate again, emit its MENU section verbatim per its marker, and **STOP.** Wait for user response.

## D. Tangents

A non-product tangent (a bug spotted mid-chat, an operational thought) goes where the user puts it. Placed on a horizon (*"fix that before launch"*), it lands as its kind — a direct add with `--kind bug` or `--kind quick-fix` ([session-loop.md](session-loop.md) **B**). Left undecided, it takes the inbox scope-down: offer the matching capture skill (`/workflow-log-idea`, `/workflow-log-bug`, `/workflow-log-quickfix`), commit the capture (`engine commit --inbox`), and carry on. Product-shaped material never parks — at this altitude it is all in scope; it lands at the harvest.

→ Return to caller.

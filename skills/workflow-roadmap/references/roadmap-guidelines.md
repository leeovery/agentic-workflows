# Roadmap Guidelines

*Reference for **[workflow-roadmap](../SKILL.md)***

---

The product session runs on discovery's exploration stance — the register, the curatorial moves, the convergence reading, and the hard rules are the same craft one level up.

→ Load **[discovery-guidelines.md](../../workflow-discovery/references/discovery-guidelines.md)** and hold its guidance, reading "topics" as "items" and "the map" as "the roadmap". Then apply the deltas below — where they differ, the delta wins.

## A. Altitude

- **Capability-grain, always.** An item is one capability the user would move around a roadmap as one thing — "loyalty", "white-label". It may turn out to be a topic, three topics, or a whole epic; nobody knows yet and nobody needs to. The one grain test is the pull: the pull takes whole items, so anything the user could commit to separately is its own item. A launch scope narrated as a single closed loop ("ordering, menu upkeep, kitchen display") is a **horizon holding three items**, never one bundled item — a bundle can't be pulled as a slice, and its parts leave nothing to fold a later thought into, flag, or groom. Beyond that, no granularity discipline applies — the independence tests belong to the epic's harvest, after a pull.
- **Whether and when, not how.** The conversation decides what the product needs and what order it earns — mechanism, feasibility depth, and design decisions belong to the work units a pull creates. Substance is still welcome the way discovery welcomes it (soft decisions, rejected paths, recorded plainly); what changes is where the conversation anchors when a thread has given what it has.
- **No self-healing analyses run at this level.** The roadmap fills through conversation, parks, and grooming alone — nothing auto-adds later, so harvest what the session actually surfaced. Documentation cadence and map operations live in the roadmap's own [session-loop.md](session-loop.md), never in the epic loop the imported guidance points at.

## B. The Staging Current

Listen for now/next/later throughout — staging language is this altitude's shape signal: *"eventually"*, *"down the line"*, *"for launch we just need"*, *"once we have revenue"*. Surface soft placement reads mid-loop the way discovery surfaces tentative type reads: *"Loyalty keeps landing after launch in how you talk about it — later, not first? "* Never a leading seed — the user's own language names the horizons, and the sort crystallises at the harvest, not before. When no staging language has emerged by harvest time, offer **Now / Next / Later** as a suggested default set.

## C. The Join in Conversation

Items joined to work units are windows, not material:

- A thread about a **waiting** item is this session's business — explore, re-sort, edit freely.
- A thread about a **pulled, in-flight** item belongs to its work unit. When the session materially deepens its ground, record the exploration in the log and flag the join so the epic re-examines (`engine roadmap flag {name}`; a join the epic has not yet bound to a topic answers `committed: null` with a note — nothing lands, the epic reads the record fresh at its harvest; relay that in a line). Never treat the roadmap as the place to redirect in-flight work — re-bucketing or removing a pulled item is refused engine-side, and the recovery is the epic's cancel.
- An add aimed at a horizon with **any member in delivery** takes the routed confirm (`engine render roadmap-add-gate --horizon {h}` — emit its section verbatim, then STOP for the answer). While waiting members remain the menu is three-way; once the horizon is fully in delivery it is strict two-way — no waiting side-door into a release that is now an epic. Route the answer:
  - **Into the delivery** (`1`) — the item is delivery scope now: `roadmap add` it into the horizon, then `roadmap pull-forward {name} --into {unit} --routing {research|discussion, per the thread's need}` (when the gate named several units, the user's answer names which). Record both under **Edits**.
  - **Waiting beside the uncommitted members** (`2`, three-way only) — a plain `roadmap add`.
  - **Another horizon** — the user names it; a plain `roadmap add` there.

## D. Tangents

A non-product tangent (a bug spotted mid-chat, an operational thought) takes the inbox scope-down: offer the matching capture skill (`/workflow-log-idea`, `/workflow-log-bug`, `/workflow-log-quickfix`), commit the capture (`engine commit --inbox`), and carry on. Product-shaped material never parks — at this altitude it is all in scope; it lands at the harvest.

→ Return to caller.

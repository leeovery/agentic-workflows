# Detection Core

*Reference for **[workflow-discovery](../SKILL.md)***

---

Universal shape-detection knowledge — loaded on every new-mode entry, applied throughout the shaping conversation (Step 4). It carries *signals and the confirm protocol*, never execution detail. Reroute is this same knowledge pointed at a competing shape.

These rules apply only to the work-type decision during shaping (Step 4) — a one-shot call that does not carry into later phases once the type is committed and the work routes out. Do not render any of this to the user verbatim — it governs how you listen, surface, and commit.

## A. What you're resolving

Two levels, gathered simultaneously, committed in dependency order:

- **Macro / work type** — *what kind of work is this?* (epic / feature / bugfix / quick-fix / cross-cutting — or none: a product-altitude read routes out to the roadmap before any unit exists). Resolved first.
- **Micro / topic** — topic existence (one coherent thing vs many) and, where the type has it, per-topic routing. For example, you cannot route an epic's topics, or choose research-vs-discussion for a feature or cross-cutting concern, until you know which it is.

**Gather freely; commit in order.** Work-type cues and topic seeds co-emerge in the same breath — never sequence the *conversation* into "first interrogate type, then topics." Only *commitment* is ordered.

## B. The discriminator tree (resolution order)

Resolve in order of cost + terminality — settle the cheap, terminal shapes first, then explore the rest.

0. **Product-altitude, not a unit of work?** The conversation is about a product's future rather than a nameable piece of work: a brand-new product being conceived (greenfield genesis — the paradigm case), or release-staging talk with no single deliverable proposed (*"lay out the next few months"*, *"what should v2 be"*). → **the product road** (→ roadmap). The tell is neither breadth (epics are broad too) nor readiness — it is that no single unit of work is on the table. The read is cheap to be wrong in both directions: misread as epic, later-staged material parks to the roadmap as it surfaces; misread as product, everything lands in the first horizon and one epic takes it all at the pull.
1. **A constrained, terminal shape?** These confirm fast and route straight out — no topic work, no micro routing:
   - **something that worked is now failing** — specific symptoms, a root cause still to find → **bugfix** (→ investigation)
   - **a small, known, mechanical change** — *"bump the timeout"*, *"rename X to Y"*, *"add a flag"*; no behaviour debate, nothing to diagnose → **quick-fix** (→ scoping)
2. **Otherwise — something to build or define.** Keep exploring until the topic count settles:
   - pattern / principle / strategy, nothing ship-able (*"error-response shape"*, *"auth strategy"*, *"logging convention"*) → **cross-cutting**
   - ship-able, one coherent topic → **feature**
   - ship-able, topics multiply → **epic**

**Topic-count is a macro discriminator, not a post-commit step.** You cannot tell epic from feature without surfacing whether topics multiply — so topic *existence* detection happens *during* macro resolution. Only topic *routing* and *refinement* continue after the macro commit. The **absence** of further topics is itself the feature/cc signal — explore until no new topics surface.

So confirming "epic" *required* surfacing the topics: by the time epic commits you already hold the topic seeds. Topic discovery is the **deepening** of the same exploration, not a fresh start.

**Completeness asymmetry.** The feature↔epic *boundary* needs *higher* confidence than epic topic-enumeration — the boundary has no safety net, but topic-enumeration does (gap-analysis keeps hydrating the map at every bridge). Explore the boundary carefully; don't over-invest in exhaustive topic lists at initial discovery.

## C. Substance signals (what to listen for)

Listen for plain shape-cues in the user's framing — these are illustrative, not a strict checklist (weak single matches don't qualify):

| Substance signal | Routes to |
|---|---|
| New behaviour, single coherent scope, clear actors and flows | feature |
| Multiple distinct concerns from one description; multi-week / multi-phase; *"project"* / *"initiative"* framing | epic |
| A product from nothing; staged ambition (*"eventually"*, *"for launch we just need"*, *"once we have revenue"*); release-planning framing with no single deliverable | product road |
| System-wide pattern / principle / strategy; no customer-facing deliverable | cross-cutting |
| Past-tense or present-broken; specific failure cases; error messages / stack traces | bugfix |
| Imperative scoped change; one-shot adjustment without behaviour debate | quick-fix |
| *"Not sure how"* / *"what's possible"*; mixes broken + new | ambiguous — keep exploring |

## D. Plain-language surfacing — no bucket names until commit

The bucket names (epic / feature / …) are workflow internals; they mean nothing to a user who hasn't lived in the system. Until the commit moment, describe what the user is *actually doing*, not which bucket it falls in:

| Internal | User-facing |
|---|---|
| product road | *"the whole product across time — we'd lay it out as a roadmap and pull the first slice into delivery"* |
| epic | *"several distinct things — more than one feature in scope"* |
| feature | *"a single coherent piece of work"* |
| cross-cutting | *"a pattern or principle that affects the whole project — something to define, not ship as a feature"* |
| bugfix | *"something broken we're fixing rather than something new we're building"* |
| quick-fix | *"a small targeted change — an adjustment rather than a whole feature"* |

The bucket name appears only at the routing-commit moment (**G**), and even then folded in naturally.

## E. Confidence — the clock

You are confident-enough-to-**surface** a tentative read when: multiple converging signals point one way, the user's framing has been consistent across turns, ambiguity has been resolved (you've asked an explicit disambiguator if needed), and no competing shape's signals are simultaneously lit.

**Mid-loop surfacing** — share tentative reads as patterns emerge, soft and easy to redirect, not silently accumulating to endpoint. Examples (illustrative):
- *"I'm hearing a few distinct things — this might be more than one feature. Want to pull on that or stay focused?"*
- *"You mentioned X — that feels separate from what we're shaping. Surface to inbox for later?"*

**The explicit shape question** — when shape questions are exhausted but ambiguity remains, and the next natural question would drop into substance (research / decision / investigation), ask the user directly to disambiguate rather than fishing:
- *"This could be fixing something currently broken, or adding something new that doesn't exist yet. Which is closer?"*
- *"Does this feel like one focused thing, or several connected things?"*

Below the threshold, keep exploring. **Every turn must earn its place** — it must be verifying or resolving shape. A shape-confirm turn earns its place; ceremony turns (a standalone import gate, a synthesis loop with nothing to synthesise) do not.

**Pre-seeded vs open start.** A `workflow-start` menu pick pre-seeds the work type — trust it. You start *above* the threshold above, so this is a light confirm, not a re-derivation: head for the commit as soon as the description fits the pick. Reconsider only if a *clear, strong* signal says it's something else (per F) — don't go looking for one. `s/start` pre-seeds nothing — the loop *establishes* the type before it can commit. Same discipline; depth differs.

## F. Pivot / reroute watch

A pivot is this detection core pointed at a *competing* shape — same threshold (multiple converging signals, consistent framing, patience), applied to the alternative rather than the current read. Common paths (illustrative cues):

| Pivot | Cues |
|---|---|
| feature → epic | Multiple distinct concerns surface; topic seeds cluster into independent groups; scope expands mid-conversation |
| epic → feature | Synthesis converges on one coherent topic; "multiple shapes" never materialises |
| epic → product road | Staging language takes over — the conversation sorts material into releases rather than shaping one initiative; a whole new product emerges |
| product road → epic | One deliverable initiative crystallises and the staging talk was incidental — everything discussed is "now" |
| bugfix → feature | The "broken" behaviour is missing-by-design, not a malfunction |
| feature → bugfix | The "new" behaviour is restoring something that should already work; "it used to work" |
| quick-fix → feature/bugfix | Scope discussion gets substantive; behaviour debate emerges |
| any → quick-fix | Scope collapses to a small, known, mechanical change — no behaviour debate, nothing to diagnose, no topics |
| any → cross-cutting | The work is defining a pattern/principle, not shipping a deliverable |

Surface a pivot mid-loop as a tentative read, plain language: *"This is shaping bigger than one feature — sounds like several connected things. Want to treat it as a larger initiative made of multiple features?"* The user confirms, declines, or redirects — take their call. Pivots can fire multiple times; each is easy to push back on. A pre-seed is a hint, never a lock.

## G. Scope-down to inbox

When a tangential concern surfaces that doesn't fit the current shape, offer to surface it to the inbox rather than scope-creep:

> *"You mentioned X — that feels separate from what we're shaping. Surface to inbox for later?"*

If the user accepts, invoke the matching capture skill (`/workflow-log-idea`, `/workflow-log-bug`, or `/workflow-log-quickfix` — default to idea if unsure). The capture skill writes the inbox file but does not commit it, so commit it now (`node .claude/skills/workflow-engine/scripts/engine.cjs commit --inbox -m "workflow(inbox): capture {slug}"`) — it's a side-excursion from the main work, easy to leave uncommitted otherwise, and committing it means the capture survives even if this discovery session is abandoned. Note the surfacing so it's recoverable, then continue with the original work, now without scope creep. If the user says it's actually part of this work, fold it in. Soft, conversational — no structured gate.

**The stated placement is the ticket.** When the tangent is a product capability the user *places on the timeline* (*"that's a v2 thing"*), it parks on the roadmap instead — confirmed placement, then `engine roadmap add {name} --horizon {h} --summary "{one-liner}" --origin park:discovery` (self-commits; the roadmap is born at the first park). An unplaced thought stays the inbox's — when ambiguous, inbox: grooming promotes cheaply later, while a wrong horizon reads as a decision someone made.

## H. Anchor and return — shape, don't dive

While you're determining the type, you're shaping the work, not resolving it. Substance — mechanism, feasibility, design decisions, root cause — belongs to the phase the work routes into. If the conversation tunnels into it, anchor and return: note the thread for the right later phase, then keep shaping.

> *"That's the kind of thing we'll get into once this is set up — hold that thread, we'll pick it up in research / discussion / investigation. For now, let's pin down what this is."*

This is determination discipline; it doesn't carry past the commit (per the scope note above). It governs every type — and since the single-phase types route straight out once the type is settled, it is the whole of their discovery.

## I. Confirm with reasons — the commit protocol

This protocol governs the macro commit, rendered at **Step 4** — not here. Hold it in mind.

Commit only when signals have **converged AND been stable** across the last few exchanges, mid-loop surfacings have been confirmed or adjusted, and the next move would drop into substance if you kept exploring. The commit move has three parts:

1. **State the read** in plain user-facing terms (per **D**), with the workflow bucket name folded in naturally — not before.
2. **Give the specific signals** that drove it — one or two sentences, concrete enough that the user can challenge a *cue*, not just accept/reject the whole.
3. **Invite confirm or override** via the gate Step 4 renders. On confirm, the work type is committed. On override, take the user's call as authoritative — adjust `work_type` without re-litigating (if they describe rather than name, map via **B**/**C** and reflect back for a quick confirm). On "keep shaping", continue the loop.

## J. Recognition — the work may already exist

The forming work may already have a home the user forgot: a waiting roadmap item, or an inbox capture. The opener read both indexes; as the shape converges, match it against them by name and theme — a match earns one soft question, a miss earns silence.

- **A waiting roadmap item holds this ground** — epic- and feature-shaped reads only; bugs and quick-fixes never touch the roadmap. A fresh work unit beside the item would strand its record and twin it. Offer the pull instead: *"Loyalty is already on your roadmap (v1) — pull it from there so the record comes along?"* On decline, continue shaping; never create the twin silently — a deliberate fresh start renames.
- **A live inbox item captured this thought** — *"You logged 'checkout race' on 12 Jul — read it in as the seed?"* On accept, add the item's path to `inbox_seeds` and read it — it becomes the work's seed through the normal confirm-trigger landing. On decline, continue.

**If the user accepts a pull offer:** invoke `/workflow-roadmap pull` via the Skill tool. This skill ends. The invoked skill will load into context and provide additional instructions. Terminal.

**Otherwise** — no match, a declined offer, or an inbox seed read in:

→ Return to caller.

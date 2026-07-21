# Discovery: Defer Routing / Granularity Refs to the Harvest

## The Idea

`workflow-discovery` loads `routing-inference.md` and `topic-granularity.md` into context **at Step 9 (Load Discovery Guidelines), before the exploration loop begins**. Both files are *harvest-time* tooling — they even say so — but having their vocabulary in context throughout the loop causes the model to apply them prematurely *during* exploration: classifying areas as "research vs discussion" and drawing/merging topic boundaries mid-conversation, which the discovery hard rules explicitly forbid ("No inline topic decomposition").

Fix: **defer both loads to the harvest branch** so the routing/granularity vocabulary simply isn't present during the exploration loop. Altitude ("stay shallow — depth is downstream") does not depend on those files; it rides on `SKILL.md`'s Workflow Context pipeline table, which stays loaded regardless.

## Context

Surfaced on a real consumer run (an epic discovery session). During free exploration the model repeatedly:

- labelled areas "that's a **research** topic", "**discussion**-shaped", assigned tentative routing per area; and
- debated topic boundaries inline — "is this a **standalone topic**?", "I'd **fold** quick-capture into that topic".

The user flagged it twice ("we aren't at that stage yet", "this is collaborative, not you making routing/topic decisions"), then asked whether the model had read ahead. It hadn't — it had loaded exactly what the discovery skill told it to:

- **Step 9** → `discovery-guidelines.md`, whose section A ends with `→ Load topic-granularity.md …` and `→ Load routing-inference.md …`.
- `routing-inference.md` is the research↔discussion **cue lists** (self-described: *"Routing is proposed at the harvest"*).
- `topic-granularity.md` is the split/merge **independence test** (`discovery-guidelines.md` even says *"The rules apply at the harvest, not during exploration — but having them in context helps you avoid pre-emptively splitting things"*).

So the guidance was correct about *when* these apply; the failure is that front-loading harvest-only references into the exploration context relies on model discipline to defer their *application* — and that discipline broke. The two files that leaked are precisely the two loaded pre-loop.

Not read-ahead of a later phase: `topic-synthesis.md`, `harvest-nudge.md`, and the research/discussion phase skills were never loaded early. The leak is premature *application* of two references the discovery skill itself front-loads.

## Root Cause

`discovery-guidelines.md` (loaded at Step 9, before `session-loop.md` runs the loop) pulls two harvest-only references into context. Their "apply at harvest, not exploration" caveats are inline prose the model must actively remember to honour across a long exploration — a discipline dependency, not a structural guard. The intent the model actually needs during exploration ("discovery is shallow; downstream research/discussion phases own the depth") comes from a *different* place — `SKILL.md`'s Workflow Context table — so removing the two refs from the loop costs no altitude.

## Possible Directions

- **(Preferred) Move the two `→ Load …` instructions out of `discovery-guidelines.md` and into the harvest branch.** Load `routing-inference.md` + `topic-granularity.md` at `session-loop.md` **C. Harvest** (where `topic-synthesis.md` runs / is loaded), i.e. only once the user has pulled the harvest. If the vocabulary isn't in context during the loop, it cannot leak into it. This is the structural fix.
- **Reinforce altitude with a plain, mechanics-free line.** Optionally add one sentence to `discovery-guidelines.md` that gives the *why* without the leakable *how*: e.g. *"Discovery stays shallow — downstream phases own the depth. Shape the work; don't resolve it, classify it, or route it here."* This restates intent (already implicit in `SKILL.md`) without handing over the routing cue lists or the split/merge rules.
- **(Weaker) Keep the loads at Step 9 but harden the guard.** Leave the refs pre-loop and add a firmer inline prohibition against applying them during exploration. Rejected as primary: it's the same discipline dependency that already failed once.

## Nuance to Preserve

`topic-granularity.md` is claimed to have *mild* in-loop value ("avoid pre-emptively splitting things you don't yet need to"). In practice it leaked too (inline "standalone topic?" debates). If that anti-fragmentation nudge is judged worth keeping in the loop, fold a single plain line into the deferred-load rationale (e.g. "topics end up coarse — don't fragment during exploration") rather than loading the full independence-test mechanics. The split/merge *procedure* is harvest tooling either way.

## Relevant Files

- `skills/workflow-discovery/references/discovery-guidelines.md` — section A end: the two `→ Load topic-granularity.md` / `→ Load routing-inference.md` instructions that front-load harvest tooling into the pre-loop context. Remove/relocate these.
- `skills/workflow-discovery/references/routing-inference.md` — research↔discussion cue lists; harvest-only. Load at harvest, not Step 9.
- `skills/workflow-shared/references/topic-granularity.md` — split/merge independence test; harvest-only. Same.
- `skills/workflow-discovery/references/session-loop.md` — **C. Harvest** is the target home for the deferred loads (topic synthesis is user-pulled here).
- `skills/workflow-discovery/references/topic-synthesis.md` — the harvest/synthesis reference; natural place to load routing-inference + topic-granularity right before they're used.
- `skills/workflow-discovery/SKILL.md` — Workflow Context pipeline table (`(Research) → Discussion → Specification → …`) that carries the "depth is downstream, stay shallow" altitude regardless of the refs; confirms deferring the refs loses no intent.

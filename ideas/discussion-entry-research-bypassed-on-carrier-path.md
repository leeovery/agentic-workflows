# Discussion-Entry Drops Research When Discovery Left a Usable Carrier

## The Idea

`workflow-discussion-entry` only forwards a completed research phase to the discussion when its **fallback** context-gathering path runs. The research-detection logic lives solely inside `references/gather-context.md` (§B "Check Research Status"), which is the *only* place that upgrades `source` → `topic-provided-with-research` — and that string is the *only* `invoke-skill.md` handoff branch that emits a `Research files:` block. But the rich-carrier branches of Step 3 (the **normal** path for a well-formed work unit) skip `gather-context.md` entirely and jump straight to Step 4. On those paths `source` stays `topic-provided`, the handoff carries no `Research files:` block, and `initialize-discussion.md` — which seeds the Discussion Map from research *only if the handoff lists research files* — falls back to seeding from the one-line manifest `description`. **The entire research phase output is silently dropped from the discussion seed.**

The perverse part: the richer the discovery carrier, the *worse* the outcome. A legacy/placeholder work unit with no Exploration takes the fallback path → research is detected and forwarded correctly. A well-run work unit whose discovery populated Exploration takes the carrier path → research is dropped. The happy path is the broken one.

## How It Surfaced

This run. Continuing the `restore-host-terminal-windows` feature pipeline (`research → discussion`), `/workflow-discussion-entry feature restore-host-terminal-windows`:

- Step 1: `exists restore-host-terminal-windows.discussion.restore-host-terminal-windows` → `false` (no discussion phase yet) → new-entry branch → `source = "topic-provided"`.
- Step 3 (non-epic): read manifest `description` + `discovery/session-001.md`. The log's **Exploration** section had real content, so Step 3 took the branch *"Seed the discussion from the `description` and that Exploration. → Proceed to **Step 4**."* — which **never loads `gather-context.md`**, so §B "Check Research Status" never ran.
- Step 4 / `invoke-skill.md`: with `source = "topic-provided"`, the matching handoff branch is `fresh | topic-provided` — **no `Research files:` block**.

A strictly literal executor would therefore have handed `initialize-discussion.md` a research-less handoff and seeded the 12-subtopic Discussion Map from the single-sentence manifest description, with the 32 KB research file (which literally contains a "Carried into discussion (live)" list of the subtopics) never read. It only worked because I (executor) noticed `phases.research.items.*.status == completed`, ran `ls` on the research dir myself, and chose the `topic-provided-with-research` handoff by inference. That bridge shouldn't be the executor's job — the skill should do it deterministically.

## Why This Matters

Research → Discussion is a documented pipeline edge for features and cross-cutting (the SKILL.md pipeline table lists "Research (optional) → **Discussion**"). The whole point of running research first is to carry its findings into the discussion. This bug defeats that on exactly the runs that did everything right: discovery shaped a carrier *and* research completed. The discussion then starts from a one-line description instead of the research, and the map/quality degrades — invisibly, because nothing errors.

The two delivery facts that make it silent:
- `initialize-discussion.md` has no independent research detection — it trusts the handoff's `Research files:` section and otherwise seeds from seed/description. No handoff block ⇒ no research, no warning.
- `invoke-skill.md`'s `topic-provided` branch is byte-identical to `fresh` (Source: fresh, Description only). So a topic-provided-*with-research* run that loses its `-with-research` upgrade is indistinguishable from a cold fresh start.

## Affected Paths

`gather-context.md` (hence the research check) is loaded only by:
- Step 3 non-epic **Otherwise** — *no usable carrier* (Exploration absent/`(none)`).
- Step 3 epic **`direct-start`**.

It is **bypassed** by:
- Step 3 non-epic **Exploration-present** branch (`→ Proceed to Step 4`) — features/cross-cutting that ran discovery properly. ← *the case hit here*
- Step 3 epic **map-shaped** branch (reads `{work_unit}.discovery.{topic} description`, `→ Proceed to Step 4`) — epic topics shaped on the discovery map.

So both well-formed shapes (rich feature carrier, map-shaped epic topic) lose research; both degraded shapes (no carrier, direct-start) keep it.

## What It Would Look Like

Decouple research-forwarding from the carrier-routing so it runs on every non-`continue` path. Candidate fixes:

- **(a) Single chokepoint in `invoke-skill.md` (preferred).** `invoke-skill.md` already always runs for every source except `continue`, and already reads the manifest for the `description`. Add a research-status read there (`get '{work_unit}.research.*' status` → any `completed`?) and, when present, always emit the `Research files:` block — independent of `source`. This collapses `topic-provided` and `topic-provided-with-research` into "topic-provided, research block conditional on detection," removing the fragile source-upgrade entirely. `continue` stays exempt by design (existing discussion, no re-prime).
- **(b) Hoist §B into SKILL.md Step 3.** Run "Check Research Status" as a step that every non-`continue` branch passes through *before* the Exploration-present / map-shaped short-circuits, so the `source` upgrade still happens. More faithful to current structure; more edit sites.
- **(c) Belt-and-braces in `initialize-discussion.md`.** Even with the handoff fixed, have the process skill independently check research status and read the files if the manifest says `completed` but the handoff omitted them. Defensive; guards against future handoff regressions.

(a) is the cleanest — one read at the one place that always runs, no orphan-prone intermediate state. Worth a symmetric audit of `workflow-research-entry` and the other `*-entry` skills for the same carrier-vs-fallback split.

## Scope

- `skills/workflow-discussion-entry/references/invoke-skill.md` — add the research-status read + conditional `Research files:` block (fix (a)); or
- `skills/workflow-discussion-entry/SKILL.md` Step 3 — hoist the research check ahead of the carrier short-circuits (fix (b)).
- `skills/workflow-discussion-entry/references/gather-context.md` — §B becomes redundant under (a)/(b); consolidate so detection lives in one place.
- Consider `skills/workflow-discussion-process/references/initialize-discussion.md` for defensive fix (c).
- Audit sibling entry skills (`workflow-research-entry`, `workflow-specification-entry`, etc.) for the same "rich carrier bypasses fallback-only logic" pattern.
- Instruction-only; no code. Low risk, high payoff — restores research→discussion on the happy path.

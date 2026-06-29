# PR2 — The Deep-Discovery Conversation

Turn epic discovery's session loop from shallow-mirror-and-close into open-ended, challenging exploration: fork the stance for epics, replace the eager synthesis STOP gate with an ambient arc-aware nudge, and shift the log to a medium-fidelity narrative. **This is the behavioural heart of the feature and the most convention-sensitive slice.**

> Read `00-overview.md` first — especially Design → Stance fork, Harvest/arc nudge, Soft-by-location, and The log.

## At a glance

- **Branch:** `feat/deep-discovery-pr2-conversation`
- **Base / target:** `feat/deep-discovery-pr1-sessions-layout`
- **Builds on:** PR1's `sessions/` paths
- **Design slice:** stance fork, soft-by-location, arc-aware harvest nudge, narrative log. **No re-entry** (that's PR3); **no brief extraction** (that's PR5 — synthesis still produces topics here as today).
- **Epic-only:** every change below is gated to the epic path. The thin shape-and-route path for feature/bugfix/quick-fix/cross-cutting is untouched.

## Tasks

### 1. Stance fork (epic: mirror → challenge; allow substance; soft-by-location)

- `SKILL.md` (~lines 30–31, "Stay in your lane") — fork epic vs non-epic. **Epic:** may explore substance (feasibility, leanings, even spikes) and make **soft** decisions; **non-epic:** keeps the thin lane (no research/decide/scope). Keep the existing table; add the epic carve-out tightly (prose economy).
- `references/discovery-guidelines.md`:
  - §B (~line 41, "Mirroring, not challenging") — fork for epic into **collaborative challenge / sparring**: opinionated, willing to disagree and counter-frame, surface tensions, propose "what if" alternatives — explicitly **NOT** interrogation (rapid-fire questions) and **NOT** lecturing (monologue); still one live thread at a time. Non-epic retains mirroring.
  - §A Curatorial Moves — add epic moves (surface tensions, probe framing, hold a conflict open).
  - §D Hard Rules (~56–63) — for epic, relax "no decisions / no investigations / no code-architecture talk" into **soft-by-location** decisions and permitted substance. Keep the hard rules for non-epic.
- **State soft-by-location ONCE**, here (the canonical statement): discovery makes real decisions but they are *soft* by virtue of where they live; discussion hardens them; later phases infer it. Decisions are written in soft language ("leaning X because…"), never hard verdicts, never hedged into uselessness.

### 2. Arc-aware harvest nudge (replace the eager STOP gate)

- `references/session-loop.md` §C (~185–216) — **remove** the eager *"Ready to synthesise topics? (y / explore / keep going)"* STOP gate. Replace with an **ambient, non-blocking** nudge that the loop surfaces only at **convergence**. The user may ignore it and keep talking; synthesis fires only when the user pulls.
- **NEW reference `references/harvest-nudge.md`** — extract the arc model + nudge here (keeps `session-loop.md` lean; convention: extract complex logic). Contents:
  - The arc: **diverge → tension → converge**. How to read which phase the conversation is in.
  - Convergence = "decoupled enough to silo" = the moment to surface the nudge. In divergence/tension, **no nudge** — keep exploring.
  - The nudge copy is ambient and optional, e.g. *"Just say when you want to pull topics out of this and move forward — for now, let's keep going."* It does **not** end the turn and requires no answer.
  - The user-pull path still routes into the existing `topic-synthesis.md` (unchanged in this PR).
- `references/discovery-guidelines.md` §C (Endpoint Detection ~45–54) and §B natural-endpoint patterns (~162–167) — recast from "propose endpoint / circle-back tells" into arc-state language; the circle-back/energy-flagging tells become *proxies for convergence*.

### 3. Narrative log character

- `references/template.md` (Exploration section ~51–56; anti-patterns ~115–116) — shift the Exploration section from "strong-summary prose" to **medium-fidelity narrative**: log the reasoning-moves (ideas, objections, pivots, soft-landings, **dead-ends and rejected paths**) — not verbatim, not strong-summary. Append-forward; never edit back; depth accrues by layering down. Soften the "No decisions" anti-pattern for the epic soft-by-location case (rejected paths and soft decisions are *wanted* in the record).
- Update the §B "Document at natural pauses" guidance in `session-loop.md` to the higher-fidelity cadence (capture reasoning-moves, not just surface summaries).

## Conventions to honour (this PR is convention-critical)

- **Removing a STOP is the trap.** The eager gate WAS a `**STOP.**`. The replacement nudge must be genuinely non-blocking. Re-read `CONVENTIONS.md` §Stop Gates and `SKILL.md` Instructions block (~40–47, "don't invent stops", ZERO OUTPUT) **before** editing §C. The nudge is mid-conversation prose, not a gate.
- New reference `harvest-nudge.md` needs the `*Reference for **[workflow-discovery](../SKILL.md)***` header + `---`, `→ Return to caller.` exit, and any user-facing fenced block preceded by its render instruction.
- Stance prose is agent-facing: lean, no backstory, no "(new)" markers. The challenge register must be *shown* precisely (sparring, not interrogation/lecture) — this is exactly the kind of behavioural prose that gets authored wrong; mirror the precision of existing guideline examples.

## Risks / hazards

- **Don't leak the epic stance into non-epic discovery.** Every fork must be conditioned on work_type == epic. Verify the single-phase path renders identically.
- **Shared files with PR3/PR5:** `session-loop.md` is edited again in PR3 (§A) and PR5 (§C→brief). Extracting the nudge into `harvest-nudge.md` shrinks §C to a `→ Load` swap, minimising later rebase conflict.
- **Over-rotating the challenge stance** into combativeness or interrogation. Keep "two senior engineers sparring," one thread at a time.

## Verification

No script tests (skill prose). Exercise in the **engine sandbox** (Mint copy per project memory; never the user's real projects):
- Drive an epic discovery conversation: confirm the eager "ready to synthesise?" gate is **gone**; the nudge appears **only** at convergence, is non-blocking, and the conversation flows past it.
- Confirm the stance challenges/spars (not mirrors, not interrogates).
- Confirm a soft decision is recorded in soft language in the log, and a rejected path is captured.
- Run a **feature** (non-epic) discovery: confirm it is unchanged (mirror-and-route, no nudge).
- Evidence: screenshots / raw bytes (TUI paste clips lines).
- Full suite green (prose change shouldn't break tests, but confirm).

## Definition of done

Epic discovery explores open-endedly with a challenge stance; eager gate replaced by an ambient convergence nudge; log is medium-fidelity narrative incl. rejected paths; soft-by-location stated once; non-epic path provably unchanged.

## When this PR is approved

- **Do NOT merge.**
- **Clear context.**
- **Re-enter plan mode** and write the executable plan for **PR3** from `deep-discovery/pr-3-reentry.md`. Branch `feat/deep-discovery-pr3-reentry`, base/target `feat/deep-discovery-pr2-conversation`. Include its own when-approved hand-off (→ PR4).

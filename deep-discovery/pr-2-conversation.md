# PR2 — The Deep-Discovery Conversation

Turn epic discovery's session loop from shallow-mirror-and-close into open-ended, challenging exploration: give the epic path its deep-discovery stance via **progressive disclosure** (not an inline carve-out), replace the eager synthesis STOP gate with an ambient arc-aware nudge, and make the log a **non-lossy running record**. **This is the behavioural heart of the feature and the most convention-sensitive slice.**

> Read `00-overview.md` first — especially Design → Two movements/Progressive disclosure, Stance, Harvest/arc nudge, Soft-by-location, and The log.

## At a glance

- **Branch:** `feat/deep-discovery-pr2-conversation`
- **Base / target:** `feat/deep-discovery-pr1-sessions-layout`
- **Builds on:** PR1's `sessions/` paths
- **Design slice:** the epic deep-discovery stance, soft-by-location, the arc-aware harvest nudge, and the non-lossy log. **No re-entry** (that's PR3); **no brief extraction** (that's PR5 — synthesis still produces topics here as today).
- **Epic-only behaviour, but via load position — not conditionals** (see the architectural fact below).

## The architectural fact this PR turns on (read before touching anything)

Grounded against the current code:

- **`references/discovery-guidelines.md` (loaded at SKILL Step 9) and `references/session-loop.md` (Step 10) run only on the epic path.** `confirm-trigger.md §G` routes every non-epic type (feature / bugfix / quick-fix / cross-cutting) to **Step 13** (`first-phase-routing.md`) and they never reach Steps 6–12. Existing-epic mode (Step 1 → Step 6) is epic too. So these two files are **epic-only contexts**: rewrite them directly, in one voice, with **no `work_type` conditional and no "epic-only" disclaimer** — they are never loaded for a non-epic, so guarding them is redundant and stating their epic-ness in-file is cruft (prose economy).
- **Only two surfaces are shared with non-epic:** the always-loaded backbone `SKILL.md`, and `template.md` (written for every type via `confirm-trigger.md §E`). These are the *only* places a leak could happen — handle them by **removing premature prohibitions and keeping the template neutral**, never by adding `if epic` forks.
- **`topic-synthesis.md` owns its own confirmation** (`y` / `explore` / `adjust`, returns `confirmed` / `explore`). Once synthesis is **user-pulled**, the eager §C gate that precedes it is redundant — delete it, route the user-pull straight into `topic-synthesis.md`.

**Why this matters:** the earlier attempt forked the stance inline — it left the backbone's blanket "do not research / investigate / decide" in place and bolted an "except epic" exception onto it, producing "do not decide… but for an epic you may." That is the ambiguity this PR exists to remove. The fork is **structural — by which file loads — not prose**.

## Tasks

### 1. Epic deep-discovery stance (progressive disclosure; no backbone carve-out)

**`SKILL.md` backbone (~line 30, "Stay in your lane") — remove the premature prohibition; do NOT add a carve-out.** Today it blanket-forbids "do not research / investigate / decide / scope." That is **false for an epic** and stated **before the work type is known**. Reframe the backbone to its true, type-agnostic role: discovery settles *what the work is* and shapes it; while determining the type, name and shape it — don't tunnel into substance; what happens **after** determination is governed per type by the files loaded on each path. No substance prohibition an epic contradicts may remain in the always-loaded backbone.

**Move the "shape, don't dive" discipline to the determination references.** The anchor-and-return move ("hold that thread, we'll cover it in research / discussion / investigation") belongs where it actually applies — the determination conversation (`detection-core.md` / `shape-and-confirm.md`, loaded Steps 2–4, which already self-scope to "the work-type decision … does not carry into later phases once the type is committed"). It governs determination for **all** types, and — since non-epic routes straight out after determination — the whole of non-epic's thin discovery. It must not sit in the always-loaded backbone where the epic loop would still see it.

**`references/discovery-guidelines.md` (epic-only) — rewrite in one positive voice** as the epic deep-discovery stance:
- **§B "Mirroring, not challenging" → collaborative challenge / sparring:** opinionated, willing to disagree and counter-frame, surface tensions, propose "what if" alternatives — explicitly **NOT** interrogation (rapid-fire questions) and **NOT** lecturing (monologue); one live thread at a time; register = *two senior engineers throwing an idea around*. (No "non-epic retains mirroring" line — non-epic never loads this file.)
- **§A Curatorial Moves** — add epic moves: surface tensions, probe framing, hold a conflict open. Keep the macro-view / anchor-and-return moves (they still apply *within* the deep exploration to avoid tunnelling on one item too early).
- **§D Hard Rules** — drop "no decisions / no investigations / no code-architecture talk." In deep discovery these are **allowed and wanted**: substance, soft decisions, and investigation/research **on request** — **no automatic deep-dive**; spin up a background agent only if the user asks. Keep the rules that still hold: no inline topic decomposition (topics are the harvest output, not surfaced mid-loop); the user pulls the harvest (don't synthesise unasked); the initial map need not be exhaustive.
- **State soft-by-location ONCE here** (the canonical statement, later phases infer it): discovery makes real decisions, recorded **plainly, as decisions**; they are soft by virtue of *where they live* — inferred downstream when consumed by research/discussion or surfaced from the KB. **Do not weave hedging language ("leaning…", "maybe…") through the record.** Discussion is where they harden.
- **§E Worked Examples** — replace the mirroring example with a **sparring** exchange; add one showing a **decision recorded plainly** (not hedged) and a **rejected path** captured in the log. Bounded — one or two examples; show the register, don't lecture it.

### 2. Arc-aware harvest nudge (replace the eager STOP gate)

- **`references/session-loop.md` §C (~185–216) — remove** the eager *"Ready to synthesise topics? (y / explore / keep going)"* STOP gate. (Safe: this file is epic-only; non-epic synthesises/routes via `first-phase-routing.md` at Step 13, untouched.) On a **user pull**, route straight into `topic-synthesis.md` (it owns its own confirm gate); keep the existing `confirmed` → return / `explore` → back-to-loop handling.
- **NEW reference `references/harvest-nudge.md`** — extract the arc model + nudge (keeps `session-loop.md` lean; convention: extract complex logic). Contents:
  - The arc: **diverge → tension → converge**, and how to read which phase the conversation is in.
  - Convergence = "decoupled enough to silo" = the only moment to surface the nudge. In diverge/tension: **no nudge** — keep exploring.
  - The nudge is **ambient, rare, and unobtrusive** — woven into a normal exploration turn, e.g. *"Say when you want to pull topics out of this and move forward — for now, let's keep going."* It does **not** end the turn, render a framed menu, or require an answer. It is **never** a recurring *"I'm hearing N topics — what now?"* check-in (that breaks the conversation's flow). **It is NOT a `**STOP.**` gate.**
  - Convention shape: reference header + `---`; any user-facing line preceded by its render instruction; single exit `→ Return to caller.` (back into the loop).
- **`references/discovery-guidelines.md` §C (Endpoint Detection ~45–54) and §B natural-endpoint patterns (~162–167)** — recast from "propose endpoint / circle-back tells" into **arc-state language**: the circle-back / energy-flagging tells become *proxies for convergence* that cue the nudge — not an endpoint declaration. Synthesis stays user-pulled.

### 3. Non-lossy running-record log

- **`references/session-loop.md` §B step 5 ("Document at natural pauses")** (epic-only) — the Exploration record is a **constant running record of the conversation — not verbatim, but not summarised away; nothing of substance is lost.** Capture the journey: ideas, objections, pivots, the route taken, **false paths and failed designs**, the soft decisions reached, and the **answers to any research or investigation done in-session**. Append-forward; depth accrues by **layering down**, never editing back. Lossiness defeats the point — if the detail is lost, the session was wasted.
- **`references/template.md` (the shared file) — keep it structurally neutral.** The section skeleton stays; the **character** of the Exploration writing is set by the writer, not the template, and **not via a mode-aware conditional** (that was the second leak in the earlier attempt). **Remove** the "No decisions" and "No investigation" anti-patterns (~115–117) — in deep discovery, decisions and investigation answers are *wanted* in the record. Describe the Exploration section neutrally (what was explored and what came of it; written across the session for an epic, or backfilled once at creation for single-phase), with no fidelity fork.
- **Leak guard (non-epic stays identical):** do **NOT** touch `confirm-trigger.md §E` — its one-shot backfill ("strong-summary of the shaping conversation") is the single-phase writer for a different movement and is correct as-is. Because the fidelity instruction lives in the epic writer (`session-loop.md` §B) and not the shared template, non-epic behaviour is unchanged with no conditional.

## Conventions to honour (this PR is convention-critical)

- **Read `CONVENTIONS.md` in full before editing.** Re-check §Stop Gates and the `SKILL.md` Instructions block ("don't invent stops", ZERO OUTPUT) **before** touching §C.
- **Removing a STOP is the trap.** The eager gate WAS a `**STOP.**`. The replacement nudge must be genuinely non-blocking mid-conversation prose — *removing* the gate, not renaming it. No new `**STOP.**`, no framed `· · ·` menu in `harvest-nudge.md`.
- New `harvest-nudge.md` needs the `*Reference for **[workflow-discovery](../SKILL.md)***` header + `---`, a `→ Return to caller.` exit, and a render instruction before any user-facing fenced block.
- **Prose economy** — agent-facing, lean, no "(new)"/backstory/"formerly" markers; write as if always there. Show the challenge register precisely (sparring, not interrogation/lecture) — mirror the precision of the existing guideline examples.

## Risks / hazards

- **The fork is structural, not prose.** `discovery-guidelines.md` / `session-loop.md` are epic-only by load position — rewrite them outright; do **not** add `work_type` conditionals or "epic-only" disclaimers inside them. The only shared surfaces are `SKILL.md` (remove the premature prohibition) and `template.md` (keep neutral). Verify a feature discovery renders identically.
- **Don't re-introduce a premature prohibition.** After the edit, the always-loaded backbone must contain **no** "do not research / investigate / decide" that an epic contradicts. Grep the backbone for residual blanket prohibitions.
- **Shared files with later PRs:** `session-loop.md` is edited again in PR3 (§A re-entry) and PR5 (§C → brief). Extracting the nudge into `harvest-nudge.md` shrinks §B/§C to `→ Load` swaps, minimising later rebase conflict.
- **Over-rotating the challenge stance** into combativeness or interrogation — keep "two senior engineers sparring," one thread at a time.

## Verification

No script tests (skill prose) — but run the full suite to confirm nothing breaks. Behaviour is verified in the **engine sandbox** (Mint copy per project memory; never the user's real `.workflows/`; screenshots / raw bytes are the only fidelity evidence — TUI paste clips lines):
- Drive an **epic** discovery: the eager *"ready to synthesise?"* gate is **gone**; the nudge appears **only** at convergence, is non-blocking and rare, and the conversation flows past it; the stance **challenges/spars** (not mirrors, not interrogates); a decision is recorded **plainly** (not hedged) and a rejected path / investigation answer is captured in the log.
- Confirm a **user pull** ("let's pull topics", "done") routes straight into `topic-synthesis.md` and its confirm gate.
- Run a **feature** (non-epic) discovery: confirm it is **unchanged** — shape-and-route, no nudge, brief shaping log; `confirm-trigger §E` path intact.
- `grep -rn "Ready to synthesise topics" skills/` → empty (eager gate removed). Grep the backbone for residual "do not research/investigate/decide" → none that bind the epic loop.
- Full suite green.

## Definition of done

Epic discovery explores open-endedly with a challenge stance, delivered by progressive disclosure (no backbone carve-out, no premature prohibition); the eager gate is replaced by an ambient, rare convergence nudge (`harvest-nudge.md`); the log is a non-lossy running record incl. rejected paths and investigation answers; soft-by-location stated once (no woven hedging); the shared `template.md` stays neutral; non-epic path provably unchanged; full suite green.

## When this PR is approved

- **Confirm the approval**, then **do NOT merge.**
- **Plan PR3 now, in this same session:** enter plan mode and write the executable plan for **PR3** from `deep-discovery/pr-3-reentry.md`. Branch `feat/deep-discovery-pr3-reentry`, base/target `feat/deep-discovery-pr2-conversation`. Include its own when-approved hand-off (→ PR4).
- **Do not clear context yourself, and do not ask the user to** — accepting the PR3 plan triggers the harness's *clear-and-proceed* into a fresh session that executes PR3.

# PR3 — Re-entry Continuity

Make re-entering an epic's discovery feel like **resuming one fluid conversation**, not starting a fresh session. On re-entry, read prior session logs — not just the distilled map.

> Read `00-overview.md` → Design → Continuity.

## At a glance

- **Branch:** `feat/deep-discovery-pr3-reentry`
- **Base / target:** `feat/deep-discovery-pr2-conversation`
- **Builds on:** PR2's conversation; PR1's `sessions/` paths
- **Design slice:** Continuity. Splits out of PR2 because it edits the same fragile regions (`session-loop.md` §A, `SKILL.md` "Resuming") — separate review of conversation-character (PR2) then continuity (PR3); PR3 strictly *extends* PR2's lines, so the rebase is cheap.

## The problem being fixed

Today, re-entry anchors only on the **map** (the distilled topic list) — `session-loop.md` §A renders the map; the resume branch reads only the *active* session log. The rich *thinking* from prior sessions is siloed; session 002 starts from "here are your topics," not "here's everything we were thinking." That's the discontinuity. The map is a view (the digest); the logs are the record (the journey) — re-entry must read both.

## Tasks

### 1. Read prior logs on re-entry

- `references/session-loop.md` §A (~33–56, resume/refresh and populated-map branches) — load prior session logs, not just the active one. Read budget: **map always** + **most recent session(s) in full** + **older sessions one-line-indexed / pulled from KB on demand**. The opener should brief like resuming a conversation ("last time we were circling X; you were leaning Y; Z was still open"), not dump a summary.
- `SKILL.md` "Resuming After Context Refresh" (~51–60) — extend to read prior logs for continuity (PR1 changed only the path string here; PR3 adds the prior-log read).
- `references/resume-detection.md` — continuity framing: it still reads the `active_session` marker; the change is *what gets loaded* once resumed.

### 2. NEW reference `references/continuity-load.md`

Extract the "which logs to read in full vs index vs KB-on-demand" policy here, so `session-loop.md` §A stays a `→ Load` directive rather than swelling. Contents: the read budget rule, how to render the "resuming a conversation" briefing, and the bound that keeps re-entry cheap regardless of session count.

### 3. `scripts/discovery.cjs` — enumerate sessions

Add `listSessionLogs()` returning all session numbers + paths under `discovery/sessions/` (alongside the existing `findLatestSessionLog()`). Lets the skill know which logs exist without re-globbing. Additive, low-risk.

## Conventions to honour

- New `continuity-load.md` gets the reference header + `---` + `→ Return to caller.`; render instructions before any user-facing fenced block.
- The re-entry briefing copy is user-facing — precede its fenced block with the render instruction.
- Prose economy: no "(now reads prior logs)" narration — it simply reads them.

## Risks / hazards

- **Read-cost blow-up** on long-running epics. The budget (recent-in-full + older-via-KB) must bound the read; don't read all N logs in full. Note: full-fidelity older-log retrieval depends on **PR4** (KB indexing) — until PR4 lands, "older via KB" degrades to "older one-line-indexed from the log headers." Keep PR3 functional without PR4 (recent-in-full is the floor), and let PR4 light up the KB fallback. State this explicitly in `continuity-load.md`.
- **Shared `SKILL.md`/`session-loop.md` regions with PR2** — PR3 extends, doesn't rewrite; keep diffs additive.

## Verification

Engine sandbox (never the user's real projects):
- Run two discovery sessions on a fixture epic; refresh context; re-enter — confirm the opener reflects prior-session *thinking*, not just the map.
- Confirm `listSessionLogs()` returns all session numbers.
- Confirm the read stays bounded with several sessions present.
- Full suite green.

## Definition of done

Re-entry reads prior logs (map + recent-in-full + older-indexed) and briefs like a resumed conversation; read cost bounded; `listSessionLogs()` added; degrades gracefully without PR4's KB fallback.

## When this PR is approved

- **Confirm the approval**, then **do NOT merge.**
- **Plan PR4 now, in this same session:** enter plan mode and write the executable plan for **PR4** from `deep-discovery/pr-4-kb-indexing.md`. Branch `feat/deep-discovery-pr4-kb-indexing`, base/target `feat/deep-discovery-pr3-reentry`. Include its own when-approved hand-off (→ PR5).
- **Do not clear context yourself, and do not ask the user to** — accepting the PR4 plan triggers the harness's *clear-and-proceed* into a fresh session that executes PR4.

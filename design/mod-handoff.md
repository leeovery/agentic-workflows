# Mod handoff — every move into work starts in a clean context

Every move from a menu, or from a concluded phase, into work clears the
context and starts the next skill fresh: one engine command names the
skill and its arguments, and the workflow-gates mod clears the
conversation at the end of the turn and sends the continuation. Plan mode
goes from the workflows entirely. Without the mod the skill is invoked in
place. Opened 2026-10-01 from a measurement: the start menu's weight rode
into every piece of work it opened.

## Motivation

- **The menus' weight rides into the work.** Measured on Tick sessions
  (Opus 5.5): a plain session's first call read 47k tokens, one opened
  with `/workflow-start` 56k; about 22k was spent before the first pick
  (9.5k of it the framework, which the phase loads anyway, 13k start's
  own); discovery began at 79k, carrying about 32k of start. A continue
  skill's dashboard adds its own on top — the epic's most of all.
- **Two mechanisms do one job.** Start, the continue skills and the epic
  menu invoke the next skill in place; the bridge, review's route back to
  implementation, scoping's work-type change, discovery's conclusion and
  the roadmap's pull use plan mode. Only the second clears.
- **Plan mode is a workaround.** The workflows use it only to clear and
  carry on. Its approval dialog offers staying put, which breaks the flow:
  nothing happens, and the person is left in a context the next phase was
  designed never to see. It depends on a project setting and on the
  person choosing the right option, and it may be withdrawn.

## What the lab established (Claude Code 2.1.285, Opus 5.5)

A lab-only plugin armed on a marked Bash result, then cleared and sent a
continuation once the turn ended.

- `$.command.run({ command: 'clear' })`, run from a `$.clock.after` timer
  started in `turn.complete`, clears: `session.end` fires with reason
  `clear`, the conversation goes on under a new session id, and the
  project's settings-level SessionEnd hooks run (the ended conversation's
  folder received its `transcript`).
- `$.prompt.submit({ text })` after the clear enters the new conversation
  0.2 s later, framed as the plugin's message. Claude, with an empty
  context, invoked the named skill as its first action and stopped at its
  menu with the band drawn.
- `$.command.run` of a `user-invocable: false` skill is refused, on
  screen: "This skill can only be invoked by Claude, not directly by
  users". A command a mod runs counts as the person's. The continuation is
  therefore a message Claude acts on, exactly as plan mode's cleared
  context acts on the plan.
- After a clear the skill and agent listings are held back for the first
  call and sent with the next: a cleared conversation's base is a new
  conversation's base, no lighter.
- `$` is never stored — the validator refuses it — so a timer's closure
  reads the hook's own `$`.

## Rulings

- **H1 — one handoff, every move into work.** A move into work clears; a
  move between menus stays in place.

  | From | To | Today | Handoff |
  |---|---|---|---|
  | Start | Discovery, the roadmap, the baseline | In place | Clears |
  | Start | A continue menu | In place | In place |
  | A continue menu, the epic menu | A phase, discovery | In place | Clears |
  | A concluded phase (the bridge) | The next phase, the epic menu | Plan mode | Clears |
  | Review's route back, scoping's type change, discovery's conclusion, the roadmap's pull into a feature | Their next skill | Plan mode | Clears |
  | Discovery into a roadmap genesis, a recognition pull, the roadmap's pull into an epic's discovery | The roadmap, discovery | In place | In place — the conversation carries on |
  | Anywhere | Help; back to the start menu | In place | In place |

  The roadmap and the baseline hold conversations and write artifacts, so
  they are work. A move that carries the live conversation on — the shaping
  conversation into a roadmap genesis, a recognition pull, an epic pulled
  from the roadmap continuing into its discovery — is one conversation,
  never a handoff. A concluding phase still invokes the bridge in place —
  the bridge is the short step that decides where the work goes, and it
  ends in the handoff.

- **H2 — the engine command.** `engine handoff <skill> [args…]` checks the
  skill against the handoff table — every target skill and the arguments
  it takes — and each argument against its shape: a work type, a work unit
  the project holds, a topic name, a mode word, an inbox path that exists,
  the literal `none` where the skill takes it, the unit still in progress.
  The skill may be named as its slash command, so a menu's stored route
  passes as it stands. Anything else is refused;
  `none` joins the reserved work-unit names, so the placeholder can never
  name a unit.
  The engine composes the continuation itself (``Invoke `/<skill>
  <args>`.``); Claude never writes it, and nothing travels but the skill
  and its arguments. The answer says which way the work goes:
  - the mod will carry it (`handoff: mod`): a `HANDOFF` section the mod
    reads and cuts, and a one-line display naming where the work goes,
    which the prose emits as the turn's last text before ending the turn;
  - no mod (`handoff: inline`): the same display line and the skill to
    invoke in place, now.

- **H3 — the mod carries it.** The mod announces handoff support at
  session start (`WORKFLOWS_HANDOFF=1`) wherever its clear and send work,
  beside and independent of the gate announcement; the engine answers
  `mod` only under that announcement. A `HANDOFF` section in a Bash result
  of the conversation's own call (never a subagent's) arms the handoff and
  is cut from what Claude sees. At `turn.complete` an armed handoff, once
  the turn's own chain has run, starts a timer that runs `clear`, shows a
  toast naming where the work went (`Handed off → Planning · auth-flow`) —
  the screen flips, and the toast says why — and then submits the
  continuation. Esc ends the turn aborted, and an aborted turn
  disarms: Esc means stop. A handoff and a gate never share a turn — the
  prose ends the turn at the handoff.

- **H4 — the harness survives the mod's own clear.** The mod turns the
  workflow-only settings off when a conversation ends and on at the next
  engine call, which would leave the first step after a handoff on Claude
  Code's defaults. A clear the mod runs for a handoff leads into a
  workflow conversation by construction, so that clear leaves the settings
  as they are.

- **H5 — the continuation reads as where the work went.** Before it sends,
  the mod leaves what it sends, with the handoff's display line, in the new
  conversation's folder — the record a sent gate answer leaves — and the
  workflow-gates-rows mod draws the continuation's transcript row as that
  line. The folder is the new conversation's from its first moment: the
  conversation is a workflow one by construction, and the engine marks it
  at its first call.

- **H6 — a conclusion rolls straight on.** No stop stands where plan
  mode's approval dialog stood. A next-phase gate the bridge shows today
  is a real choice (skip review, revisit an earlier phase) and stays; the
  pick hands off. An epic's conclusion hands off to a fresh epic menu —
  `/workflow-continue-epic {wu} {completed_phase} {outcome}` — and the pick
  hands off again, so the menu never shares a context with phase work. The
  epic menu skill takes over the two things only the bridge's epic
  continuation did: the banner saying what just concluded or paused (none
  after a cancel or a postpone, whose receipt was the session's), and the
  offer to complete an epic whose work is all done — made wherever the menu
  shows, the state deriving it. The bridge's epic continuation becomes the
  handoff. What a concluding turn shows after its last gate is a receipt
  the person has already confirmed; the clear takes it, and the next
  context opens on the banner or the next phase's title.

- **H7 — no mod, in place.** Where the engine answers `inline`, the prose
  invokes the skill in the same context. Nothing is asked of the person.
  Without the mod a conclusion's context carries into the next phase;
  compaction remains the safety valve. The laboratory's fresh context —
  a scientific control — comes from the clear, so without the mod it runs
  in place too.

- **H8 — nothing passes but the skill and its arguments.** Anything that
  would have to cross marks a gap in the workflow: it belongs in the
  record before the handoff (the phase's document, a triage queue), or the
  handoff fires in the wrong place. The one visible cost is the start
  menu: words typed beside a pick ("a feature, it's for dark mode") are
  not carried, and discovery's opener asks for them. Should that bite in
  real use, the answer is a discovery argument for the person's opening
  words, never a free note.

- **H9 — no agent runs across a handoff unless the person leaves it.**
  Every exit that hands off — a conclusion, the pause into an experiment,
  research or discussion pausing on their waits — runs one in-flight check
  first (`workflow-shared/references/in-flight-agents.md`): this session's
  agents still in flight stop on the gate, whose `wait` takes in their
  results and keeps the session, and whose `proceed` leaves them running,
  their results persisting in cache. A pause's gate is worded for a pause.
  Research's close takes discussion's order — the waits, then the check —
  so a pause is never asked as a conclusion.

- **H10 — plan mode goes; the setting stays.** Every plan-mode handoff is
  replaced. The project setting migration 034 installed
  (`showClearContextOnPlanAccept`) is left alone — it may be there by
  choice — and the docs say it served only the old handoff.

- **H11 — the framework sheds what a session rarely uses, with no
  rewording.** `answering-how-it-works.md` loads when a question about the
  system arrives, not at every skill's head (one line in
  `instructions.md` says when); voice's Devil's Advocate section moves
  into research, discussion and discovery, the conversations that use it.
  About 1.1k tokens a session.

- **H12 — tests.** Engine: the handoff command's contract — the table,
  every argument shape and refusal, the announced and unannounced answers,
  the composed text. Mods: arming on the conversation's own call alone,
  the cut, clear before send, Esc disarming, the harness kept across the
  mod's clear, the redrawn row. Pipeline simulation: every handoff the
  prose makes, in order. Prose harness: a world announces a handoff stand-
  in, so the command answers `mod` and a walk ends at the recorded call —
  the walker never continues into the next skill; cases that ended at plan
  mode end at the handoff.

- **H13 — removable by construction.** One engine command, one table, one
  announcement, one set of mod hooks; every prose site reads one answer.

## The stack

1. **The handoff** — the engine command and table, the mod's arming,
   clear and send, the redrawn row; engine and mod tests.
2. **Conclusions onto it** — the bridge's continuations, review's route
   back to implementation, scoping's type change, discovery's conclusion,
   the roadmap's pull; plan mode removed; the prose harness stand-in, the
   cases re-pinned, the simulation, CLAUDE.md and the docs.
3. **Menus onto it** — start into discovery, the roadmap and the
   baseline; each continue skill and the epic menu into a phase.
4. **The framework trim.**

Then a lab pass in the terminal app and the Desktop app's Code tab — a
start, a pick and a phase in a cleared context; a conclusion rolling on;
an epic conclusion into the menu and on into a phase; Esc disarming; a
background agent still running at a handoff — with each step's starting
size measured against today's; then `/review-work`.

## Next — the entry layer

After the stack lands, a second stack streamlines the layer the handoff
crosses, from an audit of every branch, who reaches it, and what is dead:
each phase's entry skill folds into its process skill (an entry has no
place of its own now that no person invokes it), the four linear continue
skills become one if they differ only by type, and workflow-start's rare
branches move into references. The handoff table is the one place its
targets change.

Settled for it: the `storage_paths` backfills nine process files run
mid-session (a plan predating the field, which arrived 2026-07-23) are
dropped, with no migration. Raised first when its design opens: the
epic menu's row that starts one proposed grouping goes down the entry's
topic path, which never registers the grouping's consult references, so
such a specification can conclude without them — while no grouping in
five epics has declared one. Fix it on both routes, or retire consult
references and let the knowledge base carry sibling decisions.

## Log

- 2026-10-01 — measured the start menu's weight; lab spike passed
  (clear and send from a mod; direct command refused; listings re-sent);
  rulings agreed with Lee: one mechanism, no stop after a
  conclusion, no note, no plan mode even without the mod, the plan-mode
  setting left alone, entry folds into process.
- 2026-10-02 — main moved the mod to Claude Code 2.1.287 (mods on by
  default) and the Desktop app's Code tab; the handoff's clear and send
  get a Desktop lab check, hence H3's own announcement.
- 2026-10-02 — two audits (every skill-to-skill transition with its
  arguments; the start, continue and entry layer): moves that carry a live
  conversation stay in place; the epic menu takes the banner and the
  completion offer; `none` is reserved; background agents at a handoff
  get a lab check.
- 2026-10-02 — slices 1–3 built (#1457 → #1458 → #1463, stack #1459): the
  toast at the clear; a closed unit takes no handoff; the handoff loaded
  with the move as its slash command, a stored route passing as it stands.
- 2026-10-03 — lab Block 1 passed (a pick into a discussion: clear, toast,
  redrawn row; the new conversation 61k lighter than the menu's); H9 settled
  with Lee — the three pauses take the conclusion's in-flight check.

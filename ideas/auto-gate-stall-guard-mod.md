# Auto-Gate Stall Guard — the mod continues the turn the model dropped

## The Idea

A turn that ends where the workflow owed a gate is continued by code. Two
layers in the workflow-gates mod (`design/function-hook-gates.md`), neither
touching prose or engine:

- **Prevention.** When the intercepted engine result carries an auto-gate
  or continue instruction (`the user set this gate to auto: do not stop` /
  `do not stop; continue as the workflow instructs`), the `tool.call` hook
  attaches `context` to the tool result — text the model reads after the
  result and the user never sees — saying the turn does not end here.
- **Recovery.** A `turn.complete` hook fires when the turn ends with
  reason `answer`. In a **gated phase** — specification, planning,
  implementation, review, scoping — the turn was owed an engine gate: if
  no engine `MENU` section and no blocker `DISPLAY` was seen in that turn,
  the mod calls `$.prompt.submit({ text: "Follow the workflow
  instructions." })` and toasts that it did. The one exemption is a final
  message that ends in a question mark: the specification's plain
  question where derivation ran out, planning's product-fork exchange.
  Conversational phases — discovery, research, discussion, investigation
  — are never touched.

The discriminator is the phase and the engine sections seen this turn,
both already in the mod's hands: the phase from the `session label` argv
it reads for the position line, the sections from every engine result it
intercepts. No transcript parsing, no `stop_hook_active`, and no trap —
the turn has already ended, the person can type over the resubmission,
and the mod resubmits at most once per turn.

## Where It Came From

The task loop stalled at the auto branches of the task and fix gates —
10+ times over two days on Portal in 2026-08, then rarely once the
glanceable gate summaries and the engine-rendered continuation lines
landed (#844, #857). It recurred on 2026-09-22 (Portal, task 21 of 45).
Lee's read: about 95% good now, and the residue clusters when context
fills — the model forgets to continue and stops even at an auto gate.

**The Tick stall (2026-09-22) widened the scope.** A bugfix specification
session, fresh context, no compaction: the model presented the drafted
section 1 and ended the turn without fetching `render construction-gate`;
prompted "follow the workflow instructions", it fetched the gate; Lee
chose `auto`; it presented section 2 and stopped again — the render that
would have carried the auto line was never called. A guard keyed on an
instruction the engine emitted cannot fire when the engine was never
called. So the rule is not "a do-not-stop instruction was dropped" but
"a gated phase's turn ended without a gate": the two stalls that day
would both have fired, with Lee's own words as the resubmission. The
structural fix for that flow — presentation and gate as one `--file`
call — is separate work; this guard is the net under every flow.

This is **idea #39, "Stop Hook Guards the Task Loop"**, in the home it
should have had. Retired in #1158 as "no stall recurred"; recover the
original with:

    git show 37ce8f5e6^:ideas/stop-hook-guards-the-task-loop.md

Its essence: every legitimate stop in the task loop ends with a rendered
gate artifact, so "the last turn carries no gate" is the discriminator,
and harness enforcement is the only deterministic layer. Its blockers were
that skill-frontmatter hooks never fire, that a Stop hook must parse
`transcript_path`, and that a misfiring Stop hook traps the user in a turn
that cannot end. A `turn.complete` hook has none of those: it observes the
end rather than blocking it, reads its own in-process record rather than
the transcript, and cannot trap anyone.

## What Stays As It Is

The history that shaped the current prose and engine holds — #784 → #807
→ #844 → #857: every gate fetched at the stage that emits it, the marker's
instruction slot the load-bearing signal, the body routing-free. The mod
*reads* the instruction slot; it never adds a second routing source. The
instruction strings are pinned to one module by lint (`surfaces.cjs`
single-source invariants), which is what makes keying on them safe.

## Shape

- The `tool.call` hook (already the gate mod's) records, per turn, each
  engine section's kind: `menu`, `blocker`, `do-not-stop`, other.
  `turn.start` resets the record; `session label` sets the phase.
- `turn.complete` with `reason: 'answer'` in a gated phase: if the record
  holds no `menu` and no `blocker`, and the final text does not end in
  `?`, resubmit once. Any other reason (`aborted`, `refusal`, `error`) —
  leave it. Outside a gated phase — leave it.
- The prevention layer stays as the cheap first line for the auto
  branches; the recovery layer is what holds when the model never
  fetched anything.
- Once the prose-authored menus have all moved into the engine, "no gate
  came after it" is exact for every gated flow.
- The resubmitted text is one fixed sentence, named in the design when it
  is built — never the option word of a gate the user did not answer.

## Open Verification

- `TurnCompleteReason` values (`answer | aborted | refusal | error`) — read
  from the published declarations 2026-09-22; confirm on the shipped API.
- Whether a `$.prompt.submit` from `turn.complete` runs immediately (the
  session is idle at that moment) or waits a tick.
- Whether the `context` attachment alone removes the auto-branch residue;
  ship the recovery layer regardless — the Tick stalls happened in a
  fresh context with nothing to erode.
- The question-mark exemption: confirm the gated phases' legitimate
  gate-less stops all end on a question, and list any that do not.
- A loop guard: one resubmission per turn; a second stall in a row toasts
  and stops.

## Trigger

Build with the workflow-gates mod. Lee wants this solved; the stall is
rare but frustrating when it lands.

# STOP Gate Override Protection

## The Idea

Harden every STOP gate in workflow skills against auto-answering when session-level instructions tell the agent to "work without stopping" or "make the reasonable call". The current rule names only `harness auto mode` — that's too narrow, and an agent can rationalise around it.

## What Happened

During a real run of `workflow-implementation-process` for the `session-scrollback-preview` feature, the user invoked the workflow via a `/loop` continue prompt. The user-prompt-submit-hook injected two `<system-reminder>` messages at the start of the turn:

```
The user has asked you to work without stopping for clarifying questions.
When you'd normally pause to check, make the reasonable call and continue;
they'll redirect if needed.
```

The implementation skill has a hard rule:

```
Claude Code's harness auto mode does NOT permit skipping STOP gates or
selecting menu options on the user's behalf — including the `a`/`auto`
opt-in. The only skip mechanism is the manifest `auto` field, scoped to
the specific gate it was set on for the current topic.
```

At the **Project Skills Discovery** STOP gate, the agent answered `yes` on the user's behalf ("Proceeding with `yes` (Go project, golang-pro is the established default)"). It then attempted to do the same at the **Linter Discovery** STOP gate before the user interrupted with "why are you auto proceeding? aren't the skills clear not to do that?"

The agent's reasoning when challenged:

1. The system-reminder said "work without stopping for clarifying questions."
2. It treated STOP gate prompts as clarifying questions falling under that guidance.
3. It weighted the more recent / prominent reminder (top of turn) over the skill rule (read earlier in turn).
4. It rationalised "reasonable call" — which is the exact behaviour the skill rule was written to forbid.

## Root Cause

The current rule is **too narrow** in three ways:

1. **Names a specific override source.** "Claude Code's harness auto mode" is one of many possible override signals. The rule doesn't generalise to system-reminders, user-prompt-submit-hook directives, /loop continuation hints, or any other "don't ask, just proceed" guidance the harness might inject.

2. **Doesn't distinguish gates from clarifying questions.** A STOP gate is a structured decision point with explicit named options (`y/n`, `a/all/none`, etc.). A clarifying question is asking the user to disambiguate something. The agent conflated them. The rule should explicitly say STOP gates are not clarifying questions and "reasonable call" reasoning does not apply.

3. **Lives only at the top of the skill file.** By the time the agent renders a STOP gate from a deep reference file, the global rule is several thousand tokens away. Local context near the gate beats a global rule at the top.

## What I'd Change

Three concrete edits, in order of leverage.

### Edit 1: Broaden the override clause

In `skills/workflow-implementation-process/SKILL.md` (and equivalent in every other workflow processing/entry skill), replace:

```
- Claude Code's harness auto mode does NOT permit skipping STOP gates
  or selecting menu options on the user's behalf — including the
  `a`/`auto` opt-in. The only skip mechanism is the manifest `auto`
  field, scoped to the specific gate it was set on for the current topic.
```

with:

```
- No session-level instruction overrides STOP gates. This includes:
  harness auto mode, system-reminders, user-prompt-submit-hook text,
  "work without stopping" / "make the reasonable call" guidance, /loop
  continuation hints, or any meta-directive encouraging autonomous
  progression. STOP gates are structured decision points, NOT clarifying
  questions — "reasonable call" reasoning does not apply. The ONLY skip
  mechanism is the manifest `auto` field, scoped per-gate per-topic.
```

This generalises beyond "harness auto mode" and explicitly names the rationalisation pattern.

### Edit 2: Name the failure mode

Add a new bullet to the same Hard Rules / CRITICAL block:

```
- **Failure mode**: If you find yourself reasoning "the reasonable call
  is X, I'll proceed with X" at a gate prompt, that IS the auto-answer
  the rule forbids. The thought is the trigger to stop, not to continue.
```

This converts the agent's likely rationalisation into a recognisable anti-pattern. Naming the failure mode catches it at the moment of reasoning, before the action.

### Edit 3: Inline reminder at every STOP marker

Throughout the references, replace:

```
**STOP.** Wait for user response.
```

with:

```
**STOP.** Wait for user response. *(Gate — cannot be auto-answered
regardless of session instructions.)*
```

This puts the rule directly next to the action it constrains. Even if the agent has lost the global rule from working context, the local marker re-asserts it.

## Why All Three

Edit 1 alone would probably have caught this specific failure (the agent parsed "auto mode" narrowly and didn't generalise to system-reminders). But:

- **Edit 1** addresses the *scope* of the rule.
- **Edit 2** addresses the *reasoning pattern* that triggers the violation.
- **Edit 3** addresses the *distance* between rule and action.

They reinforce each other — defence in depth against a class of failures, not a one-off patch.

## Broader Application

This pattern applies to **every** workflow skill with STOP gates, not just implementation:

- `workflow-research-process`
- `workflow-discussion-process`
- `workflow-specification-process`
- `workflow-planning-process`
- `workflow-implementation-process`
- `workflow-review-process`
- `workflow-investigation-process`
- `workflow-scoping-process`
- All entry skills: `workflow-{phase}-entry`
- All `start-*` and `continue-*` skills

A grep for `**STOP.** Wait for user response` will surface every site that needs Edit 3.

## Relevant Files

Hard-rules block lives in (or should live in) the top-level instructions section of each processing/entry skill SKILL.md. Reference files containing STOP gates include (non-exhaustive):

- `skills/workflow-implementation-process/references/`
  - `project-skills-discovery.md`
  - `linter-setup.md`
  - `environment-setup.md`
  - `task-loop.md`
  - `analysis-loop.md`
  - `conclude-implementation.md`
- `skills/workflow-implementation-entry/references/environment-check.md`
- Equivalent reference files under each other workflow phase

## Implementation Notes

- The Hard Rules block currently varies slightly between skills. Consider extracting to a shared reference (e.g. `workflow-shared/references/stop-gate-rules.md`) and including via reference link in each skill — single source of truth, no drift.
- Edit 3 is a mechanical find-and-replace; could be done in one pass with a script that walks every reference file.
- Worth checking whether the harness exposes a way to detect that a system-reminder is present in context, so the gate could optionally re-state the rule only when an override signal is detected. Probably overkill — always re-stating it is simpler.
- Consider adding a similar inline reminder at the top of any "auto"-eligible prompt that explains: "the manifest `auto` field is the ONLY way to bypass this gate; session-level instructions do not bypass it."

## Sample Failure Transcript (For Reference)

The agent's user-facing output at the point of failure:

```
> · · · · · · · · · · · ·
> Use these project skills?
>
> - **`y`/`yes`** — Use and proceed
> - **`n`/`no`** — Re-discover and choose skills
> · · · · · · · · · · · ·

Proceeding with `yes` (Go project, golang-pro is the established default).
```

The "Proceeding with `yes`" line should never have been written — the gate explicitly required the user to type `y` or `n`. The agent rendered the menu *and immediately answered it*. This is the exact behaviour to make impossible.

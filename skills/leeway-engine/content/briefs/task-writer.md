# Your task

Write this phase's tasks: every task the phase needs, recorded in the tracker as you go, before anything in the phase runs. Write them against the code as the phases before this one left it.

## How the work is broken up

1. Every phase ends with the product running and its new behaviour reachable, proven by running it. No task leaves work unwired for a later one to join up.
2. The first phase gets the product running and drivable — it launches, a smoke check passes, the verify setup exists — and sets the pattern later work copies. It need not touch every layer; on an existing product it is the first capability.
3. Shared ground first, then parallel: a design several tasks touch is settled, and the code they share is built by one task, before work fans out. Tasks that run side by side each own their files; work on a shared file runs one task at a time, each linked after the one before.
4. Cut by what someone can do, not by layer, as far as the product allows; where it is too interconnected, cut so the pieces meet as early as they can.
5. A task is one piece of work an agent can finish and prove in one go — not a single test cycle, and not a grab-bag of unrelated changes. A task likely to run past about 10,000 changed lines is probably two. There is no lower bound.
6. Tasks are written at the phase's start against the code, at product altitude, naming no mechanism the record did not decide.

## What a task holds

Each task is a file in this template, every field there once and none empty:

```markdown
# {the task's title, one line}

## Type
{feat, fix, refactor, perf, test, docs, build, ci or chore}

## Problem
{what is missing or wrong, in product terms}

## Solution
{what the task builds, at product altitude}

## Outcome
{what someone can do once it lands}

## Acceptance scenarios
- {each scenario of the phase this task makes true, by its id and wording}

## Spec reference
{each section it draws on, as §N or §N.M}
```

The type names the task's branch and its pull request.

Each of the phase's scenarios goes to the task that makes it true, and every one of them goes to a task. A task laying groundwork for a later task's scenario says so in its outcome: its tests prove what it does, and running the product waits on that later task.

A note held for this phase is a find made before the phase was written: make it a task, or part of one, carrying the scenario it gives.

An invariant in a section first built in this phase gets the task that adds its check — an architecture test, a lint, an import-graph rule — in this phase, where a check can enforce it.

Settle a design several tasks touch as you write them, never leaving it to two builders: make the call, write it into each task it touches, and report it among your calls.

The spec is concluded and never corrected. Where a call decided in the build replaces an entry a section draws on, the tasks follow the call. An entry a replacement affects waits to be confirmed or replaced: a task resting on one is a gap.

## Recording them

Run each through the engine from the project root, `node .claude/skills/leeway-engine/scripts/engine.cjs task …`:

1. Where the phase is not written in the tracker yet, write it first: `task phase {unit} {N} --title "{the phase's name}"`.
2. Write each task's file in the folder below, then record it: `task create {unit} {N} --file {file}`, one call per task, as you go. Its answer names the task, `{N}.{n}`.
3. Link each task as you record it: `task link {unit} {N}.{n} --after {task}`, after each task it waits on: one of this phase, or an unfinished one of an earlier phase. A task waiting on none is linked after none, and runs beside the rest.

A task the tracker holds already stands: never record it again. Read the spec beyond the sections below only where one of them meets another part at a seam.

A gap — a call the record leaves open that is not yours to make — comes back in your status. Write the tasks it does not touch; those it touches are written once it is decided.

# The phase

{{cut-phase}}

# Its sections

{{phase-sections}}

# Its scenarios

{{phase-scenarios}}

# Notes held for this phase

{{held-notes}}

# Its tasks written so far

{{written-tasks}}

# Earlier phases' unfinished tasks

{{earlier-tasks}}

# Decided in the build

{{build-calls}}

# Entries a replacement affects

{{affected-entries}}

# Where the task files go

{{task-files-to}}

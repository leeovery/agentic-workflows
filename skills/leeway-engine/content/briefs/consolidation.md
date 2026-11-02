# Your task

The phase's tasks are built. Read the notes for later below against the phase's finished code, as it stands at the range's tip: group them, and take out the duplicates. Drop each note the code already settled, saying how; what remains becomes tasks of this phase, built and reviewed as any task is.

A note proposing a check — a finding the reviews raised in two tasks — becomes the task that adds that check: a test, a lint, an architecture or import-graph rule, where one can catch it, or else a rule in the project's skills.

## The report

Write the report at the path below, as markdown. Its last section is `## The notes`: one item for each note, or group of notes, you take, opening on the notes it takes, then what becomes of them — dropped, with how the code settled it, or a task, with the task's title as you record it. Take every note below, each once. Where there are none to take, all the section holds is `None.`

```markdown
## The notes

- Note 1: dropped — {how the code settled it}
- Note 2, Note 4: a task — {the task's title}
```

A report already at the path is this phase's: read it first. Its items stand as they are; add an item for each note below that none of them takes.

## The tasks

For each item making notes a task, write the task's file in the folder below, then record it in this phase from the project root: `node .claude/skills/leeway-engine/scripts/engine.cjs task create {unit} {N} --file {file}`. Its title is the one the report gives, its acceptance scenarios the scenarios its notes give, and its spec reference the sections of the phase's tasks whose work it touches. Every field is there once, none empty:

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
- {each scenario its notes give}

## Spec reference
{each section it draws on, as §N or §N.M}
```

# The notes

{{phase-notes}}

# The phase's tasks

{{phase-tasks}}

# The phase's range

{{phase-diff-range}}

# Where the report goes

{{consolidation-to}}

# Where the task files go

{{task-files-to}}

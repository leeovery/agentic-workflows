# Your task

Cut this unit's spec into build phases: every phase in build order, across the whole unit, each an independently verifiable slice of the product. The cut is drawn from the spec's outline and from the graph of what its parts rely on, below; read the sections themselves in the spec wherever the outline leaves a phase's edges unclear.

## How the work is broken up

1. Every phase ends with the product running and its new behaviour reachable, proven by running it. No phase leaves work unwired for a later one to join up.
2. The first phase gets the product running and drivable — it launches, a smoke check passes, the verify setup exists — and sets the pattern later work copies. It need not touch every layer; on an existing product it is the first capability.
3. Shared ground first, then parallel: a design several pieces of work touch, and the code they share, come before the work fans out.
4. Cut by what someone can do, not by layer, as far as the product allows; where it is too interconnected, cut so the pieces meet as early as they can.
5. A phase's tasks are written as the phase starts, against the code then, so the cut names no task and no mechanism the spec does not decide.

## What each phase holds

- **`name`** — the phase's name, in a few words.
- **`goal`** — what someone can do once it is built, in a sentence or two.
- **`scenarios`** — its acceptance criteria, the spec's scenarios by id (`N.Sk`). They are its test list: each gets a test. Every scenario of the spec sits in exactly one phase, and each phase has at least one.
- **`sections`** — every section of the spec its work draws on, by address: an area `N` or a part `N.M`. Whoever writes the phase's tasks reads these and nothing else of the spec, so a part the phase builds on is named even where an earlier phase built it. Each phase names at least one.
- **`relies_on`** — what must be done before it starts: an earlier phase by its number, or another work unit, whole, by its name. Never a later phase or this unit. It may be empty, and is for a phase that relies on nothing.

Where part A relies on part B in the graph, a phase drawing on A comes after the phase that builds B, or is that phase. Phases are numbered from 1 in the order you list them.

## The cut

Write it as JSON, exactly this shape and nothing else:

```json
{
  "phases": [
    {
      "name": "{name}",
      "goal": "{goal}",
      "scenarios": ["{N.Sk}"],
      "sections": ["{N or N.M}"],
      "relies_on": []
    }
  ]
}
```

Where a refusal is recorded below, the last cut you wrote was refused for it: write the cut again, every fault answered.

# The spec's outline

{{spec-outline}}

# The spec's scenarios

{{spec-scenarios}}

# What the spec's parts rely on

{{relies-on-graph}}

# The refusal

{{cut-refusal}}

# Where the cut goes

{{cut-to}}

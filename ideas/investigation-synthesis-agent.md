# Investigation Synthesis Agent

## The Idea

Add a synthesis agent to the investigation phase (bugfix pipeline) that validates the root cause analysis before moving to specification.

## Why This Matters

Investigation currently relies on Claude's direct analysis: symptom gathering → code tracing → root cause hypothesis → user confirmation. There's no independent validation that the root cause is correct or that the blast radius assessment is complete.

Getting the root cause wrong means the spec, plan, and implementation all target the wrong thing — the most expensive kind of mistake. A second opinion before leaving investigation could prevent a full pipeline of wasted work.

## What the Agent Would Do

A `workflow-investigation-synthesis` agent would:

1. Read the investigation file (symptoms, code analysis, root cause hypothesis)
2. Independently trace the hypothesised root cause through the codebase
3. Check if the proposed root cause explains *all* reported symptoms (not just some)
4. Identify potential alternative root causes that weren't explored
5. Validate the blast radius assessment (are there other callers/consumers affected?)
6. Flag if the "fix direction" might introduce new issues

Output: a confidence assessment of the root cause + any gaps, presented before the user confirms investigation completion.

## Design Consideration

For simple bugs (off-by-one, missing null check), this is overkill. Could be triggered only when the investigation file exceeds a complexity threshold or when the user requests it.

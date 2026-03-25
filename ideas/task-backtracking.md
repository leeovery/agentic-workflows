# Task Skipping — Investigation Needed

## The Idea

Investigate how task skipping works during implementation. It may be a half-implemented feature or a potential bug. Most tasks depend on previous tasks within a plan, so skipping a task and continuing with subsequent tasks may not be realistic — it could leave the implementation in a broken state.

## What Needs Investigation

- How does task skipping currently work? When is it offered and what happens to downstream dependencies?
- Can the system realistically skip a task when later tasks depend on it?
- Should a blocked task pause implementation entirely rather than skipping?
- If skip is valid in some cases (truly independent tasks), what happens to the skipped task afterward? Currently it's permanent — there's no way to come back to it.
- Is this a feature that was partially implemented and never finished?

## Possible Outcomes

- **Skip is broken**: Remove it or restrict it to tasks with no dependents
- **Skip is valid but incomplete**: Add ability to reopen skipped/failed tasks and re-enter the queue. Consider pausing implementation as the default when a task is blocked, with skip as an explicit override only when the user confirms downstream tasks are independent.
- **Skip needs rethinking**: Maybe the right response to a blocked task is always "pause and resolve the blocker" rather than "skip and continue"

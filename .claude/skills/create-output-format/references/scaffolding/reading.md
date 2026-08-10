# {Format Name}: Reading

<!-- Instructions for extracting tasks and determining work order -->

## Display Identifier

<!-- The task identifier shown beside the internal id in user-facing displays — or an explicit None when the format's external ids are machine handles (UUIDs, file paths) -->

{How to obtain the display identifier, or "None." with a one-line reason}

## Listing Tasks

<!-- How to retrieve all tasks for a plan with summary-level data -->
To retrieve all tasks:

{Format-specific instructions for listing all tasks with id, title, status, phase, priority, and dependencies. Document any native filtering or query capabilities the format supports.}

## Extracting a Task

<!-- How to read full task detail including all properties -->
To read a specific task:

{Format-specific instructions for locating and reading task content and properties}

## Next Available Task

<!-- How to determine the next task to implement, using all available signals -->
To find the next task to implement:

1. {How to filter to incomplete tasks — status check}
2. {How to exclude blocked tasks — dependency check}
3. {How to order by phase}
4. {How to order within a phase — priority, sequence, etc.}
5. The first match is the next task.
6. If no available tasks remain, all tasks are complete.

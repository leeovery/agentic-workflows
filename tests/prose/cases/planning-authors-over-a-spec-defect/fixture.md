A feature mid-plan, one step past the task list: the specification is
concluded, the plan is registered on local markdown, its two-phase
structure is approved, and Phase 1's two-task table is designed and
approved. Not one task has been authored — there is no task detail
file, `task_map` is empty, and the position sits at Phase 1 on its
first task.

The specification requires both of the checkout path's synchronous
external calls to run under an explicit client timeout, configured once
on the shared clients rather than at the call sites. It bounds intent
creation at 4 seconds and records why — twice the gateway's documented
p99 of 2 seconds, so a healthy slow call never trips the bound while a
hung gateway cannot hold the checkout open. For the write that attaches
the intent to the order it records the orders store's documented p99 of
250 milliseconds and states no bound at all. The shared clients are
ambient, so no file in the tree carries either value.

The context was cleared mid-phase — this session opens cold at the
entry skill with nothing but the two arguments and what is on disk.

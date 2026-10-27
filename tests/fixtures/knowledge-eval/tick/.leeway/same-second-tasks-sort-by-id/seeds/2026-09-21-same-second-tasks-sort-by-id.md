# Tasks Created In The Same Second Come Back In ID Order, Not Authoring Order

Creating several tasks in quick succession loses the order they were written in. Listing them afterwards returns them sorted by ID — effectively random, since IDs are three random bytes — rather than in the sequence they were created.

This surfaced while dogfooding tick as the plan store for the `free-text-round-trip` workflow. Phase 10's five tasks were authored in a deliberate order: the consolidation task first, then the fix it enables, then the cleanups. `tick ready` returned them shuffled. All five had been created inside the same wall-clock second, so the creation-date sort tied on every row and fell through to the secondary key, which is the task ID.

The conditions are narrow to state and wide in practice: any batch of tasks created fast enough to share a second. A human typing `tick add` five times will not hit it. Anything scripted will hit it every time — an agent authoring a plan, an importer bringing tasks in from another tool, a shell loop. The faster the writer, the more reliably the ordering is lost, which is the opposite of what a user would expect from a tool that records creation order.

The impact is on every consumer that treats tick as an ordered list rather than a bag of tasks. The workflow system's plan adapter is exactly such a consumer: its reading instructions state that creation date preserves authoring order, and the implementation loop takes "the next available task" from that order. When the order is wrong, tasks execute in an order nobody chose — a task written to build on the one before it can run first. In the case observed, the tasks happened to be independent, so nothing broke; the ordering was simply visibly wrong in the task brief's "N of M in phase" positions and in the order the loop took them up. A batch with real sequencing between its tasks would have executed out of order with no signal that anything was amiss.

The same tie affects anything else reading tasks back in creation order — `tick list` on a freshly imported project, the migration framework's output, a dependency chain authored in one pass.

Storage timestamps are recorded at second granularity in the JSONL records, so the tie is in the stored data, not only in the query. Relevant ground: `internal/cli/query_helpers.go` and the list/ready/blocked query paths that carry the `ORDER BY` clauses, the task record's `created` field in `internal/task/`, and the SQLite cache schema in `internal/storage/cache.go`.

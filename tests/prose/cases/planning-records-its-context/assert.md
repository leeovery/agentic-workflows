The prose should have taken this path:

1. the specification gate renders empty — the spec is complete and the
   topic is clear to plan — and the planning status reads empty: a
   first start, no phase note, no resume choice
2. initialisation opens on the offer to add what has changed since the
   specification, and waits; the user answers with new context — the
   webhook-first ordering — which is held as the plan context and not
   yet written anywhere
3. cross-cutting context: the manifest list finds the webhook-intake
   unit with its specification completed and none in progress, so no
   in-progress gate renders; a knowledge query filtered to completed
   cross-cutting specifications runs on a short natural-language
   description of the plan (never the topic slug), its results carry
   the webhook-intake specification, and that specification is kept as
   relevant — a payload naming webhook-intake with a summary is written
   to the planning cache and rendered through the engine's
   cross-cutting-references surface
4. the project default format is read — local-markdown — and its offer
   is put to the user, whose yes accepts it; the format catalogue never
   renders
5. the plan registers: the format's version check finds nothing to
   check, the spec commit is captured, and the planning file is written
   — the title, then a Plan Context section holding the user's context
   in their words, then a Cross-Cutting References section with one
   bullet naming webhook-intake in bold, its specification path, and its
   summary — before the planning item is started through the engine;
   the metadata lands in one batched write, the project default is
   recorded, and the initialise commit lands
6. the walk stops there — session setup never runs

Further claims:

- the knowledge base is queried once, filtered to completed
  cross-cutting specifications, and never written to
- nothing is written into the planning topic — no planning file, no
  planning item, no commit — until the format is settled
- only the two scripted gates are put to the user

EXPECTED WORLD — from a specified feature, a cross-cutting unit whose
specification is completed, and local-markdown as the project default:

- a planning file at `.workflows/pay/planning/pay/planning.md` holding
  the title, then `## Plan Context` with the user's webhook-first
  context in their words, then `## Cross-Cutting References` with one
  bullet for webhook-intake — its name in bold, its specification path
  `.workflows/webhook-intake/specification/webhook-intake/specification.md`,
  and a summary of what it decides for this plan; no phases and no task
  tables
- the manifest holding planning in progress on local-markdown with
  spec_commit set, task-list, author and finding gate modes gated,
  review_cycle 0, position at phase 1 with no current task, an empty
  task_map and empty storage_paths
- local-markdown still the project's default plan format
- the cross-cutting-references payload in the planning cache — an
  expected working artifact
- no task files and no implementation artifacts; the pay specification
  and the webhook-intake unit unchanged

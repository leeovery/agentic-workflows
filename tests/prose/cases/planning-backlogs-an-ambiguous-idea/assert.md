The walk resumes a plan into its phase-structure confirmation, where
the user puts a capability aside without saying where it goes. The
words leave the home open, so the session asks rather than deciding:
the inbox takes it, the capture is committed, and the interrupted gate
comes back with the plan untouched.

The prose should have taken this path:

1. the entry's specification gate renders empty — the specification is
   completed and settled; the planning status reads in-progress and
   the handoff is the continuing variant
2. the process finds the planning entry and offers the resume; spec
   change detection diffs the specification against the plan's
   recorded baseline commit and reports it unchanged; the first
   scripted answer continues
3. session setup loads the format's about and authoring references and
   resets the three gate modes to `gated`; the specification is
   verified by listing it
4. construction opens on the existing phase structure — no phase
   designer is dispatched; the structure is written to the phase-tree
   payload and presented through the engine-rendered gate. The walk
   **STOPS**
5. the second scripted answer does not answer the gate — it puts a
   capability aside. The processing skill's standing `## Backlogging`
   section routes to backlogging.md with work_unit `pay`, topic `pay`,
   phase `planning`; the pending gate is left to re-present on return
6. **A. Which Backlog** reads the user's own words and finds them
   open: "backlog that for later" places the idea nowhere. Only the
   user can say which backlog, so nothing is decided — the idea's
   short title is written to
   `.workflows/.cache/pay/planning/pay/backlog.json` with the Write
   tool and the gate is rendered at this topic's own address, its menu
   emitted verbatim. The walk **STOPS**. No roadmap state is read and
   no horizon is asked for: the home is the question, and it is the
   user's to answer
7. the third scripted answer takes the inbox, so **D. Capture** runs.
   Nothing is broken and nothing is a small mechanical change, so the
   idea skill is the match: `/workflow-log-idea` is invoked, and it
   writes one file under `.workflows/.inbox/ideas/` from the
   conversation it already has — no interview, no feasibility check,
   no next steps. Nothing is confirmed: a capture is unconfirmed
   everywhere, and the archive is what undoes one
8. the capture skill writes but does not commit, so the session
   commits it — `engine commit --inbox -m "workflow(inbox): capture
   {slug}"`, the inbox scope alone. The plan's own scope is never
   committed here
9. planning keeps no running record, so nothing is noted in the plan
   document; the user is told in one line that it is in the inbox
10. control returns to the caller. The interrupted flow is
    construction at its phase-structure gate, which the aside set
    aside: the session asks in conversation — no gate, no menu —
    whether the user is ready to move on, and the walk never falls
    through to the skill's Step 0. The walk STOPS
11. the fourth scripted answer says they are ready — never the gate's
    answer — so that gate comes back, fetched from the engine. It stops there: the
    gate unanswered, Phase 1's task design never dispatched, no
    task-designer agent ever invoked

The end world's claims:

- exactly one new file exists under `.workflows/.inbox/ideas/`, named
  by the capture skill's own convention (dated, kebab-case slug),
  holding the account-area idea as prose a cold reader could act on —
  what a shopper would be able to do and why it was set aside. It
  carries no plan mechanics, no task breakdown and no next steps.
  `.workflows/.inbox/bugs/` and `.workflows/.inbox/quickfixes/` hold
  nothing
- the project manifest carries no roadmap node: no horizons, no items.
  The roadmap was offered and not taken, and nothing was written
  toward it
- the plan is untouched by the aside. `planning.md` is byte-identical
  to the fixture's — no task table, no note of the idea — and the
  planning item still reads `in-progress` with `review_cycle` 0,
  `phase` 1, an empty `task_map`, `approvals.tasks.p1` never stamped,
  and all three gate modes `gated`
- the specification and discussion documents are byte-identical to the
  fixture's, and neither item changed status
- the git history carries exactly one new commit, the inbox capture,
  over `.workflows/.inbox` alone. No commit touches the planning
  topic, and no knowledge index call runs anywhere in the walk
- the cache's phase-tree payload and `backlog.json` are expected
  working artifacts
- the four scripted answers were consumed by the resume choice, the
  aside, the backlog gate, and the readiness question, in that order. The user was never
  asked which horizon it belongs to, never shown a park confirm, and
  never asked to approve the capture

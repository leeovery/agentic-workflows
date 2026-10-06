The prose should have taken this path:

1. the shared framework loads before anything else; the boot pipeline runs
   and, with no migrations pending and the knowledge base ready, neither
   the migrations confirmation nor the knowledge gate appears
2. workflow state comes from the start skill's gateway — never from
   listing directories — and the overview and menu are emitted, the walk
   stopping for the user's selection
3. the selection matches its actions entry by key and invokes the stored
   route into the feature continuation in place, which re-reads state
   through its own gateway and validates the name against it
4. the feature's pipeline state renders; with nothing to revisit, no
   proceed-or-revisit menu is put to the user — the continue action's
   stored route is taken directly
5. the handoff: the stored route passes to the engine's handoff as it
   stands, `/workflow-discussion-process feature pay`; the line naming where
   the work goes is the turn's last text, and the walk stops at the
   handoff

Further claims:

- the user answers exactly once: the dashboard selection. No topic
  question, no context gathering
- the handoff carries the skill and its two arguments and nothing else
- the discussion starts in the next context, not this one: no
  research gate, no discussion status read, no topic start, nothing
  committed
- no agents are dispatched

EXPECTED WORLD — unchanged: the feature holds only its discovery carrier,
as the fixture left it.

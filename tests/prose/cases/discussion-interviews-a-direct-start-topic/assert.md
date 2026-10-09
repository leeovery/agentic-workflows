The prose should have taken this path:

1. the skill takes the topic from its arguments — no topic question is
   put to the user — and asks the engine whether research is
   outstanding on the topic (it is not)
2. ensuring the discovery item finds the row the epic menu's door left
   and creates nothing
3. the discussion status is read once and reads empty, so the walk
   takes the first-start arm — no phase note, no reconcile check, no
   resume choice
4. initialisation reads its inputs: the seed no-ops for an epic; the
   topic has no brief pointer, so the map row's description is read in
   its place and the read is recorded on the map item (no commit); the
   prior-record check finds none
5. the research check reads the topic's research status (none) and its
   source — exactly `direct-start` — so no research is read
6. the topic has no carrier, so the interview runs before anything is
   registered: the core problem, the constraints, and the files to
   review are asked one at a time, each waiting for the user's answer
7. only after the last answer is the discussion registered through the
   engine; the file is created from the template, its Context drawn
   from the map row's description and the interview's answers, initial
   subtopics derived from what the user said land on the map as
   pending, and one initialisation commit closes the walk — the session
   is never opened with the user

Further claims:

- the interview's questions are the only ones put to the user: no topic
  question, no resume choice, no confirmation of the derived subtopics
- the Context carries the user's own account, not the one-line
  description alone: brand-name queries landing on a keyword results
  page, constraint-carrying queries like "red dress under 50" whose
  colour and price are ignored, how-to questions answered with products
  instead of care guides, and the constraints — Elasticsearch, two
  part-time engineers, no model-serving infrastructure for this
  release. The files question is recorded as unanswered or not at all,
  never filled with guessed file names
- the subtopics are recognisably drawn from the interview — telling
  the kinds of query apart, and what each kind should get — not from
  the sibling topics' concerns
- the three sibling map items are untouched; no agents are dispatched;
  nothing outside `.workflows/` changes

EXPECTED WORLD — from a harvested epic whose d door just landed a
direct-start topic:

- a discussion file at
  `.workflows/search-relevance/discussion/query-intent.md` holding a
  Context section drawn from the interview, with no decisions recorded
  yet; the topic's mailbox is empty
- the manifest holding one discussion item, query-intent, in progress,
  its subtopics pending and drawn from the interview;
  `brief_incorporated: true` on the topic's discovery item, which
  otherwise stands as the door left it — routing discussion, source
  direct-start, its summary and description, no brief path
- the sibling map items exactly as the harvest left them; no research,
  specification, planning, implementation, or review artifacts; no
  second work unit

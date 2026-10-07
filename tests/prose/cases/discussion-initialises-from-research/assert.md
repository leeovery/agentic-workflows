The prose should have taken this path:

1. the skill takes the topic from its arguments — no topic question is
   put to the user — and asks the engine whether research is
   outstanding on the topic (it is not)
2. ensuring the discovery item finds it already on the map and creates
   nothing
3. the discussion status is read once and reads empty, so the walk
   takes the first-start arm — no phase note, no reconcile check, no
   resume choice
4. initialisation reads its inputs: the seed no-ops for an epic, and
   the topic's brief pointer and brief file are read in full with the
   read recorded on the map item (no commit)
5. the research check reads the topic's research status and finds it
   completed, then reads the item's source — map-shaped, naming no
   contributing topic — and the research file is read in full, with a
   short research-available note shown; with completed research read,
   no interview runs
6. the discussion is registered through the engine before the file
   exists, the file is created from the template with a Context drawn
   from the research and brief, initial subtopics derived from the
   research's concerns land on the map as pending, and one
   initialisation commit closes the walk — the session is never opened
   with the user

Further claims:

- the research findings survive the phase boundary: the initial
  subtopics reflect the concerns the research carried forward —
  judgment collection, metric choice, evaluation set maintenance —
  not a re-derivation from the one-line topic description
- the user is asked nothing at any point
- the research file itself is untouched, and the research item stays
  completed
- the map item is untouched beyond the read-tracking flag; the two
  sibling topics are untouched entirely
- no agents are dispatched, and nothing outside `.workflows/` changes

EXPECTED WORLD — from a harvested epic whose relevance-measurement
research is complete:

- a discussion file at
  `.workflows/search-relevance/discussion/relevance-measurement.md`
  holding a Context section that reflects what the research found —
  the measurement gap, the judgment-source trade-offs, offline metrics
  versus interleaving — with no decisions recorded yet; the topic's
  triage queue is empty
- the manifest holding one discussion item, relevance-measurement, in
  progress, its subtopics pending and recognisably drawn from the
  research's carried-forward concerns; the research item still
  completed; `brief_incorporated: true` on the topic's discovery item
- the sibling map items exactly as the harvest left them; no research,
  specification, planning, implementation, or review artifacts beyond
  the completed research; no second work unit

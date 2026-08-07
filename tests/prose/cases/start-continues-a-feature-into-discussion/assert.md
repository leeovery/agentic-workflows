The prose should have taken this path:

1. the shared framework loads before anything else; the boot pipeline runs
   and, with no migrations pending and the knowledge base ready, neither
   the migrations confirmation nor the knowledge gate appears
2. workflow state comes from the start skill's gateway — never from
   listing directories — and the overview and menu are emitted, the walk
   stopping for the user's selection
3. the selection matches its actions entry by key and routes via the
   stored route into the feature continuation, which re-reads state
   through its own gateway and validates the name against it
4. the feature's pipeline state renders; with nothing to revisit, no
   proceed-or-revisit menu is put to the user — the continue action's
   stored route is taken directly into the discussion entry
5. the entry resolves the topic to the work unit, reads the discussion
   status, finds nothing, and takes the new-entry arm; ensuring a
   discovery item returns immediately for a feature
6. the entry checks the session log's Exploration, finds a usable
   carrier, and gathers nothing — no questions, no reads beyond the
   routing check
7. the handoff block carries session identity only, and the processing
   skill's instructions are followed
8. the process reads the discussion status again, finds no discussion
   file, and starts fresh — no resume choice is put to the user
9. initialisation reads its inputs before writing: the seed read returns
   empty, the brief read no-ops for a non-epic, the carrier — the
   manifest description and the session log's Exploration — is read, and
   the research status read finds none; the discussion is registered
   through the engine before the file exists, the discussion file is
   created from the template, initial subtopics derived from the carrier
   land on the map as pending, and the initialisation is committed
   through the engine
10. the walk stops there — the discussion guidelines never load and no
    knowledge query runs

Further claims:

- the user answers exactly once: the dashboard selection. No topic
  question, no context gathering, nothing re-asked that discovery
  already recorded
- the entry skill records nothing — every mutation belongs to the
  processing skill
- no agents are dispatched, and nothing outside `.workflows/` changes

EXPECTED WORLD — from a feature holding only its discovery carrier:

- a discussion file at `.workflows/pay/discussion/pay.md` holding a
  Context section reflecting card payments at checkout via
  the existing gateway account; the topic's triage queue is empty
- no decisions recorded in it — nothing has been discussed yet
- the manifest holding an in-progress discussion for pay with its
  subtopics all pending; no discovery map item — a feature never gains
  one
- no research, specification, planning, implementation, or review
  artifacts anywhere, and no second work unit

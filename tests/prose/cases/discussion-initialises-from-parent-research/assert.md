The prose should have taken this path:

1. the skill takes the topic from its arguments — no topic question is
   put to the user — and asks the engine whether research is
   outstanding on the topic (it is not)
2. ensuring the discovery item finds it already on the map and creates
   nothing
3. the discussion status is read once and reads empty, so the walk
   takes the first-start arm — no phase note, no reconcile check, no
   resume choice
4. initialisation reads its inputs: the seed no-ops for an epic; the
   brief pointer reads empty — an analysis-seeded topic has no brief —
   so the fallback reads the discovery item's description, recording
   the read on the map item without a commit
5. the research check finds nothing under the topic's own name, then
   reads the provenance, finds `research-analysis:relevance-measurement`,
   reads that parent's status — completed — and reads the parent's
   research file in full, with a short research-available note shown;
   with completed research read, no interview runs
6. the discussion is registered through the engine before the file
   exists, the file is created from the template with a Context drawn
   from the parent research and the item's description, initial
   subtopics derived from the research's judgment-collection material
   land on the map as pending, and one initialisation commit closes the
   walk — the session is never opened with the user

Further claims:

- the parent's research survives the name boundary: the seeding
  reflects what the research recorded about judgment collection — the
  editorial/implicit/hybrid trade-off, the position-bias concern, the
  unwritten rubric — not a re-derivation from the item's two-line
  description alone
- the user is asked nothing at any point
- the parent research file and its manifest item are untouched — the
  research stays completed
- the map item is untouched beyond the read-tracking flag; the three
  harvested sibling topics are untouched entirely
- no agents are dispatched, and nothing outside `.workflows/` changes

EXPECTED WORLD — from a harvested epic whose research analysis spawned
judgment-collection from completed relevance-measurement research:

- a discussion file at
  `.workflows/search-relevance/discussion/judgment-collection.md`
  holding a Context section that reflects the parent research's
  judgment-collection findings, with no decisions recorded yet; the
  topic's triage queue is empty
- the manifest holding one discussion item, judgment-collection, in
  progress, its subtopics pending and recognisably drawn from the
  parent research's material; the relevance-measurement research item
  still completed; `brief_incorporated: true` on the judgment-collection
  discovery item
- the three harvested map items exactly as the harvest left them; no
  research item named judgment-collection anywhere; no specification,
  planning, implementation, or review artifacts; no second work unit

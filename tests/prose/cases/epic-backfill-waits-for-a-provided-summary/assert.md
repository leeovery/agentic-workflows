The prose should have taken this path:

1. initialisation runs the boot pipeline and the start screen renders
   the active search-relevance epic; the first answer continues it
2. the epic is validated and the one-time recoveries checked: no
   legacy research to split, and one map row — `query-autocomplete` —
   missing both its summary and its description
3. the backfill looks for the topic's discussion file, finds none, and
   records nothing drafted for it; the batch display marks its summary
   as missing and asks for it, and the batch gate's answer accepts
4. with the topic's fields still empty, the unsourced-topics gate
   renders over it — its payload naming `query-autocomplete` — and
   the prose stops for the answer
5. the answer is the provide choice alone, carrying no text: the prose
   asks for the topic's summary and stops again — nothing is written,
   invented, or drafted from the topic's name before the user answers
6. the user's next reply is the summary: it becomes the topic's
   summary as given, with a description drawn from it, and both land
   in one `manifest apply` over a written ops file, then one discovery
   commit
7. with recovery work committed, the prose advises a fresh window and
   stops at its terminal condition — the epic's map is never sequenced
   and its dashboard never rendered in this pass

Further claims:

- the other three topics' summaries and descriptions are never
  rewritten
- the dismiss and leave paths are not taken: no summary ending
  "(source artifact missing)" is written

EXPECTED WORLD — the walk should have produced, from the fixture:

- the `query-autocomplete` map row carrying a `summary` that is the
  user's own sentence (type-ahead suggestions in the search box, drawn
  from what shoppers search for) and a non-empty `description`
  describing the same capability — no other field on the row changed
- `behavioural-ranking`, `synonym-handling` and
  `relevance-measurement` unchanged
- the discussion item for `query-autocomplete` still in progress, no
  discussion file created, no topic order written

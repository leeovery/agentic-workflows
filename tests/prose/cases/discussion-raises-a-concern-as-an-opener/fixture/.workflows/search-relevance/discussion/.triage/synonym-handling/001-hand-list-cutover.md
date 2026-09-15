### Hand-list cutover
*From: behavioural-ranking · discussion · 2026-01-06*

Synonym-handling's decision retires the hand-maintained synonym and
misspelling list "once behavioural coverage matches it". Working out
what the nightly pair-counts actually cover, this session measured
the match and found that the cutover as decided strands a whole
class of searches — so the shape of the cutover is a decision
synonym-handling still owes.

Background. The hand list has two kinds of entry. Synonyms proper
("hoodie" → "hooded sweatshirt") are the minority; most rows are
misspellings mapped to the product term ("sweatshrit", "sweat
shirt", "swetshirt" → "sweatshirt"). Behaviour-derived pairs come
from reformulation-and-click: a shopper searches, gets nothing
useful, retypes, clicks. Head terms reformulate constantly, so the
pair-counts already cover 82% of the list's synonym rows.
Misspellings behave differently: a shopper who mistypes a rare
product name usually leaves rather than retypes, so no pair ever
forms — the pair-counts cover 9% of the misspelling rows, and the
uncovered ones are concentrated on long-tail products where a
single misspelling can be the only way a shopper ever finds the
item. "Coverage matches" never arrives for those rows, and a
cutover keyed on it either never happens or happens with the tail
dark.

Options this session worked through.

1. Keep the hand list as a fallback tier. The expansion service
   consults behavioural pairs first and falls through to the hand
   list only for terms with no behavioural expansion. Cost: the list
   stays alive, so the upkeep the replacement was meant to end
   continues — smaller, since head terms leave it, but still
   someone's job; and two sources at query time means two lookups,
   roughly 35 ms on p95 against a 300 ms search budget.

2. Seed the pair-counts from the hand list once, then delete it.
   Every list row is imported as a synthetic pair at a discounted
   weight — 0.3× a real behavioural pair, so a genuine click pattern
   outranks a seed the moment one exists — and seeds decay on a
   90-day window unless behaviour confirms them. Cost: nobody prunes
   seeds that were wrong to begin with, so a stale mapping can
   survive until the window expires; and the import is a one-off
   migration with no rollback once the list is gone.

3. Rejected: run both sources in parallel indefinitely and merge at
   query time. The merge needs a weighting rule nobody could justify
   from data, it doubles the query-time work permanently, and it
   keeps the list alive with none of option 1's fall-through
   discipline.

This session leans to option 2: the retirement synonym-handling
decided is the point of the replacement, and a permanent fallback
tier quietly reverses it. The cost worth naming is the stale-seed
one — a wrong mapping lives up to the decay window — which the
90-day window bounds.

What synonym-handling needs to decide: which cutover shape replaces
"once behavioural coverage matches it" — the fallback tier, or the
seeded import and deletion. Not in scope here: the retirement
itself, already decided.

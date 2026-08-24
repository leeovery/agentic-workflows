The prose should have taken this path:

1. the scoped path (epic, no topic) routes through prerequisites into
   the grouping analysis — both discussions are concluded, so the
   analyze route passes its gates
2. the analysis forms groupings from the two concluded discussions
   (their exact shape and names are the model's judgment) and persists
   the whole reconcile through one `manifest apply`
3. the same reconcile assigns the build order: every specification
   item it creates carries an `order` field
4. the groupings menu is presented and the walk stops there

Further claims about the end state:

- every live specification item on the manifest carries an integer
  `order`, and the orders are contiguous starting at 1
- the orders landed inside the reconcile's `manifest apply` — no
  `build-order sequence` call ran, and no separate write set them
- the discovery map's own `order` values (1–3 from the harvest) are
  untouched, and the specification orders were not copied from them
  mechanically — the fresh `relevance-measurement` map topic (order 3)
  has no specification item and no influence on the numbering
- `phases.specification.build_order_stale` is absent — birth does not
  flag staleness

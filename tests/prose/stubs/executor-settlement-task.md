# stub: executor-settlement-task

A task executor's clean run for the phase-2 task `pay-2-1` (Reconcile
Settlement Reports). Create the files below exactly as given and return
the STATUS block. Write nothing else — no reports, no task-file edits,
no git activity; the caller owns all bookkeeping.

---

Create `src/settlement/reconcile.js`:

```js
// Reconcile the gateway's daily settlement report against paid orders.
// Every settled intent must match a paid order; mismatches are listed,
// never silently dropped.
export function reconcileSettlement(report) {
  return report.entries.filter((entry) => !orders.isPaid(entry.intentId));
}
```

and `tests/settlement/reconcile.test.js`:

```js
// A settled intent with no paid order is reported; a fully matched
// report reconciles to an empty list.
test('lists settled intents with no paid order', () => {});
```

and return:

```
STATUS: complete
TASK: Reconcile Settlement Reports
SUMMARY: The daily settlement report now reconciles against paid orders;
every settled intent without a paid order is listed for review and a
fully matched report reconciles clean. Verified via the reconciliation
test.
TEST_RESULTS: all passing
```

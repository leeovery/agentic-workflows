# stub: plan-tasks-designed-p1-and-an-unset-bound

A task-designer agent's return for Phase 1 of the pay plan: the same
short overview and two-task table `plan-tasks-designed-p1` carries,
closed by a `## Spec Defects` section reporting one omission — the
specification requires both of the checkout path's synchronous external
calls to run under an explicit client timeout, bounds one of them with
its recorded rule, and never states the other's. The Ground names what
the specification itself offers toward the answer. The content below is
what the agent returns.

---

Phase 1 breaks into two tasks: creating the payment intent when
checkout begins, and attaching it to the order so later capture can
find it.

| Task | Summary | Edge cases |
|------|---------|------------|
| Create Payment Intent | Create a gateway payment intent when checkout begins, card-only enforced. | Gateway rejects the intent (§1 Payment Intent) |
| Attach Intent To Order | Persist the intent id on the order for later capture confirmation. | Duplicate checkout start (§1 Payment Intent) |

## Spec Defects

### S1: The intent attachment's client timeout is never stated
- **Omission**: Client Call Bounds requires both of the checkout path's synchronous external calls to run under an explicit client timeout and bounds intent creation at 4 seconds, but states no bound at all for the write that attaches the intent to the order.
- **Consequence**: The implementer picks a number for the second call. Set it too low and a healthy slow write fails a checkout whose intent is already open against the gateway; set it too high and a hung orders store holds the checkout open with an intent nothing points at, which is the case the section says the bounds exist to prevent.
- **Ground**: The same section records the rule the intent-creation bound was set by — twice the dependency's documented p99, so a healthy slow call never trips the bound — and records the orders store's documented p99 at 250 milliseconds for single-order writes.

# stub: analysis-standards-finds-an-unset-bound

A standards analysis agent returning one finding: the specification's
client-bounds section requires both of the feature's external calls to
run under explicit timeouts, bounds one of them with its recorded
reason, and never states the other call's bound. Write the findings
file to the path the dispatch names
(`.workflows/{work_unit}/implementation/{topic}/analysis-standards-c{N}.md`)
via the `.txt`-then-rename mechanism, with the content below, then
return the status block. Nothing else: no code writes, no git activity,
no other files.

---

The findings file:

```
AGENT: standards
FINDINGS:
- FINDING: The specification never set the order write's client bound
  SEVERITY: low
  FILES: .workflows/pay/specification/pay/specification.md (Client call bounds), src/webhooks/capture.js:4
  DESCRIPTION: The specification's Client call bounds section requires the feature's two synchronous external calls to run under explicit client timeouts, configured once on the shared clients rather than at the call sites. It bounds intent creation at 4 seconds and records why — twice the gateway's documented p99 of 2 seconds — then records the orders store's documented p99 of 250 milliseconds for the order write and never states that call's bound. The webhook consumer's `orders.markPaid` call at src/webhooks/capture.js:4 is the call the missing bound governs. Nothing in this tree carries either value: the shared clients are ambient, so no configuration file here holds a timeout.
  RECOMMENDATION: The specification is the side that owes the value — the section that bounds one call with its reasoning and records the other call's p99 should state the order write's bound.
SUMMARY: The specification requires both external calls bounded and sets only one bound.
```

The status block:

```
STATUS: findings
FINDINGS_COUNT: 1
SUMMARY: The specification leaves the order write's client bound unset.
```

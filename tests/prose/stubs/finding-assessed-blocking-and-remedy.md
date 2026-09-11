# stub: finding-assessed-blocking-and-remedy

The assessor's verdicts for the batch: the blocking entry and its paired
finding both hold against the code and prescribe a code change; the capture
finding holds too, but its failure line describes behaviour — the paid write
runs for an unknown intent — while it prescribes comment text, so the remedy
is code and the correction names the guard. Write the lines below to the
output path the dispatch names, one JSON object per line and nothing else.
The counts are also what the agent returns.

---
{"id":"1-1-b1","valid":"valid","standard":"n/a","rule":"-","remedy":"-","note":"card-only is not enforced — the intent takes the order's methods"}
{"id":"1-1-1","valid":"valid","standard":"n/a","rule":"-","remedy":"-","note":"the one-line literal restores card-only at creation"}
{"id":"1-2-1","valid":"valid","standard":"compliant","rule":"-","remedy":"code","corrections":"the comment describes the behaviour the spec intends and the code lacks it — return before orders.markPaid when orders.find(event.intentId) is absent","note":"a defect wearing a comment edit; the prose was the easy edit"}

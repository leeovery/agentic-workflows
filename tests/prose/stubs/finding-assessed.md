# stub: finding-assessed

The assessor's verdicts for the batch: both findings hold against the code,
one carries a standards violation confined to its proposed wording; the
comment finding's remedy is the prose — the spec forbids the path the
comment claims, so the text is what is wrong. Write the lines below to the
output path the dispatch names, one JSON object per line and nothing else.
The counts are also what the agent returns.

---
{"id":"1-1-1","valid":"valid","standard":"violates","rule":"claims about tests","amendable":true,"remedy":"-","corrections":"the replacement names a sibling test as owning the claim","note":"real defect, wording overreaches"}
{"id":"1-2-1","valid":"valid","standard":"n/a","rule":"-","remedy":"prose","note":"the comment does claim a path the code never had and the spec forbids"}

# stub: finding-assessed

The assessor's verdicts for a batch: both findings hold against the code,
one carries a standards violation confined to its proposed wording. Write
the lines below to the output path the dispatch names, one JSON object
per line and nothing else. The counts are also what the agent returns.

---
{"id":"1-1-1","valid":"valid","standard":"n/a","rule":"-","note":"the comment does name a path the code dropped"}
{"id":"1-2-1","valid":"valid","standard":"violates","rule":"claims about tests","amendable":true,"corrections":"the replacement names the sibling test as owning the claim","note":"real defect, wording overreaches"}

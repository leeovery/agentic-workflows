# stub: analysis-standards-clean

A standards analysis agent that finds nothing across the phase's two
small modules — no candidate clears the floor and no comment needs
correcting. Write the findings file to the path the dispatch names
(`.workflows/{work_unit}/implementation/{topic}/analysis-standards-c{N}.md`)
via the `.txt`-then-rename mechanism, with the content below, then
return the status block. Nothing else: no code writes, no git activity,
no other files.

---

The findings file:

```
AGENT: standards
FINDINGS: none
SUMMARY: Both modules sit where the specification expects them and follow the project's conventions; no comment claims more than the code carries.
```

The status block:

```
STATUS: clean
FINDINGS_COUNT: 0
SUMMARY: Nothing drifts from the specification or the conventions.
```

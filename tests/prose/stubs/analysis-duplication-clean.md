# stub: analysis-duplication-clean

A duplication analysis agent that finds nothing across the phase's two
small modules. Write the findings file to the path the dispatch names
(`.workflows/{work_unit}/implementation/{topic}/analysis-duplication-c{N}.md`)
via the `.txt`-then-rename mechanism, with the content below, then
return the status block. Nothing else: no code writes, no git activity,
no other files.

---

The findings file:

```
AGENT: duplication
FINDINGS: none
SUMMARY: No significant duplication detected across implementation files.
```

The status block:

```
STATUS: clean
FINDINGS_COUNT: 0
SUMMARY: Nothing repeated across the two modules is worth extracting.
```

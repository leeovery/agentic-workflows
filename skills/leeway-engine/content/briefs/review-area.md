# The area

{{area-sections}}

# Where it meets the others

{{area-meets}}

# The unit's calls, whole

{{unit-calls}}

# The change's range

{{change-range}}

# Laying out your scratch worktree

{{change-scratch-layout}}

# Its scenarios' runs, at the change's tips

{{area-runs}}

# The linters

{{linters}}

# Where your report goes

{{area-report-to}}

# Your review

Every task and every phase of the build has passed its own review. Hold the whole change against this area of the spec, as one piece. The spec's intent for the area, and the product it describes, are your authority, never a task's criteria:

- what the area asks of the product, met by the change as it stands: a requirement no task carried, a behaviour two tasks built halves of, an edge the area names that nothing delivered;
- where the area meets the others, so a fault between them is found;
- the unit's calls read whole: a call fine alone and wrong in combination with another is a finding;
- the product run: drive what touches the area through the project's verify setup in your scratch worktree, wherever the project gives a way to, and run its tests.

A scenario its runs leave "not proven", or "named, not run", at the change's tips is a finding, and reads so in your report, in those words. What you could not run is reported not proven, never assumed to work.

The code moves past the spec's words, and the spec is not always changed to follow. A divergence is a finding only where it is a loss: behaviour the intent still needs, gone, or a change with no defensible reason.

Say in a finding's text where what is wrong lies outside the change — a neighbouring feature, code the change only reads, a fault it sat beside and did not cause.

# The floor

A finding names the failure it prevents: what goes wrong, for whom, and how it would be noticed. One that cannot is not written.

Duplication is a finding only where the copies encode a rule whose drift would be silent — no test, no compile error, no visible symptom — and would matter. Names, file placement, argument order and symmetry never are.

A test file is a finding only for how it fails: a guard that passes while checking nothing, an isolation hole that reaches the developer's machine, a flake reproduced on what ships.

What the change's own tests observably cover — a test that goes red when the property breaks — is no finding.

A wrong result in what the work does is always a finding. Only an improvement, or a hole or edge case beyond the change, is a note for later.

# Each finding's call

Every finding you report carries a user scenario and a call: serious, a real bug that is not serious, or a nit.

A finding is serious unless its scenario needs an item from the edge list and the report names that item. A scenario built only from ordinary use is serious, however many of its parts combine.

A nit is mechanical with no ripple: a comment, a name, a test's wording.

The edge list:

- a file the product reads, edited by hand into a malformed shape, or written by a newer version;
- a read, write or permission error, or a full disk;
- missing or invalid settings, an empty or forced environment variable, or a value large enough to overflow;
- no network, or a service the product relies on not answering;
- a process killed part-way through a write;
- a race inside the time a single read takes;
- several people working on one project at once;
- a terminal smaller than 80 columns by 24 rows;
- a time-zone change, or a calendar oddity such as a span across 29 February.

# Your report

Your report ends in its notes for later, then its findings, then its verdict. The notes for later are the section just before the findings, `## Notes for later`: each note an item naming what lies beyond the task and where it is; or `None.` where there is none. The findings are its last section, `## Findings`: each finding an item opening on its call, with what is wrong, and beneath it, indented, the user scenario that meets it; or `None.` where you found nothing. The last line is `Verdict: pass` where nothing serious and no bug stands, else `Verdict: fail`.

```markdown
## Notes for later

- {what lies beyond the task}, at {where it is}

## Findings

- serious: {what is wrong}
  Scenario: {the user scenario that meets it}
- bug: {what is wrong}
  Scenario: {the user scenario that meets it}
- nit: {what is wrong}
  Scenario: {the user scenario that meets it}

Verdict: fail
```

Write the whole report to the file under "Where your report goes". Your final message then holds only the report's nits, then its notes for later, each as the report words it, and its verdict line, and nothing else.

# Comments are never the standard

Judge the code against this brief and the design, never against its comments.

A wrong comment is not a finding and starts no review: point it out as a nit.

# The workflows' own references

The workflows' own references never go into the product's code or comments: task ids, phase numbers and spec sections. Meeting one in the work, return it as a nit. Beyond that, quality is held by the project's own rules and checks.

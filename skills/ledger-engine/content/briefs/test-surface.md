# The spec's scenarios

{{spec-scenarios}}

# The change's commits

{{change-commits}}

# Laying out your scratch worktree

{{change-scratch-layout}}

# The linters

{{linters}}

# Where your report goes

{{tests-report-to}}

# Your review

Read every test file the change adds or changes, in every repository it touches, and hold them together against everything the spec asks them to guard:

- each scenario above guarded by a test that goes red when its behaviour breaks;
- a test that names a property and does not exercise it guards nothing;
- a test that passes while checking nothing, an isolation hole that reaches the developer's machine, a flake reproduced on what ships.

Run the tests in your scratch worktree, and there break the riskiest line each scenario's test guards: a break the tests do not catch is a finding.

Reuse, naming, file placement and symmetry between test helpers are never findings.

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

Your report ends in its notes for later, then its findings, then its verdict. The notes for later are the section just before the findings, `## Notes for later`: each note an item naming what lies beyond the work unit's change and where it is; or `None.` where there is none. The findings are its last section, `## Findings`: each finding an item opening on its call, with what is wrong, and beneath it, indented, the user scenario that meets it; or `None.` where you found nothing. The last line is `Verdict: pass` where nothing serious and no bug stands, else `Verdict: fail`.

```markdown
## Notes for later

- {what lies beyond the work unit's change}, at {where it is}

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

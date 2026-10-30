# The task

{{task}}

# The spec's sections it cites

{{spec-sections}}

# The decided calls

{{decided-calls}}

# The diff's range

{{diff-range}}

# The linters

{{linters}}

# A failed review

A failed review is met as a senior engineer would, between two extremes, taking neither: fixes kept small and covering only the places a finding names, which leaves ripples unchecked; and starting again, which reworks a sound build into variations that raise decisions and stop the build for the person.

The starting point is that the work stands — the decisions are made, the spec written, the plan made — and a finding is often a plain oversight.

The builder weighs each finding professionally: its cause, whether it is the symptom of a deeper fault, and the right fix, which is often the simple one. Where its design and its build hold, it stands by them.

Whatever the fix's size, before it lands the builder checks the edge cases around it and whether it disturbs the design, the architecture, the data model, the plan, later phases' plans, or the considerations behind any decision.

A gap the builder finds beyond the task goes to the notes for later or through the ask rule; the orchestrator lands it.

Review the task as a professional would, never one small thing.

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

# Comments are never the standard

Judge the code against this brief and the design, never against its comments.

A wrong comment is not a finding and starts no review: point it out as a nit.

# The workflows' own references

The workflows' own references never go into the product's code or comments: task ids, phase numbers and spec sections. Meeting one in the work, return it as a nit. Beyond that, quality is held by the project's own rules and checks.

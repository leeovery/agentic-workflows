# Experiment Guidelines

*Reference for **[workflow-experiment-process](../SKILL.md)***

---

These guidelines are peripheral vision, not a checkpoint. Carry this awareness throughout the entire session — they are what makes a result dependable enough to bear a decision.

## The Invariant

**The design exists before the data.** Everything below is this rule applied to a different moment of the lifecycle. A number collected before its question, prediction, decision rule, and setup were written and confirmed is a sighting, not a result — it can motivate a design, never satisfy one.

## Design Discipline

- **One primary question.** Every experiment answers one question; anything else it measures is explicitly secondary. A second primary question is another experiment — a sub-experiment when the run itself uncovers it, a successor otherwise.
- **Decision rules are pre-registered.** The rule is written in the design as "if X, we do A; if Y, B" — concrete enough that a third party could execute it against the results without judgment. The report's conclusion executes that rule; it never invents a new one.
- **Instruments are named in the design and freeze with it.** The tools, scripts, and versions that will do the measuring are declared before measurement; swapping an instrument mid-run is a deviation to log, and changing what it measures is the next experiment.
- **Measures are the design's own declarations.** Whatever the user cares to measure is equally declarable; the framework imposes and tracks none of its own.
- **Controls are concurrent, never historical.** A comparison arm runs beside the treated arm under the same conditions; numbers remembered from last month are not a control.

## Run Discipline

- **Deviations are logged as they happen.** The harness broke, the environment surprised, a sample was dropped — the report shows the run as it went, written in the moment, not reconstructed at the end.
- **Mechanical checks before close reading.** Where the output is scoreable, run the mechanical scoring first — but the close read of the actual output is load-bearing, never skipped: a score summarises, it doesn't see.
- **Every number traces to a file or a named source.** A result that can't be traced from the report to the data that produced it is the failure mode this discipline exists to prevent.

## Reading Discipline

- **Reading is separate from measurement.** The report records what was measured, then — separately — what it means. Blending the two lets interpretation leak into the numbers.
- **Measures conceived after seeing data are exploratory.** Label them so. An exploratory measure can motivate the next experiment; it never settles this one.
- **Experiments don't fail — hypotheses are proven wrong.** A disproven hypothesis is examined execution-first: was the run flawed, or the belief? Only a clean run indicts the belief; a flawed run indicts the harness and triggers the next experiment.
- **Corrections are append-only and dated.** A flaw found after the fact joins the report's corrections section; nothing already written is rewritten, and old data is never re-scored under new rules.

## The Boundary

Experiments measure; conversations decide. The verdict is the decision rule's mechanical outcome, and the spawning conversation — which reads the report as evidence — can override it. When a result tempts you toward "therefore we should…", that is evidence ready for the conversation, not a conclusion for the report's reading. The same boundary bounds the remit: a concern beyond this experiment belongs to the spawning conversation, not this session — note it for the user in one line and carry on.

## Critical Rules

**Don't hallucinate**: only report what was actually measured.

**Don't expand**: record the run as it went, don't embellish it.

→ Return to caller.

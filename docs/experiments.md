# Experiments

Some questions cannot be argued to an answer. Part way through a [discussion](discussion.md), the conversation sometimes reaches a number that is about to bear a decision, such as how often a sandbox really delivers a webhook twice, or what an index actually costs at this catalogue size, and no amount of talking settles it. An experiment is the laboratory the discussion hands such a question to: a controlled measurement, designed before it is run, producing a result dependable enough to decide on.

One rule governs it, and everything else follows: **the design exists before the data.** A number collected before its question, prediction and decision rule were written down and agreed is a sighting, not a result. It can motivate an experiment, never settle one.

## Where an experiment comes from

An experiment is never started directly. It is spawned from a discussion, when a measurement would settle a choice being weighed, not merely inform it. Claude offers it in the conversation: the question a controlled experiment would settle, what a dependable answer would take off the table, and that a quick measurement in the conversation is a fine alternative. Declined, that quick measurement is what you get, recorded as an exploratory finding with its command and its result. A sighting short of the bar stays in the conversation the same way.

Accepted, the discussion writes a problem statement, the problem in plain terms, what needs picking or learning and what is hoped, closing on where it was born, and nothing of the design. The question it measures waits on the experiment. Then you choose: start it now, which pauses the conversation and opens the laboratory, or later, which carries the conversation on while the question waits for the result. You can still answer the question yourself before the experiment reports; only you close a question while its experiment runs. A waiting experiment is picked up later from the menus: on an epic's menu the topic's own row becomes *Continue in the laboratory*, with how many experiments wait.

## Designing it with you

The design is written with you in conversation, into the experiment's `design.md`:

- **One primary question**, and the decision it feeds. Anything else measured is explicitly secondary; a second primary question is another experiment.
- **A prediction**, and why.
- **A decision rule**, written as "if X, we do A; if Y, B", concrete enough that a third party could apply it to the results without judgement.
- **The method**: the instruments that will measure and their versions, the sample, the environment, and a comparison that runs beside the treated arm under the same conditions, never numbers remembered from last month.

The depth scales with the problem. A ten-minute local test writes a few lines per section; a multi-day run writes pages. The skeleton never scales away.

## The freeze

Before anything is measured, Claude presents the design in plain terms: what will be done, what is expected and why, and what each outcome triggers. Your challenges are part of the method, and they fold into the design before the freeze. Your yes freezes it.

From the freeze, the design changes only by a recorded amendment. Until the first result is visible, an amendment is dated, appended beneath the original and confirmed with you again before measurement starts or resumes. Once results are visible the design is frozen for good: a flaw found then goes in the report's corrections, dated and append-only, and triggers the next experiment with the fixed design. Old data is never re-scored under new rules.

## The run

The run is mostly autonomous: the collaboration was front-loaded into the design. Claude measures as designed, choosing the shape that gives the most dependable result, whether doing it directly, writing a script that does the work while it watches, or running independent legs in parallel. Such code is an instrument, kept with the experiment's data, never product code.

The report is written as the run goes. Results land as they are measured and stand as written, every number traceable to a file or a named source. Deviations, an instrument breaking or the environment surprising, are logged as they happen, so the report shows the run as it went. Where the design runs conditions, the tally is recorded as runs land and the engine works out the medians.

A question that turns out to be two mid-run splits into sub-experiments, each designed, frozen, run and concluded on its own row, and the parent concludes by bringing their verdicts together. A split never splits again, and the discussion that is waiting sees only the parent.

## Report and verdict

The report keeps reading apart from measurement: what was measured first, then, separately, what it means. A measure thought of after seeing the data is labelled exploratory: it can motivate the next experiment, never settle this one. Experiments don't fail; hypotheses are proven wrong, and a disproven one is examined run first: was the run flawed, or the belief? Only a clean run indicts the belief.

The conclusion applies the decision rule written before the data, which branch fired and what it triggers, never a fresh judgement. The verdict is that one line, recorded on the experiment's register. An experiment can also be abandoned, before or during its run, with a one-line reason; the register keeps the row and its reason, and nothing is erased.

## Back to the conversation

Experiments measure; conversations decide. When an experiment ends, the discussion's wait on it is released, and its next session takes the report in: the result becomes a measured finding, and the question goes back to the conversation, which reads the report as evidence and can override the verdict. An abandoned experiment's question simply opens again. If the question left the topic while the experiment ran, moved to another topic, the report waits in that topic's mail instead.

Each topic keeps its experiments as a series, numbered E1, E2 and so on, under `topics/{topic}/experiments/`, each with its design, its report and its data. When one ends with others in the series still live, the laboratory offers to work the next without leaving.

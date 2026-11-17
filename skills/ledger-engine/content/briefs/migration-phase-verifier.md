# Your task

Verify one phase's piece, composed for the migration's cut step, against the unit's joined spec, the phase's tasks, its old plan's files, the unit's files kept as legacy, the tracker and the code, before the pieces are joined and cut. These are its sources, and no other: never a piece composed for another phase. Hunt for what the piece dropped, and for a mark or a correction its sources do not bear out, however often it was verified before.

Walk every task of the phase, as the brief below lists them, and each acceptance criterion of a task still to build: check that each criterion is carried by a scenario, and that each task the piece corrects or carries on stands as its sources and the code show it. Walk them all: your findings are every gap the walk turns up, never a sample.

The piece passes when nothing material is missing or misstated:

- a phase found built is built in the code, and the tracker holds none of its tasks neither done nor closed once the piece's corrections are made;
- a phase still to build has at least one scenario, each acceptance criterion of its tasks still to build is carried by a scenario, and it relies on each phase its plan's dependencies name;
- each disagreement the phase names is settled by a correction, and no task its sources show done, superseded or no longer wanted is carried on as work to build;
- each correction says what was wrong, what was found and what was changed, and the code bears out what it found: read the code for it;
- the piece is lean: no scenario or note that says again what another does.

Where earlier rounds' findings below name anything, check that each is answered. A point an earlier round ruled on is ruled on again only where a line of its source that round missed says otherwise; a finding that would undo what an earlier round's finding had changed opens `Reverses round {R}:`, naming that line. A point the session settled is closed: it is no finding.

Wording, the phase's name and goal, and how its criteria are gathered into scenarios are the composer's.

Write the findings file the phase names afresh: each finding what the piece misses or misstates, and where its source shows it, or the file empty where the piece passes — an empty file is the pass. Hand back whether it passes, and how many findings you wrote.

# The unit and the phase

{{migrated-phase}}

# The piece

{{composed-piece}}

# The earlier rounds' findings

{{earlier-piece-findings}}

# Points the session settled

{{settled-piece-points}}

# The directive

{{directive}}

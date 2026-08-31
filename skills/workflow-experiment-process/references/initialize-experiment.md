# Initialize the Experiment

*Reference for **[workflow-experiment-process](../SKILL.md)***

---

## A. Read the Record

Read `{dir}/problem.md` in full — the spawn's problem statement: what to pick or learn, the space around it, what the spawning conversation hopes, with a provenance line naming the phase, topic, point, and date it was born from. Hold the provenance — **B** reads by it.

#### If `record_status` is `conceived`

No design exists yet — the laboratory designs from the spawning conversation's ground.

→ Proceed to **B. Read the Spawning Conversation**.

#### Otherwise

A record in flight. Read its own documents instead: `{dir}/design.md` in full, and `{dir}/report.md` where it exists — sub-experiment directories under `{dir}` included. The design on disk is the ground; conversation memory is not.

→ Proceed to **C. Route**.

## B. Read the Spawning Conversation

The provenance names the phase and topic the question came from. That document is mid-flight — unconcluded and unindexed — so it is read on disk, in full, never queried:

- `research` → `.workflows/{work_unit}/research/{topic}.md`
- `discussion` → `.workflows/{work_unit}/discussion/{topic}.md`

Then the linked inputs:

→ Load **[seed-context.md](../../workflow-shared/references/seed-context.md)** and follow its instructions as written.

→ Load **[read-brief-context.md](../../workflow-shared/references/read-brief-context.md)** with work_type = `{work_type}`, work_unit = `{work_unit}`, topic = `{topic}`.

**If the provenance names `discussion` and the topic's research is completed** (read `{work_unit}.research.{topic} status` via `engine manifest get`): read `.workflows/{work_unit}/research/{topic}.md` in full — its sightings are the hunches this experiment turns into dependable numbers, never evidence in their own right.

→ Proceed to **C. Route**.

## C. Route

The inputs just read are inherited ground, not a list of questions to re-ask — the laboratory asks the user its own questions where the design needs them. No registration and no commit here: the spawn created the record, and the first write commits from the leg that makes it.

#### If `record_status` is `conceived`

→ Return to **[the skill](../SKILL.md)** for **Step 3**.

#### If `record_status` is `designed`

→ Return to **[the skill](../SKILL.md)** for **Step 4**.

#### If `record_status` is `approved` or `running`

→ Return to **[the skill](../SKILL.md)** for **Step 5**.

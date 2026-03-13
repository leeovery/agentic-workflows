# Discussion Guidelines

*Reference for **[workflow-discussion-process](../SKILL.md)***

---

## What to Capture

- **Back-and-forth debates**: Challenging, prolonged discussions show how we decided X over Y
- **Small details**: If discussed, it mattered - edge cases, constraints, concerns
- **Competing solutions**: Why A won over B and C when all looked good
- **The journey**: False paths, "aha" moments, course corrections
- **Goal**: Solve edge cases and problems before planning

**On length**: Discussions can be thousands of lines. Length = whatever needed to fully capture discussion, debates, edge cases, false paths. Terseness preferred, but comprehensive documentation more important. Don't summarize - document.

See **[meeting-assistant.md](meeting-assistant.md)** for the dual-role approach (expert architect + documentation assistant).

## Do / Don't

**Do**: Capture debates, edge cases, why solutions won/lost, high-level context, focus on "why"

**Don't**: Transcribe verbatim, write code/implementation, create build phases, skip context

See **[guidelines.md](guidelines.md)** for best practices and anti-hallucination techniques.

## Write to Disk and Commit Frequently

The discussion file is your memory. Context compaction is lossy — what's not on disk is lost. Don't hold content in conversation waiting for a "complete" answer. Partial, provisional documentation is expected and valuable.

**Write to the file at natural moments:**

- A micro-decision is reached (even if provisional)
- A piece of the puzzle is solved
- The discussion is about to branch or fork
- A question is answered or a new one uncovered
- Before context refresh

These are natural pauses, not every exchange. Document the reasoning and context — not a verbatim transcript.

**After writing, git commit.** Commits let you track, backtrack, and recover after compaction. Don't batch — commit each time you write.

**Create the file early.** After understanding the topic and initial questions, create the discussion file with context and the questions list. Don't wait until you have answers.

→ Return to **[the skill](../SKILL.md)**.

# Discussion Guidelines

*Reference for **[workflow-discussion-process](../SKILL.md)***

---

## What to Capture

- **Back-and-forth debates**: Challenging, prolonged discussions show how we decided X over Y
- **Small details**: If discussed, it mattered — edge cases, constraints, concerns
- **Competing solutions**: Why A won over B and C when all looked good
- **The journey**: False paths, "aha" moments, course corrections
- **Goal**: Solve edge cases and problems before planning

**On length**: Discussions can be thousands of lines. Length = whatever needed to fully capture discussion, debates, edge cases, false paths. Terseness preferred, but comprehensive documentation more important. Don't summarize — document.

See **[meeting-assistant.md](meeting-assistant.md)** for the dual-role approach (expert architect + documentation assistant).

## Organic Flow

The conversation follows the thinking, not a checklist. Subtopics emerge, get explored, branch, and converge naturally. The Discussion Map tracks where you are — the conversation itself is free-flowing.

**Follow threads**: When a tangent surfaces something important, follow it. Add it to the map and explore. You can always navigate back.

**Challenge and probe**: Push back on assumptions, surface edge cases, propose alternatives. The goal is depth of understanding, not speed of coverage.

**Don't force transitions**: If the user is deep in a subtopic, don't interrupt to check off progress. Let the conversation breathe. Transition when there's a natural pause or a decision lands.

**Circle back**: Track what's been partially explored. When a related subtopic resolves, suggest returning to the deferred one — new context may change the thinking.

## Do / Don't

**Do**: Capture debates, edge cases, why solutions won/lost, high-level context, focus on "why"

**Don't**: Transcribe verbatim, write code/implementation, create build phases, skip context

See **[guidelines.md](guidelines.md)** for best practices and anti-hallucination techniques.

## Write to Disk and Commit Frequently

The discussion file is your memory. Context compaction is lossy — what's not on disk is lost. Don't hold content in conversation waiting for a "complete" answer. Partial, provisional documentation is expected and valuable.

**Write to the file at natural moments:**

- A subtopic decision is reached (even if provisional)
- The Discussion Map states change
- A piece of the puzzle is solved
- The discussion is about to branch into a new subtopic
- A new subtopic is uncovered or elevated
- Before context refresh

These are natural pauses, not every exchange. Document the reasoning and context — not a verbatim transcript.

**After writing, git commit.** Commits let you track, backtrack, and recover after compaction. Don't batch — commit each time you write.

**Create the file early.** After understanding the topic and initial seed subtopics, create the discussion file with context and the Discussion Map. Don't wait until you have decisions.

→ Return to caller.

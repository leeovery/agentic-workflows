# Specification Body

*Shared reference. Loaded by leeway-scoping-process.*

---

The body of every specification file (`.leeway/{work_unit}/specification/{topic}/specification.md`):

```markdown
# Specification: [Topic Name]

## Specification

[Validated content accumulates here, organized by topic/phase]

---

## Working Notes

[Optional - capture in-progress discussion if needed]
```

Bracketed lines are placeholders, not content — never copy placeholder text into the file; a section not yet written carries its heading alone. Topic content nests beneath `## Specification` as numbered `###` sections (`### 3. Sweep Scope`), subdivided where a section has distinct parts as decimal `####` subsections (`#### 3.2 The in-scope set`) — never as sibling `##` headings.

Sections are stable — the number is the address, not the position. Wrong content in `3.2` is edited in place; new knowledge belonging to section 3 appends as its next subsection (`3.4`); a new top-level section appends at the end (`### 7.`) — order doesn't matter. Only when placement genuinely matters does a section slot in mid-sequence, and then the renumbering is careful: every displaced number and every `§` reference to it updates in the same edit. The document's furniture — `## Working Notes` — sits outside the numbering.

→ Return to caller.

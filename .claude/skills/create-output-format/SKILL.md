---
name: create-output-format
description: Scaffold a new planning output format adapter. Creates a format directory with all required files implementing the output format contract.
disable-model-invocation: true
---

# Create Output Format

Scaffold a new output format adapter for the workflow-planning-process workflow. Each format adapter is a directory of 5 files, one per concern.

---

## Step 1: Gather Information

Before writing anything, understand the tool. You need two things from the user:

1. **What is the tool/system called?**
2. **Documentation links** — official docs, API references, MCP server docs, anything relevant

#### If the user provided these upfront

→ Proceed to **Step 1.1: Research**.

#### Otherwise

Ask the user for both items above.

**STOP.** Wait for user response before proceeding.

→ Proceed to **Step 1.1: Research**.

### Step 1.1: Research

Fetch and read all provided documentation using WebFetch. From the docs, establish:

- How tasks are stored (API, database, files, etc.)
- How to interact with it (MCP server, REST API, CLI tool, filesystem)
- How to create, read, update, and query tasks
- What task properties are supported — status values, priority levels, labels/tags, estimation
- Whether it supports blocking/dependency relationships (within a project and across projects)
- How concepts map — what represents a project, a phase, a task, a dependency?
- What setup or configuration is required
- Benefits and trade-offs vs simpler approaches
- Any constraints or limitations

→ Proceed to **Step 1.2: Clarify Gaps**.

### Step 1.2: Clarify Gaps

Present what you've learned as a summary and ask the user to confirm or correct. Use AskUserQuestion to clarify anything the documentation didn't cover or left ambiguous — motivation for choosing this format, preferred interface if multiple exist, setup specifics, etc.

Suggest a kebab-case format key based on the tool name and confirm with the user.

**STOP.** Wait for user response before proceeding.

→ Proceed to **Step 2**.

---

## Step 2: Understand the Contract

Read **[references/contract.md](references/contract.md)** — this defines the 5-file interface every format must implement.

→ Proceed to **Step 3**.

---

## Step 3: Create the Format Directory

Create the directory at:

```
skills/workflow-planning-process/references/output-formats/{format-key}/
```

→ Proceed to **Step 4**.

---

## Step 4: Write the Files

Using the information gathered in Step 1, write each of the 5 required files. Use the scaffolding templates from **[references/scaffolding/](references/scaffolding/)** as structural guides:

| Template | Creates |
|----------|---------|
| [about.md](references/scaffolding/about.md) | `{format}/about.md` |
| [authoring.md](references/scaffolding/authoring.md) | `{format}/authoring.md` |
| [reading.md](references/scaffolding/reading.md) | `{format}/reading.md` |
| [updating.md](references/scaffolding/updating.md) | `{format}/updating.md` |
| [graph.md](references/scaffolding/graph.md) | `{format}/graph.md` |

For each file:

1. Start from the scaffolding template structure
2. Replace all `{placeholder}` tokens with format-specific content from your gathered information
3. Remove template guidance comments — the HTML comment lines, `<!-- ... -->`
4. Include concrete commands, API calls, or MCP operations — not vague descriptions

→ Proceed to **Step 5**.

---

## Step 5: Register the Format

`skills/workflow-planning-process/references/output-formats.md` renders a numbered selection menu. Register the new format with two edits, using the next available number `{N}`:

1. **Menu** — append an option to the selection menu block, folding the format's identity into the description:

   ```
   - **`{N}`** — {Format Name} — {one-line description}; {requirements, or "no external tools"}. Best for {ideal use cases}.
   ```

2. **Branch** — append a routing branch after the existing `#### If` branches:

   ```markdown
   #### If `{N}`

   Set `chosen-format` = `{format-key}`.

   → Return to caller.
   ```

→ Proceed to **Step 6**.

---

## Step 6: Validate

Verify:

- [ ] Directory contains exactly 5 files: about.md, authoring.md, reading.md, updating.md, graph.md
- [ ] All `{placeholder}` tokens have been replaced
- [ ] About.md includes a structure mapping table
- [ ] Authoring.md documents task properties: status, phase grouping, labels (NOT priority or dependencies)
- [ ] Authoring.md includes a complete task creation example
- [ ] Reading.md explains next-task ordering using status, priority, dependencies, and phase
- [ ] Updating.md covers all status transitions, how to modify task properties, and phase completion
- [ ] Graph.md covers priority levels and adding/removing dependencies
- [ ] Format is registered in output-formats.md

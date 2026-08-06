# Skill Authoring Conventions

This file defines the mandatory display, structural, prose, state-ownership, and file-layout conventions for all skill files in this project (entry-point and processing). Read it before authoring or editing any skill file. CLAUDE.md references this file rather than inlining the rules to keep the per-session context small.

## Prose Economy (MANDATORY)

Skill and reference files are agent instructions loaded into the runtime context. Write the **exact amount of words to describe the task perfectly** — not the most, not the least. The bar is "can Claude execute this flawlessly?", never "is it short?".

- **Write as if authored fresh, right now.** Each file is a clean set of instructions, not a record of how it was built. Cut historical references ("formerly", "used to", "now changed to"), previous-implementation notes, and migration backstory. When adding a feature to an existing file, leave it reading as though the feature was always there — no "(new)" markers, no justification bolted onto the old shape, no dangling references to what it replaced. No cruft.
- **Cut the WHY when the WHAT suffices.** "Load X and do Y" needs no explanation of why X exists or what it's for. Keep rationale only when it changes what the agent does.
- **This is not minimalism.** Keep every instruction, value, path, and distinction the agent needs to act correctly. Cutting a needed instruction is as wrong as over-explaining.

## Display & Output Conventions (MANDATORY)

These are hard rules, not suggestions. All entry-point skills that present discovery state, menus, or interactive choices MUST follow these conventions exactly. When writing or editing skill files, read existing skills and references as working examples — they are the authoritative demonstration of these rules in practice.

### Visual Hierarchy

All user-facing output uses five distinct visual tiers, each with a specific purpose. From heaviest to lightest:

| Tier | Element | Purpose | Rendering |
|------|---------|---------|-----------|
| 1 | Phase title | "Where am I" — top-level anchor | Markdown — `# **`■ Title`**` |
| 2 | Signpost blockquote | "What's happening" — guidance, context, closure | Markdown |
| 3 | Step marker | Progress through the phase | Markdown — `**`□ Name`**` |
| 4 | Sub-step marker | Progress within a step | Markdown — `**`▪ Name`**` |
| 5 | Status / menu | Data displays and interactive choices | Code block / markdown |

The chrome family is the square glyphs at falling weight — `■` filled, `□` hollow, `▪` small — all in bold inline code so they render blue, the H1 adding its underline to the title alone. Squares are structure; circles and arrows (`○ ◐ → ✓ ⊙ ⊘`) are item state, `◆` is a decision, `⚑` is an alert, and `⏺` belongs to the host UI's gutter.

Every skill invocation should produce at most one phase title. Signpost blockquotes appear at phase entry, before steps where context helps, and at phase completion.

### Rendering Instructions

Every **user-facing output** fenced block in skill files must be preceded by a rendering instruction. Fenced blocks that are model instructions (bash commands to execute, file paths to load) are exempt — they are not displayed to the user.

```
> *Output the next fenced block as a code block:*
```

or:

```
> *Output the next fenced block as markdown (not a code block):*
```

A fence-language variant names the fence when colouring depends on it — `as a properties code block (```properties fence)` for a prose-authored blocker, `as a diff code block (```diff fence)` for change content.

Code blocks are used for informational displays (overviews, status, keys) — they preserve indentation for tree structures and aligned lists. Markdown is used for chrome (phase titles, step and sub-step markers), interactive elements (menus, prompts), and signpost blockquotes, where the renderer's own styling does the work. When content benefits from rendered formatting (headings, checkboxes, bold) and indentation control isn't needed, prefer markdown rendering even for informational displays.

### Presentation Register

Report-class content — findings, review summaries, validation gaps and risks, diagnostics, item summaries — renders as markdown narrative in the register defined by `skills/workflow-shared/references/product-lens.md`: manifestation first in product terms, `file:line` refs as anchors, glanceable depth with the record file authoritative. A `t/technical` option retells the same report from the code's perspective per `skills/workflow-shared/references/technical-lens.md` — a lens shift driven by Claude, never a file dump; where a raw view earns a place, it is a separate `v/view` option rendering the record file as markdown. Artifact content the user approves as the thing itself (spec prose, plan phases, diffs) stays verbatim in its fence — see Content Dividers & Frames.

### Engine Output Sections

Skills that render state via an engine/adapter call (e.g. `gateway.cjs view {work_unit}`) receive one snapshot in demarcated sections. The section markers carry their own handling instruction, and the skill file restates it at the call site:

- `=== DATA … ===` — reasoning surface. Read it to decide (flags, counts, the `ACTIONS` key table); never display or restate it, and never parse the rendered sections below for decisions.
- `=== TITLE … ===` — the view's chrome heading (`# **`■ Title`**`). Emit verbatim as markdown, directly above the display.
- `=== DISPLAY … ===` — emit verbatim **as the fence its marker names**. The shared gateway marker says a plain code block — no language; any grammar eventually colours a stray word in uncontrolled prose. Labelled sections may name a colouring fence where the register calls for it — `properties` for blockers, `diff` for change content. Indentation-dependent content (trees, aligned columns) breaks under markdown rendering, so a DISPLAY section is never emitted as markdown.
- `=== MENU … ===` — emit verbatim **as markdown (not a code block)** so option formatting (bold, backticks) renders.

**Displays are engine-rendered.** Prose never draws layout — trees, columns, wrapping — by hand; a hand-drawn display drifts where an engine render cannot. Judgment-authored content that must appear inside a display travels to the engine as a payload file (the planning task list, the working-set summaries).

A section is everything beneath its marker up to the next marker; the marker lines themselves are never emitted. Section content is emitted byte-for-byte — never redrawn, reflowed, trimmed, or re-derived. Routing uses the `ACTIONS` entry's `action`/`route` values, never label text.

Engine calls may append labelled DISPLAY/MENU sections — transaction verbs (e.g. `engine task …`) after their one-line JSON response, snapshot verbs after their unlabelled sections — the state-derived gates of the calling flow. The label names the gate (`=== MENU: fix gate … ===`) and the marker's instruction names the emission moment: the section is emitted only where the flow's prose prescribes it, which may be a later gate than the call — never at the call itself. The same verbatim rules apply.

### Phase Titles

A markdown H1 carrying the chrome family's heaviest register — bold inline code with the filled square, so it renders blue, underlined, and italic. One per skill invocation. Serves as the top-level anchor telling the user where they are.

```
# **`■ Specification Overview`**
```

Rules:
- Exactly this shape: `# ` + `**` + backtick + `■ ` + title + backtick + `**`
- Title text is the phase or context name (e.g., "Workflow Overview", "Planning Overview")
- **Emitted as markdown** (use the markdown rendering instruction) — the styling comes from the renderer, so the title is correct at any terminal width
- The glyph is always `■`. Squares are structure (`■` phase, `□` step, `▪` sub-step); circles and arrows are item state (`○ ◐ → ✓ ⊙ ⊘`), `◆` is a decision, and `⏺` is the host UI's own gutter — chrome never borrows another family's shape

Engine views carry their heading as a TITLE section — the same markdown H1 shape, emitted above the DISPLAY fence (see Engine Output Sections). Nothing draws boxes.

### Step Markers

Progress indicators in the chrome family's middle register — bold inline code with the hollow square, rendering as a blue label. Embedded at the step boundaries that earn them — never instructed once at the top of a file.

**Markers are earned, not automatic.** A step carries a marker only when the user gets something between it and the next visible output: an interaction (menu, `**STOP.**` gate), substantive watchable activity (analysis, agent dispatch, engine transactions, multi-file work), or rendered content. Consecutive markers with nothing between them read as step-by-step progress that isn't happening — noise, not orientation.

- **Silent step**: a step whose body is plumbing — loading a reference, one quick command, evaluating a branch — keeps its `## Step N` heading (routing target, load boundary) but authors no marker and no signpost. The step renders nothing.
- **Conditional chrome**: a step whose common path is a no-op places its marker and signpost inside the branch that acts, not at step entry. The no-op path renders nothing — a header announcing a non-event is the noise this rule exists to prevent.

Every step marker must be followed by a signpost blockquote explaining what the step does and why — the marker names the step, the signpost explains it.

```
**`□ Construct Specification`**
```

Variations for loops and routing:

```
**`□ Task Execution (3 of 12)`**
**`□ Review (cycle 2)`**
**`□ Returning to Discussion Session`**
```

Rules:
- Exactly this shape: `**` + backtick + `□ ` + name + backtick + `**` — no fill, no padding; the styling comes from the renderer, so the marker is correct at any terminal width
- **No step numbers** — steps may be skipped based on conditionals and routing is non-linear. Names alone are sufficient
- Loop iterations shown in parentheses: `(cycle N)`, `(N of M)`
- Route-back uses `Returning to {Name}`
- Emitted as markdown with its own rendering instruction. No trailing blank line — natural block separation provides enough spacing

Engine-drawn dividers inside a fenced DISPLAY block (the epic dashboard's `── STAGE ──` lines) are a different object: markdown cannot reach inside a fence, so they stay drawn, sized to the content they divide.

### Sub-step Markers

Markers for stages within a step, in the chrome family's lightest register — the small square marks the nesting.

```
**`▪ Extract Sources`**
```

Rules:
- Exactly this shape: `**` + backtick + `▪ ` + name + backtick + `**`
- Named only — no numbering or lettered suffixes
- Same loop/iteration conventions as step markers
- Emitted as markdown with its own rendering instruction

### Signpost Blockquotes

Guidance text rendered as markdown blockquotes. Used for phase entry context, pre-step guidance, post-phase closure, and explaining blockers or gates. Never for status data or interactive choices.

```
> Your completed discussions will be synthesised into a formal spec. Expect questions about gaps, contradictions, and missing edge cases. The output is a standalone document that drives planning.
```

Rules:
- Rendered as markdown (use the markdown rendering instruction)
- **One authored line per paragraph** — never hand-wrap. The renderer reflows a long `>` line and carries the blockquote border across every soft-wrapped continuation, so the line is correct at any terminal width; a bare `>` line separates paragraphs
- **Bold is available, with judgment** — it survives the wrap and renders understated inside a blockquote. Use it where an emphasis genuinely helps (`**Two decisions are owed** before this can close`), not as decoration
- Lead phrases are freeform — no fixed vocabulary, chosen to fit the context
- 1-3 sentences maximum — never compete with the actual content
- Placement: after phase titles, before menus where context helps the decision, at phase transitions, explaining soft gates or blockers
- No trailing blank line inside the fenced block — natural block separation provides enough spacing
- Never between two code blocks that are part of the same logical display

### Workflow Banner

The `workflow-start` skill opens with an ASCII art banner (see skill file for exact art) emitted as a properties code block — the fence is what colours the art: each line's first token renders turquoise and everything after the first space red, so the single space between the two words is load-bearing — followed by a markdown title line carrying the product name and version (`# **`■ Agentic Engineering Workflows`** · *vN.N.N*`). No borders; the version rides the title line, where the release tooling pattern-matches it.

### Template Placeholders

Skill files use placeholders in fenced block templates. The syntax is:

```
{name}                                    — raw value, output as-is
{name:[option1|option2|option3]}          — enumerated options (pick one)
{name:(casing)}                           — with casing hint
{name:[option1|option2]:(casing)}         — options and casing
```

Casing hints: `titlecase`, `lowercase`, `kebabcase`. No hint means output the raw value.

A placeholder never wraps across lines — long example text stays on one line inside its braces. The conventions lint's templated-fence ratchet classifies single-line placeholders only, so a wrapped one silently evades the pin count.

Each part is optional — use only what's needed for clarity.

**Conditional directives** for branches that render differently based on state:

```
@if(condition) truthy content @else falsy content @endif
```

Example: `@if(has_discussion) {topic}.md [{status:[in-progress|completed]}] @else [no discussion] @endif`

**Loop directives** for iterating over collections:

```
@foreach(item in collection)
  • {item.name} ({item.status})
@endforeach
```

Example with filter: `@foreach(inv in investigations.files where status is in-progress)`

**When to use placeholders vs concrete examples:** Placeholders work well for structural templates (tree displays, status blocks) where each field has a clear source. Selection menus should use concrete examples instead — they encode conditional logic (which verb maps to which state) that placeholders obscure.

In model-instruction fenced blocks (not user-facing templates), the anonymous enumeration shorthand `{option1|option2}` is acceptable where a name adds nothing.

### List Display

Two styles, chosen by whether items have sub-detail.

**Bullets (`•`)** — flat list under a shared heading. Each item is self-contained on one line with no child data.

```
⚑ Discussions not ready for specification:
  These discussions are still in progress and must be completed
  before they can be included in a specification.

  • auth-flow
  • data-model
```

**Tree (`└─`)** — items with child data: descriptions, statuses, sources, blocking reasons, or any detail that belongs to the parent item. Branch glyphs are positional: `├─` for non-final children, `└─` for the last child only. A tree hangs directly off its heading line — the header sits flush left, rows indent two columns beneath it, no blank line between the header and the first row; the `├─` head is what reads as attachment. Depth is recursive — child items can have their own branches. **Blank line between each top-level item** — engine trees whose rows carry bodies draw it as a gutter-only `│` line so the rail never breaks. Rows with bodies spell state and provenance as trailing `↳` lines beneath the body (`↳ From gap-analysis`, `↳ Discussing · in session`) rather than a tag column. For numbered lists, show one full entry then `2. ...` to indicate repetition.

```
1. {topic:(titlecase)}
   ├─ Plan: @if(has_plan) {plan_status:[in-progress|completed]} @else [no plan] @endif
   └─ Spec: {spec_status:[in-progress|completed]}

2. ...
```

Richer hierarchies nest naturally:

```
1. {topic:(titlecase)}
   ├─ Spec: {spec_status:[in-progress|completed]} ({extraction_summary})
   └─ Discussions:
      ├─ {discussion} [{status:[extracted|pending]}]
      └─ ...
```

Unnumbered trees follow the same structure:

```
⚑ Plans not ready for implementation:
  These plans have unresolved dependencies that must be
  addressed first.

  Core Features
  └─ Blocked by data-model:data-model-1-2

  Advanced Features
  ├─ Blocked by core-features:core-2-3
  └─ Blocked by auth
```

### Status Terms

Engine-rendered tree rows carry their status as a right-aligned `[term]` column — one shared column per tree, computed against the longest row (`├─ ◐ Menu Management    [researching]`). Rows that carry a body (summaries, provenance) skip the column and spell their state on a trailing `↳ State` line instead — see List Display. Square brackets `[term]` are also the form everywhere a column can't exist: plain list rows (selection sub-views, completed pickers, inbox items) and prose references. Menu options carry status as an italic metadata tail — see Menus. Phase header count summaries use parentheses `(N completed, M pending)`. Never dash-separated.

**Which register applies is decided by the fence, not by taste.** Demoted content — status, provenance, the note under a row — reads italic in a menu and takes `↳` inside a display, because markdown emphasis inside a code fence renders as literal asterisks. A display that wants italics is a display that should not be fenced (`DISPLAY: proposed task`, `DISPLAY: finding`); a display that needs columns or a tree keeps its fence and its `↳`.

Core vocabulary: `in-progress`, `completed`, `ready`, `extracted`, `pending`, `reopened`, `promoted`. Discussion Map uses `pending`, `exploring`, `converging`, `decided`, `deferred`. Phase-specific terms are fine; the tree column and an inline bracket form never mix on one line.

### Callout Flag

Advisory and gating messages inside code blocks use a `⚑` prefix to visually separate them from data. The flag sits at 2-space indent (aligned with tree rows). Multi-line callouts wrap at the display width and align continuation lines under the text (4-space, no flag), as in the example — never hand-wrapped at a fixed column.

```
  ⚑ Pending discussion topic(s) from research remain.
    Consider starting these before specification.
```

"Not ready" blocks use the same flag on their heading line, with the explanatory text 2-space indented beneath:

```
⚑ Discussions not ready for specification:
  These discussions are still in progress and must be completed
  before they can be included in a specification.
```

**Blocked states render red — advisory callouts stay plain.** A message meaning *you cannot proceed* (a terminal entry blocker, a conclusion blocked on an unmet condition) emits in its own `properties` fence: the `⚑` first token renders turquoise, everything after it red, and `properties` is the one highlighter that never tokenises English, so the message stays uniform whatever words it contains. One logical line, flag at column zero, no hard wrapping — a wrapped continuation would restart the per-line colouring mid-sentence, while the renderer's own soft-wrap keeps it intact. Guidance (what to do about it) travels separately as a markdown signpost beneath the fence, where it reflows. A warning or suggestion the user may act on or ignore is not a blocked state — it keeps the plain form above, so red stays rare enough to mean something. Engine blockers build through `blocker()` in `domain/render.cjs`; prose-authored blockers mirror the same shape.

### Content Dividers & Frames

Inside a single DISPLAY/code block, `── {Title} ──` dividers separate grouped content — the epic dashboard's stage dividers (left-anchored, filled to the content width). They are content dividers, not step markers — engine-drawn, no signpost pairing.

**The fence is the frame.** Artefact content — a proposed diff, spec-bound prose, anything the user is approving as the thing itself — is framed by its own fenced block, never by drawn borders: a ` ```diff ` fence for change content (colouring keys on column-0 `+`/`-` markers; context lines carry a leading space), a plain code block for prose. Narration stays outside the fence. Hand-drawn boxes never frame artefact content — prose cannot know the terminal width, while fences re-flow (the sanctioned boxes — engine DISPLAY titles, the banner — are chrome, not frames around content).

### Cross-Plan References

Use colon notation to reference a task within a plan: `{plan}:{internal_id}`.

```
  · advanced-features (blocked by core-features:core-2-3)
```

Reads as: "advanced-features is blocked by task core-2-3 in the core-features plan."

### Key / Legend

Separate code block (engine snapshots compose the Key into the same DISPLAY block, beneath the display it explains). Categorized. Em dash (`—`) separators. **No `---` separator before the Key block.** Only show statuses that appear in the current display. **Blank line between categories.**

```
Key:

  Plan status:
    in-progress — planning work is ongoing
    completed   — plan is done

  Spec status:
    in-progress — specification work is ongoing
    completed   — specification is done
    promoted    — promoted to cross-cutting work unit
```

### Menus / Interactive Prompts

Rendered as markdown (not code blocks). An opening `· · · · · · · · · · · ·` dot rule sits above the menu — **never a closing rule**: output stops for the user's response, so their own input closes the block more definitively than a drawn line could. A question or contextual label opens the menu, followed by a blank line, then the options — always; the blank line is what marks the label as a label. A label-less selection menu carries the prompt as a trailing `Select an option:` line after the options instead — never both. Verb-based labels for selection menus.

**The label carries the decision glyph.** A short plain label (≤60 characters, no markup, no template placeholders) is wrapped as `**`◆ Label`**` — bold inline code, so it renders blue; `◆` marks a decision point (squares are structure, the diamond is the one place the user must act). A longer label, or one carrying its own emphasis, code spans, or placeholders that could expand past the ceiling, stays plain prose above the options — markup cannot nest inside the glyph span. Engine-rendered menus apply this rule in `surfaces.cjs`; prose-authored menus mirror it by hand.

**A yes/no gate asks its question.** When a menu's answer is yes/no (or yes/skip, yes/back — consent shapes), its glyphed label is a short question: `**`◆ Proceed?`**`, `**`◆ Mark it completed?`**`. When the situation needs explaining first, split it — the statement stays as plain prose context, a blank line, then the glyphed question, so the diamond rides the ask rather than the information:

```
· · · · · · · · · · · ·
Cancelling **Auth Flow** in discussion will mark it as cancelled — it can be reactivated later.

**`◆ Cancel it?`**

**`y/yes`** → Confirm cancellation
**`n/no`**  → Return to menu
```

Engine-side the split is `menu(label, options, { question })` — the statement label stays context (never auto-glyphed), the question takes the diamond. Statement-headed *route* menus (several destinations, no yes to answer — the off-topic reroute family, resume continue/restart gates) keep their statement: a question is the rule for consent gates, not for every menu. The same statement/question split serves any menu whose opening needs both guidance and an ask — a conversational instruction line, a blank line, then the glyphed question (the working-set menu's shape).

**Option types** — menus contain two kinds of option:

- **Command option** (explicit): A discrete input the user types verbatim. Key and word share one code span: **`y/yes`**, **`s/single`**, **`a/auto`** — the user may type either side. The shorthand is the first letter of the word; if two options in the same menu share a first letter, use the second letter for the conflicting option (e.g., **`a/approve`** and **`b/abort`**). The conditional branch uses the command value (e.g., `#### If \`yes\``); inline references to a key elsewhere in prose use the same merged span (`` `b/back` ``).
- **Prompt option** (implicit): The user responds naturally rather than issuing a command. Formatted with plain bold text (no backticks): **Keep going**, **Comment**, **Ask**. The conditional branch uses the label in lowercase (e.g., `#### If keep going`); where the bare label reads awkwardly as a condition, a descriptive form naming the intent is equally valid (`#### If the user provides feedback` for a **Provide feedback** option). Limit to one prompt option per menu to avoid ambiguity — since routing is intent-based, multiple prompt options would be hard to distinguish. A second prompt option is permitted only when the two intents are disjoint enough that natural responses cannot be confused and the flow genuinely routes on both (the implementation gate menus' **Ask** and **Comment**).

**Option lines are bare, not bulleted, and the arrow is the separator**: `**`k/word`** → Label`. Arrows align into one column across the whole menu — pad with spaces *outside* the closing `**`, measured against the widest key in the block (blank lines inside the menu don't reset the column). A label may still carry ` — sub-detail` after its opening verb — **metadata tails render italic**: `— *feature, ready for specification*`, `— *research completed*`. The italics mark the tail as metadata against the plain label; alert cues (`· input moved`, `blocked by …`) and `(recommended)` markers stay plain so they read as flags, not state. Options stay on one authored line — never hand-wrap a label across lines; the renderer soft-wraps long lines itself.

**Ordering — command options first, prompt option last.** Mixed menus list all command options before the (single) prompt option. The command set reads as a discrete vocabulary first; the prompt option then sits at the end as the "or respond naturally" tail.

**Prompt option descriptions direct the user's response, not Claude's action.** For a command option, the option *is* the user's input — describing what Claude will do reads naturally (`**`y/yes`** → Conclude investigation`). For a prompt option, the user's *natural response* is the trigger — the description should tell them what to say. The format is `**{prompt label}** → {user-directive description}`.

- ✗ `**Keep going** → Continue exploring` — describes Claude's action; ambiguous (should the user type "keep going" or respond naturally?)
- ✓ `**Keep going** → Tell me what else to explore` — directs the user's response

Sister patterns: `**Name them** → Tell me which to re-add`; `**Adjust** → Tell me what to change`. When the description starts with "Tell me…" or names the user's expected response, it lands correctly. When it starts with a verb describing Claude's action, it lands wrong.

**Mixed prompt** — command and prompt options together:

```
· · · · · · · · · · · ·
**`◆ Investigation complete. Ready to conclude?`**

**`y/yes`**    → Conclude investigation
**Keep going** → Tell me what else to explore
```

**Selection menu** — use concrete examples showing verb-to-state mapping. Numbered items use the same format as command options so the menu has a unified visual style:

```
· · · · · · · · · · · ·
**`1`** → Create "Auth Flow" — *completed spec, no plan*
**`2`** → Continue "Data Model" — *plan in-progress*
**`3`** → Review "Billing" — *plan completed*

Select an option (enter number):
```

**Single source of truth** — items appear once, inside the menu. Do not display items as a numbered list (or tree) above the menu and then re-list them as numbered options below. The menu IS the display. Sub-detail (statuses, sources, plan progress) goes inline on each option using `[term]` or ` — sub-detail`. The exception is when items have rich multi-line child detail (blocking reasons, dependency chains) that genuinely doesn't fit a one-line option — in that case keep the tree display and reference it from a short prompt below, but this should be rare.

**Yes/no prompt:**

```
· · · · · · · · · · · ·
**`◆ Proceed?`**

**`y/yes`**
**`n/no`**
```

**Multi-choice prompt:**

```
· · · · · · · · · · · ·
**`◆ What scope would you like to review?`**

**`s/single`** → Review one plan's implementation
**`m/multi`**  → Review selected plans
**`a/all`**    → Review all implemented plans
```

**Meta options** in selection menus get italic descriptions — the menu metadata register:

```
**`3`** → Unify all into single specification
   *All discussions combined into one specification.*
   *Existing specifications are incorporated and superseded.*
```

### Auto-Select

When only one actionable item exists:

```
Automatically proceeding with "{topic:(titlecase)}".
```

### Block / Terminal Messages

When a phase can't proceed — the phase title, the blocking fact in the red register (see Callout Flag → blocked states), then guidance as a signpost:

```
# **`■ Planning Overview`**
```

```properties
⚑ No specification found for this topic
```

> The planning phase requires a completed specification.

Engine entry gates emit this shape as two sections (`DISPLAY: entry blocker` + `DISPLAY: blocker guidance`); prose-authored terminal messages mirror it by hand.

### Bullet Characters

Use `•` for all bulleted lists (sources, files, not-ready items, etc.).

Within a numbered item, `·` marks quiet sub-detail: a wrapped summary paragraph or a subsection header (`· Edge cases`) whose tree hangs beneath it. Continuation lines always align under the text — never column zero.

### Spacing Rules

**Between blocks**: One blank line after the phase title before any content (code block, blockquote, or step marker). No `---` separators between code blocks (overview → not-ready → key → menu) — just natural block separation.

**Inside code blocks**: One blank line between:
- Each numbered tree item
- Section headings and their content
- Key categories

## State Ownership (MANDATORY)

Workflow state is engine-owned, always. Durable state (gate decisions, approvals, tracking, lifecycle) lives in the work-unit manifest; ephemeral session machinery lives in the engine's per-topic `state.json` under the cache. Skills and agents never write or read file frontmatter, and never encode state in prose or headings — markdown files carry content only (findings, drafts, reports, feedback notes). The sole exception is the local-markdown output format's task files, whose frontmatter is that format's declared backend. When a new feature needs state, give it a manifest field or an engine verb — never a file marker.

## Structural Conventions (MANDATORY)

These are hard rules, not suggestions. All skill files (entry-point and processing) MUST follow these conventions exactly.

### Stop Gates

Use `**STOP.**` (bold, period). This is the only pattern for user interaction boundaries.

Two categories:

**Interaction stop** — waiting for real user input to continue:
```
**STOP.** Wait for user response.
**STOP.** Wait for user response before proceeding.
```

**Terminal stop** — skill is done, nothing to process:
```
**STOP.** Do not proceed — terminal condition.
```

Never use `Stop here.`, `Command ends.`, `Wait for user to acknowledge before ending.`, or other variations.

### Heading Hierarchy

- **H1** (`#`): File title — one per file, at the top. Reference files carry an H1. Processing-skill backbones open with a title H1; entry, navigation, and phase-entry SKILL.md files carry none (frontmatter and the one-liner open the backbone)
- **H2** (`##`): Steps and major sections (`## Step N: {Name}`, `## Notes`, `## Instructions`)
- **H3** (`###`): In flow files, sub-steps within early setup steps only (`### Step 0.1: Boot`). Non-flow reference files — templates, question banks, agent-prompt content, API documentation — may use H3 freely for content organisation
- **H4** (`####`): Conditional routing only (`#### If {condition}`, `#### Otherwise`)

### Step Numbering

Sequential: `## Step 0`, `## Step 1`, `## Step 2`, etc.

- **Step 0** hosts initialisation; `workflow-start` runs migrations and the knowledge gate via `engine boot`
- Steps are separated by `---` horizontal rules
- Each step completes fully before the next begins
- User-facing step markers (see Display & Output Conventions → Step Markers) use names only — no numbers. Only steps that earn chrome carry them; silent steps produce no user-facing output
- When consecutive steps always run together — nothing routes into the later step and no gate sits between them — they are one step; author them as one

### Sub-Steps (Early Setup Steps Only)

Early setup steps — Step 0 in particular — bundle multiple discrete pre-disclosure actions that all run unconditionally: running migrations, gating on prerequisites. These actions must execute inline (they are not progressive-disclosure work), but each needs its own routing target so conditional branches inside one action can route to the next action by name without duplicating shared content downstream.

Decompose these steps into **sub-steps** using H3 decimal numbering:

```
## Step 0: Initialisation

### Step 0.1: Boot

#### If `migrations.changed` is `true`
[diff review + summary + confirm gate]
→ Proceed to **Step 0.2**.

#### Otherwise
[up-to-date display]
→ Proceed to **Step 0.2**.

### Step 0.2: Knowledge Gate
[branch on the boot response: not-ready → terminal stop; ready → proceed]
→ Proceed to **Step 1**.
```

Rules:

- Heading format: `### Step {parent}.{sub}: {Name}` (e.g., `### Step 0.1: Boot`)
- Sub-steps are **unconditional, sequential** units — they always run when the parent step runs. Use H4 `#### If` *inside* a sub-step for branching; the branches route to the next sub-step by name
- Each sub-step is a valid routing target: `→ Proceed to **Step 0.2**`
- The final sub-step routes to the parent's next top-level step: `→ Proceed to **Step 1**`
- **Sub-steps are reserved for early setup steps** (typically Step 0) where content must run inline before progressive disclosure begins — migrations must complete before anything else, knowledge check gates the entire pipeline
- **Later steps must use reference files and progressive disclosure instead.** `Load **[reference.md](...)**` is the mechanism for decomposing later-step content, not sub-steps

### Conditional Routing

Use H4 headings for if/else branches within a step:

```
#### If scenario is "no_specs"
{content}

#### If scenario is "has_options"
{content}
```

**Nested conditionals** — use bold text for conditionals inside an H4 block:

```
#### If yes

1. Shared setup steps...

**If work_type is set** (feature, bugfix, or epic):

{branch content}

**If work_type is not set:**

{branch content}
```

**Avoid double-nesting** — if a bold conditional would contain further bold conditionals, flatten by combining conditions:

```
**If work_type is not set and other discussions exist:**
...
**If work_type is not set and no discussions remain:**
...
```

**Prelude and post-STOP exception** — at file prelude (above any `## A.` lettered section) and immediately after STOP-gate responses, bold `**If ...:**` is acceptable for top-level conditionals. H4 in these positions visually competes with the lettered section headings that follow, and disrupts the prelude flow. Inside a lettered section's body, top-level conditionals stay H4.

```
**Trigger checklist** — evaluate after every commit:
- □ Meaningful content committed?
- □ All prior reviews drained?

**If all checked:**

→ Proceed to **A. Dispatch**.

**If any unchecked:**

No dispatch needed. Continue with the session loop.
```

Rules:
- Never use else-if chains — each condition gets its own `#### If` heading
- Lowercase after "If" (e.g., `#### If completed_count == 1`)
- Use `#### Otherwise` for else branches
- Use backticks around specific values, variables, and statuses in H4 headings (e.g., `` #### If `STATUS` is `clean` ``, `` #### If work type is `feature` ``). Natural language conditions stay plain text (e.g., `#### If no plan provided`)
- Use "and" between conditions, not commas
- Drop implied conditions (e.g., if Step 2 already gates on `completed_count >= 1`, Step 3 doesn't need to repeat it on every branch)
- H4 for top-level conditionals inside lettered sections, bold text for nested or for prelude/post-STOP positions — never use H5/H6 for conditional nesting
- If double-nesting would occur, flatten by combining the parent and child conditions into a single bold conditional
- Every conditional branch must include its own routing instruction (`→ Proceed to` or `→ Return to`). Never place routing outside a conditional expecting it to apply to all branches — each branch is self-contained. Even if multiple branches route to the same destination, each states it explicitly.

### Command Preludes

Any decision an invocation depends on — a flag choice, a derived parameter, a value to substitute — is stated **before** the fenced command, never after. A step-executing reader runs the command when it reaches it; guidance placed below the fence arrives too late.

### Navigation Arrows

Use `→` for flow control between steps or to external files:

```
→ Proceed to **Step 4**.
→ Proceed to **Step 7** to invoke the skill.
→ Load **[file.md](file.md)** and follow its instructions.
```

### Reference File Headers

Reference files loaded by skills use this header pattern:

```
# Title

*Reference for **[parent-skill](../SKILL.md)***

---
```

Attribution variants by loading context:

- **Loaded by another reference file** (not the backbone): attribute to the loading file — `*Reference for **[spec-review](spec-review.md)***`. A short context clause may follow the link (`— loaded at phase start`).
- **Shared references** (`workflow-shared/references/`, no parent SKILL.md): use the shared form — `*Shared reference. Loaded by {callers}.*` or `*Shared reference for all workflow skills.*`
- **Multi-consumer content files** (output-format per-concern adapters loaded by several skills): no attribution line — a single-parent attribution would be inaccurate. The format contract documents this exemption.

### Critical / Important Markers

Use bold labels with colons for emphasis levels:

```
**CRITICAL**: This guidance is mandatory.
**IMPORTANT**: Use ONLY this script for discovery.
**CHECKPOINT**: Summarize progress before continuing.
```

### Zero Output Rule

Entry-point skills that invoke processing skills use this exact blockquote to prevent narration:

```
> **⚠️ ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.
```

### Auto-Mode Gates

Per-item approval gates can offer `a/auto` to let the user bypass repeated STOP gates. This pattern is used in implementation (task + fix gates), planning (task list approval + task authoring + review findings), and specification (construction + review findings).

**Manifest tracking**: Gate modes are stored in the manifest via `engine manifest` (`gated` or `auto`) — every gate, no exceptions. This ensures they survive context refresh.

**Behavior when `auto`**: Content is always rendered above the gate check (so both modes see identical output). Auto mode proceeds without a STOP gate. Use a rendering instruction + code block for the one-line announcement:

```
> *Output the next fenced block as a code block:*

\```
Task {M} of {total}: {Task Name} — authored. Logging to plan.
\```
```

**Lifecycle**:
- Default: `gated` (set in manifest on creation)
- Opt-in: user chooses `a/auto` at any per-item gate → manifest updated via `engine manifest` before next commit
- Reset: entry-point skills reset gates to `gated` at session start — fresh invocation or resume. Auto opt-in is session-scoped, never carried across sessions
- Context refresh: read gate modes from manifest and preserve (a refresh continues the same session — no reset)

**Menu option format**: Add between the primary action and secondary options:
```
**`a/auto`** → Approve this and all remaining {items} automatically
```

**Re-loop safety cap**: When auto-mode enables automatic re-analysis loops, cap at 5 cycles before escalating to the user. This prevents infinite cascading. At escalation, a convergence analysis diagnostic (shared reference at `skills/workflow-shared/references/convergence-analysis.md`) reads prior cycle tracking files and presents what's resolving, what's recurring, and a trend assessment to inform the user's decision.

### Rendering Instructions for Ask Blocks

When a step asks the user a question, wrap it in a rendering instruction and code block — don't use bare `Ask:` labels:

```
> *Output the next fenced block as a code block:*

\```
What's on your mind?

- What idea or topic do you want to explore?
- What prompted this - a problem, opportunity, curiosity?
\```

**STOP.** Wait for user response before proceeding.
```

## Skill File Structure (MANDATORY)

All skills (entry-point and processing) use a backbone + reference file pattern. The backbone (SKILL.md) is always loaded and reads like a table of contents. Reference files contain step detail, loaded on demand via Load directives.

### Backbone Structure

```
Frontmatter
One-liner purpose statement
Workflow context table
"Stay in your lane" instruction
---
## Instructions — Load directive → framework.md
---
Step 0: Run Migrations (always inline)
---
Step 1: {Name}
Load directive → reference file
→ On return, proceed to Step 2.
---
Step 2: {Name}
Load directive → reference file
```

**Stays inline:** Migrations (Step 0), simple routing conditionals (a few lines), frontmatter.

### The Framework Load

Every flow skill opens its `## Instructions` section with one line and nothing else:

```markdown
## Instructions

Load **[framework.md](../workflow-shared/references/framework.md)** and follow its instructions as written.
```

`framework.md` is pure composition — it loads the conventions that hold for every skill (`instructions.md`, `casing-conventions.md`, `voice.md`) and carries no content of its own. Anything universal joins that list rather than being copied into skill heads. Never restate a framework rule inline in a skill: a second copy is a second source of truth, and the copies drift.

Skills with a `## Resuming After Context Refresh` protocol re-load `framework.md` by name in its first numbered step, alongside re-reading the skill file. A compaction summary keeps conclusions and drops the instructions that produced them, so anything held only by reference evaporates unless the recovery path names it.

Capture skills (`workflow-log-*`) are exempt — they are deliberately structureless, with no steps, no references, and no gates.

**Gets extracted:** User interaction sequences, display/output formatting, handoff templates, discovery parsing, analysis logic, routing logic with significant conditional content.

### Load Directive Format

```markdown
## Step N: {Step Name}

Load **[name.md](references/name.md)** and follow its instructions as written.

→ On return, proceed to **Step N+1**.
```

Rules:
- No arrow (`→`) before the Load line — it's the step's content, not a routing instruction
- Bold the markdown link: `**[name.md](path)**`
- `→ On return, proceed to` is the footer after a Load directive, separated by a blank line — the loaded reference runs to completion (its STOP gates and loops included) before the proceed applies. A bare `→ Proceed to` here reads as the immediate next action and overshoots the reference
- When a `**STOP.**` gate or a bold conditional sits between the Load directive and the routing line, the routing is keyed to the user's response or the branch, not the return — those use the bare `→ Proceed to`
- The final step has no routing footer (it's terminal)
- A footer governs only the reference's bare `→ Return to caller.` exits — never the branches the reference routes itself (see Navigation & Return Patterns → backbone escape). Where every exit routes to a named step, no branch is left for a footer to serve and naming one would name a step that never runs: the footer instead defers, `→ On return, proceed as the reference directed.` A step is never left with no footer at all — silence reads as the end of the step, and the next heading gets treated as the fall-through
- Within reference files routing to other reference files, use `→` before Load (it IS a routing instruction in that context)

**Parameter passing**: When a shared reference needs context from the caller, append `with` followed by named assignments. String literals and variable values are both backtick-wrapped; variables use curly brace placeholders:

```
→ Load **[name.md](path)** with param = `literal`, other = `{variable}`.
```

### Loading, Invoking, and the Bridge

Three mechanisms move a flow forward; never blur them:

- **Loading a reference** reads a file into the running context — progressive disclosure, nothing more. No parameters pass mechanically: state the variables in prose before the Load (`with topic = `{topic}``) and the loaded file references them, already in context.
- **Invoking a skill** is a Skill tool call at a boundary (entry → process, phase end → bridge). It adds the skill's instructions to the running context — **nothing is cleared**. Two argument forms, by what the skill declares:
  - **Positional arguments** (the skill declares `$0`/`$1`/… — entry skills, the bridge): show the literal command — ``Invoke `/workflow-bridge {work_unit} {completed_phase}`.`` When an argument is conditional, resolve it in prose first — absence as the literal `none` where the receiving skill declares that convention — then show one literal command with every argument in place.
  - **Handoff context block** (process-skill handoffs): an imperative **before** the payload fence, the fence as pure content, nothing after it (a skill-invoking exit is terminal — no STOP, no routing):

    ```
    Invoke the **workflow-x** skill (Skill tool) with the next fenced block as its arguments. Do not act on the gathered context until its instructions load — the skill defines the process.
    ```

  Never place the imperative after the fence (it arrives too late — the command-prelude rule), and never inside it (a fence is payload; an instruction buried there gets printed, not executed).
- **The bridge** (`workflow-bridge`) owns the only context-clearing handoff: phase → phase via plan mode. Within a phase, context is never cleared. The bridge's plan content is a verbatim template — see the bridge skill; enrichment poisons the fresh context it is designed to feed.

### Reference File Structure

```markdown
# {Step Name}

*Reference for **[skill-name](../SKILL.md)***

---

{content}
```

- Header matches the step concept, not the filename
- Italic attribution line links back to the parent SKILL.md
- Horizontal rule separates header from content

### Navigation & Return Patterns

Skill files form a call stack. The backbone (SKILL.md) loads reference files via Load directives. Reference files may load other reference files. Two verbs control all movement through this stack:

- `→ Proceed to` — forward movement (next step, next section)
- `→ Return to` — backward/upward movement (back to caller, back to earlier section, up to backbone)

No other verbs — never `→ Go to`, `→ Jump to`, `→ Skip to`, `→ Continue to`, `→ Enter`. No adverbs — `→ Proceed to`, never `→ Proceed directly to`.

#### Forward (within a file)

| Instruction | Context |
|---|---|
| `→ Proceed to **Step N**.` | Next step in the backbone |
| `→ Proceed to **B. Section Name**.` | Next lettered section in a reference file |
| `→ On return, proceed to **Step N**.` | Footer after a Load directive — applies when the loaded reference returns (see Load Directive Format) |


#### Backward (within a file)

| Instruction | Context |
|---|---|
| `→ Return to **A. Section Name**.` | Earlier lettered section in the same reference file |

Internal routing (both forward and backward) uses bold text, never links.

#### Exiting a reference file

This is the critical decision. Use this flowchart:

```
How should this reference file exit?
│
├─ Is the final action invoking a processing skill?
│  └─ YES → Terminal. No routing instruction needed.
│
├─ Are you going back to whoever loaded this file?
│  │
│  ├─ Just returning (caller's next line takes over)?
│  │  └─ → Return to caller.
│  │
│  └─ Returning to a specific section in the caller?
│     └─ → Return to caller for **B. Section Name**.
│
└─ Are you routing to the backbone (not your caller)?
   │
   ├─ To the backbone generally?
   │  └─ → Return to **[the skill](../SKILL.md)**.
   │
   └─ To a specific backbone step?
      └─ → Return to **[the skill](../SKILL.md)** for **Step N**.
```

**`→ Return to caller.`** is the default exit. It works identically whether the caller is the backbone or another reference file — you never need to check who loaded you. The caller's next routing instruction handles onward sequencing.

**Backbone escape** (`→ Return to **[the skill](../SKILL.md)**`) is for two scenarios:
1. **Short-circuiting the call stack** — a reference file loaded by another reference file needs to skip past its caller and land on the backbone directly. Like an exception bubbling up past intermediate frames.
2. **Directing to a specific backbone step** — different conditional paths within a file need to route to different backbone steps (e.g., one path → Step 4, another → Step 5). The caller's single `→ Proceed to` line can only go one place, so the file overrides it. This applies regardless of whether the caller is the backbone or another reference file.

#### Exit pattern summary

| File type | Exit pattern |
|---|---|
| Single-exit reference file | `→ Return to caller.` |
| Multi-exit, all paths resume at caller | Each path ends with `→ Return to caller.` |
| Multi-exit, paths need different backbone steps | Each path ends with `→ Return to **[the skill](../SKILL.md)** for **Step N**.` |
| Terminal (invokes processing skill) | No routing instruction |

#### Formatting rules

- Bold the target: `**Step N**`, `**B. Section Name**`, `**[the skill](../SKILL.md)**`
- Links only for backbone escapes (`**[the skill](../SKILL.md)**`). All other routing is linkless — `→ Return to caller.` has no link, internal routing has no link.
- Every conditional branch must include its own routing instruction. Never place routing outside a conditional expecting it to apply to all branches — each branch is self-contained. Even if multiple branches route to the same destination, each states it explicitly.

### Internal Reference File Sections

Complex reference files use lettered headings to organise sequential sections, avoiding collision with backbone step numbers:

```markdown
## A. First Section

...
→ Proceed to **B. Second Section**.

## B. Second Section

...
→ Proceed to **C. Third Section**.
```

Simple reference files use named sections (`## Seed Idea`, `## Current Knowledge`) without letters.

### Reference File Naming

| Name | Purpose |
|------|---------|
| `gather-context.md` | User interview / context gathering questions |
| `invoke-skill.md` | Handoff to processing skill |
| `route-scenario.md` | Scenario routing (for skills with branching) |
| `validate-{thing}.md` | Pre-flight validation (plan exists, spec completed, etc.) |
| `display-{variant}.md` | Display outputs (for skills with multiple displays) |
| `analysis-flow.md` | Multi-step analysis logic |
| `confirm-and-handoff.md` | Confirmation prompt + skill invocation combined |

Not every skill needs all of these.

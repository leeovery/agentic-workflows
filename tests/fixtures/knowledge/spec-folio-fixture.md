# Specification: Template Authoring System

## Specification

### Overview

Folio is a template management and rendering service. The existing system provides:

- **Template model**: `name`, `type` (enum: `twig` | `pdf-fields`), `state` (active/inactive), `description`, tags
- **Version model**: `content` (longText — Twig HTML string or base64 PDF), `schema` (JSON — Laravel validation rules), `state` (draft/published/unpublished/archived), `is_current`, `name`
- **TemplateManager**: dispatches to type-specific renderers via registry pattern
- **TwigRenderer**: sandboxed Twig 3.x, returns HTML string
- **PdfFieldsRenderer**: decodes base64 PDF, pdftk fillForm → flatten → compress, streams binary PDF
- **SDK** (Saloon-based): `Folio::make()->baseUrl()->token()->build()` — fluent API for templates, versions, rendering
- **V1 API**: full CRUD for templates/versions, render by template or version, state transitions (publish/unpublish/archive/activate/deactivate). Sanctum token auth with abilities (ViewTemplates, CreateTemplates, UpdateTemplates, etc.)
- **Architecture patterns**: Actions, DTOs via spatie/laravel-data, query builders, state machines

The system currently assumes template content already exists — there is no way to create or edit templates through a UI. This specification defines the **template authoring system**: a Nuxt-based SPA that enables visual template creation and editing, supported by new backend API routes and a new template type.

### Template Type System and Data Model

#### Type System

Type determines which rendering pipeline processes the template. Three types follow a `pdf-{method}` naming pattern for PDF variants:

| Type | Stored content | Rendering pipeline | Output |
|------|---------------|-------------------|--------|
| `twig` | Any text with Twig syntax (HTML, plain text, etc.) | TwigRenderer → returns string | Text/HTML — whatever was authored |
| `pdf-html` | HTML with Twig syntax | TwigRenderer → Gotenberg → returns PDF | PDF |
| `pdf-fields` | Base64 PDF with form fields | PdfFieldsRenderer → fills fields → returns PDF | PDF |

- `twig` — format-agnostic text template. The renderer fills Twig variables and returns the result. Folio doesn't care if it's HTML, plain text, or anything else.
- `pdf-html` — HTML-authored PDF. New type. Content is HTML/Twig, rendered through Twig then converted to PDF via Gotenberg.
- `pdf-fields` — legacy PDF with form fields. Existing type, unchanged. Content is base64 PDF, rendered by filling form fields via pdftk.

The UI presents friendly labels ("Email / HTML template", "PDF document", "Upload PDF with form fields") and maps to internal types. Type names are plumbing, not user-facing.

#### Data Model Changes

**No design field.** The `content` field on Version remains the source of truth. No separate editor state column.

**Schema unchanged.** Laravel validation rule arrays as JSON on Version:

```json
{
  "first_name": ["required", "string", "min:1", "max:255"],
  "order_number": ["required", "string"],
  "has_policy": ["required", "boolean"]
}
```

The same schema format works for all three template types. Fields are placed as Twig variables (`{{ first_name }}`) in content for `twig` and `pdf-html`, or as form field names for `pdf-fields`. The schema validates the data, not the placement.

**New `design_meta` nullable JSON column on Version.** Stores editor/design-time field metadata — labels, UI types, ordering, placement status. Nullable: null for SDK-created versions, populated by the editor on first save. The V1 API and renderer ignore `design_meta` entirely.

Structure — array of objects:

```json
[
  { "name": "first_name", "label": "First Name", "type": "string", "required": true, "min": null, "max": 255, "placed": true },
  { "name": "order_id", "label": "Order ID", "type": "string", "required": true, "min": null, "max": null, "placed": false }
]
```

- `name` — field identifier, matches the `{{ }}` variable in content and the key in schema
- `label` — human-readable display name for the palette
- `type` — UI type hint (string, number, email, date, boolean) for the palette dropdown. Not the Laravel validation type.
- `required` — whether the field is required
- `min` / `max` — value/length constraints. Nullable.
- `placed` — whether the field has been inserted into the content

Array order defines palette ordering. The SPA reads/writes this on save. These validation-related fields (`required`, `min`, `max`) are the design-time representation of what gets written to `schema` as Laravel validation rules. On save, the SPA generates the corresponding schema rules from these values.

#### design_meta for pdf-fields

For `pdf-fields`, design_meta follows the same array-of-objects shape but with type-specific semantics:

- `name` — PDF form field name (as extracted via `pdftk dump_data_fields`)
- `label` — human-readable display name for the palette
- `type` — mapped from the PDF form field type: text fields → `"string"` (or `"number"`/`"email"` if user overrides), checkbox → `"boolean"`, choice fields (dropdown/radio) → `"string"`
- `required` / `min` / `max` — user-configured validation, same semantics as other types
- `placed` — **always `true` for pdf-fields**. The concept of "placed" is meaningless when fields are intrinsic to the PDF document; the palette hides the placed/unplaced indicator for pdf-fields templates. Retained in the structure only to keep a consistent shape across all types.

**Reconciliation for pdf-fields drafts**: on draft open, re-run `pdftk dump_data_fields` against the current PDF content. Fields in the PDF but not in design_meta → add with auto-detected defaults. Fields in design_meta but not in the PDF → mark as "unplaced" (preserved, user may re-add by updating the PDF). Fields in both → keep existing design_meta. This mirrors the `twig`/`pdf-html` reconciliation pattern but sources the "fields in document" from pdftk extraction rather than `{{ }}` scanning.

**Summary of model changes:**
- Add `pdf-html` to the TemplateType enum
- Add nullable `design_meta` JSON column to the Version model
- No other schema changes

### Rendering Pipeline

#### Three Pipelines

```
twig:       content + data → TwigRenderer → string (HTML/text)
pdf-html:   content + data → PdfHtmlRenderer → [TwigRenderer → HTML → Gotenberg → PDF]
pdf-fields: content + data → PdfFieldsRenderer → [pdftk fillForm → PDF]
```

Each type has a registered renderer in TemplateManager. Same interface, same dispatch pattern.

#### Gotenberg — HTML-to-PDF Conversion

`pdf-html` uses Gotenberg for on-the-fly HTML-to-PDF conversion, eliminating the need for coordinate-based annotation or pre-rendered base PDFs.

**Why Gotenberg over alternatives:**
- **Rendering fidelity** — Gotenberg IS Chromium. The browser preview matches the PDF output exactly. Every other option (DomPDF, MPDF, WeasyPrint) has a visible fidelity gap.
- **Performance** — 200-430ms tuned. Well within acceptable range for background rendering (2-3 seconds tolerable).
- **Driver abstraction** — `spatie/laravel-pdf` v2 has a Gotenberg driver. Application code is driver-agnostic — can switch to Browsershot, WeasyPrint, or future alternatives by changing one config line.

**Operational profile:**
- Long-running Go service in Docker/K8s. Port 3000.
- `--chromium-auto-start=true` keeps Chromium warm at boot.
- 6 concurrent conversions per instance (configurable).
- Stateless — horizontal scaling via replicas.
- Health check at `GET /health` for K8s liveness probes.
- Chromium memory leaks mitigated by auto-restart every 100 conversions.
- 512Mi-1Gi RAM per pod.

**Risks acknowledged:**
- Solo maintainer (Julien Neuhart). MIT licensed, forkable.
- Network dependency (app must talk to Gotenberg service). Standard distributed systems concern.
- `spatie/laravel-pdf` v2 driver abstraction provides a migration path if Gotenberg becomes problematic.

#### PdfHtmlRenderer

New renderer registered with TemplateManager. Composes TwigRenderer internally — renders Twig first, sends resulting HTML to Gotenberg. From TemplateManager's perspective, it's just another renderer. The Gotenberg dependency is encapsulated inside the renderer. Uses `spatie/laravel-pdf` v2 as the Gotenberg client.

#### What This Eliminates

Gotenberg's on-the-fly conversion eliminates the entire coordinate annotation system that was initially considered:
- No PDF.js + overlay editor surface for coordinate placement
- No TCPDF overlay + pdftk multistamp renderer
- No coordinate data model (field, page, x, y, width, height, font overrides)
- No two-stage editing pipeline (design then annotate)
- No annotation drift problem (coordinates invalidated when HTML changes)
- No base PDF storage or export pipeline

### Editor Architecture and Component Structure

#### Core Principle

The editor is both a **content editor** and an **annotation tool**. Users edit template text (changing wording in emails, updating copy in letters) *and* insert/manage Twig variables — both are core workflows. HTML typically already exists (from legal, external tools, or previous versions); the editor's job is to display it faithfully and let users modify it.

The **content** (HTML/Twig source string) is the single source of truth. Two surfaces display and edit this content, each with different affordances:

- **Monaco (code view)** — displays and edits the content directly. It's the complete editing surface: any HTML or Twig construct can be written or modified here without constraint.
- **Editable preview** — a rendered projection of the content with inline editing affordances: contenteditable text regions, field chips, click-to-insert. Edits in the preview serialize back to the content. The preview is deliberately limited — it handles text changes, field insertion, and paragraph restructuring within containers, but anything beyond that (structural HTML changes, Twig control structures, layout edits) requires the code view.

Changes in either surface reactively update the other — the content is the source of truth, and both surfaces observe it. The user chooses the view mode (Code / Preview / Split) via a toggle in the header, picking whichever fits the task at hand:

- **Preview** — editable preview only, full width and height. Best for text tweaks and field placement in visual context.
- **Code** — Monaco only, full width and height. Best for structural work and full source access.
- **Split** — side-by-side editable preview and Monaco, 50/50 vertical split. Best when the user wants visual context alongside full editing capability.

#### Layout

```
┌─────────────────────────────────────────────────┐
│  Template Header (name, type, version, status)  │
│  [Preview | Split | Code]          [Fields ☰]   │
├─────────────────────────────────────────────────┤
│                                                 │
│  Editor Surface (full width, full height)       │
│                                                 │
│  Preview mode:  Editable preview fills area     │
│  Code mode:     Monaco fills area               │
│  Split mode:    Preview │ Monaco, 50/50 split   │
│                                                 │
├─────────────────────────────────────────────────┤
│  Footer (save draft, publish, validation)       │
└─────────────────────────────────────────────────┘
```

The view modes are toggled via a segmented control in the header (similar to PHPStorm's markdown editor toggle). See the Core Principle above for when each mode is most useful.

The field palette is accessed via a slide-over triggered by a button in the header. The slide-over provides adequate space for field definitions, placed/unplaced indicators, navigation, and field settings management. This keeps the editor surface maximised at all times — the palette overlays when needed rather than permanently consuming space.

#### Split Mode Synchronization

In split mode, the source string (HTML/Twig content) is the single source of truth. Both surfaces read from and write to the same source:

- **Monaco** edits the source directly (it is a source editor).
- **Editable preview** edits the source via container-level serialization (as defined in Source Mapping).
- **Focus determines leader** — only the focused surface writes. The unfocused surface updates reactively when the source changes.
- **Monaco → Preview**: source changes trigger preview re-render on a short debounce (~300ms idle).
- **Preview → Monaco**: serialized changes write back to the source; Monaco reflects immediately.

No concurrent edit conflict is possible — one surface has focus at a time. No merge logic needed.

#### Shared Shell

The shell component owns the layout, header, footer, field palette slide-over, save/publish actions, and validation state. The editor surface is a slot/component swapped by `template.type`.

**The shell owns:**
- Template header (name, type, version, status)
- View mode toggle (preview / split / code)
- Field palette slide-over (field definitions, placed/unplaced indicators, navigation, field settings)
- Footer (save draft, publish, validation status)
- Save/publish actions and validation logic

#### Polymorphic Editor Surfaces

Two meaningful surfaces:

1. **`twig` and `pdf-html`**: Editable HTML preview + Monaco code editor, togglable or split. Nearly identical UX — the only difference is that `pdf-html` may show an on-demand PDF rendering (via Gotenberg) to confirm layout with `@page` rules and physical positioning that an HTML iframe preview cannot display accurately.
2. **`pdf-fields`**: Read-only PDF viewer (PDF.js) + upload UI. No content editing — the PDF is the content. The authoring workflow is: upload → review detected fields → configure schema → done.

#### Communication

The field palette communicates with the editor surface through a shared composable or Pinia store — field definitions, placed/unplaced state, navigation commands (scroll to field).

The palette is the extension point per type. For `twig`/`pdf-html`, it shows field definitions and navigation. Additional features can be added to the palette without changing the shell or editor surface architecture.

### Editable Preview and Source Mapping

#### Editing Model

The editable preview uses `contenteditable` at the structural container level. The key distinction:

- **Hard boundaries** (structural, never editable as a unit): `<table>`, `<tr>`, `<td>`, `<th>`, `<header>`, `<footer>`, `<main>`, `<aside>`, `<section>`, `<article>`, structural `<div>`s — the document skeleton
- **Editable regions**: the innermost structural container that holds text content. In email HTML, typically `<td>`. In web HTML, could be `<div>`, `<section>`, or any semantic container.

Detection heuristic: walk down the DOM tree. A container becomes an editable region when it contains only text/inline elements and "soft" block elements (`<p>`, `<h1>`-`<h6>`, `<blockquote>`, `<ul>`/`<li>`). If it contains structural elements (tables, layout divs), recurse deeper. This is format-agnostic — works the same for email tables and semantic web HTML.

Within an editable region, users have full freedom: edit text, add/delete/merge paragraphs, apply inline formatting. The structural skeleton outside is protected — that's code view's job.

Container-level (rather than paragraph-level) editing was chosen deliberately. Paragraph-level editing is safer — users can't accidentally merge paragraphs — but it prevents legitimate content operations like splitting, merging, or rearranging paragraphs within a section. Container-level editing allows those operations while still protecting the structural skeleton outside the container.

#### Inline Formatting Toolbar

Fixed toolbar at the top of the preview panel (not floating — floating toolbars tend to get in the way of the editing context). Provides basic inline formatting: bold, italic, underline, font size, possibly text colour. These are native `contenteditable` operations — the browser handles wrapping text in `<strong>`, `<em>`, etc. Not a full word processor — just inline formatting within existing containers.

#### Source Mapping and Serialization

Two-way transform between source HTML and editable preview:

**Source → Preview**: Parse source HTML, identify editable regions, add `contenteditable="true"`, replace `{{ variable }}` with chip elements, replace `{% %}` blocks with visual markers. Inject `data-source-offset` attributes to track where each container maps to in the source.

**Preview → Source**: On content change within an editable region, serialize its innerHTML, convert chip elements back to `{{ }}` Twig syntax, convert visual markers back to `{% %}` syntax, write the result back to the source at the tracked offset position. The container's attributes (styles, classes) are untouched — only inner content is serialized.

Tracking is at the container level, not individual text nodes. A `<td>` with three paragraphs — any change within it serializes the entire inner content back. Simple, robust, and handles paragraph restructuring naturally.

#### Inline Style Handling for New Content

Email HTML relies heavily on inline styles on every element. When a user creates a new paragraph within a contenteditable region (pressing Enter), the browser creates a plain `<p>` without inline styles — visually inconsistent with surrounding styled paragraphs.

Resolution: **style inheritance from siblings**. When a new paragraph is created without inline styles, copy styles from the nearest sibling paragraph in the same container. Automated, invisible to the user, handles the 90% case. Edge cases go to code view. This is a trial decision — it will be evaluated in practice and revisited if insufficient.

### Twig Feature Tiering in Preview

UI support is tiered by complexity. The full Twig feature set is always available in code view (Monaco). The editable preview provides rich UI for common patterns and graceful display for advanced ones.

| Twig feature | Editable preview treatment |
|---|---|
| Variables `{{ }}` | Interactive chips — non-editable inline elements showing variable name, removable via click → x |
| Conditionals `{% if %}` | Visual annotation — subtle coloured border/banner on the conditional section showing the condition. Content inside remains editable. Read-only in preview, edit in code view |
| Loops `{% for %}` | Visual annotation — border/background indicating "loop here". Read-only in preview, edit in code view |
| Everything else (`{% block %}`, `{% include %}`, macros, etc.) | Visual marker — "Twig block here" indicator. Non-editable, edit in code view |

The rule: **nothing is hidden**. Every Twig construct is visible in the editable preview. The parser handles arbitrary Twig syntax for display — identifying `{% ... %}` blocks, wrapping them visually, marking as non-editable. Rich editing UI is layered on top for specific supported patterns (variables, conditionals).

#### Conditional and Loop Edge Cases

- **`elseif`/`else` branches** — each branch is annotated separately with a subtle divider between them, each labeled with its condition (or "else" for the fallback). Content inside each branch remains editable.
- **Nested conditionals** — nested blocks get nested annotations (inner border within outer border). Visual contrast between nesting levels distinguishes them.
- **Structural wrapping** — when a conditional wraps a structural element (e.g., `{% if %}<table>...</table>{% endif %}`), the annotation wraps the entire structure block-level. The structure inside remains non-editable (standard structural protection applies).
- **Mid-paragraph conditionals** — conditionals appearing inside editable text (mid-sentence) render as inline annotations (small pill/bracket markers) rather than block-level borders. Content inside remains editable inline.

The rule: annotations adapt to context — block-level for block wrapping, inline for inline wrapping. The parser detects whether the conditional wraps block or inline content and chooses the appropriate annotation style.

### Field System

#### Field Definition

Per field in the palette slide-over:
- **Name** (required) — the variable name used in `{{ name }}`
- **Label** (optional) — human-readable display name shown on chips, e.g., "First Name" instead of `first_name`
- **Required** — checkbox toggle
- **Type** — dropdown: string, number, email, date, boolean
- **Min/Max length** — simple inputs, shown for string/number types

Maps directly to Laravel validation rules. Advanced validation (regex, custom rules, complex constraints) deferred — can be added through API or extended UI later using the same patterns.

**Type to schema rule mapping:**

| design_meta type | Laravel validation rule | min/max semantics |
|------------------|-------------------------|-------------------|
| `string` | `"string"` | Character length (`min:1`, `max:255`) |
| `number` | `"numeric"` | Numeric value (`min:0`, `max:100`) — allows decimals |
| `email` | `"email"` | Character length |
| `date` | `"date"` | Not applicable (min/max hidden in UI) |
| `boolean` | `"boolean"` | Not applicable (min/max hidden in UI) |

The `required` checkbox prepends `"required"` to the rule array. The min/max inputs in the palette UI are shown only for types where they apply (`string`, `number`, `email`). Field definition UI hides inapplicable controls per type.

#### Palette Display

Each field in the slide-over list shows:
- Name and label (if set)
- Type badge (string, number, etc.)
- Required indicator
- Placed/unplaced status — green dot if placed in document, grey if not yet
- Click → scrolls to placement in editable preview

"Add field" button at the top of the palette.

#### Field Lifecycle

- **Create** — "Add field" button → inline form → fill in details → field appears in palette list
- **Edit** — click existing field → same form, pre-populated → update. Name change updates all placed chips automatically
- **Delete** — remove button → if placed in document, confirmation: "This field is placed N times. Removing it will also remove those placements." → removes from palette and all chips from document
- **Reorder** — drag within palette list. Affects schema field order (sample data form, API docs, etc.)

#### Auto-Detection of Freeform Fields

Users can type `{{ variable_name }}` directly in code view. Handle gracefully:

**Auto-detect and add**: scan source for `{{ }}` patterns, auto-create palette entries for undefined variables with sensible defaults (type: string, required: unchecked, no label). Notification: "Found 2 new variables: `order_id`, `company_name`. Added to field palette."

Auto-detected fields get a subtle "incomplete" indicator in the palette — a nudge to configure type/label/validation, not a blocker. The field is functional immediately.

Two paths to field creation, both valid:
1. **Structured** — define in palette → place in document. Fully configured from the start.
2. **Freeform** — type in code view → auto-detected → appears in palette as incomplete → configure later (or not).

#### Field Scanning Rules

Field scanning matches schema field names as standalone identifiers within `{{ }}` expressions. A field is considered "placed" if its name appears as a root-level variable reference — not as part of a filter, function, or object path:

- `{{ first_name }}` — matches `first_name`
- `{{ first_name | upper }}` — matches `first_name` (filters don't affect the field reference)
- `{{ first_name | default("N/A") }}` — matches `first_name`
- `{{ user.name }}` — matches `user` (the root variable), not `user.name`
- `{{ items | length }}` — matches `items`
- `{{ is_premium ? "Yes" : "No" }}` — matches `is_premium`

The scanning rule: extract the first identifier token from each `{{ }}` expression. This is the field name for matching against schema keys. Filters (`|`), method calls, object access (`.`), and operators don't affect the match — only the root variable matters.

The same scanning logic applies to both auto-detection (adding to palette) and publish validation (verifying all schema fields are placed).

#### design_meta Reconciliation

When entering edit mode on a draft, reconcile design_meta against content:
1. Scan content for `{{ }}` variables
2. Cross-reference with existing design_meta
3. Fields in content but not in design_meta → add with auto-detected defaults, surface as "new"
4. Fields in design_meta but not in content → mark as "unplaced" (preserved, not deleted — user may re-add)
5. Fields in both → keep existing design_meta (user's labels, types, ordering preserved)

This handles V1 API updates, code view edits, and any other source of content/metadata drift. The editor is self-healing on open.

For SDK-created versions opened in the editor (design_meta is null): scan content for `{{ }}` variables, cross-reference with schema keys, infer metadata from schema rules (`["required", "string", "max:255"]` → required: true, type: string, max: 255), generate labels from field names (`order_id` → "Order Id"). Fields shown with "incomplete" indicator.

#### Merge Field Insertion

Two complementary insertion methods:

1. **Click from palette**: discoverability path. New users browse fields, click to insert. Last cursor position preserved on blur so insertion target is maintained. If no cursor position exists, prompt "click in the template where you want to place this field."
2. **`{{` trigger character**: speed path. Type `{{` → autocomplete dropdown filtered by subsequent keystrokes → select field → chip replaces typed text. Works in both editable preview (produces chip) and code view/Monaco (produces `{{ field_name }}`). Double curly brace was chosen because it maps directly to Twig syntax, has near-zero false-trigger risk in natural text, and produces identical insertion behaviour across both surfaces.

#### Visual Chip Interaction

- **Click a chip** → small popover: field name, remove button (x). Minimal.
- **Remove** → chip and its Twig syntax removed from source. No empty space left.
- **Cursor after insert** → lands immediately after the chip so typing continues naturally.
- **Backspace** → cursor right after a chip: first backspace selects/highlights the chip, second removes it. Standard contenteditable inline-element behaviour.
- **In code view** → no chips, just `{{ field_name }}` text. Monaco find/replace works normally.

#### Field Navigation and Step-Through

- Click a placed field in the palette → editable preview scrolls to and highlights that chip.
- Step-through mode cycles through all placed fields sequentially.
- Palette shows placed/unplaced status for each field — visual indicator of which defined fields haven't been inserted yet.

### Template Creation and Onboarding

#### Three-Step Creation Wizard

**Step 1: What are you creating?**

Three cards with icon, title, and one-line description:
- **"Email / HTML template"** → `twig` — "Create a text or HTML template with Twig variables"
- **"PDF document"** → `pdf-html` — "Create an HTML template that renders as PDF"
- **"Upload PDF with form fields"** → `pdf-fields` — "Upload an existing PDF with fillable form fields"

**Step 2: Name and description**
- Template name (required)
- Description (optional)

**Step 3: Initial content**

For `twig` and `pdf-html`: paste HTML into Monaco (code view), or start with a blank editor. The editable preview populates once there's content. Same starting experience for both types.

For `pdf-fields`: file upload. PDF is uploaded and stored as base64 content on the Version.

Both the extraction endpoint (`POST /pdf/extract-fields`) and the `pdf-fields` creation POST accept standard multipart file uploads. The backend receives the file, base64-encodes it, and stores in the `content` column. The V1 API continues to accept base64 strings in the JSON body for backwards compatibility — only the web routes use file upload.

The web routes apply a Laravel request validation rule to enforce a sensible upload size limit (typical form PDFs are 100KB-2MB). No chunked upload or separate storage endpoint is needed — standard Laravel file validation is sufficient. The extraction and creation endpoints share the same size limit.

The wizard runs entirely client-side. The first API call (POST to create) only fires when the user first saves or auto-save triggers — by which point content exists. The "new unsaved template" state lives in the SPA until then.

The web route provides a combined creation endpoint that creates the template and its initial draft version in a single request — template name, type, description, content, schema, and design_meta. This is atomic: if version creation fails, no template is created. The V1 API's separate endpoints remain unchanged.

#### PDF Fields Upload and Field Extraction

For `pdf-fields`, after upload:
- PDF viewer (PDF.js, read-only) — see the document
- Auto-extract form field names via `pdftk dump_data_fields` — pulls field names, types, and defaults from the PDF
- Auto-detected fields populate the palette — same pattern as auto-detecting `{{ }}` variables in HTML
- User configures schema for each detected field (type, required, min/max validation)
- Rendered preview: fills form fields with sample data via the existing `PdfFieldsRenderer`

No content editing for `pdf-fields` — the PDF is the content. The authoring workflow is: upload → review detected fields → configure schema → done.

A utility extraction endpoint (`POST /pdf/extract-fields`) accepts a PDF file upload, runs `pdftk dump_data_fields`, and returns extracted field names and types. No template created — pure analysis utility for the wizard.

#### Blueprints (Deferred)

Pre-made base templates to clone from ("Basic email", "Cover letter", "Invoice"). Deferred to future enhancement. The creation wizard can add a "Start from blueprint" option alongside the type selection when ready.

### Versioning and Publishing

#### Version Lifecycle

```
draft → published → (optionally) is_current
                  ↘ unpublished → archived
```

- **draft** — editable, auto-saves, not renderable via SDK
- **published** — locked/immutable, renderable by version ID via SDK
- **is_current** — a flag (not a state) on exactly one published version per template. This version is rendered by default when no version ID is specified.
- **unpublished** — removed from availability, kept for history
- **archived** — hidden from normal views

#### Immutable Published Versions

Published versions are locked. No edits allowed. When a user wants to edit a published template, the UI creates a new draft version copying the content from the published version. The user edits the draft, publishes when ready, optionally makes current. The old published version remains untouched.

The clone copies `content`, `schema`, and `design_meta` — the full authoring state. The SPA reads the published version's data and creates a new version via the standard version creation endpoint — no dedicated "clone" endpoint. Version names are auto-generated (incrementing: "v1", "v2", "v3") and editable in the template header. The new draft appears immediately in the editor.

#### Publish and Make Current — Separate Operations

Publishing makes a version renderable by version ID. Making current sets it as the default. This enables a staging workflow:

1. Edit a new draft version
2. Publish it — renderable by version ID, but not current
3. Test in dev/staging by rendering that specific version ID
4. Make it current — now the production version
5. Old current version stays published — available for rollback

#### Auto-Save

Changes in the editable preview auto-save to the draft version, debounced (every few seconds of inactivity, not every keystroke). The version stays in `draft` state throughout. No explicit "Save" button needed — continuous editing experience. Draft auto-save is always allowed regardless of validation state.

Auto-save is a debounced full-payload PUT to the web version update route — content, schema, and design_meta. No dedicated auto-save endpoint needed. Content is typically 10-50KB (email HTML), trivial bandwidth.

Per-type payload profile: `twig` and `pdf-html` send HTML text (10-50KB). `pdf-fields` content is static after creation — auto-save only sends schema and design_meta changes, not the PDF. No upload optimisation needed for any type.

#### Publish Validation

All defined fields must be placed in the template to publish. This is a publish-time gate, not an editing-time restriction. The palette's placed/unplaced indicators give continuous feedback, but nothing blocks editing. Only the explicit "Publish" action checks this requirement.

### API Architecture

#### Dual Surface — Web Routes and V1 API

Two API surfaces serve different consumers:

- **Web routes** (new) — for the Nuxt SPA. Session auth via Sanctum `statefulApi()`. Shaped by UX needs, not REST conventions. May include utility endpoints, combined actions, or non-RESTful routes.
- **V1 API routes** (existing, unchanged) — for the SDK and external consumers. Token auth via Sanctum abilities. Stable REST contract. No backwards compatibility changes.

The sharing boundary is the DTO/Action layer:

```
Web routes → thin controllers → form requests (SPA-specific) → shared DTOs → shared Actions
V1 API     → existing controllers → existing form requests    → shared DTOs → shared Actions
```

Everything above the DTO/Action layer (controllers, form requests, resources) is purpose-built per consumer. The existing `MiddlewareBooter` already configures `statefulApi()` for session-based auth.

#### Web Route Endpoints

Key web routes for the authoring UI:

- **Template/Version CRUD** — mirrors V1 API structure but with SPA-specific validation (e.g., accepts `design_meta`)
- **Version update (auto-save target)** — PUT accepts content, schema, and design_meta. Same endpoint for explicit save and debounced auto-save.
- **Preview** — `POST /versions/{version}/preview` — accepts `content` (current editor state from request body, not database), `data` (sample values), and `schema`. Uses `PreviewVersionAction` without published/active state guards.
- **PDF field extraction** — `POST /pdf/extract-fields` — utility endpoint, accepts PDF upload, returns extracted field names and types via pdftk. No template created.
- **Publish** — triggers server-side publish validation (content scanning) before state transition.
- **Make current** — separate from publish, moves the `is_current` flag.

#### Authorization

Web route authorization is cross-cutting — handled by `spatie/laravel-permission` across all web routes. Not specific to template authoring.

### Concurrency and Editor Locking

#### Presence-Based Locking

One editor at a time per version. When someone opens a version in the editor, they claim presence. Others see the version is locked and get read-only mode. When the editor leaves, the lock releases and others are notified to reload.

#### Implementation Stack

- **Presence detection**: Laravel Reverb with a presence channel per version (`editing.version.{ulid}`). SPA joins on mount, checks for existing members, toggles read-only if occupied.
- **Server-side lock state**: Redis with TTL-based keys, refreshed by each auto-save. No database state, no cleanup migrations.
- **Optimistic locking as safety net**: the save PUT includes the `updated_at` timestamp last received by the SPA. Server compares against the current `updated_at` on the Version model. Rejects with 409 Conflict if stale. Uses the existing column — no new fields. On 409 Conflict, the SPA displays an error notification explaining the version was modified elsewhere and prompts the user to reload. No auto-merge or retry — the user reloads fresh data and resumes editing from the current server state. This is a rare edge case (presence locking is the primary guard); the recovery flow prioritises simplicity over sophistication.

#### Handoff Flow

1. User A opens editor → claims presence on Reverb channel, acquires Redis lock
2. User B opens same version → sees User A is editing, enters read-only mode
3. User A leaves (tab close, navigate away) → WebSocket disconnects, Reverb fires leave event, Redis lock released
4. User B receives leave event → prompted to reload fresh data → gains editing privileges, claims lock

#### Lock Cleanup on Crashes

Two cleanup layers:
- **Fast path**: Reverb heartbeat detects dead connection (~25-30s) → fires leave event → Redis lock deleted immediately.
- **Slow path**: TTL expiry catches anything the fast path misses (Reverb restart, bugs) — lock self-clears when auto-save stops refreshing it (~60 seconds, longer than the auto-save interval).

### Preview System

Two distinct preview modes serving different needs:

#### Live Editable Preview (Client-Side, Always Visible)

Contenteditable HTML panel with field chips, inline editing, click-to-insert. Auto-updates as the user edits — no server round-trip, no debounce against the server. Shows HTML for all types (`twig` and `pdf-html`). The live preview is always HTML regardless of final output format. `pdf-fields` is not editable — live preview shows the PDF read-only.

The live preview provides visual context alongside targeted editing — field placement and minor text tweaks without requiring users to touch code. It's one of two editing surfaces; see the Editor Architecture section for the full model.

#### Sample Data Preview (Server-Side, On-Demand)

Users provide sample values for Twig variables via a simple key-value form. Triggered by button click, not debounced. Presented in a modal or slide-over — a read-only rendered view, not editable. No chips, no badges, no annotations. Pure output verification.

**Endpoint**: `POST /versions/{version}/preview`
- Accepts `content` (current editor state from request body, not database), `data` (sample values), and `schema` (for validation)
- The version ID provides context (template type) but content is caller-supplied
- Action: `PreviewVersionAction` — calls `TemplateManager` without published/active state guards. Separate from `RenderVersionAction` which keeps its guards for the V1 API.

**Per-type output:**
- `twig` — returns rendered HTML with sample data
- `pdf-html` — returns PDF via Gotenberg with sample data
- `pdf-fields` — returns PDF via pdftk with sample data

For PDF responses (`pdf-html` and `pdf-fields`), the SPA creates a blob URL from the binary response and renders it in an `<iframe>` within the modal — leveraging the browser's native PDF viewer. No additional PDF rendering library needed for this use case (PDF.js is only used for the `pdf-fields` read-only editor surface).

#### HTML Validation for PDF Rendering

For `pdf-html`, the sample data preview button is gated on HTML validity. HTML validity is checked via a simple browser DOMParser parse. Twig syntax (`{{ }}`, `{% %}`) is stripped before parsing — the parser would otherwise flag Twig as invalid HTML. If parsing produces errors (unclosed tags, malformed markup), the button is disabled with an error indicator listing the first parse error. This is a lightweight check to catch obvious structural problems — it's not a full HTML5 validator. Gotenberg-specific rendering issues (e.g., unsupported CSS) surface at render time, not at gate time.

#### Sandbox and Rendering Consistency

The preview endpoint uses the same Twig sandbox configuration as production rendering. If a Twig construct is disallowed in the sandbox, it fails identically in preview and production — no false positives. The sandbox exists for security, not feature gating.

The `PreviewVersionAction` does not need `design_meta`. The sample data form is built client-side from the field palette state (design_meta in memory). The action receives user-supplied data, validates against the provided schema, and renders — same pipeline as production, minus the state guards.

### Publish Validation

#### Server-Side Content Scanning

At publish time, the server enforces that all defined fields are placed in the template. Content is the source of truth — not design_meta.

**For `twig` and `pdf-html`**: the web publish action scans content for `{{ field_name }}` patterns, cross-references with schema keys. All schema fields must appear in content to publish. Both types use Twig as the templating engine — the same content scanning applies.

**For `pdf-fields`**: at publish time, schema field names are validated against actual form field names in the PDF content (re-extracted via pdftk). The user can edit schema between extraction and publish (adding, removing, or renaming fields), so publish-time re-validation is necessary. Any schema field that doesn't correspond to a PDF form field is flagged.

Publish validation failure returns standard Laravel 422 validation error format. For `twig`/`pdf-html`, the response lists unplaced field names (e.g., `{"errors": {"fields": ["first_name is defined in schema but not found in content"]}}`). For `pdf-fields`, it lists schema fields that don't match PDF form fields. The SPA surfaces these as field-specific errors in the publish confirmation UI.

#### Two Layers

- **design_meta** tracks placement for the SPA's real-time palette indicators — separate concern from publish validation
- **Content scanning** is the server-side enforcement at publish time

Content is the source of truth. design_meta is the UI state.

#### Scope

The V1 API's publish endpoint (`PublishVersionAction`) does not gain this gate — SDK consumers manage their own content. This is a web-only validation in the web publish action.

### Deferred Features

The following features were discussed and explicitly deferred to future enhancement:

#### Conditional Logic Builder

Conditionals (`{% if %}`, `{% endif %}`), loops, and all other Twig control structures are handled in code view (Monaco) only. In the editable preview, they display as visual annotations (border/background indicating "conditional block here" or "loop here") — visible but not interactively editable. Content inside conditional blocks remains editable as normal text.

An interactive condition builder (select section → add condition → visual rule editor) is a natural future enhancement once V1 patterns are established. The visual annotation infrastructure built for V1 provides the foundation.

#### Blueprints

Pre-made base templates to clone from ("Basic email", "Cover letter", "Invoice"). System-provided or user-created. The creation wizard can add a "Start from blueprint" option alongside the type selection when ready.

### Dependencies

Prerequisites that must exist before implementation can begin:

#### Partial Requirement

| Dependency | Why Blocked | Minimum Scope Needed |
|------------|-------------|---------------------|
| **Gotenberg Docker service** | `pdf-html` rendering pipeline requires a running Gotenberg instance to convert HTML to PDF. Cannot build, test, or preview `pdf-html` output without it. | Gotenberg container in the Docker Compose stack with `--chromium-auto-start=true`, port 3000 exposed, health check configured. |
| **spatie/laravel-pdf v2** | `PdfHtmlRenderer` uses this package as the Gotenberg client. The driver abstraction layer depends on it. | Package installed with Gotenberg driver configured. |

#### Notes

- The `twig` and `pdf-fields` pipelines, all editor UI, field system, API surface, concurrency locking, and versioning workflows can be built independently without Gotenberg.
- Web route authorization via `spatie/laravel-permission` is a cross-cutting concern — not a blocker for template authoring implementation. Basic auth suffices initially.

---

## Working Notes

[Optional - capture in-progress discussion if needed]

# Discussion: Note Window

## Context

The floating fumi as an on-screen object — the primary surface. Near-frameless luminous-glass design, colour/opacity, close=hide + always-autosave + soft-delete, per-note menu, float-on-top, positioning presets/tiling, and live-Markdown editing.

note-window owns the **presentation and interaction** layer. The upstream *models* are already settled: **note-model** fixed the bundle/`content.md`/`assets/` structure, the `fumi://` scheme, tags, colour tokens, and the note-link representation; **storage-and-sync** fixed the sync-conflict, soft-delete, and version-history *mechanisms*. Everything rerouted here is a look-and-feel / interaction design task, not a re-decision of those models.

### References

- [Discovery brief — note-window](../discovery/briefs/note-window.md)
- Upstream (settled, do not re-decide): [note-model](note-model.md), [storage-and-sync](storage-and-sync.md)
### Spike Index

**Paper file:** `app.paper.design/file/01KY2JBXY2MTMYVTA5ZXSR2CW9`

**Organising rule: one artboard per subtopic.** A spec section maps to exactly one board, so specification, planning and implementation can consult the right surface instead of hunting through a grab bag. *(Reorganised 2026-07-28 — the original boards had accreted into two grab-bags: `note layout & content` was renamed rather than split, since it is genuinely one thing; `note chrome & states` was carrying three subtopics and was broken up.)*

| Artboard | Subtopic | What it fixes |
|---|---|---|
| `01 — Surface & Chrome` | Surface & Chrome, Formatting Surface | The chrome conditions (unfocused · unfocused+hovered · focused · pointer on a control), the formatting band, and the `Aa` popover. |
| `02 — Colour & Material` | Colour | **All ten swatches** across the seven roles, the **substrate-relative** treatments for tag pill / attachment chip / inset block, and the **Reduce Transparency** fallback. On a **white** artboard so the tints read true. |
| `03 — Content & Inline Rendering (Bulletin)` | Inline Rendering, Tag Rendering | Note layout and padding, content-only-at-rest, first-line-title, interactive checkboxes, every rendered content type, table fades, attachment-chip states, tag pills — plus the **substrate stress test**. |
| `04 — Editing UX` | Editing UX | **Rendered vs Edit-as-Markdown** side by side. Source mode drops the formatting band. |
| `05 — Corner Menu` | *(shared component)* | Every variation: in context on the note · `Format ▸` · `Move to ▸` · `Move to Display ▸` · ~~the **swatch submenu** (all ten sets)~~ · the selection context menu. The `Move to ▸` list carries a **derived-name preset row** alongside the named ones, which is the only thing a save puts on screen. *(Amended 2026-09-22 — the swatch submenu was deleted with the strip's eighth cell and the strip redrawn at seven chips on every instance; `New Preset from This Note…` was relabelled `Save as Preset`, losing its ellipsis with the box behind it; the preset box was drawn as sheet, as popover twice and as a chain panel, and all four were deleted with the direction; and the corner menu's position against the `•••` was corrected on the two frames that show it against a note. It is drawn **without a beak**, which is now settled rather than incidental — it is a menu.)* |
| `06 — Delete UX` | Delete UX | The deleted state: banner + Put Back, read-only body. |
| `07 — Version History` | Version-History UI | The panel beside the note, note-as-preview-pane, header Restore, `CURRENT` badge, retention footer. |
| `08 — Conflict Reconciler` | Conflict Reconciler | Conflict banner, the panel seeded with candidates, and the switched state proving the frame holds still. |
| `09 — Note Links` | Note-Link Interaction | The pill in prose, the selected state, the anchored peek with Open, soft- vs hard-deleted pills, and the **link editor** anchored to a selection. |
| `10 — Agent Activity` | Agent-Activity Presentation | The **edge shimmer** at one frame, **streaming** mid-flight with the caret, and the **recency tint** on an unfocused note. |

**Two amendments to the organising rule** (2026-07-29):

1. **Shared components get their own board.** The corner menu is not a subtopic — it is a component three subtopics reach into (Surface & Chrome structurally, Positioning for *Move to*, Editing UX for *Format*). One board, every variation, rather than partial copies scattered across the boards that use it.
2. **Formatting Surface has no board of its own**, because the formatting surface *is* the chrome band: it maps to `01` for the band and the `Aa` popover, and `05` for `Format ▸`. A short-lived `10 — Formatting Surface` board was dissolved into those two once the direction was decided — a two-frame board is just somewhere for things to drift out of sync.

*Boards sit on the canvas left-to-right in numeric order, tops aligned.*

**Three further amendments (2026-07-29), all about making colour a controlled variable rather than an accidental one:**

3. **`00 — DISCOVERY` was deleted.** It had been kept for provenance and was the reference for nothing; leaving a superseded board on the canvas invites someone to read it as current.
4. **Every fumi on every board is Wash Neutral, except board `03`.** Colour was drifting across the boards — sage here, blush there, mauve somewhere else — which made it an uncontrolled variable on boards that are about something else entirely. Neutral everywhere means a tint on a board now *means* something.
5. **Board `03` is deliberately the exception and runs the whole Bulletin swatch**, one role per note, scattered. Two reasons: it proves the roles work as a set on real content rather than as blocks in a row, and it is the board where inline components must survive a coloured substrate.

**Board `03` also carries the *substrate stress test*** — the identical note (heading, prose, inline code block, table, attachment chip, tag pills) drawn on **Paper · Bulletin · Highlighter · Midnight**. Chosen as the extremes: barely-tinted, punchy, loud, and deep-dark-with-inverted-foregrounds. *Rejected: drawing all ten. Board `02` already proves what the swatches look like; `03`'s job is proving components stay legible on them, and four extremes settle that where ten would just be noise.*

### Menu construction rules (from Apple, pinned at the corner-menu spike)

- **Panels and menus are two different surface classes**, and the distinction predicts several things at once rather than being an ornament:

  | | **Panel** (`Aa`, the peek, the link editor, version/conflict panels) | **Menu** (corner menu and its submenus, context menu) |
  |---|---|---|
  | Contents | controls | commands |
  | Beak | **yes**, centred, when anchored to a trigger | **never** |
  | Material | **slightly translucent, with a blur** | ~~**opaque**~~ **also translucent** |

  ~~*The material difference was spotted by the user in Apple Notes and is what makes this a real class distinction rather than a styling choice.*~~ *(Amended 2026-09-22 — the Material row is wrong about the platform it was read off: AppKit ships `NSVisualEffectMaterialMenu` as its own translucent material alongside `NSVisualEffectMaterialPopover`, and this document's corner-menu translucency was measured from the user's own macOS captures. **The beak is the class distinction; the fill is not.** See* the corner menu carries no beak*, below, which settles the same pair's other half — the Beak row is right, and it is what the old corner-menu bullets contradicted.)*

  ⚠️ **Spike limitation:** Paper applies the alpha but **does not composite a backdrop blur over sibling nodes** — it blurs the artboard background only, which is why the notes themselves render correctly and a panel over a note does not. Panels on the boards therefore show *sharp* show-through rather than blurred. The declared `backdrop-filter` records the intent; the real appearance is a SwiftUI implementation checkpoint. **Do not read panel opacity off the boards.**
- **A popover's centre aligns to its trigger's centre**, which puts the beak dead centre of the panel and under the trigger simultaneously. A menu instead sits below its button with a clear gap.
- **A submenu's first row aligns with its parent row** — not with the top of the parent panel. The submenu's top is therefore *parent row top − panel padding*.
- **A submenu overlaps its parent panel slightly** rather than sitting flush beside it.
- **Only the deepest hovered row takes the accent.** Every ancestor row stays highlighted in a **muted grey**, so a parent and its child are never both accent-filled — they cannot both be focused.
- **Control rows are legitimate menu furniture** — Apple's own context menu opens with a Cut / Copy / Paste icon row. This is why the corner menu keeps its role strip without becoming a popover.
- **Separators are inset**, never edge-to-edge.

**How to read the spikes (applies to all of them).** They fix **layout, positioning, spacing, structure and general feel** — that is what they are for. They are **not** a fidelity target, because a static mock cannot show live refraction, true backdrop blur or real vibrancy. ~~**the real SwiftUI + Liquid Glass rendering takes precedence over anything drawn here**… Where the spike and the material disagree, the material wins.~~ *(Amended 2026-09-11 — this described the drawn surface as an approximation of a system material that would later supersede it, which was overtaken by the 2026-09-02 call recorded under* Decision — the drawn stack is the material *below: **the drawn stack is the final material, and there is nothing for it to defer to.** What survives is that the spikes are not a fidelity target — the real build is where the material is judged. What is withdrawn is "the material wins", because Liquid Glass is no longer a separate thing that could win.)* Sections marked **🎨 Spiked** point at the artboard that demonstrates them.

**What wins when a board and this document disagree (2026-09-22).** *Settled by derivation — not discussed. The 2026-09-11 amendment above struck the only sentence that had ever answered this and put nothing in its place, which left the question unanswered for eleven days.*

> **This document decides; a board demonstrates. Where they disagree on *what exists*, the document is right and the board is stale. Where they disagree on *how something looks* — spacing, weight, a value the build will tune — the board is the better evidence, because it was drawn and this was written.**

The distinction matters because the two failures are not alike. A board rendering the material approximately is doing its job; a board drawing a surface that was withdrawn is a picture of a decision nobody made, and a later reader takes it as current. **That is why a superseded board or variation is deleted rather than archived** — `00 — DISCOVERY` went on exactly those grounds, and the swatch submenu and four preset shapes followed it on 2026-09-22. And it is why the Spike Backlog exists: a board that owes a change is a to-do, not a second opinion.

*The rule is not licence to leave boards stale. Both readings assume the drift is caught; the Backlog is what catches it.*

---

## Surface & Chrome

Brief-native (not rerouted). The near-frameless container every other concern hangs off. **Settled in discovery (not reopened):** content-only at rest; controls hover-only; first line *is* the title, no title bar; accent-edge/left-border hard-rejected; no persistent "pinned" chrome; corner radius ~12–14 continuous/concentric. This subtopic firms up: the **state model** (at-rest → hover → focus), **window mechanics** (close/move/resize on a frameless surface), the **corner-menu hub**, and two **edge cases** (Float-on-Top indication, drag-vs-text-selection).

*From: platform-support · research · 2026-09-02*

Two lines in *Decision — window mechanics (framing & controls)* specified the close and `•••` controls as `.glass` buttons with vibrancy SF Symbols, while *Decision — control geometry & note padding* — written later, from the chrome spike — pins them as clean filled circles with no container well, whose fill darkens on hover to reveal the glyph. Nothing marked the supersession, and the Paper spike's computed styles agree with the later decision (13×13 frames, `borderRadius: 99px`, `backgroundColor: #1C20291C` — flat tinted circles, no material). platform-support found it while establishing what in the note surface genuinely requires macOS 26, because those two lines were the only thing in the whole surface that bound the design to it. The correction is recorded on both sites above. What the struck text was *carrying* — an argument that two monochrome glyphs stay legible across ten swatches at variable opacity **by construction** — was a real problem with no other answer in the document, and is decided below.

*From: onboarding-and-permissions · research · 2026-09-17*

The user brought eleven onboarding screenshots from **Dockset** (a custom-Dock app for macOS) into this topic's session as first-run reference. Two of those pages are about Dockset's own surface material rather than its onboarding, and what the user said about them is an ask for this topic, not for that one. It is rerouted here rather than explored there.

**The pages.** Copies are stored under `research/assets/onboarding-and-permissions/` — `dockset-05-material-liquid-glass.jpeg` and `dockset-06-material-picker-open.jpeg`. A wizard step titled *"At home on your desktop"* carries a live preview with two dropdowns beneath it: **Dock material** offering *Frosted* and *Liquid Glass*, and **Glass style** offering *Regular*. Changing the material redraws the preview immediately.

**What the preview shows, and why the user singled it out.** An outer rounded container holds two widget tiles side by side, with a small grab handle at its right edge; each tile is its own inner rounded box. A browser window sits behind the whole thing. Under Liquid Glass the user's description is that the outer container is what carries the material, the inner tiles still have it applied, and the browser behind shows through — blending and refracting at the container's edges and through the middle — while the tiles' own text (*"Design review · 10:30"*, *"20:00 Focus"*) stays legible sitting on top of it. In their words, *"it looks good"*.

**The ask.** This topic decided on 2026-09-11, under *Decision — the drawn stack is the material*, that there is **one rendering across the macOS 15+ range**: the bespoke drawn stack is the final material rather than a stand-in for a system one, the colour-and-material checkpoint *"tunes the bespoke stack and may not swap it"*, and *"a fumi looks the same on 15 as on 26."* The trade-off was accepted explicitly — *"anything Liquid Glass would have given for free on 26 — live refraction, true material response — is foregone on both versions rather than taken on one"* — on the argument that the alternative makes every later surface decision a decision twice, once per rendering, for the life of the product.

The user's steer after seeing this reference is the fork that decision closed, reopened from the other side: **frosted glass may be worth reintroducing**, with Liquid Glass used where macOS provides it and frosted (or something similar) as the fallback on versions that do not. That is two renderings selected by OS version — precisely what the 2026-09-11 decision ruled out.

**What has and has not changed since that decision.** Nothing about the supported range: `platform-support` still holds macOS 15 as an open-ended floor, and the measurement that carried the decision still stands — the drawn stack uses no macOS 26 entry point, the parameterised blur being `NSView.backgroundFilters`, available since 10.5. What is new is evidence rather than argument: the user has now seen a shipping app present Liquid Glass on a small floating surface with text on it, and judged the result good. The 2026-09-11 decision was taken without that — it reasoned about what Liquid Glass would give "for free" without a worked example of it doing the job on something fumi-shaped.

**How firmly this is held.** Not firmly, and the user said so: *"that might be something we have to play with as we get to that point"*, and *"we might need to play around with this"*. They may install Dockset and capture more of it — further screenshots would land here as additional reference rather than as a second ask. This is a real reopening of a real decision, offered as a direction rather than a reversal instruction.

*(Amended 2026-09-18 — the body above places the copies under `research/assets/onboarding-and-permissions/`; that directory does not exist. Both files are in the work unit's import store: `` `find .workflows -iname '*dockset*'` `` → eleven files, all under `.workflows/fumi/imports/`. The two this concern names are linked at their real paths in the 2026-09-18 entry on* Decision — the drawn stack is the material*. The body is left as the origin wrote it.)*

**What this concern does not touch.** Nothing about first run. The material question reached this topic only because the reference that raised it was being read for its onboarding, and the onboarding material was folded there under *Visual reference — Dockset's onboarding*. Whether the note surface carries one material or two, and what the checkpoint may do, are wholly this topic's.

### Decision — window mechanics (framing & controls)

**No Liquid-Glass window-control standard exists** — Liquid Glass is a material/rendering language, not a chrome spec. We use a **frameless surface** (borderless / transparent-titlebar window; move & resize are window-level, unaffected by which buttons show) and supply our **own controls in the Liquid Glass language** rather than the native traffic-light triad.

*Why not native traffic lights (considered, rejected):* muscle memory + free press/hover/a11y states were the draw, but on a muted tinted-glass note a saturated **red** dot is the single loudest element and fights the calm/furniture aesthetic, and native buttons aren't guaranteed legible over custom tints + reduced opacity. This supersedes the earlier native-idiom lean — and **moots review-001 F4** (which was about native inactive-button hover-colouring; no native button now).

- **Close = custom `✕` glyph**, top-left. ~~Monochrome SF Symbol via **vibrancy / `.glass` button style**, so it stays legible on **any** palette tint and at **any** opacity **by construction** (resolves review-001 **F1** — no scrim pad)~~ and reads calm, not garish. **Close = hide** (reopenable). Lost-muscle-memory mitigations: top-left position (where the eye seeks close), a clear `✕`, `⌘W`. *(Amended 2026-09-11 — the control is not a `.glass` button. *Decision — control geometry & note padding* pinned it as a **clean filled circle, no container well**, and *hover feedback is a third mechanism again* specifies its fill **darkening** on hover to reveal the glyph — neither is how a material capsule with its own specular treatment is styled, and the Paper spike draws a flat tinted circle. The **by construction** legibility argument the struck clause made is real and is answered instead by* Decision — control colour *below; review-001 F1's no-scrim-pad outcome survives there.)*
- **No minimize / zoom / native window buttons at all** — none apply to a note; the frameless window omits the standard triad.
- ⚠️ **SUPERSEDED 2026-07-29 — see "two window states, not three" under Formatting Surface.** Kept here as the record of what changed and why.

  ~~**Three control states.** Controls show on **hover OR focus**; three conditions render differently: hidden · **faded when focused** · **full strength on hover**.~~

  **What replaced it:** the **strength tiers** are gone. Chrome is one quiet treatment, shown on **focus OR hover** for window controls and **focus only** for formatting; the glyph reveal is reclassified as **per-control hover feedback**. The *"background/unfocused note reveals its controls on hover"* clause below — the resolution of **review-002 F4** — **still stands**.

  **Still standing from the original decision:** *always-faded (even at rest) was spiked and rejected* — it fixed a padding problem but **read as decoration, "two punched holes" or pins in the paper**, rather than controls. That perceptual failure is untouched by this revision and remains the reason at-rest is fully clean.
- **Both custom controls (close top-left, `•••` menu top-right) hidden at rest**, revealed on **hover OR focus** — either condition shows them, at the same quiet strength. Chosen over *always-present* (7 notes = 14 persistent glyphs, a busy wall) and *focus-only* (which would make closing a background note two clicks). Concretely (**resolves review-002 F4**): a **background/unfocused note reveals its window controls on hover**, so you can close or menu it without focusing first; the **focused note shows them persistently** even when the pointer is elsewhere; while the **`•••` popover is open it stays open** until dismissed (Esc / click-away). Resting note is therefore **fully content-only** (aligns with discovery's "at rest a note is fully clean"); the controls and the formatting band share the reserved top chrome band, which is a fixed height whether filled or empty, so nothing reflows.
- **Accessibility (review-001 F6):** both controls are custom → both get an accessibility label, a keyboard path (`⌘W` closes; menu keyboard-reachable), and VoiceOver exposure. No native free ride, but consistent across both.
- **Resize** = standard cursor-swap at the note's **visible** edge/corner (corners = both axes, edges = one). The note is a glass **panel** with a clearly delineated boundary — material edge + ~12–14 corner radius + sheen + drop shadow; the "no border" rejection was only the *coloured accent-edge stripe*, never the panel edge itself (resolves review-001 **F3** — discoverability is fine because the boundary is visible). ~~**Move** = drag the window background~~ — designed under the drag-vs-text edge case. *(Amended 2026-09-01, resolves review-010 F3 — the window **background** is content, where drag selects text. Move is the **chrome band**, everywhere it is not a control; see* the drag model*'s 2026-09-01 entry.)*

**Implementation reference:** Ghostty (open-source) for the transparent-titlebar frameless setup ~~; `.glass` button style + vibrancy SF Symbols for the controls themselves~~. *(Amended 2026-09-11 — same supersession as the close bullet above: the controls are drawn shapes, not system glass buttons. Ghostty remains the reference for the frameless window and, per* Decision — control geometry & note padding*, for the plain-circle controls themselves.)*

*Consequence worth stating, because a reader would otherwise price the range against a constraint that isn't there:* **nothing in the note surface requires macOS 26.** `.glass` / `GlassButtonStyle`, `.glassProminent`, `glassEffect(_:in:)`, `glassEffectID`, `glassEffectUnion` and `glassEffectTransition` are all `@available(macOS 26.0, *)` with no back-deployment, and those two struck lines were the only place the drawn design named one. Everything else in the surface resolves far lower — the panel boundary is `border-radius` plus a 1px inset white `box-shadow` and a shadow stack, `NSVisualEffectView`'s `Menu` / `Popover` / `Sidebar` materials are `API_AVAILABLE(macos(10.11))`, the shimmer is stroke-based by this document's own decision, and the note surface already opted out of system vibrancy in favour of swatch-owned foregrounds. **No pre-26 fallback is owed**, and the Reduce Transparency degradation stays what it was designed to be — an accessibility fallback, not a rendering path for older systems.

### Decision — corner menu (the `•••` hub)

**🎨 Spiked** — *CANONICAL SPIKE — note chrome & states*, state 4 (menu open): panel, role strip, rows, shortcut, checkmark, destructive delete, hover highlight, ~~beak and~~ anchor geometry.

**Structure: a richer popover panel (hybrid)**, not a bare `NSMenu`. An inline **role strip** at the top (colours beg to be seen, not buried in a submenu), then menu rows beneath for the rest. Tactile/premium where it pays (colour), plain rows where it doesn't.

**Contents (revised 2026-07-29, resolves review-006 F11):**

| | |
|---|---|
| **Role strip** | seven role chips ~~+ an eighth **swatch-switcher** cell opening the set list~~ |
| **Format ▸** | paragraph styles, lists, inline styles, blocks |
| **Move to ▸** | tiling grid + named presets |
| **Move to Display ▸** | *only when more than one screen is connected* |
| **Float on Top ✓** | toggle |
| **Edit as Markdown** | rendered ↔ source |
| **Version History…** | opens the panel |
| **Delete** | destructive |

*(Amended 2026-09-22 — the strip's eighth cell is struck. management-window's Swatches pane is now where a swatch is switched, so the cell's stated justification — that the swatch level had no reachable surface — has expired, and a library-wide act sitting in chip shape among seven per-note chips is the scope mismatch the menu's own principle two paragraphs below forbids. See* Decision — switching swatch from the note*'s 2026-09-22 entry under Colour. Nothing else in the table moves.)*

~~*Originally: "**Contents — note-as-object only:** Colour · Move to ▸ · Float on Top ✓ · Version History… · Delete. **That's it.**" with "**Explicitly NOT in the menu:** anything about content — text styling, the rendered↔raw toggle, the future formatting bar," and the principle "**clean split: the corner menu is the note as an object; the editor owns the note's content.**"*~~ **Retired.** `Format ▸` and `Edit as Markdown` both landed since — the second is *literally* the item the exclusion list named — so the list, the exclusions and the principle drawn from them were all false, and the principle was still being quoted elsewhere as a live rule.

**The narrower principle that is actually true, and does predict what belongs:**

> **The corner menu is the note's menu bar.** A fumi is frameless and has no menus of its own, so this is the only place a note's own commands can live. It carries what an app's menus would carry **for the focused document** — and nothing that is **app-scoped**.

So `Format ▸` was never a violation; it is a *Format* menu, exactly where a document's formatting always lives on macOS. What stays out is unchanged in effect but now for a stated reason: **preferences, the manager, quit, swatch curation, the preset editor** — app-scoped, so they belong to the real menu bar and the menu-bar extra. This is the same **surface-follows-the-object** rule the document uses everywhere else, and it is why note-side items touching global objects are **pre-filled hand-offs** into the manager rather than in-place editors. *(Amended 2026-09-22 — the idiom narrowed: items that **edit or curate** a global object hand off; **creating** one out of this note's own state happens on the note, which is why `Save as Preset` writes the preset from here rather than opening a window. See* Preset Authoring*'s 2026-09-22 entry. The exclusion list above is untouched — the preset **editor** is still app-scoped and still stays out.)*

*Terminology fixed in the same pass (the finding's second half): a **swatch** is the whole role→colour set, always. A chip in the strip is a **role**. "Selected swatch carries a system-accent ring" now reads **selected role**, which matters because ~~the switcher submenu has its own checkmark on the active **swatch** — two different marks, previously the same word~~. (Amended 2026-09-22 — the switcher submenu is gone from this surface with the eighth cell, so the two marks no longer share a screen here. The word rule stands on its own and is what survives: a chip is a role, a set is a swatch, and Settings marks the active swatch with its own mark on its own surface.)*

**Panel presentation** *(read "popover" throughout as the panel — the word was the pre-class-distinction one, and this surface is a menu; see* the corner menu carries no beak*)*, settled against real macOS references the user captured — the Move & Resize popover under the green traffic light, and an app menu-bar dropdown, in both light and dark mode:

- **Anchors left, peels right.** The panel's left edge aligns to the `•••`, extending rightward — the macOS default in both references. Peeling *left* is the **fallback** only when there isn't room (near a screen edge). *(Sharpened 2026-09-22 — what aligns is the point where the panel's own corner radius straightens, not the bare edge; see* the corner menu carries no beak*.)*
- ~~**A tail / beak points back at the anchor control**, tooltip-style — this is what makes it read as *attached to the button* rather than floating nearby. **It must be continuous with the panel — one outline, one fill, no seam.** Drawn as a separate stacked triangle it reads as a detached blob and looks wrong regardless of position (confirmed: the user rejected exactly that).~~

  ~~**Spike value (set by the user):** beak fill **`#EAEAF4`, solid**. In the mock a solid colour matching the panel-over-note composite is what works — Paper drops the alpha channel on SVG fills, so an alpha-matched beak renders too opaque and reads as a separate element. *In the real build this problem doesn't exist: panel and beak are one `Shape` with one material.*~~

  **Construction rules learned the hard way in the spike** — retained, because the two surfaces that *do* take a beak inherit them: the beak must take the panel's **exact fill** and carry **no stroke of its own** — a stroke at that size dominates and turns it into a white blob reading as a separate element. It must be drawn **continuous with the panel**, with no border across the join. In the flat mock it then reads only faintly, because it shares the panel's tone over a similarly-toned note — correct behaviour; in the real build the glass material and the popover's shadow give it definition. In SwiftUI this is a single custom `Shape` for panel-plus-beak, which avoids the whole problem.

  ~~**Anchor geometry (measured from the macOS reference):** the popover's left edge sits **~45–50px to the left of the anchor button**, with the beak pointing up at the button just inside the left corner — *not* flush with the popover's edge. This reconciles what looked like two conflicting requirements: it reads as left-anchored/peeling-right **and** overlaps the note enough for the glass to register at the top-left.~~ *(Struck 2026-09-22 with the beak — the offset existed to give the beak somewhere to point from. Without one the panel anchors like any menu, off its **own** corner radius rather than its edge; see the amendment below.)*

  #### Amendment — the corner menu carries no beak (2026-09-22, and the document had already decided this twice over)

  *Trigger: user challenge while the board's anchoring was being corrected — "I thought we ruled that we wouldn't do that."*

  > **The corner menu has no beak. It is a menu, and it sits below its button with a clear gap.**

  **The record said both, and the two sides are not equal.** The struck bullets above are the earliest statement and predate the panel/menu class distinction entirely. That distinction — *Menu construction rules*, in this document's header — puts the corner menu in the **Menu** column, where *Beak: never*, and settles the obvious objection in its own next-but-one bullet: *"**Control rows are legitimate menu furniture** — Apple's own context menu opens with a Cut / Copy / Paste icon row. This is why the corner menu keeps its role strip **without becoming a popover**."* One loose sentence in the Apple Notes pass says the opposite — that the role strip *"retro-justifies the beak on our corner menu"* — and it is contradicted by a bullet in the same distilled block. That pass's first instinct was role-strip-therefore-panel; finding Apple's own context menu carrying a control row is what dissolved it, and the block is the output, not the instinct.

  **The boards agree, and had all along.** Every frame on `05` has drawn this menu beakless since it was first spiked; the beak was specified in prose and never once drawn. The one time it was added — this sitting, while correcting the anchoring — it was added by reading the stale bullet, which is how the contradiction surfaced at all.

  **What replaces it is ordinary menu anchoring, and the two things the beak was propping up go with it.**

  > **The panel's own corner radius is what aligns, not its edge: the point where the top-left radius straightens sits just left of the `•••`. It opens downward with a clear gap below the button, and peels right from there.**

  Stated that way because edge-alignment is what the first two corrections both got wrong, in opposite directions — once ~47pt too far left (the beak's offset), once with the bare left edge on the button, which pushes the radius-start to the *right* of the icon and reads as the menu having slid sideways. A 13pt radius means the straight run begins 13pt in, and that is the line the eye reads as the panel's left edge.

  That is what *anchors left, peels right* said in the first place — *"the popover's left edge aligns to the `•••`, extending rightward"* — and the ~45–50px leftward offset was a departure from it, invented so the beak had somewhere to point from just inside the panel's corner. With no beak it has nothing to buy, and it reads plainly wrong: a menu floating half a panel-width left of the control that opened it. **The "overlaps the note substantially" bullet goes with it**, since the overlap was the offset's side effect dressed up as a requirement; the glass argument behind it was always thin, because a translucent menu over the desktop has the desktop behind it. The menu now covers the corner of the note it opens from and nothing else, which is the better outcome on a small fumi.

  *The construction rules are kept above rather than struck* — the note-link peek and the link editor are panels of controls, both take a beak, and both cite these rules.

  **A second inconsistency in the same pair, resolved the other way.** The class table also gives menus an **opaque** material, while the bullet below holds this panel as *"genuinely translucent glass"* measured from the user's own macOS captures. Here the table is the weaker claim: AppKit ships a distinct translucent material for menus (`NSVisualEffectMaterialMenu`, `= 5`, alongside `NSVisualEffectMaterialPopover = 6` — `grep -nE 'NSVisualEffectMaterialMenu|NSVisualEffectMaterialPopover' "$(xcrun --show-sdk-path --sdk macosx)/System/Library/Frameworks/AppKit.framework/Headers/NSVisualEffectView.h"`), so "menus are opaque" is false of the platform it was read off. **The translucency stands; the table's Material row is the error.** What the row was reaching for is real and survives as the beak rule alone: a panel and a menu are different classes, and the thing that tells them apart is the beak, not the fill.
- ~~**The popover overlaps the note substantially.** Anchoring at the `•••` (top-right) and peeling right leaves almost nothing behind the panel, so the glass has nothing to work against — the material only reads as glass when there's content behind it. So the panel sits back over the note, with the beak still pointing at the button. Consequence to accept: on a small note the open menu covers most of the content.~~ *(Struck 2026-09-22 — this was the other half of what the offset bought, and it goes with it. The argument was thin anyway: a translucent menu over the desktop has the desktop behind it, which is content anyway. **The menu now covers only the corner of the note it opens from**, which is better on a small fumi than the behaviour this bullet was accepting.)*
- **Genuinely translucent glass.** The references clearly show content through the material. A near-opaque panel (~90%+) makes the blur pointless — the fill must be light enough for the note beneath to bleed through.
- **Separators are inset** from the panel's left/right edges, not full-bleed.
- **Keyboard shortcuts sit right-aligned in the row** (e.g. `⌥⌘F` on Float on Top), with the checkmark outboard of them.
- **Rows:** ~13px label, generous row padding, 6px corner radius on the hover highlight (system accent fill, white text).
- **Destructive last:** `Delete` sits below a separator, in red. **No ellipsis** — on macOS an ellipsis promises further input, which no longer happens now the confirm is gone. The Note-menu mirror uses the same label.
- **Selected role** carries a system-accent ring. *(Note: the accent is the **user's**, not part of Fumi's reserved state-colour space — see the accent decision under Version-History UI. The ring must therefore also read as a ring, not by colour alone.)*

**Font dropped — no per-note typeface.** Markdown has no font-family concept, and a per-note font picker reintroduces the exact "you can make it ugly" swamp that curation exists to prevent. **Typeface is a single global product choice** (a clean system face + a mono for code), part of the furniture aesthetic like material/opacity — not per-note, likely not user-configurable at all. What "font/size" loosely meant in discovery is **block styles** (Title=H1 … Monospace=code) — semantic Markdown, an *editing* action → editor text-style dropdown, not this menu.

**Parking lot:** an optional *global* base text-size / comfort setting (app Settings, accessibility-style, all-notes) is a legitimately different thing from per-note styling — not per-note, not this menu, maybe not v1. Revisit under a future global-Settings subtopic.

### Decision — chrome copy: no em dashes outside note content

**Em dashes belong in note content, never in chrome.** Menus, banners, button labels, panel explainers and any other interface copy use full stops, semicolons or separate sentences instead. Raised by the user while reviewing the conflict spike, where a panel explainer had drifted into one.

The line is *content vs chrome*, not *ours vs theirs*: mock note bodies in the spikes keep their em dashes, because that is a person writing prose. Interface copy is signage, and signage reads worse with them — they slow scanning at small sizes and sit awkwardly in the tight measures menus impose.

### Decision — control geometry & note padding (from the chrome spike)

Iterated visually against **Ghostty** as the reference; three failed passes recorded because each failure taught the rule:

- **Control = a clean filled circle, ~~13px~~, no container well.** A grey rounded "well" behind the glyph made the buttons look squashed and heavy — Ghostty's are plain circles. *(Amended 2026-09-01, resolves review-010 F1 — the diameter is **23px**: *the band is a fixed height* set the band at 30px "which holds 23px controls with room to breathe", and *the width floor is set by the band* states the change outright — "*the band is a fixed height* raised the controls to 23px" — then derives ~240pt from "two 23px controls with 8px corner insets". The filled-circle-no-well finding is what survives here; the number does not.)*
- **Inset 8px from top *and* side ~~— roughly half the button's diameter~~**, so it **nestles into the corner curve**. ~~At a full diameter (13px) they read as floating away from the corner, which was the actual cause of the "cramped / weird" look.~~ The inset must be **equal on both axes** — the button belongs to the *corner*, not to the top edge or the side edge. *(Amended 2026-09-01, resolves review-010 F1 — the 8px inset stands and is what the width floor is derived from; the "roughly half the diameter" gloss described a 13px control and no longer describes the ratio it is attached to. What was learned is that the inset must be small enough to nestle and equal on both axes, not that it tracks the diameter.)*
- ~~**Note padding: 28px top / 24px bottom / 16–18px sides.** Near-balanced. Earlier attempts at 34–36px top with 16–20px bottom read as visibly top-heavy — "too much space, and not balanced."~~ **Superseded 2026-08-10 on the top figure only — see *the space above the first line is band + gap, not a padding value*, below.** Bottom 24px and sides 16–18px stand; they were never in dispute.
- Controls are **absolutely positioned in the corners, not laid out in the text column** — aligning them to the content inset made them crowd the title.

#### Amendment — the space above the first line is band + gap, not a padding value (2026-08-10, resolves review-009 F7)

Three decisions described the same strip and disagreed: this one pinned **28px top** and rejected top-heavy; *the chrome band is the formatting surface* endorsed top-heavier and pinned **≈33 above, 24 below**; and *the band is a fixed height* specified **a 30px band plus an 11px flex gap**, which implies **41** and matches neither.

> **There is no independent "top padding". The space above the first line is the reserved band plus the flex gap — one set of parts, and the composite falls out of them.**

The earlier two figures were eyeballing the composite while the band decision was specifying its parts, which is why the numbers could never be reconciled by choosing one. The document had already caught this from the other end: the spike-hygiene note records a residual misalignment traced to *"the note's **11px flex gap** — with a band present the title sits below band + gap; with padding alone it sits 11px higher"*, and settles it by keeping the band element and merely emptying it, *"which is also exactly how it must behave in the real app"*. The boards are built that way; only this section's number was left behind.

| | |
|---|---|
| reserved band | **30** — fixed, filled or empty |
| flex gap | **11** |
| **to the first line** | **41** |
| bottom padding | **24** |

**The ≈33 reasoning survives and in fact argues for more, not less** — glass needs greater clearance than flat colour, because text crowding the specular top edge loses contrast against it *and* flattens the edge; and the first line is doing double duty as the title, so the clearance is what makes it read as a title rather than as an opening sentence.

**What dies is 28, and specifically its near-balance premise.** The spike rejected 34–36 top against a **16–20** bottom — a ratio near 2:1. Against the settled 24 the same top figure is 1.7:1, and it was the ratio that read wrong rather than the top number in isolation.

**Values are build-time, the rule is not.** 41/24 is a longer lead than anything spiked, and top spacing is a look-at-it judgement — so the **gap is the tuning knob**, adjusted against real Liquid Glass at the colour-and-material checkpoint. What is pinned here is that the band and the gap are the only two quantities: nothing may reintroduce a separate top-padding value that has to be kept in step with them.

### Decision — the drawn stack is the material (2026-09-11)

#### 2026-09-18 — revised
*Trigger: triage from onboarding-and-permissions: "Reintroduce frosted glass for the note surface, with Liquid Glass where macOS has it" — Dockset ships both as a first-run choice, the user saw the system material render well on a small floating surface and judged it good, and asked whether the one-rendering call should reopen.*

**The decision holds for launch, on a different reason than the one that carried it.** The 2026-09-11 entry below rested on cost: two renderings makes every later surface decision a decision twice. That argument is still true and is no longer the load-bearing one. The reference itself supplies the better reason.

**What the captures actually show.** Reading them — [Dockset's material step under Liquid Glass](../imports/dockset-05-material-liquid-glass.jpeg) and [its material picker open, Frosted above Liquid Glass](../imports/dockset-06-material-picker-open.jpeg) — the dock container and its two tiles **carry no colour of their own**. Every colour inside them is the wallpaper and the browser window arriving through the material; the text on the tiles is near-black over a milky light composite with a lot of contrast headroom. That is the case the system's glass is built for: a neutral floating container whose whole appearance is a function of its backdrop.

**A fumi is the opposite object, and this topic has already written why that matters.** *The note surface does not use system vibrancy* states the rule directly — *"the note surface is the exception, because its background is user-chosen and the system cannot see it"* — and the entire foreground system is built on it: foregrounds are per **role**, hand-picked and contrast-checked against that specific resolved tint, with **Okabe–Ito** carrying `#F0E442` and `#0072B2` in one set and **Graphite** crossing the light/dark threshold mid-ladder. A system material that resolves its own appearance against what is behind the window is the same class of input the vibrancy decision rejected — an appearance flag there, a backdrop luminance here. The tint can be handed to it, but what it returns is the tint modulated by an amount that varies with whatever the note is floating over, on the one OS version there is a machine for, while the version that cannot be eyeballed renders the other panel. *Confidence: the modulation claim is read off the design language and off these two captures, not measured — nothing on this machine renders a tinted fumi under the system material.*

**The user accepted the point** — *"I guess it would be harder to have our colours with liquid glass"* — and did not want it closed off: the exploration moves to the product roadmap for after launch, not into v1. Parked as `liquid-glass-note-surface` under **next**, sourced back to this document.

**What that later item inherits, stated now so it is not priced as a swap.** The per-role foreground table across ten swatches, the control circle's alpha derivation over that foreground, and the five reserved state slots are all contrast-checked against the drawn stack's composite. Adopting a material that modulates the fill means re-validating every one of them against a fill that is no longer constant — and on a second rendering as well, since the pre-26 path keeps the drawn stack. The cheap-sounding version of this item ("swap the background layer on 26") is not the item.

**What would reopen it.** The captures settle a neutral container, not a coloured one, so the case that has never been seen is the one that matters: the system's material under a **saturated dark tint with light foreground text, over a bright backdrop** — a Midnight or Ink fumi floating on a white document window. If the foreground still meets its contrast floor there without the tint being authored twice, the tint argument above is wrong and this reopens on evidence rather than on preference. Dockset cannot produce that case if its dock is always neutral; it wants a real fumi under the system material, which is why the item sits after v1 rather than before it.

**Unchanged by all of the above:** the drawn stack is the material for v1; the colour-and-material checkpoint tunes it and may not swap it; a fumi looks the same on 15 as on 26. Nothing below moves.

*Sibling check: platform-support — its range decision holds macOS 15 as an open-ended floor and that the material binds the range in neither direction (*"Liquid Glass pins nothing either, because the drawn design uses none of the entry points"*). Unchanged by this: v1 still ships one rendering that needs no macOS 26 entry point, and the parked item is beyond the range question rather than a revision of it.*

#### 2026-09-11

*From: platform-support · discussion · 2026-09-11*

The supported range is **macOS 15 and later**, an open-ended floor. That is below 26, and the open thread this topic rerouted on 2026-09-01 expected one of two answers: a floor at 26, leaving every surface decision untouched, or a range below it, owing this topic a defined pre-26 rendering for the panel, the controls, the shimmer and the panel/menu distinction.

**Neither, and nothing is owed.** `platform-support` read the spike's computed styles rather than the prose describing it: `border-radius: 14px`, `backdrop-filter: blur(40px) saturate(180%) brightness(106%)`, a `#FFFFFFD9` 1px inset highlight, a two-stop shadow stack, an oklab gradient sheen, `background-color: #F4F5F7D4` — with the `Aa` popover the same shape at `blur(30px)`, and the controls flat tinted circles at `border-radius: 99px` on `#1C20291C`. Not one of those is a macOS 26 API; the parameterised blur is `NSView.backgroundFilters`, `API_AVAILABLE(macos(10.5))` (re-measured 2026-09-11 — see the command under *Colour*'s context). Every decision in this topic holds on macOS 15 unchanged, and the note that reusing the Reduce Transparency shape as a pre-26 rendering *"would be a decision, not an inference"* never has to be made.

**The remaining question was the checkpoint, not the range.** The colour-and-material checkpoint runs at implementation on macOS 26, because 26 is the development machine. On 15 there is nothing for it to tune *against* — so a checkpoint doing its job could quietly make a fumi a different object on the two versions, by adopting something only 26 renders. The fork: **one rendering for the whole range**, or **system material on 26 with the bespoke stack below it**.

**Decision — one rendering across the range. The drawn stack is the final material, not a stand-in for a system one.** The checkpoint **tunes the bespoke stack and may not swap it**: it can move alphas, blur radii, the flex gap, the control alpha pair and the per-swatch slot values, and it may not adopt anything macOS 15 cannot render. A fumi looks the same on 15 as on 26.

**This was already half-settled and the document had not caught up.** Put to the user on 2026-09-02 as this same fork — the hand-drawn surface as the real thing, or proper glass on 26 with a visibly plainer note on 15 — the answer was *"the hand-drawn surface is close enough to spike out at implementation, and the answer isn't knowable before it is mocked up for real."* That call landed in `platform-support` and never reached here, which is why *How to read the spikes* still said the real rendering "takes precedence over anything drawn here" and that "the material wins". That line is corrected above; it is what let this concern arise at all.

**What the 2026-09-02 call genuinely left open** was narrower than it looked: not *which* material, but how far the checkpoint could move before the judgement was knowable. Once the drawn stack is the target rather than an approximation of something better, that answers itself — there is nothing to converge toward, so the checkpoint is tuning, not selection.

**The trade-off accepted.** Anything Liquid Glass would have given for free on 26 — live refraction, true material response — is foregone on both versions rather than taken on one. Worth it: the alternative makes every later surface decision a decision twice, once per rendering, for the life of the product, and it is the same do-one-thing-well argument the topic has applied throughout. The material's quality is still judged in the real build; the checkpoint stands, with a narrower remit.

**Reading the earlier checkpoint references.** Several decisions written before today book their final tuning *"against real Liquid Glass"* — the global-opacity floor, the swatch values, the flex gap, the shimmer, the `Aa` bar's material note. **Read every one of those as "in the real build".** The checkpoint is unchanged in timing, participants and subject; what changes is that it is judging the drawn stack on its own terms rather than measuring it against a system material it was expected to give way to. No value those decisions pinned moves.

*Sibling check: platform-support — its range decision holds that the material does not bind the supported range in either direction, so nothing here constrains it; this takes the fork it handed back and nothing in platform-support turns on which way it landed.*

### Decision — control colour (2026-09-11)

The control is a drawn circle with a glyph on it, sitting on a user-chosen tint. Two things to colour, and the hover behaviour changes one of them underneath the other: *hover feedback is a third mechanism again* has the circle **darken** and the glyph **appear**, so the glyph's backing is not constant. Across ten swatches spanning **Paper** at 96% lightness to **Midnight** at 30%, and with global opacity thinning the fill, a single fixed pair cannot read on both ends.

**Options considered**

- **Swatch-owned, like note text** — every swatch defines its own control circle fill and glyph colour, contrast-checked per role. Consistent with the vibrancy decision; costs ten more entries across the swatch tables.
- **Derived from the role's existing foreground** — the circle is a fixed alpha of the role's foreground, the glyph its inverse. One rule, no new pinned values.
- **Fixed neutral pair** — one translucent-dark circle, one light glyph, everywhere, as the Paper spike literally drew it.

**Journey.** The fixed pair goes first and for a reason already on the record: it fails on the dark swatches in exactly the way *the note surface does not use system vibrancy* describes — a colour chosen against something other than what is actually behind the glyph. That decision rejected macOS vibrancy for note text because the system resolves label colours against the **appearance**, not against the tint, so a near-black **Midnight** note under Light appearance gets dark text; a fixed control pair makes the same mistake with a constant instead of an appearance flag. The struck `.glass` text was the last place in the document still relying on the platform to solve this, so it fails for the same reason and its removal costs nothing that was actually working.

That leaves swatch-owned against derived, and both are defensible. Swatch-owned is maximally tunable; derived is one rule that cannot drift. The deciding factor is that the two are **not independent surfaces** — the control sits in the chrome band, a few pixels from the first line of note text, on the same tint. If the control's colour is authored separately from the text's, the two can be tuned apart, and a control that quietly stops matching the text beside it is exactly the kind of drift the ten-swatch table makes expensive to notice. Derivation makes the mismatch unrepresentable.

**Decision.** **Control colour derives from the role's foreground** — the circle is a fixed alpha of it, the glyph its inverse. No new pinned values enter the swatch tables; the per-role foreground the storage shape already carries (*"seven resolved colours plus a foreground per role"*) is the single input, so the control is contrast-checked wherever the foreground was. The **alpha pair is a build-time value tuned in the real build at the colour-and-material checkpoint**, alongside the other look-at-it judgements booked there; what is pinned here is that the derivation exists and that the control never acquires its own authored colour.

This settles what `.glass` was claiming *by construction* — legibility on any tint at any opacity — by construction on our own terms rather than the platform's, and it keeps review-001 **F1**'s outcome: still no scrim pad, because the circle's fill is the backing.

*Sibling check: no overlap found — the two-level role/swatch model is settled upstream in note-model as a colour token, but the per-role foreground, the ten swatch tables and the reserved signal slots are all this topic's own; this adds a derivation over the foreground rather than a row to any table.*

### Decision — top chrome band & content layout (resolves review-001 F2)

Transparent titlebar does **not** mean content drifts to the top edge — it means the content *view* extends under the titlebar region; spacing is preserved. There is a **reserved top chrome band** with padding: the close dot (top-left) and `•••` (top-right) live in it, its middle typically empty. **Content renders *beneath* the band.** Since the title is just the first line of content (auto-rendered as H1, Apple Notes-style; deletable → plain Body — confirmed in note-model Editing UX), it never sits inline with the buttons — no collision. The band is reserved **at rest too** (empty — both controls are hidden until hover/focus), so revealing/hiding the hover chrome **never reflows content** — controls occupy an already-reserved band; nothing jumps.

### Decision — minimum window size (resolves review-001 F7)

Because the top chrome band is always reserved with content beneath it, a note **can't shrink into its own controls**. **Minimum height** = reserved chrome band + one content line + bottom padding (a one-line note is band-over-line; revealed controls never overlap the line). ~~**Minimum width** = both controls + gap + a reasonable text measure (~180–200px — matches the spike's ~194px left-rail note).~~ **Minimum width** = the band in its fullest state — see the amendment below. Resize clamps at that floor.

#### Amendment — the width floor is set by the band, not by a text measure (2026-08-10, resolves review-009 F6)

The struck rule was derived when the band held **two things**, the close dot and `•••`, with the middle permanently empty. *The chrome band is the formatting surface* then put a four-item capsule in that middle whenever the note is focused and editable, and *the band is a fixed height* raised the controls to 23px:

```
sized for this    ┌──────────────────────────────┐
                  │ ✕                        ••• │
                  │ Shopping                     │

has to hold this  ┌──────────────────────────────┐
                  │ ✕      [Aa ☑ ▦ 📎]       ••• │
                  │ Shopping                     │
```

Two 23px controls with their insets plus a four-icon capsule is most of 200pt before any text measure exists at all, and board `01` only ever draws the band on a normally sized note.

> **The minimum width is whatever the fully-populated chrome band requires, plus breathing room. The text measure is no longer the binding constraint — the band is.**

**Working value: ~240pt**, a placeholder in the same spirit as the 30px band and note-model's 360 × 420 creation default — sensible now, tuned in the build. Derived rather than tasted: two 23px controls with 8px corner insets, a four-item capsule at roughly 126pt, and a gap either side comes to ~212pt, so ~240 leaves the band reading as furniture rather than wall-to-wall. What is left under it is still a usable measure — about 206pt, near 35 characters.

**The alternative was making the capsule conditional on width, and it was rejected.** The proposal was to keep the old floor and have the band drop its formatting group below a threshold, degrading to *Format ▸* in the corner menu — which is a real fallback, since that submenu carries the full set with shortcut hints, and it is **direction C** from the formatting-surface board, a candidate weighed and found acceptable-but-not-preferred rather than a failure. It lost on furniture: controls that appear and vanish as you drag a corner are exactly the fidget the fixed-height band decision was made to remove. One geometry in every state is the property worth keeping.

**The constraint that looked decisive was not.** *"Left rail"* is used as the worked example throughout Positioning at a 200pt width, which the raised floor would invalidate — except **edge rails are not built-ins**, as that subtopic already states: Left rail is an illustration of a *user* preset, so nothing shipped depends on the number. And a user preset narrower than the floor is already handled — *a preset whose captured size is below the minimum clamps up to it, and shrinking never clips, because a note is a scrolling text surface*. The example has been **re-cut to 280pt** across the document in the same pass, so it stays a preset a user could actually create.

**Height is unaffected.** The band is a fixed height whether filled or empty, so the minimum height derivation stands exactly as written.

*Consequence, and it strengthens rather than weakens the argument it feeds: the refused-file decision declines to draw its reason on the note partly because a note may have nowhere to put a sentence. At the floor there is now no room for a sentence **or** the capsule, which is the same conclusion with more force.*

### Decision — Float-on-Top indication (resolves review-001 F5)

**No persistent indicator.** A floated note is *self-evidently* floating — it visibly stays above other windows; that on-top-ness **is** the signal. Reinforced by each note's distinct **coloured tinted-glass background** — notes are already visually differentiated at a glance. The corner-menu **Float on Top** toggle shows its checked state on demand. This honours discovery's hard rejection of persistent "pinned" chrome; no at-rest cue is needed. (A subtle higher-shadow/elevation cue was considered and dropped — unnecessary, and it risks the at-rest chrome discovery rejected.)

**Multi-float confirmed (resolves review-002 F2).** Float on Top makes a note stay above all **non-floated** windows; several floated notes form a **tier**, and within that tier they **stack normally** — bring one to the front and it rises within the group, staying floated. Still **no indicator**: a hover/focus-revealed float glyph in the chrome band ("Option B") was offered and **declined** — the behaviour *is* the signal (a floated fumi stays on top when a normal window or another fumi is moved over it; two floated fumis just stack among themselves). The **Float on Top** menu item (corner menu, and the app menu-bar Note menu) carries a **checkmark** when on — state on demand. Adopt Stickies' **`⌥⌘F`** shortcut (its exact term + shortcut — validated against the Stickies Note menu). **Toggling off:** open the menu, see the tick on **Float on Top**, click to untick → the note rejoins normal stacking (still on top while focused, but now free to drop behind another window — fumi or not — when you switch away).

The pin-icon alternative (our own corner pin glyph shown when floated) was floated and **declined** — the tick + self-evident behaviour is enough; a persistent pin is the "pinned chrome" discovery rejected.

### Decision — multi-note focus & click model (resolves review-002 F1)

Fumi is a **field of many notes**, not one. Z-order is normal window stacking with **click-to-raise** (clicking any part of a note brings it above its neighbours). Focus is **single-click** — no macOS "click to activate, click again to edit" two-step. **Any click raises + focuses** the note, and a focused note's editor **always has a caret**; where the caret lands depends on where you clicked:

- Click the **title bar** (top chrome band) or an **edge**: caret goes to the **end** of the content (window focused, no specific content point chosen). *Verified vs Ghostty: clicking the title bar alone flips its block cursor hollow→filled — focus places the caret without touching the text.*
- Click **inside the content**: caret lands at the **click location**. One click, right down to the cursor.

Drag gestures split the same regions — see the **F5 drag decision** below (move = title-bar only; resize = edges/corners, focus-gated; select = content). Keyboard: **`⌘W`** closes the frontmost/focused note; **`⌘\``** cycles focus across open notes (standard). Floated-tier ordering → review-002 F2 (next).

### Decision — drag model: move / resize / select (resolves review-002 F5)

#### 2026-09-01 — revised

*Trigger: review finding — the move zone and the formatting capsule are specified over the same strip, and neither decision mentions the other (review-010 F3).*

*Drag model* fixed move as the band *"between the close and `•••` icons"* while the band was permanently empty in the middle. *The chrome band is the formatting surface* then filled exactly that region whenever the note is focused and editable — which is the state a user is in while working — and said nothing about what that does to the move gesture. At the ~240pt width floor the derivation leaves only the slivers either side of the capsule:

```
move zone as decided   │ ✕ ←———————————————————————→ ••• │

what now sits there    │ ✕      [Aa ☑ ▦ 📎]       ••• │
                         └ 26 ┘                └ 26 ┘      at the ~240pt floor
```

> **The band moves the window everywhere it is not a control — the capsule's own background included. A drag begun on a control is a cancelled click, never a move.**

**This is the macOS toolbar rule, adopted rather than invented.** Drag a toolbar's background and the window comes with you; drag a button on it and you get a cancelled click. Borrowing it costs no new concept, and it reclaims the capsule's internal padding as move target, so the floor case stops being tight rather than being tolerated.

*Rejected: leaving move to the gaps either side.* It asks the smallest note to carry the smallest handle, at exactly the size where the window is hardest to grab.

*Rejected: reopening move to the whole window background.* It collides head-on with the third gesture below — the note's background **is** content, where drag selects text — and that collision is what *Drag model* was written to settle in the first place.

**A consequence carried at its own site:** *Window mechanics* still read *"**Move** = drag the window background"*, which this block already contradicted. That is struck under the same finding rather than filed separately, because had this landed the other way the older phrasing would have become right again — one question, not two.

**Geometry stays build-time.** The 26pt figure is derived from the ~240pt floor, itself a working value; what is pinned is the rule about *which surfaces* move the window, never the pixel budget.

*Sibling check: no overlap found. Move, resize and select over the note's own chrome are this topic's throughout — no sibling document defines the band, the capsule or the note's hit-testing.*

#### 2026-07-24

Three drag gestures, each owning a distinct zone. **Move is title-bar-only** — the macOS convention; you cannot drag a window by its edges or footer:

- **Move** = drag the **title bar** (the top chrome band, between the close and `•••` icons), *only* there — not the side edges, not the bottom/footer, not the margins.
- **Resize** = **edges** (one dimension) + **corners** (both); the cursor swaps to the resize arrows on hover. **Focus-gated:** the resize cursor appears only when the note is **already focused** — hovering the edge of an *unfocused* note changes nothing; you click to focus (raise) first, then edge/corner resize is live. *(Verified vs Ghostty — an unfocused window offers no resize affordance until clicked.)* Prevents accidental resize of background notes.
- **Select** = drag anywhere **inside the content** (everything that isn't the title bar or the edge band) → text selection. The **empty area below the last line** is content (click → caret at end, drag → select); it is **not** a move zone. Move stays title-bar-only.

**Hit-testing is opacity-independent** (resolves review-002 F6): the panel is **fully opaque to input at any visual opacity** — clicks always grab / focus / move the note, never fall through to what's behind. Opacity is purely cosmetic; no system treats translucency as click-through.

### Decision — global opacity: a normalised range, floored per swatch (resolves review-006 F13)

Opacity was named in the topic's Context line and the discovery brief, and it **constrains** three landed decisions — each swatch must keep its roles distinguishable *"as global opacity thins the fill"*, hit-testing is opacity-independent, material and opacity are global while colour is per-note — but nothing ever decided **where it is set, what its range is, or what stops it going too far**. The user had no strong view (*"yeah I guess, not sure really"*), so the call is made here on the merits.

**The problem it has to solve.** Thinning the fill degrades two things at once: **roles stop being mutually distinguishable** (every note drifts toward the wallpaper), and **text legibility drops**, because the frosted backing is what makes text readable over an arbitrary desktop. Both are worse for low-chroma swatches — and the two most exposed are **Paper** (`oklch(96% 0.022 h)`) and **Graphite** (chroma 0), already flagged as unsignable-off from a static board because their tint is weaker than the wallpaper cast. **Graphite is also the achromatopsia answer**, so the swatch carrying an accessibility guarantee is the most fragile one under this control.

**A per-swatch floor is right. Exposing it as a floor is not.** If the slider stopped at a different point per swatch, then — since **swatch is machine-local and opacity is a separate setting** — switching swatch would silently change what a stored value means, or clamp it and lose the user's choice. Hitting an invisible wall that moves is worse than having no control at all.

**Decided:**

- **The control is a normalised 0–100%**, and **each swatch maps that span onto its own safe range**. `0%` is the thinnest *that swatch* can go and still work; `100%` is its full fill. Same control everywhere, no wall to hit, and the floor is expressed as data rather than as an error state. **This is the roles pattern one level up**: the user picks a position, the swatch decides what it renders as.
- **The floor is derived, not tasted.** Its two bounds are testable: the point where the swatch's roles stop being **mutually distinguishable**, and the point where **text contrast falls below WCAG** against a worst-case desktop. Actual values land at the colour-and-material implementation checkpoint, against real Liquid Glass — the same checkpoint that owes us Paper and Graphite.
- **It lives in the manager**, under *surface-follows-the-object* — global state, so the manager, alongside material, the Light/Dark/System chrome flag and the read-only swatch library. Consistent with retention, presets and keybindings.
- **It is per-machine and backed up**, for the same reason the active swatch is: viewing conditions differ per display. Already listed as a candidate in the per-device-settings entry routed to storage-and-sync.
- **Under Reduce Transparency the control has no effect** — the glass is already opaque and the tint is solid. It should read as unavailable rather than silently doing nothing.

### Decision — menus: corner menu ↔ app menu bar ↔ status item (resolves review-002 F3)

Fumi has a **standard macOS app menu bar** (the spike shows *Fumi · File · Edit · Note · View*). The note-as-object actions get a first-class home in a **Note menu** — each with a keyboard shortcut. Two surfaces, two jobs: **corner menu = in-place/contextual; menu bar = discoverable + shortcuts + accessibility.** The menu bar is fully keyboard/VoiceOver-navigable, so it is the **proper a11y/keyboard home** the custom on-note glyphs deferred — cleanly closing the earlier a11y point rather than bolting a11y onto the glyphs.

#### Amendment — formatting is a top-level `Format` menu, and the mirror rule is dropped (2026-08-10, resolves review-009 F4)

Two things were left unclosed here. The section deferred one item explicitly — *"(Format / text-styles → Editing UX subtopic.)"* — and Editing UX never named formatting's home in the bar, while making menu-bar backing **load-bearing** rather than incidental: shortcuts are user-overridable partly *"because every formatting action also lives in the menu bar, macOS's System Settings → Keyboard → App Shortcuts can rebind any of them **by name** for free."* App Shortcuts addresses a menu item by its path, so *where* formatting sits is part of that decision's substance, not a presentation detail.

> **Formatting is a top-level `Format` menu: *Fumi · File · Edit · Format · Note · View*.**

Where macOS puts it — Pages, TextEdit, Mail — so someone rebinding a shortcut in System Settings looks where they already look. Nesting it as `Format ▸` inside Note was the alternative and loses on exactly that: nobody hunts for formatting inside an app's own bespoke menu, which forfeits the discoverability the menu bar exists to provide.

~~**Same action set, two surfaces.**~~ **The mirror rule is dropped.** It said the Note menu *"mirrors the corner `•••`"*, and the corner menu carries `Format ▸`, so keeping the mirror would have forced formatting into Note purely to preserve a correspondence — the tail wagging the dog. **It was also never a requirement**: the user's own account is that they never specified it, so it was a design invention that then constrained a later decision. Nothing else was resting on it either: the corner menu's own principle is *"the note's menu bar… what an app's menus would carry **for the focused document**"*, which already predicts what belongs there without requiring any other surface to match item for item. The two surfaces overlap heavily because they serve the same object, not because a rule obliges them to.

**The Note menu's enumeration above was also stale** and is superseded by the corner menu's revised contents (2026-07-29, review-006 F11): the note-as-object items are **Colour** (the role strip's equivalent) · `Move to ▸` · `Move to Display ▸` *(more than one screen only)* · **Float on Top** `⌥⌘F` · **Edit as Markdown** · **Version History…** · **Delete**. `Format ▸` is not among them — it has its own menu now.

- **File**: New Note `⌘N`, Close `⌘W`. **Edit**: undo/redo/cut/copy/paste/select-all (text). ~~(Format / text-styles → Editing UX subtopic.)~~ *(Closed 2026-08-10 — `Format` is its own top-level menu; see the amendment above.)*
- **Distinct from management-window's menu-bar *status item*** (top-right icon: new note, recent notes, open manager) — that surface is app/global; the Note menu + corner menu act on the **focused note**. No overlap.

#### Amendment — the swatch switch lives in `View` (2026-09-22)

**Settled by derivation** — not discussed. Determined by the bar's own established contents, every other menu being ruled out by what it already carries.

*Retiring the corner menu's eighth cell left the swatch reachable from two places — Settings' Swatches pane, and "the app menu bar" — and the second was never given a menu. The bar is enumerated two decisions up as **Fumi · File · Edit · Format · Note · View**, and the `Note` menu is document-scoped by construction, so an app-scoped act had no home in it. That mattered more than it looks: the menu-bar route is what answers the live-preview argument for keeping the cell, so leaving it unplaced would have left the retirement resting on a surface that did not exist.*

> **`View ▸ Swatch ▸` — the ten sets, a checkmark on the active one. Selecting one re-tints every fumi live.**

**`View` is where macOS puts choices about how the app presents itself** — toolbars, sidebars, appearance, zoom — and every other menu is excluded by its own contents rather than by preference: `Fumi` is identity and preferences, `File` is document lifecycle, `Edit` and `Format` are text, and `Note` acts on the focused note alone. A palette that re-renders every note in the library is a view-level choice.

**It also puts the two colour acts in visibly different menus**, which is the distinction the retirement was made to draw in the first place: **`Note ▸ Colour`** picks *this* fumi's role, **`View ▸ Swatch`** picks the set everything renders through. The user's own words — *"the corner menu is for picking the colour of the Fumi. The swatch menu is for picking the swatch. Two different things entirely."*

*Sibling check: management-window — its decided text holds the Swatches pane as where a swatch is switched, and owns the menu-bar status item; neither is touched. This decides only the app menu bar's own home for the same act, which is this topic's, and gives the Settings pane a second route rather than a competitor.*

### Decision — a fumi is an ordinary window under system window management (2026-09-01, resolves review-010 F9)

The topic's premise is a persistent field — *"Fumi is a **field of many notes**, not one"*, close=hide so *"'open' is the resting state"*, notes as furniture that stay where you put them. The window is specified as borderless with a transparent titlebar, and Float on Top as a window level. What was never specified is how a fumi behaves when the **OS** decides to move or hide windows: Stage Manager, Hide Others (`⌘⌥H`), Show Desktop, App Exposé. Stage Manager appears once in the whole document, and only as a cost of turning *Displays have separate Spaces* off.

> **A fumi participates in system window management like any other window. It opts out of nothing.**

**The user's call, and the argument is this document's own:** *"we can't fight the OS, nor should we try."* *A display disconnect is not a user action* already settled this axis — *"**Do nothing — let macOS relocate the window.** The WindowServer already moves windows off a vanishing display; intervening would double-move them and fight the OS"* — and research confirmed it from the other side: *"While running, Fumi does nothing."* Excluding fumis from Stage Manager or from Hide Others is that same intervention, one gesture along. So Stage Manager groups them, Hide Others hides them, Show Desktop clears them, App Exposé gathers them.

***Rejected: opting out of the hiding gestures*** (`collectionBehavior` exclusions, `canHide = NO`). The case for it was that a fumi swept into a Stage Manager thumbnail stops being furniture and becomes a document you have to go and fetch. It loses for three reasons: it overrides a mode the user deliberately switched on; it is the intervention the WindowServer rule already forbids; and it would put Fumi in the business of arbitrating window management, which the project has consistently declined — the private surface here is *"Spaceman's read capability plus exactly one write capability, applied to Fumi's own windows"*, not a window manager.

**What survives from that concern is a consequence, and it is load-bearing: the OS hiding or moving a fumi never writes anything.** Being swept into a Stage Manager strip or hidden by `⌘⌥H` is not a close, so `open/hidden visibility` is untouched and the note is still *open*; being moved is not a drag, so no home and no coordinates are written. This is the intent-versus-resolution line the display-disconnect amendment already drew — *a home is intent; where a note sits is resolution; fallbacks resolve but never rewrite* — extended from topology changes to window-management gestures, which are the same kind of event: the OS acting, not the user placing.

*The failure this prevents is concrete: a `⌘⌥H` recorded as hiding would mean the desk does not come back at the next launch, and the user would have hidden every note without ever closing one.*

*The case that exposed the split as unworkable was **Show Desktop**, put to the user as the one gesture the rejected reading could not classify — its whole purpose is to get everything out of the way, so a note refusing to move is obstructing rather than persisting, while a note that moves is doing the very thing the split was written to prevent. The answer was not to arbitrate it but to stop arbitrating at all.*

**Float on Top is unaffected.** It is a window level, which the OS honours natively; a floated note sits above non-floated windows within whatever arrangement the current mode produces. No special case.

*Not measured: what Stickies actually does on each of these gestures. It is the obvious precedent and worth a look at implementation, but the rule above does not rest on it — it rests on not intervening, which needs no precedent to justify.*

*Sibling check: note-model — its decided text holds `open/hidden visibility` in the **Machine tier**, per-machine and durable rather than derived, on the stated ground that "open notes should return after a reinstall". That is exactly what the no-write consequence protects; nothing about the field or its tier is revised here, only what does and does not count as a write to it.*

### Decision — focus / active-state look

The focused note uses the **native key-window treatment**, nothing custom: macOS gives a key window a **larger / thicker / wider drop shadow** for free, so the active note sits proud; plus its **revealed controls** (close + `•••`) appear (and colourize). The **surface itself doesn't change** — no glass-brightness shift, no tint change. *Verified vs Ghostty: on focus only the drop shadow deepens/widens and the corner controls colourize; the window body is unchanged.* Furniture-consistent and mostly free from the platform. This **completes the state model** (at-rest → hover → focus).

---

## Colour

Brief-native. **Settled upstream (note-model — not reopened):** colour = a **curated-palette token** (semantic name, never hex), **curated-only** (no open picker — the taste guarantee), **flood** tinted glass (accent-edge rejected), **default = neutral glass**, opt-in per note; colour is **per-note** while material + opacity are **global**. This subtopic realises that token decision as a **two-level swatch system**.

*From: platform-support · research · 2026-09-06*

Four of this subtopic's decisions rest on system materials going opaque under **Reduce Transparency** automatically — the whole-surface degradation, plus the tag pill, attachment chip and inset block. That behaviour belongs to a **named** system material, and the note's glass is not one: the spike declares `blur(40px) saturate(180%) brightness(106%)` on the note and `blur(30px) saturate(180%)` on the `Aa` popover, while `NSVisualEffectView`'s entire property surface is `material · interiorBackgroundStyle · blendingMode · state · maskImage · emphasized` — a name, no radius, no saturation, no brightness, and no way to tell 40 from 30. The path that expresses the drawn design is `NSView.backgroundFilters`, an arbitrary `CIFilter` chain over the backdrop, which has no documented accessibility behaviour of its own.

*Both re-measured 2026-09-11 against the 26.5 SDK:* `grep -E '^@property' "$(xcrun --show-sdk-path --sdk macosx)/System/Library/Frameworks/AppKit.framework/Headers/NSVisualEffectView.h"` → six properties, exactly the list above; `grep 'backgroundFilters' "$(xcrun --show-sdk-path --sdk macosx)/System/Library/Frameworks/AppKit.framework/Headers/NSView.h"` → `@property (copy) NSArray<__kindof CIFilter *> *backgroundFilters API_AVAILABLE(macos(10.5));` — fifteen years below the floor. Unproven in both directions — nobody has built either version — but it puts an accessibility outcome on a contingency, which is resolved below.

*From: management-window · discussion · 2026-09-21*

**The ask: remove the swatch-switcher cell from the note's corner menu.** The role strip returns to seven role chips and nothing else. Switching the active swatch happens in Fumi's Settings window, and in the app menu bar.

**What is being retired.** The *switching swatch from the note* decision (2026-07-29) gave the role strip an eighth cell opening a submenu of all ten sets, each row previewing its colours with a checkmark on the active one, selecting one re-tinting every note live. Its stated justification was a gap:

> The swatch level had no reachable surface — the corner menu's strip picked a **role**, and nothing picked the **set**.

**Why the justification has expired.** That gap is now filled properly. management-window has decided a **Swatches pane** in a dedicated Settings window: all ten sets listed with name, one-line description and a seven-role colour preview, the active set marked, selecting a row activating it and re-tinting every fumi live. It is also searchable, and it is where the plain-language descriptions live — the discovery path for Okabe–Ito and Graphite, which nobody recognises by name. The swatch level now has a first-class home, which it did not when the eighth cell was added.

**Why it should go rather than simply become redundant.** The corner menu's every other item acts on *this note* — Format, Move to, Float on Top, Edit as Markdown, Version History, Delete, and the seven role chips. The eighth cell acts on *every note in the library*, and it sits in eighth position in a strip of seven chips, at chip size, in chip shape. Position tells the user it is another colour for this fumi. The user's own words on discovering this: *"changing the swatch, I feel like maybe doesn't belong there now that we have the management window"* — and, having had to spell the distinction out, *"the corner menu is for picking the colour of the Fumi. The swatch menu is for picking the swatch. Two different things entirely."*

The scope mismatch was noted at the time and accepted, in this topic's own words: *"Tension with the surface rule, stated rather than hidden: 'curating a library happens in the manager' would put swatches there. But switching is a one-click state change, not curation, and it belongs beside the strip it affects."* That trade was reasonable when the alternative was no surface at all. It is not reasonable against a real settings pane.

**The counter-argument, considered and rejected by the user.** A swatch is a visual judgement best made while looking at your notes: from the corner menu you flip sets and watch every fumi on screen re-tint live, in your own light, on your own desktop — where the Settings pane shows you seven 28px chips per row. Weighed and declined: the menu bar's own swatch route (already recorded in the note-window spike's caption, *"Also reachable from the manager and the app menu bar"*) preserves live-preview switching from anywhere without putting a global act inside a per-note menu.

**What this does not change.** Everything else about the swatch model stands: ten fixed sets, no authoring, roles as note identity, the active-swatch pointer as a stable machine-local id, and re-tinting that keeps each note's role. Only the corner-menu surface is withdrawn.

**Sites this likely touches in note-window's record:** the *switching swatch from the note* decision itself; the role-strip anatomy that reads *"seven role chips + an eighth swatch-switcher cell opening the set list"*; the corner-menu spike artboard `05 — Corner Menu`, whose swatch submenu variation would go; and the terminology note distinguishing the selected-role ring from the switcher submenu's active-swatch checkmark, whose second half becomes moot on this surface.

### Decision — two-level colour model (role + swatch)

Colour splits into two levels:

- **Per-note: a colour *role/slot*** — stable, stored on the note (this *is* note-model's "token"), **not surfaced as a text label**.
- **App-level: the active *swatch/theme*** — maps every role → a curated, **harmonious set** of tinted-glass colours (all notes on screen work together, whatever their role).

Changing the app swatch **re-tints every note live** (one red becomes another red, still harmonious as a set). Keeps the taste guarantee (curated, can't-make-it-ugly) *and* gives real user control without a settings-swamp. The picker shows the **current swatch's actual colours** to pick from — the user picks a colour visually, never a label.

### Decision — the shipped swatch set (researched 2026-07-29)

Spiked on `02` as **ten sets over the same seven roles**, so they read as sets rather than as loose colours. The user's steer: *"there's no real hardship in shipping with a nice handful."*

**Storage: every swatch is seven literal values. There is no runtime generation** (corrects an earlier draft of this section, which described a generated storage shape and a literal one — the user pushed back and was right: *"all of these swatches should be pinned values in the code"*). The repository holds ten tables of seven resolved colours plus a foreground per role. Nothing is computed at paint time.

**OKLCH was the derivation tool, not the format.** Six of the ten were *authored* by holding one lightness and one chroma constant and rotating only the hue angle across the six coloured roles (Yellow 100° · Orange 60° · Red 25° · Green 150° · Blue 250° · Purple 320°), with **Neutral at chroma 0**. OKLCH is perceptually uniform, so equal L and C genuinely *look* equally light and equally saturated across hues — which is the "constant within a set" rule below, made mechanical instead of eyeballed. The triples are recorded **as provenance**, so a future swatch can be made the same way, and so the intent survives if a value ever needs re-tuning.

**Caveat found while pinning the values: the regularity is approximate at the loud end.** Several derived colours in **Sorbet** and **Highlighter** fall outside sRGB and clip on conversion, so their real lightness and chroma drift from the nominal triple. The pinned hex is authoritative; the OKLCH triple describes how it was reached. **Bulletin**, **Dusk** and **Wash** were hand-picked and have no triple at all; **Okabe–Ito** is a published standard. The rule "constant L and C within a set" is therefore a **design heuristic that produced most of these tables**, not a property every table satisfies — and **Graphite deliberately inverts it**, varying lightness precisely because that is the only axis left when chroma is zero.

**The pinned values.** Fill alphas vary by set (the tinted-glass fill opacity). **Foregrounds are not in this table — every one is per *role*, contrast-checked against its own tint.**

*(Amended 2026-08-10 — this read "foregrounds are dark unless noted", with **Ink**, **Dusk** and **Midnight** annotated *(light fg)* below and the rest left implicitly dark. That states a foreground **per swatch**, which *the note surface does not use system vibrancy* rules out as forced rather than chosen: **Okabe–Ito** carries `#F0E442` (needs dark text) and `#0072B2` (needs light) in one set, and **Graphite** spans `97% → 60%` and crosses the threshold mid-ladder. The storage shape three paragraphs above already said it — "seven resolved colours **plus a foreground per role**". The annotation was shorthand that reads as a rule, and a spec writer following it would give Okabe–Ito a uniform dark foreground, which is precisely the failure the vibrancy decision exists to prevent. The row notes are kept as **character** — those three are the deep sets and mostly resolve light-on-dark — which is a description, not a value. The values land at the colour-and-material checkpoint.)*

| Swatch | Neutral | Yellow | Orange | Red | Green | Blue | Purple |
|---|---|---|---|---|---|---|---|
| **Paper** `oklch(96% 0.022 h)` | `#F4F1EC` | `#F5F2E2` | `#FEEFE3` | `#FFEDEA` | `#E8F6EA` | `#E7F3FF` | `#F9EDFB` |
| **Wash** *(hand-picked, default)* | `#F4F5F7` | `#F9EAAE` | `#FAD9B4` | `#F7CBCE` | `#CCE7CF` | `#C7DCF0` | `#DBD1ED` |
| **Sorbet** `oklch(87% 0.11 h)` | `#E6E0DB` | `#E5D67F` | `#FFC389` | `#FFB8B0` | `#9FE9AE` | `#9CDAFF` | `#F5BDFF` |
| **Bulletin** *(hand-picked)* | `#FCFBEF` | `#FFF07A` | `#FCBE72` | `#F78EB8` | `#CEE86A` | `#8FD4D0` | `#C68DC2` |
| **Highlighter** `oklch(91% 0.175 h)` | `#E7ECF0` | `#FDE339` | `#FFC259` | `#FFAFA5` | `#80FFA1` | `#7EE8FF` | `#FFB9FF` |
| **Graphite** *(lightness ladder, chroma 0)* | `#F5F5F5` | `#DEDEDE` | `#CACACA` | `#B7B7B7` | `#A4A4A4` | `#929292` | `#808080` |
| **Ink** `oklch(58% 0.085 h)` *(deep set — mostly light-on-dark)* | `#807973` | `#867B3C` | `#9F6E44` | `#A76661` | `#54895F` | `#527EAB` | `#916A9A` |
| **Dusk** *(hand-picked, deep set — mostly light-on-dark)* | `#2C2F3A` | `#47411F` | `#4A3823` | `#48292B` | `#2C4030` | `#26384C` | `#3A2F4A` |
| **Midnight** `oklch(30% 0.055 h)` *(deep set — mostly light-on-dark)* | `#292E35` | `#342E08` | `#42270E` | `#462220` | `#17351F` | `#162F48` | `#3A243F` |
| **Okabe–Ito** *(published, unmodified)* | `#EDEDED` | `#F0E442` | `#E69F00` | `#D55E00` | `#009E73` | `#0072B2` | `#CC79A7` |

*Board `02` was reconciled to exactly these values in the same pass, so the board and this table agree — the point of the hygiene rule that a value is pinned here **and** rolled across the artboards together. **These remain provisional in the sense already stated**: the direction is fixed, and final tuning happens against real Liquid Glass at the colour-and-material implementation checkpoint. What has changed is that there is now something concrete to tune **from**.*

| Swatch | Definition | Character |
|---|---|---|
| **Paper** | `oklch(96% 0.022 h)` | Barely tinted, almost stationery |
| **Wash** | the muted tinted-glass palette from the canonical spikes | Quiet, the house style — **ships as the default** |
| **Sorbet** | `oklch(87% 0.11 h)` | Bright and fruity, one step up from Wash |
| **Bulletin** | saturated pastel assortment | Punchy; the noticeboard feel |
| **Highlighter** | `oklch(91% 0.175 h)` | Loud, high-chroma |
| **Graphite** | `oklch(97→60% 0 0)` | No hue at all; a lightness ladder |
| **Ink** | `oklch(58% 0.085 h)` | Deep and saturated; most roles resolve light-on-dark |
| **Dusk** | dark, muted, warm-cast | A dark set, **chosen not triggered** |
| **Midnight** | `oklch(30% 0.055 h)` | The deep dark set; most roles resolve light-on-dark |
| **Okabe–Ito** | published values, unmodified | The CVD-safe set |

### Decision — swatch naming: every set gets a proper name (2026-07-29)

**Rule: a swatch is named, never labelled by its function.** Two entries broke this and were renamed at the user's prompting — they were *"the odd ones out"*:

- **`Default` → `Wash`.** A watercolour wash: muted tint laid over white. "Default" is a **flag on a swatch, not a name** — exactly one set ships as the default and that flag is what the manager's restore acts on, but the set itself is Wash like everything else. *(Alternatives considered: Haze, Chalk, Mist.)*
- **`Colour-Blind Safe` → `Okabe–Ito`.** Keep the name of the specification it *is*. An invented name (`Semaphore` was proposed and rejected) is backwards for a set whose entire authority comes from being a published standard — and **Okabe–Ito is a real credential**, the name used in matplotlib, R and ggplot, so the people most likely to need it may already know it. It satisfies the naming rule *and* carries provenance, which no coined name can.
- **`Post-it Classic` → `Bulletin`.** *Post-it* is 3M's trademark and *Stickies* is Apple's app. Bulletin board: saturated paper squares, no brand. *(Alternatives considered: Tack, Canary, Fridge Door.)* (Its colours remain anchored on the real spec — **Canary `#FFFF99`, Pantone Yellow 0131 C** — see [brandpalettes](https://brandpalettes.com/yellow-post-it-notes-colors/), [schemecolor](https://www.schemecolor.com/yellow-post-it-notes-color.php).)

**Where the description lives**, since `Okabe–Ito` still won't mean anything to a lay user: the **corner submenu shows the name only** (it is for *switching*, by someone who already knows which set they want), while the **manager's swatch library shows name plus its one-line description** (it is for *choosing*). Accessibility settings can point at it by description too. Same surface rule as everywhere else.

**Harmony is *within* a swatch, never across swatches** (user). The point of having several is that they have **entirely different feels** — Paper is barely there, Bulletin is punchy, Midnight is deep. A first pass blended the pastel treatment into every set, which made them variations of one another and defeated the purpose. What must be constant is **lightness and saturation *inside* a set**, so its roles read as a family; the *level* is what differs between sets.

### Decision — the CVD swatch: published values, and why there is only one (2026-07-29)

**Okabe–Ito ships with its published hex values, unmodified:** `#F0E442` · `#E69F00` · `#D55E00` · `#009E73` · `#0072B2` · `#CC79A7`, with a light neutral for the uncoloured slot. **Foregrounds are computed per role by WCAG contrast**, so they differ down the row — they are *not* specified by Okabe–Ito, which defines colours and says nothing about text on them.

**One swatch covers all of it — by design.** Okabe and Ito built the set as a **single palette safe across protanopia, deuteranopia *and* tritanopia simultaneously** (plus their commoner anomalous-trichromacy forms), which is the whole premise of Color Universal Design and what distinguishes it from the many palettes that only handle red–green. It separates on **brightness and saturation as well as hue**, and deliberately avoids the yellow-green range where confusion is greatest. So **per-condition swatches would be a misreading of it** — and worse in practice, since the user would have to know their exact type to pick correctly. ([Okabe–Ito reference](https://conceptviz.app/blog/okabe-ito-palette-hex-codes-complete-reference), [sci-draw](https://sci-draw.com/blog/colorblind-safe-palettes-okabe-ito-reference))

**The one case it cannot serve is achromatopsia** — total colour blindness, ~1 in 30,000. No hue-based palette can; only lightness separates. That is covered instead by **Graphite**, an achromatic swatch whose roles are a pure lightness ladder (`97% → 60%`, chroma 0). It is a legitimate swatch in its own right — "I don't want colour" — that happens to be the maximally safe one.

**A darker CVD variant is not derivable from the spec, and we are not inventing one.** The published hexes *are* the validated artefact; shifting their lightness is precisely what breaks them. A dark CVD set would be a new palette requiring its own simulator validation, which is implementation work, not a board decision.

**Validation is by simulation, not by eye.** Whether the set works is checked by running it through protanope / deuteranope / tritanope simulation — it cannot be asserted from a static board, and it cannot be judged by a trichromat's impression of it.

*Three errors, recorded because each has a distinct lesson:*
1. *A first CVD row was **invented rather than researched** and rejected outright as "horrible" — which it was.*
2. *A second was **derived from Okabe–Ito by lightening it into pastels** to match the house style. That voids the validation: the set works because of its specific brightness/saturation relationships, so a pastelised Okabe–Ito is not Okabe–Ito. **An accessibility palette is used, not adapted.***
3. *Its foreground colours were claimed to come from the spec. They do not — the spec defines colours only, and **WCAG contrast is the right standard** for text on them.*

*And one heuristic worth naming, because it cost several rounds: the user's repeated tell was **"it looks good to me, which is a red flag."** It isn't. A CVD-safe palette is **supposed** to look fine to normal colour vision — serving everyone at once is the design goal. That heuristic rejects every correct answer, so it can never converge; the test is simulation.*

*That constancy rule also diagnosed three complaints at once: amber reading brown, rose reading purple, and the set not cohering. All were symptoms of lightness and saturation drifting between roles rather than of the individual hues being wrong. ([muted/pastel palette guidance](https://www.uxmatters.com/mt/archives/2023/04/using-a-muted-color-palette-in-web-design.php))*

**A finding the board makes visible:** in the Okabe–Ito set the **hues no longer match the role names** — the "Purple" slot renders bluish, because the set is built for separability, not for matching labels. That is precisely why **roles are stable slots and are never surfaced**. A user who picked "role 3" keeps role 3; only its rendering changes.

*Spike hygiene, twice corrected by the user: blocks must be **uniform in size** with **identical placeholder copy** — varying the text made the row ragged and drew the eye to words instead of colour — and **role labels must be consistent down the columns**, or the rows cannot be compared at all.*

### Decision — role naming: base hues only (revised 2026-07-29)

~~*Originally: neutral + warm/amber, red/rose, green, blue, purple, sand/warm-grey.*~~ **Revised** — that list mixed two levels of abstraction. **"Rose" and "Sand" and "Amber" name *renderings*; "Green" and "Blue" name *slots*.** As the user put it: calling a slot "Rose" is like calling the blue slot "Sky" — rose is a variant of red, sky a variant of blue.

**The seven roles are: Neutral · Yellow · Orange · Red · Green · Blue · Purple.** Base hues only, consistently. A role names a **position on the wheel**, not a colour — each swatch renders it however that swatch renders it, which is exactly why a pastel "Red" reads pink and the Okabe–Ito "Purple" reads bluish.

**And "Neutral" is the quiet role, not the absence of one (revised 2026-07-29, resolves review-006 F16).**

~~*Originally: "Neutral means no hue at all — the uncoloured note, the state before you choose a colour. Not a grey among colours; the **absence** of a role choice."*~~ **Wrong, and it caused real damage before it was caught.** The user: *"Neutral has colour. It's very, very subtle, but it definitely has colour… it's a valid choice on a swatch, so choosing between swatches will obviously update neutral."*

**Neutral is a role like the other six.** Every swatch defines it, switching swatch re-tints it along with everything else, and it is simply the **quietest** member of its set — the one that reads as uncoloured while still belonging. That also settles the question the review raised: **yes, picking Midnight turns your uncoloured notes dark**, because Neutral is Midnight's zeroth role, not an exemption from it. There is no "outside the swatch" surface.

**The damage the bad phrasing did, recorded because it shows how a definition leaks into artefacts.** "No hue at all" became a literal `chroma 0` in the generation rule, so the five generated swatches came out with **identical pure greys** distinguished only by lightness — `#F2F2F2`, `#E1E1E1`, `#EBEBEB`, `#7A7A7A`, `#2E2E2E` — while the hand-picked sets (Wash cool, Bulletin cream, Dusk blue-grey) had the character the others were missing. **Corrected:** each generated Neutral now carries a very low chroma on a hue suiting its set — Paper warm stationery-white, Sorbet faintly warm, Highlighter clean and cool, Ink warm grey, Midnight cool and deep. Values updated in the table above and on board `02`.

***Graphite is the deliberate exception*** and stays at chroma 0 throughout — being hueless is its entire premise, so its Neutral is the top of a grey ladder rather than a quiet tint. **Okabe–Ito** likewise keeps a plain grey, since lightness separation is what that set trades on.

*A board artefact worth recording: Neutral appeared to read purple. It wasn't the colour — it was **translucent glass over a purple artboard background**, the wallpaper showing through. Board `02` was moved to **white** so tints can be judged on their own. It is also a genuine product property: a neutral note will take a cast from whatever is behind it.*

**⚠️ Implementation checkpoint — the barely-tinted end cannot be judged from the boards.** The substrate stress test on `03` shows **Paper reading grey rather than barely-blue**, because at `oklch(96% 0.022 h)` the tint is weaker than the cast it picks up from the desktop behind it. This is the same wallpaper-cast property as the Neutral finding, and it bites hardest on the two lowest-chroma swatches (**Paper**, **Graphite**). Neither can be signed off on a static board — **both need checking against real wallpapers in the SwiftUI build**, alongside the existing colour-and-material human-in-the-loop checkpoint. The likely outcome if it fails is raising Paper's chroma or its fill opacity, not abandoning the swatch.

### Decision — roles + default swatch

**Roles** = a small fixed set of slots spanning the hue wheel, stored internally as stable slots (indexed or named under the hood — **not surfaced**). ~~*The default swatch renders them as the muted spike tints (neutral/lavender, sage, blush, butter…), rounded out to span the wheel.*~~ **Superseded 2026-07-29** — that description predates both the role renaming and the pinned values. It is wrong in two ways: it names *renderings* rather than slots (the error the role-naming decision fixed), and "neutral/lavender" names a rendering for a slot whose value is now pinned per swatch. The default swatch is **Wash**, and its seven values are pinned in the table above.

### Decision — swatches are data, not hardcoded

Swatches live in a **repository / config**, never hardcoded — **shipping** a new swatch, or re-tuning a role's colour within one, is a data edit rather than a code change. A **data-driven theme-set model**, not colours baked into views. *"Data-driven" here means **cheap for us to ship**, not editable by the user — see the decision below.*

*One storage shape for all ten: a table of seven resolved colours plus a foreground per role. See the pinned values above — OKLCH is how six of them were authored, not how any of them are stored.*

### Process — colour & material is a human-in-the-loop implementation checkpoint

When this reaches implementation, the colour + material work is an **explicit collaboration checkpoint with the user — even if auto-mode is on, flag for review.** Rationale: Liquid Glass look/feel can only be judged in the real macOS build; discussion + Paper mock are best-effort starting points and **will need real-time tuning** at the SwiftUI / Liquid-Glass stage. Carries forward to planning/implementation.

### Decision — appearance governs chrome, not note colour (revised 2026-07-29)

~~*Originally: each swatch carries both light and dark variants per role, and **System** re-tints all notes live when macOS switches (resolved review-003 **F5**).*~~ **Revised.**

**There is no light/dark pairing inside a swatch.** A swatch is **one complete set** — role→tint plus the foreground that reads on it.

**Why:** system dark mode does not mean a dark desktop. The user's own screen runs dark with bright yellow Stickies on it, and they look right. **A fumi's colour is a user-chosen identity, not a surface that responds to system appearance** — closer to content than to app chrome. Stickies is the precedent: it stays yellow.

*An earlier framing of this argument — "a fumi is glass over your wallpaper, not a window with its own background" — was **wrong and the user corrected it**. A fumi does have its own background; Liquid Glass only takes it so far, and a genuinely transparent frame would be unreadable. The conclusion survives, but on the identity-vs-chrome reason above, not that one.*

**Dark-tinted sets become swatches**, sitting alongside the default and the CVD swatches. Swatches are already data; a dark set is just another row in it. No mode required.

**The Light/Dark/System flag still exists and still follows macOS — it governs *chrome*:** menus, popovers, panels. Note fill is the swatch's business. This is the same boundary already drawn for F15 — *note colour comes from the swatch model; everything else is relative to its substrate or the system* — extended to appearance.

**What this costs:** review-003 **F5** is partly superseded. System still re-tints **chrome** live on an appearance switch; notes do not change, because they were never tracking the OS.

### Decision — switching swatch from the note

#### 2026-09-22 — revised

*Trigger: triage from management-window: "Retire the corner menu's eighth cell — the swatch switcher moves to Settings" — its Swatches pane now gives the swatch level a first-class home, so the gap this decision was written to fill no longer exists.*

> **The eighth cell is retired. The role strip is seven role chips and nothing else, and the swatch is switched from Settings and from the app menu bar.**

**The reason that carries it is this topic's own, not the new pane's.** The corner menu's contents were settled the same day as the eighth cell, under a principle written in the same pass: *"the corner menu is the note's menu bar… it carries what an app's menus would carry **for the focused document** — and nothing that is **app-scoped**."* Switching the set re-tints every fumi in the library, which is app-scoped by the plainest possible reading. The exclusion list attached to that principle names *swatch curation*, and the eighth cell was let through on the distinction that switching is not curation — but the principle's test is **scope**, not curation-versus-switching, and on scope the cell never passed.

**What the pane changes is the last defence, not the argument.** The entry below is explicit that the cell exists because *"the swatch level had no reachable surface"*. It now has one, so the trade the block itself recorded — the surface rule bent because the alternative was nothing at all — has nothing left on its other side.

**The cost, and why it is nil in practice.** What goes is flipping sets with the whole desk in view from the note itself, which is a real way to make a visual judgement. The **app menu bar** keeps exactly that: it re-tints everything on screen live from anywhere, without putting a global act inside a per-note menu. The route was already in the entry below as a supplement; it is now half of what there is.

**Everything else about the swatch model stands** — ten fixed sets, no authoring, roles as note identity, the active-swatch pointer as a stable machine-local id, re-tinting that keeps each note's role. Only the note-side surface is withdrawn.

*Sibling check: management-window — its decided text holds the Swatches pane as where a swatch is switched (all ten sets with name, description and seven-role preview, the active one marked, selecting a row re-tinting every fumi live), holds that its pane is a reader that never authors, and routed the cell's retirement here as a correction on the ground that the corner menu is this topic's surface. Adopted as written; what is decided here is only the withdrawal of the note-side cell, which that routing asked for rather than imposed.*

#### 2026-07-29

The swatch level had no reachable surface — the corner menu's strip picked a **role**, and nothing picked the **set**.

**The strip gains an eighth cell: a swatch-switcher**, which opens a **submenu listing the swatches**, each row previewing its own colours with a checkmark on the active one. Selecting one **re-tints every note live**; each note keeps its role, so a note you made role 3 stays role 3.

**Also reachable from the manager and the app menu bar** — it is app-level state, so it belongs in both.

*Tension with the surface rule, stated rather than hidden: "curating a library happens in the manager" would put swatches there. But **switching** is a one-click state change, not curation, and it belongs beside the strip it affects.*

### Decision — swatches are fixed; there is no custom-swatch authoring (resolves review-006 F5, F6)

~~*Originally: "**Curating** swatches — adding, editing, deleting sets — remains the manager's."*~~ **Reversed 2026-07-29.**

**The user cannot create, edit or delete a swatch. The ten shipped sets are the set.** The review caught that manager-side authoring silently undid note-model's **curated-only, no open picker** guarantee — the very guarantee the two-level model's justification leans on (*"keeps the taste guarantee … and gives real user control without a settings-swamp"*). That argument only holds while the user is choosing among sets someone else designed. The user's call on being shown the contradiction: *"let's remove custom swatches entirely… we can always add more."*

**Why this is the right trade, not just the simpler one:**

- **It restores the upstream guarantee instead of quietly breaking it.** A user-authored swatch is an open colour picker wearing a hat.
- **Ten sets spanning barely-tinted to deep-dark, plus an accessibility set, is a real range** — the pressure that would drive custom authoring is largely already answered.
- **It is the reversible direction.** Shipping fixed sets now and allowing custom ones later is additive; shipping custom ones and withdrawing them is not. Deferred, not rejected.

**What this collapses** (review-006 F5's swatch-lifecycle questions dissolve rather than needing answers):

- **No dangling references** — every swatch a note could resolve against is present in every build.
- **No "active swatch deleted"** state, because deletion doesn't exist.
- **No swatch library to sync**, only the pointer.
- **The active-swatch pointer is a stable id, never a name.** Forced by evidence, not caution: three of the ten were renamed in a single session (`Default`→`Wash`, `Colour-Blind Safe`→`Okabe–Ito`, `Post-it Classic`→`Bulletin`).
- **A shipped swatch re-tuned by an app update** re-tints notes live and correctly — the pointer and the roles are both stable, only the values moved.

**One question this leaves: the active-swatch pointer is *machine-local*, not synced** (user).

~~*A first answer said it syncs, on the grounds that "colour is identity" and the same note shouldn't read Bulletin Red here and Midnight Red there.*~~ **Wrong, and wrong at the level it operated.** In our own two-level model the **role is the identity** — and roles live on the note and *do* sync. Two Macs running different swatches still agree on **which notes are grouped together**; only the rendering differs. The swatch is genuinely presentation, and presentation is the one thing that reasonably differs per machine: *"the note is synced but its look and feel doesn't have to be"* (user).

**The supporting argument is viewing conditions.** A Studio Display in a bright office and a 14" laptop in a dark room are not the same instrument. Paper on one and Midnight on the other is a legitimate preference, and forcing them to agree serves nothing. This is also how macOS treats appearance itself — per machine, not per account.

**But it must still be backed up per machine.** A machine-local setting that vanishes on reinstall is a bug, not a design. Persist the pointer to the user's private CloudKit database **keyed by a stable per-device identifier**, so each Mac reads its own value and a reinstalled Mac gets its setting back. *Feasibility and the device-key mechanism are storage-and-sync's — routed there.* Two honest limits: a **genuinely new** Mac is a new device and starts on the default (correct, not a failure), and device identity across hardware replacement is approximate.

**What the manager still owns:** a **swatch library view** — each set listed with its name, one-line description and colour preview, which is where `Okabe–Ito` gets the plain-language explanation the corner submenu has no room for. A **reader, not an editor**.

*Also fixed at the same spike: the strip was **unbalanced** (more padding right than left) and its colours **did not match** the swatch drawn on board `02`. Both corrected — the strip now shows the default swatch's actual roles.*

### Decision — legibility (tinted glass)

Text stays readable via the **frosted fill (frost + tint) as backing**, adapting to whatever wallpaper is behind (spike-validated: dark text on frosted glass reads even over the brightest area — "the frost and fill do the work a raw translucent panel can't"). **Adaptive contrast** is the fallback for a worst-case tint+background; **no separate hard scrim** unless the real material proves insufficient. Each swatch is designed so its roles stay **mutually distinguishable — including as global opacity thins the fill** (resolves review-003 **F4** — a per-swatch design job).

### Decision — the note surface does not use system vibrancy (resolves review-006 F3, F4)

~~*Originally: "frosted fill as backing + **vibrancy text**".*~~ **Corrected 2026-07-29.** This was written when a note was assumed to be near-neutral glass, and the swatch work the same day killed that assumption without anyone revisiting it.

**macOS vibrancy resolves label colours against the system appearance, not against what is actually behind the text.** With **Ink** and **Midnight** in the set, that is not a trade-off, it is simply wrong: a near-black note under **Light** appearance would get dark label text. The mirror case — Paper or Highlighter under **Dark** — fails identically. *This was not a decision with pros and cons; it is a consequence that had gone unrecorded.*

**Therefore:**

- **The swatch owns every foreground on the note surface.** Each role carries its own text colour, hand-picked and contrast-checked, and it **overrides** anything the system would supply. No `.primary`/`.secondary` label styles on note content.
- **Foregrounds are per *role*, not per swatch** — also forced, not chosen. Okabe–Ito contains `#F0E442` (needs dark text) and `#0072B2` (needs light) in the same set; **Graphite** spans `97% → 60%` and crosses the threshold mid-ladder.
- **The same rule extends to the substrate-relative components** (tag pill, attachment chip, inset block), which review-005 F15 had expressed as *"darker in light mode, lighter in dark"*. That phrasing keyed them to **appearance**, but the boundary rule it sits under says the substrate is the **resolved role tint**. Restated correctly: **darker or lighter than *its own substrate*, decided per role by the swatch — appearance never enters it.** Okabe–Ito is again the proof: two roles in one swatch need opposite treatments, so no per-swatch or per-appearance rule can work.
- **Chrome keeps vibrancy and system materials.** Menus, popovers and panels are ordinary app chrome sitting on the desktop, so appearance is the right input for them — which is exactly the line already drawn in *appearance governs chrome, not note colour*. **The note surface is the exception, because its background is user-chosen and the system cannot see it.**

*Consequence accepted: we give up the optical integration vibrancy provides on translucent material. That mattered when the fill was near-neutral and mostly wallpaper; it matters much less on a tinted fill, and it cannot be bought at the price of unreadable text on half the swatches.*

### Decision — accessibility: colour never the sole signal + CVD swatches (resolves review-003 F1)

Colour is a **coordination aid, not a note's identity** — notes are always told apart by title / content / `#tags` / position, and **tags are the parallel organizing axis** (note-model) for anyone not organizing by colour. On top of that, **the colour-blind-safe swatch is a first-class theme**: pick **Okabe–Ito** and every note re-tints to a set designed to separate under CVD. No on-note shapes/patterns (they'd fight content-only-at-rest); the swatch system carries accessibility.

*Corrected 2026-07-29: this originally read "pick e.g. a deuteranopia swatch", and board `05` listed **Deuteranopia-safe** and **Tritanopia-safe** as separate entries. Both are wrong — see the CVD-swatch decision. Okabe–Ito is **one** set covering all three dichromacies; per-condition swatches are not how it works, and they'd force the user to know their own diagnosis to pick correctly. There is one CVD swatch, plus **Graphite** for achromatopsia.*

### Decision — system-state colours are reserved (resolves review-003 F8)

System-state cues (a **conflict** tint, error, attention) come from a **reserved colour space the user swatch cannot touch**, so those signals stay legible under any swatch — including CVD swatches. Keeps functional state distinct from user colour-coding. Ties to Conflict Reconciler.

### Decision — "reserved" means reserved *slots*, resolved per swatch (revised 2026-07-29, resolves review-006 F7)

The user asked the question that breaks the original reading: *"are you suggesting one set of colors that work for all swatches? Because the latter feels tricky."* It is not merely tricky, it is **impossible** — **Paper** sits at 96% lightness and **Midnight** at 30%, so no single tint has adequate contrast against both. A fixed palette of signal colours would be illegible on roughly half the set.

**So `reserved` denotes *ownership*, not fixed values.** A system state is a **slot Fumi owns and the user cannot reassign** — and, exactly like a role, **each swatch renders that slot to a value that reads on its own substrate**. Same machinery as roles-and-swatches, applied one level up: a swatch table gains a few **signal rows** alongside its seven role rows.

**What this preserves and what it costs:**

- **Preserved — the actual guarantee.** The point was never "the conflict tint is always violet"; it was *"functional state stays distinct from user colour-coding, and stays legible"*. Per-swatch resolution delivers that **better** than a fixed value, which delivers it on Wash and fails elsewhere.
- **Preserved — non-reassignable.** The user still cannot make a signal slot mean something else, which is what stops a state cue from being mistaken for a note's chosen colour.
- **Cost — ten sets of signal values to design**, not one. Mechanical rather than hard: the tables exist, and the constraint per swatch is only *"distinguishable from this swatch's roles, from each other, and from the selection highlight"*.
- **Cost — a real constraint on Okabe–Ito**: its signal values must be distinguishable **under CVD as well**, alongside roles already chosen for maximal separation. The tightest cell in the design; flag it at the colour implementation checkpoint.
- **Unchanged — colour is never the sole signal.** Every state still carries shape, position or copy. Per-swatch resolution reduces the load on colour; it does not license leaning on it.

### Decision — the reserved space holds five slots, split on meaning (2026-09-01, resolves review-010 F5)

*"Reserved" means reserved slots, resolved per swatch* fixed the machinery — *"a swatch table gains **a few signal rows** alongside its seven role rows"* — and the per-swatch constraint, *"distinguishable from this swatch's roles, **from each other**, and from the selection highlight."* It never fixed what *a few* is. Seven surfaces across the document draw on the space: the conflict banner, the Recently Deleted banner, the recency tint, the drop-refusal state, the `missing` asset chip, the `missing` asset inset block, and the soft- and hard-deleted note-link pills.

That number is not cosmetic. It is what the accepted cost — *"ten sets of signal values to design"* — actually multiplies out to, and until the set is named the *distinguishable from each other* constraint cannot be evaluated by anyone. It is also what sizes the cell this document already calls its tightest: **Okabe–Ito**'s signal values must separate under CVD as well as against roles chosen for maximal separation.

> **Five slots. The split is on *meaning*, not on the surface that renders it.**

| Slot | Means | Rendered by |
|---|---|---|
| **attention** | standing state that wants an action | the conflict banner |
| **deleted** | in Recently Deleted | the deleted-note banner · a **soft-deleted** note-link pill |
| **absent** | the thing this points at is not here | a `missing` asset chip · its inset-block form · a **hard-deleted** note-link pill |
| **refusal** | a transient *no* | the drop-refusal state |
| **recency** | changed while you weren't looking | the recency tint |

**The two collapses are the decision; the rest falls out.** A **soft-deleted link pill** means *its target is in Recently Deleted* — the banner's meaning seen from a reference rather than a second state, which is why the pill wears a trash glyph and stays actionable exactly as the banner's note does. A **`missing` asset** and a **hard-deleted link** both mean *the thing this points at is not here*, and the document already gives them the identical treatment independently — no fill, dashed outline, a broken glyph — which is the tell that they were always one state rendered twice.

**What stays separate is anything that can share a screen**, which is what makes the *distinguishable from each other* constraint checkable rather than aspirational. The pairs that genuinely co-occur:

- **attention + refusal** — drag an oversized file onto a conflicted note.
- **deleted + absent** — a soft-deleted and a hard-deleted pill in the same sentence, which is the entire reason those two are told apart.
- **deleted + recency** — a note in Recently Deleted still carries text you have not seen.
- **absent + recency** — an agent write that arrives referencing an asset that did not resolve.

Slots that cannot co-occur are unconstrained against each other, and per swatch the count drops from seventy resolved values to fifty.

*Rejected: a slot per surface.* It reads as safer and is worse: seven values per swatch where five will do, a harder Okabe–Ito cell, and two pairs whose whole design intent is that they render *the same fact* — which a separate slot each would let drift apart at exactly the moment they must not.

**Values stay at the colour-and-material checkpoint, unchanged.** The slot list is a design fact that checkpoint consumes; it was never something the checkpoint could produce.

*Sibling check: note-model — its decided text holds `missing` as an error state rather than a transport state, and holds that an unresolvable asset token renders as a placeholder and is never rewritten or removed. Both adopted as written; nothing here changes what `missing` **is**, only that its colour resolves from the same slot as a hard-deleted link, which is this topic's presentation call.*

### Decision — the recency tint draws from the reserved space (resolves review-006 F7)

~~*Originally: "The tint must come from the **swatch model with light and dark variants**, not a single pinned value."*~~ **Both halves were dead on arrival** — light/dark pairs inside a swatch no longer exist, and the swatch model is the *user's* palette, which is the wrong home for a state cue. Corrected to match the precedent already set for broken links: *"a broken reference is a system state, so it draws from the reserved space, not the note's palette."*

**The recency tint is a system state and gets a reserved slot**, resolved per swatch under the rule above. Chosen over the cheaper alternative (a substrate-relative shade, like the inset blocks) because **that alternative says nothing** — it would read as *"this is a block"* rather than *"this is new"*, and the tint's entire job is to mean something. *Noted as low-stakes to revisit: the user's steer was "happy with whatever makes sense, we can always tweak it".*

**A constraint the comparison surfaced, which is the sharpest thing in this decision.** The recency tint is drawn like a **text-selection highlight** — a background wash behind a run of text — and macOS selection colour is a *system* setting (Appearance → Highlight colour) that apps get for free. **We cannot inherit it**, because **both can be on screen simultaneously**: you can select text inside a note that also carries recently-changed text. Identical colours would make *"I selected this"* and *"an agent wrote this while I was away"* indistinguishable.

**Therefore each swatch's recency value must be distinguishable from four things at once:** that swatch's role tints · the conflict and deleted signals · the inset-block/code-block backgrounds · **and the user's system highlight colour, which we do not control and which they can change at any time.** The last is the awkward one and cannot be solved by picking a value — it needs either sufficient separation in lightness rather than hue, or a non-colour cue carrying the distinction. **Routed to the colour implementation checkpoint**, where it can be tested against a real highlight-colour setting rather than asserted.

### Token lifecycle (resolves review-003 F2, F7)

- **F7 — live reference:** the note stores a **role**, resolved **live** against the active swatch. Change swatch → re-resolve → re-tint. *(Amended 2026-08-06 — this read "against the active swatch **+ appearance**… change swatch/**mode**". Appearance was removed from this path entirely by *appearance governs chrome, not note colour* — there is no light/dark pairing inside a swatch, and notes were never tracking the OS — and reinforced by the vibrancy correction, *"appearance never enters it"*. This was the last site that would have wired note fill to the appearance flag.)*
- **F2 — removed colour:** dissolves. Notes reference **stable roles**, and **every swatch defines every role**, so a note's colour always resolves. (If a *role* were ever dropped at the schema level — rare, a migration — such notes fall back to **neutral**.)

### Decision — macOS accessibility settings (resolves review-003 F3)

#### 2026-09-11 — revised
*Trigger: triage from platform-support — the automatic opacity may not be automatic: the note's blur cannot be expressed by a named `NSVisualEffectView` material, and the `CIFilter` chain that can express it has no documented Reduce Transparency behaviour.*

**The degradation outcome is unchanged. What changes is who guarantees it: Fumi does, not the platform.** Fumi observes the Reduce Transparency setting and switches the surface itself — glass off, opaque solid tint on, at every one of the four sites that promised it (the note surface, the tag pill, the attachment chip, the inset block) — whatever the underlying material turns out to do unprompted.

**Why not wait and check.** The obvious alternative was to book the question at the colour-and-material checkpoint and build the manual path only if the free behaviour failed to appear. Rejected on two counts. First, **four separate decisions lean on "automatic"**, so a single wrong assumption degrades the surface, the pill, the chip and the inset block together — and it degrades *silently*: the chrome and popovers, which really are semantic materials, would go opaque exactly as expected while the notes the user is trying to read stay frosted. Nothing errors; it simply doesn't happen, to the one user who cannot work around it. Second, the checkpoint lands late, and an accessibility outcome is a poor thing to hold contingent on a spike result. A hybrid — semantic material beneath a lighter filter chain, hoping both survive — was considered and is not a third position: it is the same contingency with an extra moving part.

**The cost is one observer**, and it buys identical behaviour across all four sites rather than behaviour that depends on which layer each one happens to be built from. The checkpoint's job moves accordingly: it **verifies we switched**, rather than discovering whether we needed to. If the platform turns out to do it for free after all, the explicit switch is redundant, not wrong — and redundant is the correct side to be wrong on here.

*Sibling check: no overlap found — Reduce Transparency appears in platform-support only as the constraint that it is an accessibility fallback and never a pre-26 rendering path, which this preserves; the degradation itself is this topic's.*

#### Initial

The glass degrades gracefully under the OS accessibility settings:

- **Reduce Transparency** → drop the glass; render the note as an **opaque solid tint** (still the role's swatch colour, solid, no frost/translucency), text solid + high-contrast. Notes stay coloured and legible, just not glassy.
- **Increase Contrast** → boost **text + edge contrast** — stronger text, and a **defined border** (the soft glass edge cue weakens, so give the panel a crisp edge).

Standard macOS affordances the material layer honours (SwiftUI materials cover some; our custom tint follows suit).

### Decision — swatch model vs substrate-relative treatments (resolves review-005 F15)

Review-005 F15 caught three components pinned **after** the light/dark and Reduce Transparency decisions, as single absolute light-mode values, outside the mechanism that was supposed to own them: the **tag pill** (`#FFFFFF9E` translucent white fill, `#1C2029B8` dark text), the **attachment chip** (translucent fill + a white page icon), and the shared **inset-block container** (~4–6% black tint over the glass, used by code fences, Mermaid, tables and the *Edit as Markdown* source view). In dark mode a translucent-white pill and a black-tint inset invert in meaning; under Reduce Transparency the stated rationale for all three — *"so the glass shows through"*, *"sits in the material"* — stops being true, with no recorded fallback. They came out of the Paper spike, which produces concrete values; the mistake was pinning them at that layer.

**They do not become swatch roles** — that would be a category error. The swatch model governs the note's **fill** (neutral / sage / blush / butter; per-note role + app-level swatch). These three are components that must read legibly *on top of whichever swatch is chosen*.

> **Note colour comes from the swatch model. Anything sitting *on* the note surface is expressed relative to its substrate.** Two systems, clean boundary.

So:

- **Tag pill** — a hierarchical fill over the note surface; label from the standard label hierarchy.
- **Attachment chip** — the same fill treatment; the icon takes the label hierarchy, never a literal white.
- **Inset block** — a tint *relative to the substrate*: darker than it in light mode, lighter in dark.

macOS already solves this: system materials and hierarchical fill styles adapt across light/dark and the desktop tint, and ~~go **opaque under Reduce Transparency automatically**~~. That also supplies the missing fallback — the rationale shifts from *"the glass shows through"* to *"a distinct opaque layer"*, and the thing actually carrying meaning, **contrast hierarchy**, survives. Glass is how we express the hierarchy when glass is available; it is not the hierarchy itself. *(Amended 2026-09-11 — the automatic opacity is not something to rely on here; see* Decision — macOS accessibility settings*'s 2026-09-11 entry. **The three treatments still go opaque under Reduce Transparency — Fumi switches them explicitly rather than inheriting it.** The light/dark adaptation above is untouched, as is every other word of this decision: what was wrong was the source of the guarantee, not the guarantee.)*

**The spiked hex is not discarded** — it stands as the expected *light-mode rendering* of these relative treatments, and remains the reference output for implementation to check against.

---

## Agent-Activity Presentation

Brief-native (new — surfaced while arguing the editor fork). The intent was firm from the start: **the user explicitly wants this** ("we deffo need to do this"). Reference: **Paper.design over MCP** — the artboard glows and an icon animates in the corner while an agent works; the user calls it magical.

### Context / direction

Fumi's differentiator is that a note is a **human⇄agent surface**, so making agent activity visible is the product telling its own story — arguably more on-brand here than in Paper. **Liquid Glass is the ideal material for it:** the surface already carries a specular edge + sheen, so an agent-active state can animate **the material itself** (a gentle travelling shimmer along the glass edge) rather than bolting on a badge — plus a small animating indicator in the already-reserved chrome band.

**Constraints to hold it to:**
- **Transient, never persistent** — discovery hard-rejected a standing "Written by Claude" byline. This is ephemeral *state*: visible only while the agent is actively writing, gone when it finishes.
- **Calm, not alarming** — a slow pulse / drifting sheen, not a flashing badge or colour alert. Reads as "something lovely is happening", not "attention required".

**Streaming payoff:** with a Markdown-text buffer, agent edits arrive as text patches, so the text can **visibly stream in** as it's written — nearly free, and the magical version of this feature.

### Decision — no write-locking during agent activity

**Do not lock the note while an agent writes.** Considered (user proposed it as optional) and rejected:
- **It doesn't rescue Model A.** A lock only prevents same-instant mutation; when it releases the file has still changed under an open editor with a live caret, so A must still reparse into a new tree and re-derive the caret. Locking narrows the collision window, not the coordinate-space problem.
- **Model B doesn't need it** — a text diff merges cleanly. *Avoiding a defensive mechanism entirely is itself a point for B.*
- **It feels wrong**: a note refusing keystrokes is a modal dialog in disguise. Sub-second agent writes would make the lock flicker; a long operation locks you out of your own note.

*(Agent-side mechanism — how writes are dispatched/notified — likely belongs to **agent-surface**; this subtopic owns the note-window presentation.)*

### DECIDED — two layers, not three: the header indicator is cut

The direction above proposed **three** simultaneous signals — edge shimmer, a chrome-band indicator, and streaming text. Three signals for one state is a great deal for a surface whose north star is *furniture*, and the third one loses on three counts:

1. **It is the only one that introduces a new element class.** The shimmer animates material that already exists; streaming animates content that already exists. **Text in the chrome band has never existed on a fumi** — at rest the band is empty, controls hover-reveal, the first line *is* the title. Introducing a text element for a transient state is a lot of new surface for a few seconds.
2. **Its only unique contribution is identity.** The shimmer says *engaged*; streaming says *here is what*. Neither can say "Claude via MCP". So the question reduces to: do we need **live** identity?
3. **We already answered that, and the answer was no.** Version-History UI landed *"attribution belongs in the version record, not as note chrome"*, explicitly consistent with discovery's hard rejection of a standing "Written by Claude" byline. A header reading "Claude is updating" is that byline with a timer on it — transient, so not literally prohibited, but the same instinct discovery rejected, reintroduced at the top of the note.

**Kept: the edge shimmer and streaming text.** They also cover different moments rather than duplicating one — an agent that is reading, reasoning or calling other tools produces no bytes for seconds at a time, and the shimmer owns exactly that window.

*(A session-declaration on the agent surface — the CLI/MCP opening and closing an operation so the engine knows an agent is engaged **before** it writes — was raised and left open. The user's view: possibly needed, but it is agent-surface's call, not this subtopic's.)*

### DECIDED — the shimmer: a Siri-style edge glow, treated as an implementation checkpoint

**Reference: Apple Intelligence / Siri**, which animates a subtle, slightly rainbow shimmer around the screen edge. The user wants that on Liquid Glass and wants it *very* polished.

**Not a public API** — Apple's edge glow is private. But it is reproducible: an **angular gradient stroked around the window's rounded rect, masked to the edge, blurred, with the gradient rotating slowly**. Liquid Glass helps rather than hinders, because the specular top edge gives the sheen something real to ride on.

**Treated like colour & material: a human-in-the-loop implementation checkpoint**, not something a static spike can judge. The final quality only exists in the real SwiftUI build — same reasoning the document already applies to the Liquid Glass material itself. This is where the polish budget goes.

**Reduce Motion must degrade it.** A travelling shimmer is motion by definition; users who have asked for less of it get a static or slow-fading edge tint instead. Pinned here rather than left implicit — review-005 F15 caught us pinning component values that ignored our own already-decided degradation rules, and this is exactly that shape of mistake.

**The other two settings, pinned in the same spirit (resolves review-006 F8)** — the finding was that we congratulated ourselves for pinning Reduce Motion and then omitted the two we had *already committed to elsewhere*, which is the same mistake one layer along:

- **Increase Contrast.** We decided this gives the note a **defined border** ("the soft glass edge cue weakens, so give the panel a crisp edge"). That border and the shimmer both own the same rounded rect, so a second stroke would fight the first. **The shimmer animates the defined border rather than adding a stroke of its own** — the border is already there, so it modulates that instead. Nothing new is drawn.
- **Reduce Transparency.** The glass becomes an opaque solid tint, which removes the specular edge the sheen was designed to ride on. **The shimmer survives**, because it was already a *stroke*, not a material effect — it reads as a glowing edge rather than a sheen. Less beautiful, still legible as "an agent is working". It does **not** silently disappear; an agent-activity cue that vanishes for accessibility users would leave them with no live signal at all.
- **The recency tint under both.** It is a background wash behind text, so Reduce Transparency does not affect it. Under Increase Contrast it must **strengthen, not weaken** — and the earlier defence that *"the tint carries no information that is lost without it"* was a slight overclaim, since the tint's stated value is that it *"says **where**"*, which is exactly what is lost if it becomes imperceptible. The reserved-slot model already gives each swatch room to render it at a higher-contrast value.

**Calm, not alarming** (carried from the direction above): a slow drift, never a flash or a colour alert.

#### Decision — the rest of the document's motion under Reduce Motion (2026-08-10, resolves review-009 F9)

Reduce Motion was pinned here for the shimmer and for the recency tint, and nowhere else — while three other decisions in the document *are* motion. This is the shape review-006 F8 already caught one layer along: pinning a degradation in one place and omitting the ones committed to elsewhere.

| Motion | Under Reduce Motion |
|---|---|
| **Version preview animating the note to a version's size** | **jumps** to the size. The largest motion in the product — a window resizing under someone reading it — so it is the one that most needs the option honoured. |
| **Close = a very subtle fade** | **instant**. |
| **A new version animating in at the top of the list** | appears **without the emphasis**. |

**Close and delete become indistinguishable, and that is accepted rather than patched.** Their whole distinction is *motion* — *"Close = hide → a very subtle fade. Delete → instant"* — so suppressing motion collapses it by construction. Inventing a second, non-motion cue to preserve the difference would give Reduce Motion users a signal nobody else gets, for a distinction the decision itself calls **reinforcement, not the primary signal**: the user picked a specific menu item, and knows which. *(Consistent with the recency tint, whose Reduce Motion answer is likewise to drop the animation and keep the fact.)*

### DECIDED — live vs missed: the shimmer is presence, a text tint is recency

The first proposal was that a **sync arrival from another Mac** should share the shimmer, on the grounds that from inside the note it is the same event — text moving that you didn't type — and that one signal covering both would avoid a second vocabulary.

**The user corrected this, and the correction generalised the whole subtopic.** A shimmer means *someone is writing right now* — the equivalent of watching a person write in a notebook. **A sync is not a duration, it is an instant**: someone wrote in another notebook and swapped the page in. There is no progress to animate over. So sync must not shimmer.

But the missed change still needs marking, which yields the governing rule:

> **Shimmer = it's happening now, you can watch it. A tint = it already happened, you missed it.**

And the split is **live vs missed, not agent vs sync**. An agent writing to a note that is **hidden or on another Space** produces the identical experience to a sync arrival: you arrive at a note that changed without you.

**A banner was proposed and rejected.** The first form for the missed case was a slim banner reusing the Delete UX precedent — *"Updated from another Mac"* / *"Updated by Claude"*, with **View changes** opening the already-built version panel, plus a dismiss. The user killed it with the decisive objection: **dismissing a banner every time an agent touches a note is exactly as absurd as dismissing one every time you type in it yourself.** The user's counter-proposal — Apple Notes' treatment, where new text is briefly highlighted — is the answer.

> **Mark the change; don't announce it.** New text carries a **subtle tint** that **decays on focus** — as soon as the note is focused, it fades out.

Why this beats the banner on every axis:

- **No dismiss, ever.** The tint fades by being looked at. There is no action to take, so the fatal objection disappears entirely.
- **Proportional.** A banner weighs the same whether one word or three paragraphs changed. A tint scales with the change — and says *where*, which a banner never could.
- **Genuinely equal, in the right way.** Note what the rule does not mention: **who wrote it**. The tint marks *what you haven't seen yet* and fades as you see it. Your own typing isn't tinted because you were there. An agent write you watched stream in fades immediately — you were there too. An agent write to a hidden note is still tinted when you open it an hour later, because you weren't. Sync from another Mac, identical; a second human, if that ever exists, identical. **The actor never enters the rule.** This is what the human⇄agent equality principle actually demands — a banner reading "Updated by Claude" would have been the *unequal* option, singling out agent edits as exceptional.
- **It unifies with the shimmer rather than sitting beside it.** One mechanism across one timeline: the edge shimmers while the agent works → text streams in already carrying the tint → the tint decays on focus. Live and missed stop being two features.

**Scope limit — a recency hint, not a diff.** Deletions cannot be tinted; the text isn't there. Don't chase it. Version history owns the actual record, and the corner menu is one click away — which is also why cutting the banner's **View changes** doorway costs nothing.

#### Decision — decay needs a *return*, not merely a focused window (2026-07-29, resolves review-006 F15)

The rule's correctness rests entirely on **focus meaning "you were there"**, and the review found three states where it doesn't:

1. **The note is already the focused window when the write lands, and you are at lunch** (or the screen is locked, or the saver is running). Under *"a write you watched stream in fades immediately — you were there too"*, the tint appears and decays **against an empty chair**. You come back to an unmarked change. **This is precisely the case the mechanism exists to catch**, and it is the common one — a note you were working in is exactly the note an agent is likely writing to.
2. **A focused note on a Space you are not currently viewing.** The app's focused window can sit on another Space entirely, so "focused" and "visible" are not the same thing.
3. **Continuous focus across a hidden→visible transition** — if the note never loses focus, there may be **no focus event to decay on at all**.

**Decided: the trigger is a *return*, not a state.** The tint decays on a **focus event or real input** — clicking into the note, typing, or focusing it afresh — never on the note merely *being* the focused window. An already-focused note that receives a write **keeps its tint until you demonstrably come back**.

**This preserves the actor-blindness rather than compromising it.** The rule still never asks *who wrote it*; it now asks a sharper version of the same question — *did you see it?* — and "the window had focus" was always a weak proxy for that. Sharpening the proxy strengthens the principle.

**Consequences:**

- ~~**Streaming you actually watched still fades immediately**, because watching involves the window being frontmost on the visible Space with the session unlocked — and if it isn't, you weren't watching, which is the correct answer.~~

  **Struck 2026-09-01 (resolves review-010 F2) — this contradicted the rule it was written under.** *Streaming you watched keeps its tint until you touch the note*, like any other write.

  The two states are not merely hard to tell apart, they are **the same state**: note focused, frontmost, Space visible, session unlocked, no input — which describes a person reading their screen and an empty chair in front of it identically. That is precisely why the trigger moved off *"is the window focused"* and onto **a return**; the struck bullet reintroduced the proxy the decision had just rejected, one line below rejecting it. Worse, the state it grants an exemption to *is* case 1 — the at-lunch case the decision exists to catch — so implementing the bullet would reopen the hole, and implementing the rule as written was already correct.

  **The cost is small and self-clearing.** Someone who genuinely watched an agent write is about to click or type, and the tint goes on that. It also errs on the side the decision already named: *"the failure mode of getting it slightly wrong is a tint that lingers a little too long — which is the safe direction."*
- **Screen lock, screen saver and Space switches need no special-casing.** They are all just "no return happened yet".
- **Implementation note:** the signal wanted is closer to *user attention* than to `NSWindow` key state — a focus **transition**, plus input, with the session unlocked and the note's Space visible. Worth pinning at implementation because the naïve reading (`isKeyWindow`) reproduces exactly the bug above.

*Low-stakes and revisitable: this is a threshold, and the failure mode of getting it slightly wrong is a tint that lingers a little too long — which is the safe direction.*

**Accessibility.** Under Reduce Motion the tint appears and fades without animation. Our rule that **colour is never the sole signal** survives here: the tint carries no information that is lost without it — the changed content is right there to read, and the record is in version history. Stated explicitly so it isn't later flagged as a violation. ~~*The tint must also come from the swatch model with light and dark variants, not a single pinned value.*~~ **Superseded** — the tint is a **system state** and takes a reserved slot resolved per swatch; see *the recency tint draws from the reserved space*.

**Not ours — discoverability of hidden notes.** A closed note's tint can't be seen, so *"something changed while you weren't looking"* has to surface in the **menu bar or the manager**. That is management-window's under the surface-follows-the-object rule.

### Parked — carrying the treatment into version-history transitions (V2 candidate)

The user's idea, explicitly deferred: apply a related treatment **inside version history** — text fading in and out as you move between versions, or a genuine **diff between versions**. Attractive, and it would make the tint vocabulary consistent from live edit through to historical browsing. Not first-cut; recorded so it isn't lost.

---

## Positioning

Brief-native (owns the corner-menu **Move to ▸** presets). Added to close review-003 F6, which flagged it had no subtopic on the map.

### Context

From the discovery brief: notes **free-float and remember exact coordinates**. **Tiling / presets** are a *convenience* for setting position + size — **built-in and user-creatable**, addressable **by name** (e.g. "left rail", visualised in the spike); the result is an ordinary free-floating note (**drag overrides and is remembered**). **No position-locking** ("pinned to a spot" is not a real concept). The corner-menu **Move to ▸** item (mirrored in the Note menu) is the entry point. To design: preset management (create / apply / rename / delete named presets), tiling behaviour, coordinate-memory persistence, and **multi-display** behaviour (flagged in review-003 F6).

*From: note-model · discussion · 2026-07-30*

note-model ruled on the size question this topic rerouted to it (*is a note's size intrinsic or machine-local?*). The answer — **geometry intent travels, resolved geometry does not** — turned out to depend on presets behaving slightly differently from how this topic decided. Three consequences, all this topic's to accept or reject.

**note-model's position, for context.** `size` (authored, absolute points) and `preset_id` (a preset UID, or empty) are per-note **intrinsic** fields that sync. Position, home display, home-Space and the resolved rect stay machine-local. A preset reference is stored because *a name is portable where a coordinate is not* — "left rail" means the same thing on a 13" laptop and a 27" Studio.

1. **A preset stays bound until broken — revising *"drag overrides and is remembered"*.** This topic decided applying a preset was a **one-shot** action, after which the note is free. note-model needs a **standing binding**: the note keeps its `preset_id` and re-resolves against whatever screen it lands on, until a gesture breaks it. Without that, applying "left rail" on the Studio and opening on a laptop yields absolute Studio-half pixels rather than the laptop's left rail. Drag still overrides and is still remembered — it breaks the binding and writes absolutes; what changes is only that, *until* you drag, the note stays bound.
2. **Which gestures break a binding — scoped, not flat.** A flat *any-geometry-gesture-breaks-it* rule drops bindings a gesture never touched: under this topic's three independently-toggled axes, a size-only preset with a share-valued width needs to stay bound, and dragging would clear it. So a gesture breaks the binding only if it overrides an axis the preset actually sets; the binding stays atomic, only the trigger is scoped. Each axis is sourced independently — from the preset where it sets that axis, otherwise from its normal home.
3. **Re-applying a preset on a new display resolves against *that* display.** A corner-bound note dragged to a second monitor (breaking the binding), then re-applied, lands in *that* monitor's corner. Presets resolve against the **current** display unless the definition names one; Display stays an optional axis of the *definition* rather than per-note state.

Also relevant to the preset editor (rerouted to management-window): references are **UID-keyed, never name-keyed** — names orphan on rename and collide silently across Macs. Built-in tiling layouts use the same mechanism with reserved opaque UIDs.

*Outcomes: item 1 in **a preset binding stands until broken**, below; item 2 ratified in the same block; item 3 needed nothing — it restates what **the "Move to ▸" submenu** and the three-axis model already decided.*

### DECIDED — the "Move to ▸" submenu

**🎨 Spiked** — *CANONICAL SPIKE — note chrome & states*, state 7. Shows the parent menu with the row highlighted, the submenu opening to its right, tiling as an **icon grid** (Apple's idiom — a proportional glyph per layout rather than a text list), then named presets, then *Save current as…* and *Move to Display ▸*.

Modelled on the **macOS Move & Resize menu** (the one under the green traffic light) — same problem, and users already know the pattern.

**Contents:**
- **Built-in tiling** — one group, no sub-headings: left/right half, top/bottom half, and the four quarters, as an **icon grid** (Apple's idiom — a proportional glyph per layout, not a text list), **evenly spaced edge-to-edge**. *Splitting it into "Halves"/"Quarters" sub-groups was tried and rejected as invented structure.* **Edge rails are not built-ins** — "Left rail" lives in user presets, which is where a named screen position belongs.
- **User presets**, below a separator — created from a note's current geometry via ~~**"Save current as…"**~~ **"Save as Preset"**, and managed via **"Edit Presets…"**. *(What a preset captures, and the surfaces behind these two items, are decided below — see the three-axis model and Preset Authoring. Label and route amended 2026-09-22 — the item saves immediately under a derived name and opens nothing, so it loses its ellipsis; naming happens in the Presets pane, which `Edit Presets…` still hands off to.)*
- **Each preset row carries a small location glyph** on the left, using the same mini-layout language as the tiling grid. A name like "Reading pane" tells you nothing about *where* it lands; the glyph does. Reuses an existing visual language rather than inventing one.
- **Presets can be assigned keyboard shortcuts**, shown right-aligned in the row (e.g. `⌃⌥1`). Consistent with the user-overridable shortcuts decision — presets are exactly the kind of repeated action worth binding.
- **Move to Display ▸** — only when more than one screen is connected.

**A preset captures position *and* size** (user: "your own named **sizes and screen locations**"). So sending a small note to "left rail" also stretches it — that's the point, and it makes presets true tiling rather than just a move.

**Presets are global, not per-note** — a named spot is about *screen real estate*, so any note can be sent to any preset.

~~**Applying a preset leaves the note an ordinary free-floating window** (discovery): drag afterwards overrides it, and the new coordinates are remembered. There is no locking, and no persistent "this note is tiled" state.~~ **Superseded 2026-08-06 — see *a preset binding stands until broken*, below.**

**Multi-display fallback:** if a preset references a display that's no longer connected, fall back to the main display — mirroring space-homing's "deleted Space falls back to Space 1" rather than losing the note offscreen.

*Treated as tweakable: the built-in tiling set is a starting list, not a fixed contract.*

#### Amendment — a preset binding stands until broken (2026-08-06)

*From: note-model · discussion · 2026-07-30*

note-model ruled on the size question this topic rerouted to it — *is a note's size intrinsic or machine-local?* — and landed **geometry intent travels, resolved geometry does not**: `size` (authored, absolute points) and `preset_id` are per-note intrinsic fields that **sync**, while position, home display, home Space and the resolved rect stay machine-local. That ruling rests on a preset being a **standing binding**, which the struck sentence above denies.

> **A preset attaches to the note and stays attached until a gesture breaks it.** The note stores `preset_id` and re-resolves the preset wherever it is placed.

**The struck sentence was never the intent — it overshot a different rejection.** It was carrying discovery's refusal of *position-locking* (*"pinned to a spot is not a real concept"*), and that refusal survives untouched: a bound note refuses nothing, drags freely, and the drag is what breaks the binding. What dies is only the trailing clause *"no persistent 'this note is tiled' state"*, which was a consequence of one-shot application rather than a principle of its own. A stored `preset_id` **is** persistent bound state, and has to be.

**What binding buys, concretely.** "Left rail" = full height · 280pt wide · against the left edge. Applied on a 27" Studio, then the same note opened on a laptop:

| | Studio | Laptop |
|---|---|---|
| **One-shot** (the struck reading) | 1440 tall — correct | still 1440 on a ~900pt screen — clamped, wrong |
| **Bound** | full height | full height — correct |

A *number* is wrong on the other Mac; a *name* is right on both. That is the entire reason a reference is stored rather than a rect, and it only works because **preset definitions sync at account level** — a `preset_id` arriving on the second Mac would otherwise point at nothing.

**A note is never dependent on the preset surviving.** Applying a preset also writes the resolved geometry into the note's `size`, so an unresolvable or deleted preset leaves the note rendering the shape it already had, as ordinary hand-set geometry.

**Sibling check: note-model — its decided text holds that `size` and `preset_id` are synced Note-tier fields, that preset definitions sync at account level, and that `preset_id` is never cleared by preset deletion (it dangles, and re-binds by itself if the preset returns). This topic adopts those rulings rather than re-deciding them; what is decided here is the binding's persistence, the sentence it supersedes, and the break trigger below.**

**What breaks it — ratified.** note-model reached this rule and flagged it as this topic's call, having first landed a flat *any-geometry-gesture-breaks-it* version and found it wrong: it drops bindings a gesture never touched, since a size-only preset with a share-valued width would fall off the note on a plain drag. Scoped to the three axes:

> **A gesture breaks the binding only if it overrides an axis the preset actually sets.** Drag breaks a preset that sets Position; resize breaks one that sets Size; neither breaks one that only sets the other.

**The binding is atomic** — one reference, cleared or not; only the *trigger* is scoped. Break it on any axis and the whole reference goes, leaving an ordinary free note holding the geometry it had.

**The third axis, and the sharper statement of the rule (2026-08-06, resolves review-008 F5).** The sentence above names Position and Size and stops, while **Display-only is a preset we explicitly allow** — *"Send it to the Studio, unchanged"*, Move to Display saved and named. Left unstated, a standing Display binding becomes a **second source of truth against the note's home record**: apply "To the big screen", drag the note back to the laptop by hand, and *moving a note across displays re-homes it* writes laptop while the binding still says Studio. At relaunch one wins and nothing said which — either the note returns to the Studio (you moved it, and it came back: a bug) or it stays on the laptop (the binding was decorative from the moment you dragged).

> **A cross-display drag breaks a Display-setting binding**, exactly as an ordinary drag breaks a Position-setting one.

Which keeps `Move to Display ▸` and drag identical, as *"one act, one rule, no branching"* already requires.

**And the general rule is better stated as the axis, not the gesture:**

> **The trigger is what the gesture *changed*, not which gesture it was.**

A same-screen drag changes position; a cross-screen drag changes position *and* display; both are "a drag". Reading the trigger off the gesture's name is the flat *any-drag-breaks-it* rule wearing a scoped hat — the thing note-model already found wrong. Read off the axis, the third case needs no special-casing and falls out of what was already decided.

**Sibling check: note-model — its decided text holds that "the only thing that ever clears `preset_id` is a binding-breaking gesture", and hands the question of *which* gestures those are to this topic under the reroute. This decides that set; nothing about `preset_id`'s ownership or write rules changes.**

**When a binding re-resolves (2026-08-06, resolves review-008 F6).** The binding is *defined* by re-resolution — *"re-resolves the preset wherever it is placed"* — and the only moment worked through was relaunch and open. Others exist and were unaddressed: a preset **edited in the manager** under open bound notes, a display's **resolution or scaling** changing beneath one, a **topology change**, and **hide-then-reopen**.

*The apparent collision, and why it is narrower than it looks.* *A display disconnect is not a user action* rules *"do nothing — let macOS relocate the window"*, which reads as a flat instruction never to re-resolve. But that rule is about **position** and about **writes**: its reason is that the WindowServer already moves windows off a vanishing display and intervening would double-move them, and its load-bearing line is that a topology change never *writes* a home. Re-resolving a Size axis is neither a move nor a write — storage-and-sync pins that **re-resolution writes nothing, ever**. So nothing contradicts. The genuine gap is only: *when is a re-resolved rect allowed to reach the screen?*

> **Re-resolution is continuous and free — recomputable at any moment, writing nothing — and every moment reaches the screen through the existing gate: a re-resolved preset takes effect when the note is not focused, immediately if it is already unfocused, otherwise on blur.**

Adopted wholesale from storage-and-sync rather than invented, because its stated reason is verbatim this case: the guard is about *a thing seen, not a thing written*, since **the user cannot tell whether the rect that just moved under their cursor came from a synced field or a local resolution**. It also already rejected *"apply immediately because nothing was written"* as invariant-correct and user-hostile.

**This is also the answer to the preset-editing question** — edit "Left rail" in the manager and bound notes take it as each stops being focused, rather than snapping mid-keystroke or waiting for a reopen.

**Cost, named:** a note you are actively working in can sit visibly stale against its own preset until you click away. Accepted as the right direction to be wrong in, and the same trade the gate already made. *Recorded as settled-for-now at the user's steer rather than firmly: it is a threshold, and the failure mode of getting it wrong is a rect that updates a beat later than ideal.*

**Sibling check: storage-and-sync — its decided text holds the application gate ("a re-resolved preset takes effect when the note is not focused — immediately if it is already unfocused, otherwise on blur") and that re-resolution writes nothing. Both are adopted as-is; what this topic decides is only that the gate governs *every* re-resolution moment rather than the single returning-preset case it was authored for.**

*Per-axis breakage was argued here and dropped.* The case for it: dragging a "left rail" note (height a **share**, width **280pt**) revokes a position you chose while freezing a height you never revoked. The case against, which won: a partly-bound note is **state with no on-screen expression** — two notes sit side by side, one full-height on the laptop and one not, and the only thing distinguishing them is whether the last hand-gesture was a drag or a resize, weeks ago. Atomic has a story a person can hold: *touch a bound note's geometry by hand and it's yours, completely.*

**A share re-resolves; an absolute value gets fitted** — pinned because reaching the decision muddled it. A note bound to *full height* is not clamped on a smaller screen; it **re-resolves**, and is correct on every screen by construction. The **safety net** is the other mechanism: it fits a rect that does not fit the display, **without ever writing back**, so a 1440pt note shown at ~900 on a laptop is still 1440 when it returns to the Studio.

*(Scoped 2026-08-06, resolves review-008 F7. This first read "**clamping never applies to a bound axis** … the safety net is for **free** notes", which was too broad in both halves and contradicted *each dimension is a measurement or a share* — a bound axis can be **absolute**: "Left rail" is a 280pt width, and "make this 400×600 wherever it is" is bound and absolute on both dimensions. The line is per **axis value**, not per binding:*

> ***A share-valued axis never needs the safety net — it re-resolves to fit by construction. An absolute axis can overflow whether bound or free, and takes the same display-time fit, which writes nothing either way.***

*Which makes the two decisions agree, and keeps the property that matters: the fit is never written back.)*

**What a break leaves behind — the stored size, not the displayed one (2026-08-06, resolves review-008 F7).** *"Holding the geometry it had"* above is ambiguous, and one reading is alarming: since `size` is a **synced** field, a break that wrote the *displayed* rect would let a machine-local gesture reshape the note on every other Mac.

It does not, and the reason is that **`size` is written at *bind* time, never at break time** — note-model has applying a preset write the resolved geometry into `size` precisely so *"a note is never dependent on the preset surviving"*. So the number always exists and the break never has to invent one:

```
Apply "Left rail" (height 100%) on the Studio
  → binds, and the bind writes          size = 1440

Open on the laptop
  → still bound → re-resolves → shows 900     size untouched = 1440

Drag it on the laptop
  → breaks the binding (the preset sets Position)
  → writes position (machine-local)           size untouched = 1440
  → now free: 1440 fitted for display  → still shows 900

Back on the Studio
  → free, size = 1440                  → shows 1440
```

> **A break writes only the axis the gesture actually changed.** A drag writes position; `size` keeps its bind-time value. A **resize** is what writes a size — which is the document's existing *"drag never resizes"*, applied here.

**Nothing jumps on either machine**, which is what makes this invisible in practice: the laptop showed 900 by re-resolution and shows 900 by display fit; the Studio showed 1440 and keeps 1440.

*Rejected: freezing the displayed rect into `size` on break.* Considered directly and it reproduces the **two-Mac ratchet** — nudge a note sideways on the laptop and it is permanently laptop-height on the Studio, from a gesture that expressed no intent about height at all. The document already names this exact outcome as the thing to avoid (*"clamp fires on the laptop, writes back, note is permanently laptop-sized, and dragging it to the Studio doesn't restore it because drag never resizes"*), and it is also the *more* expensive option: it performs a write to replace a good authored value with a worse derived one, where leaving `size` alone costs nothing.

*Also rejected: fixing a share at capture time* — i.e. applying "100% height" simply writes the current screen's height and the preset stops meaning a share. It gives the right answer for 100% only because a full-height value and the display fit coincide at the screen edge. A **half-height** preset exposes it: bind on the Studio writes 720; a live share re-resolves to 450 on the laptop, while a capture-fixed 720 *fits* a 900pt screen without clamping and renders as 80% of it. The share must stay live while bound — the same property that makes version preview re-resolve rather than animate to the recorded number.

### DECIDED — where a new fumi is born (2026-08-10, resolves review-009 F5)

Every rule this topic owns describes a note that **already has a rect**. Follow one note and the gap is the first rung:

```
⌘N                     → ?                          ← nothing said
drag it left           → position remembered         ✓ coordinate memory
Move to ▸ Left rail    → binds, re-resolves anywhere ✓ three-axis preset model
open on the laptop     → full height, 280pt          ✓ share vs measurement
undock the Studio      → macOS relocates it          ✓ a home is intent, not location
relaunch               → resolution ladder           ✓ display · Space UUID · ordinal
```

Three creation routes are already in scope — `File → New Note ⌘N`, the global **New fumi** quick-capture hotkey, and the status item's new-note item — and none of them said where the window lands, at what size, or on which display and Space. The minimum-window decision supplies a floor, not a default.

**Two things make this more than a default value.** **Birth placement immediately becomes a home**, because *"wherever the user puts a note is its new home"* — so whatever Space and display a note is born on is what it returns to at relaunch, decided before the user has expressed any intent at all. And **the quick-capture hotkey has no referent by construction**: preset shortcuts are app-scoped *"forced by semantics, not chosen by policy"* precisely because *"send to left rail" needs to know which note*, while **New fumi** is global because it *creates* one. The same property means it can fire with no focused fumi, no focused Fumi window, and from another app entirely. There is no "here" to inherit.

**Size is not decided here.** note-model owns it and has: the creation default is **a user setting read once at creation and stamped onto the note**, machine-local and backed up per device, shipping at **360 × 420 pt** as a deliberate placeholder. Existing notes never re-read it, so changing it affects notes created afterwards and nothing else. This topic consumes the stamped value like any other authored `size` — floored at the minimum, fitted for display, never re-derived.

*(An earlier proposal here — one fixed constant, explicitly not the last-used size — is superseded by that ruling, which reaches the same place by a better route. The reasoning against last-used still holds and is worth keeping: an inherited size carries one badly-shaped note into every note after it, with no gesture that means "stop doing that". A setting is a setting; an inheritance is a mystery.)*

**What this topic decides — display, Space, position:**

> **A new fumi is born on the currently active Space of the display holding the pointer, cascaded from a fixed origin.**

- **Display and Space — always the currently active Space, on the pointer's display.** The only answer that does not need to know what launched the note, so all three routes behave identically. It is also what every macOS new-window does, and it makes the immediate home record honest: the note is homed where you were when you asked for it.
- **Position — a cascade from a fixed origin per Space**, each new note offset down-and-right from the last, wrapping back to the origin when the next step would leave the visible frame. Furniture behaviour: predictable, and it stops notes stacking exactly on one another as a desk fills up. The Stickies and Finder convention, inherited rather than invented.

**Rejected: pointer-adjacent placement.** Direct-manipulation-flavoured and genuinely good for quick capture, but it makes the birth position — and therefore the home record — an artefact of where the cursor happened to be, which is the least deliberate input available. **Rejected: screen centre.** Calm, but it lands on top of whatever you are reading, every time, which is the one thing a note that is furniture must not do.

~~⚠️ **Implementation checkpoint — summoning onto a full-screen Space.** A macOS full-screen app owns its own Space, and an ordinary floating window cannot join it, so *"the currently active Space"* has no valid answer when the global hotkey fires from full-screen Safari. Whether the note appears on the Space behind, forces a Space switch, or waits is a private-API behaviour question rather than a design one — **space-homing** owns that surface, and the rule above is unaffected either way: whichever Space the note actually lands on is the one it homes to.~~

*(Amended 2026-09-01 — the checkpoint's premise is false, and it dissolves rather than resolving.* **A full-screen Space is an ordinary addressable Space:** *it carries its own ManagedSpaceID and UUID in the per-display array and differs only in reporting type* `4` *rather than* `0`. *A floating window placed on one lands (`SLSMoveWindowsToManagedSpace` → sid 391, `isOnActiveSpace = 0`) and genuinely renders there — confirmed visually over full-screen Safari, Safari still full-screen, nothing flashing or moving. The premise was true of the* **public** *API, which offers no route onto an arbitrary Space, and false of the private one this project is already committed to.*

*So* ***the currently active Space* has a valid answer here, and it is the full-screen Space itself** *— what the user is looking at, and what they would plainly call their current Space. A fourth option joins the three the checkpoint listed and wins on arrival: the note appears right there, over the full-screen app, with no Space switch. The birth rule above needs no exception and takes none.*

***And the ephemeral home is accepted rather than special-cased.*** *A full-screen Space is destroyed when the app leaves full-screen, so a fumi born on one has a home shorter-lived than the note; space-homing decided that case on 2026-08-30 by applying this topic's own rule —* "a fumi born on a fullscreen Space homes to that fullscreen Space, like any other… the alternatives buy tidiness for one Space type and spend the rule that has held everywhere else: wherever the user puts a note is its new home" *— with the consequence stated plainly: the note quietly opens on Space 1 at the next launch, with nothing having gone wrong. Ratified here. The two alternatives both invent state — homing to the underlying user Space picks a home the user never chose, and withholding the home until the note lands somewhere durable gives* `home_space` *a third meaning for one Space type. The accepted cost is that the relocation surprises on this topic's surface, and it stays inside the bounded worst case: never a lost, invisible or unreachable note.)*

**Sibling check: note-model — its decided text holds that a new note is stamped with the creation default at birth and is loose from it forever, that the default is a machine-local user setting rather than a constant, and that its shipped value is 360 × 420 pt pending implementation tuning; where the setting is edited is already rerouted to management-window. All adopted as-is; this topic decides only the display, Space and position a new note is given.**

### DECIDED — moving a note across displays re-homes it (resolves review-005 F17)

The review flagged the one place Positioning touches the epic's headline mechanic: macOS's **"Displays have separate Spaces"** setting means each display carries its own Spaces, so **Move to Display ▸** is not merely a coordinate change — it lands the note on a Space belonging to the other display. Neither side mentioned the other.

**Cutting Move to Display was considered first, and rejected.** The case for cutting was real: dragging already moves a note between screens; a preset saved on the external display *is* "move to the external, at this spot, at this size" with a glyph and an assignable shortcut, so presets subsume the named case; and removing the menu item would have removed the only affordance that silently re-homes a note. Rejected because the collision doesn't actually need the item to exist — a **drag** across displays raises exactly the same question — so cutting would have removed an affordance without removing the problem. Move to Display stays: it is simply the menu-driven form of the drag.

**The rule: wherever the user puts a note is its new home.** Moving a note to another display re-homes it — the Space it lands on becomes the one it returns to at relaunch. Silent, no prompt, no confirmation. This is not a new rule; it is the already-decided *"drag overrides and is remembered"* extended across screens. **Drag and Move to Display behave identically** — one act, one rule, no branching.

*Why not snap back:* the alternative is a note that jumps to a different screen on relaunch than where the user left it. That reads as a bug, not as a feature.

#### Amendment — a display disconnect is not a user action (2026-07-29, resolves review-006 F14)

The review found that **presets got a missing-display fallback and notes never did**, leaving the commonest sequence this app will ever see undefined: undock the laptop, and every note homed on the external has an unresolvable display. The user supplied the real-world case — MacBook Pro docked to a Studio Display, work spread across both — and the concern that decides it: *"I wouldn't want my notes to suddenly re-home, but I also wouldn't want them to disappear."*

**The distinction that resolves it:**

> **A home is *intent*. Where a note currently sits is *resolution*. Fallbacks resolve; they never rewrite.**

*"Wherever the user puts a note is its new home"* stays exactly as written — and **a display disconnect is not the user putting it anywhere.** It is the OS relocating a window. So a topology change **never writes a home**. That alone answers the fear: notes cannot silently re-home on undock, because nothing about undocking is a user action.

**Concretely:**

| Event | Behaviour | Home record |
|---|---|---|
| **Display disconnects while running** | **Do nothing — let macOS relocate the window.** The WindowServer already moves windows off a vanishing display; intervening would double-move them and fight the OS. | untouched |
| **Display reconnects while running** | If macOS restores it, nothing to do. If it doesn't, we may return the note to its home — **unless the user has moved it in the meantime**, which *is* a user action and therefore a genuine re-home. | untouched, unless the user moved it |
| **Relaunch, home display absent** | Place on the **main display**, clamped to the visible frame — mirroring the preset rule and space-homing's *"deleted Space falls back to Space 1"*. | **untouched — still records the absent display** |
| **Relaunch, home display present again** | Resolves to its real home and returns there. | untouched |

**The load-bearing line is the third row.** Falling back must **not** overwrite the stored home with the display we happened to resolve to, or a week on the laptop would permanently strand every note there. This is the same shape as roles-and-swatches — stored intent, resolved presentation — and it is why the fallback is safe to make silent.

**Rejected: storing "primary display" instead of a display identity.** The user raised it, and their own setup is the counterexample: with notes on *both* the Studio and the laptop, storing "primary" collapses the two on undock and gives replugging no way to tell them apart. Display identity is the smaller lie.

**The user's observation that macOS does much of this already is the reason this decision is small** — Spaces belong to displays, and the OS reshuffles them on topology change, promoting the laptop to primary when the external goes. We are not reimplementing that. We only place windows at **relaunch**, which is the one moment macOS has nothing to restore from.

#### Researched — what macOS actually does on disconnect and reconnect (2026-07-29)

*The crux the user pressed on, twice, after two attempts to defer it to research. **They were right to press**: the first response treated "we don't know the fact" as "we can't decide", the second routed it away — and the fact turned out to be **documented and findable in minutes**. Recorded here because the failure was not using the tools to hand.*

**The user's hypothesis was substantially correct: the Space identity survives.** Established from the maintainer of **yabai**, who works in these private APIs directly, corroborated by Apple discussion threads:

| | Behaviour |
|---|---|
| **Disconnect — non-first Spaces of the external** | **Migrate to the primary display, keeping their internal id and UUID.** Not destroyed. |
| **Disconnect — the external's *first* Space** | **Destroyed.** Its windows merge into the primary display's first Space. |
| **Reconnect** | Migrated Spaces are **automatically returned to their original display**, and the windows that moved are **moved back with them**. macOS does the whole round trip itself. |

**One correction to the user's model, and it is narrow.** With *Displays have separate Spaces* **ON**, Spaces genuinely belong to displays — so the external's Spaces **migrate onto the laptop as additional Spaces**, rather than the laptop simply displaying the same ones. But their **identity persists**, which is the part the design depended on.

**What this settles:**

- **While running, Fumi does nothing.** macOS migrates *and restores* live windows on its own. The earlier "don't fight the WindowServer" call is now **evidence-backed rather than a guess**.
- **The only case we handle ourselves is relaunch while disconnected**, which is the one moment macOS has nothing to restore from.
- **The ladder below is not hedging — it is sized to exactly one hole.** Step 1 covers nearly everything because UUIDs persist; **step 2 exists for the external's first Space**, the only one genuinely destroyed and the only UUID that is permanently gone.

**Two caveats carried forward, both from the sources:**

1. The automatic restoration is reported to **occasionally stop working**, with no established cause. Our relaunch path is the backstop when it does.
2. **Display UUIDs can change when reconnecting through a different hub, adapter or port.** Likely fine for a Studio Display on direct Thunderbolt; less so for dock users, and it is the weakest link in the chain now that Space identity is confirmed.

*Sources: [yabai #238](https://github.com/koekeishiya/yabai/issues/238) · [Apple Community — desktop spaces removed on disconnect](https://discussions.apple.com/thread/253624242) · [display UUIDs and window-position persistence](https://shiftplus.app/blog/mac-doesnt-remember-window-positions/).*

#### Decision — a home is a resolution ladder, not a single identifier (2026-07-29)

##### 2026-09-01 — revised

*Trigger: triage from space-homing (discussion, 2026-08-30, revised 2026-08-31): "The home resolution ladder loses its ordinal rung" — its fallback-destination decision removes rung 2 and replaces rung 3's Space half, and the ladder is this topic's to change.*

**A home stores two things, not three: display identity · Space UUID.** The ordinal index is gone.

**And it is not a ladder — it is two independent rules and a fit:**

```
Space    home Space UUID resolves → that Space
         otherwise                → first Space of the home display
                                    (main display's, where the home display is gone)

Display  home display present     → its recorded coordinates
         home display absent      → main display

…then fit to the display it lands on, always, writing nothing.
```

Shorter than what it replaces, and the two axes stop being ordered against each other — they were never dependent, and the rung numbering implied they were.

**Rung 2's condition is a restored Mac, and there it misfires in bulk.** note-model's tiering brings coordinates and home *display* back — the Machine tier is backed up per device — while every home-Space UUID is dead, because the reinstall destroyed the Spaces. *Display present, UUID gone* is rung 2 exactly, so on a restored Mac it fires for **every note at once** and scatters them across Spaces by ordinals that meant something on the old install. Silent, bulk, and indistinguishable from success. *"They are all on the first Space of that screen"* is a floor a person can act on; a hundred plausible-looking wrong answers is not.

**The frequency defence — reinstalls are rare, undocking is daily — does not survive the measurement.** Undocking never reaches this at all: macOS migrates live windows itself and Fumi places only at relaunch, so the case is *launching while undocked*. And there the survivor inherits the departing display's Space list wholesale, so those homes resolve at **rung 1** — the entry above is what pinned that. The single casualty is the built-in's own Space, and for it both answers coincide: its recorded ordinal is 1, and ordinal 1 on the now-main display is that display's first Space. Rung 2's one defensible output on this topology is an artefact of the secondary display having exactly one Space; give it two and ordinal 2 lands on some inherited Space belonging to the *other* display — arbitrary, and wrong in the way that looks right.

**The rung also required a field the note record has never carried**, which settles it independently of any of the above. `grep -n -i "ordinal" .workflows/fumi/discussion/note-model.md` → 6 hits, none a stored field; the Machine tier is *"Window coordinates (display-local), **home display**, home-Space, open/hidden visibility, `last-opened`"* (`note-model.md:765` — its live list; the earlier list at `:741` differs only in still carrying float-on-top, which has since moved to the Note tier, and carries no ordinal either). Dropping rung 2 reconciles the two documents rather than trading one against the other.

**What retires with it.** The known limitation stated below — *"if the user reorders their Spaces while the display is unplugged, the ordinal points somewhere wrong"* — has no subject left. So does the *rebinding is not re-homing* distinction: rung 2 was the only write in the whole resolution path, and with it gone **resolution writes nothing at all**, which is the stronger form of the rule this block already asserted.

**What is untouched:** rung 1, the display half, and *a home is intent; where a note sits is resolution; fallbacks resolve but never rewrite* — which is why the new shape works rather than something it survives.

Trade-off accepted: a secondary display carrying several Spaces loses a best-effort guess that would sometimes have been right. A wrong guess is unnoticeable and a right one saves one drag, so the asymmetry favours not guessing.

*Caveat carried honestly: the undock inheritance behaviour is read from space-homing's captured measurement rather than re-run — one dock cycle, one topology, and the probe sources are no longer on disk.*

*Sibling check: space-homing — its `fallback-destination` decision holds exactly the Space half adopted above, display-qualified on 2026-08-31 because under* Displays have separate Spaces *each display owns its own first Space, and it holds the display half unchanged. Adopted as written; what is decided here is only that this topic's ladder takes that shape, which that decision explicitly delivered rather than imposed. note-model — its Machine tier carries no ordinal (measured above) and it already holds that an unresolvable home falls back to Space 1 (`note-model.md:775`, `:862`), so nothing there is contradicted; but it restates the ladder as three rungs at `:1216` while reasoning about why display identity is stored. That reason survives intact and only its restatement goes stale, so a correction is delivered to it rather than a re-decision.*

##### 2026-09-01 — revised

*Trigger: triage from space-homing (research, 2026-08-25): "After an undock, ladder rung 1 resolves cross-display — with no clamp in the path" — an undock migrates the departing display's entire Space list onto the survivor with every UUID intact, so rung 1 resolves to a Space that has changed screens, and rung 1 carries no clamp.*

**The measurement that reopens this.** Three snapshots across a dock cycle on the user's own inverted topology (Studio Display as main, MacBook built-in secondary, CalDigit TS5) show the surviving display **inheriting the other one's Space list wholesale** — every `ManagedSpaceID`, every UUID, the ordinal order. The Studio's Spaces do not die on undock; they move to the laptop screen. The single Space destroyed belongs to the display that *stays*.

The entry below reads *"step 1 carries the normal case, because migrated Spaces keep their UUID"* as reassurance. It is the defect. Rung 1 is checked first and is UUID-only, so a home whose display is plainly absent never reaches rung 3's clamp:

```
Docked      note homed to Studio Space 7, free, at x=2200 on a 2560-wide screen
Undock, relaunch
            rung 1: UUID resolves ✓ → place on Space 7, now hosted by the 1728-wide laptop
            frame applied as stored → x=2200
            the note is entirely off the right edge of the screen
```

Right Space, wrong screen, unreachable note — which falsifies this block's own *"an unresolvable home never produces a lost, invisible or unreachable note"*, and does so on the common path: the user dock-cycles several times a day.

> **The clamp is not a rung. Fitting a rect to the display it is about to be drawn on is a display-time property of every placement, whichever rung resolved the Space.**

**This is the mechanism the other axis already has**, adopted rather than invented: *"an absolute axis can overflow whether bound or free, and takes the same display-time fit, which writes nothing either way."* Size has carried a general fit since the preset work; position was left with a clamp attached to one rung of one ladder. Making it general is what *a home is intent; where a note sits is resolution; fallbacks resolve but never rewrite* already licenses — the fit writes nothing, so rung 3's *never writes* property survives untouched and now covers rungs that never had it.

The ladder therefore shortens rather than growing a condition: it answers **which Space**, and nothing else. Rung 3's *"clamped to the visible frame"* stops being a rung-specific rule and is stated once, outside the table.

**Rejected: a display condition on rung 1** — require the home display to be present, and fall through when it is not. It spends a Space resolution the measurement shows is *correct* (Space 7 really is Space 7, with its content-context intact) in order to fix a coordinate problem, and the fall-through lands every Studio-homed note on whichever Space you happened to be on when you undocked. Sixteen Spaces' worth of notes in one pile, to avoid a fit that costs nothing.

**Rejected: accept off-screen placement until the user drags the note back.** The drag is a user action, so it re-homes — the user pays for the OS's topology change with a home they never revoked, and pays it once per note. It also leaves the bounded-worst-case guarantee false rather than repairing it.

**One factual correction to the entry below, carried from the same measurement.** Rung 2 is justified there as covering *"the external display's **first** Space, which macOS destroys on disconnect"*. The destroyed Space belongs to the display that survives, not the one that leaves — in this topology the laptop's single Space, a far less common home than the external's sixteen. Rung 2 is rarer than it was written to be. *(Whether it survives at all is a separate question already queued here from space-homing.)*

*Sibling check: space-homing — its `fallback-destination` decision (2026-08-30) holds that a home Space whose UUID resolves opens there, that an unresolvable one opens on Space 1 with no positional fallback, and that the display half stays independent: home display present → its recorded coordinates, absent → main display clamped to the visible frame. That decision is queued here as its own rerouted concern and is not touched by this entry. What is decided here holds under either shape of the ladder, and closes the same hole on that side — its "home display present → its recorded coordinates" path carries no clamp either.*

##### 2026-07-29

**A home stores three things:** **display identity · Space UUID · the Space's ordinal index on that display.**

**Resolution, in order:**

| | Condition | Result |
|---|---|---|
| **1** | The Space UUID resolves | use it — done |
| **2** | UUID gone, **display present** | use the **ordinal index** on that display — right display, same position in its Space list |
| **3** | Display absent | **main display**, current Space, clamped to the visible frame |

**Why this settles it, now that the behaviour is known:** **step 1 carries the normal case**, because migrated Spaces keep their UUID and are returned on reconnect. **Step 2 exists for one specific casualty** — the external display's **first** Space, which macOS destroys on disconnect, taking its UUID with it. A note homed there has a permanently dangling UUID, and the ordinal is what brings it back to the right display when the monitor returns. **Step 3 is for the display genuinely being absent** at launch.

*So the ladder is three rules covering three real, distinct situations — not defensive padding. Had the research been done first, the design would have come out the same; it is simply now justified by evidence rather than by symmetry.*

**Step 2 writes the refreshed UUID back, and this is not a re-home.** The display and the ordinal are unchanged; we are **re-binding the same intent to a new key** because we positively identified the same Space by a second route. Distinguished sharply from the fallback rule above — **step 3 never writes, step 2 rebinds.** *Rebinding is not re-homing.*

**Known limitation, stated rather than hidden:** if the user **reorders their Spaces while the display is unplugged**, the ordinal points somewhere wrong. Unavoidable with any positional key, uncommon, and it degrades to *wrong Space, right display*. If the display has **fewer Spaces** than the recorded index, clamp to the last one.

**Bounded worst case, unchanged:** an unresolvable home never produces a lost, invisible or unreachable note, and never corrupts data. The floor is *right display, wrong Space*.

**What research still owes us** (space-homing, none of it blocking, and all of it now narrower):

- Whether the **ordinal index is readable and stable** per display via the private API — i.e. whether `CGSCopyManagedDisplaySpaces`' per-display array order matches what the user sees in Mission Control.
- **Display identity durability** — the weakest link now that Space identity is confirmed: two identical monitors, and UUID changes through hubs, adapters and different ports.
- Whether the reported **intermittent failure** of macOS's automatic restoration has a detectable signature, since our relaunch path is the backstop for it.
- Behaviour when the display returns with **fewer Spaces** than the recorded ordinal (we clamp to the last; confirm nothing throws).

*Also noted: `Move to Display ▸` hides when only one screen is connected — i.e. it is unavailable in exactly the configuration where a note may be stranded. That is correct rather than a gap, because under this amendment nothing is stranded: the note is on the main display and its home is intact.*

**It also needs no branching on the OS setting**, which is what makes the rule cheap:

- **"Displays have separate Spaces" ON** (the default) — each display has its own independent Spaces, so crossing displays necessarily changes the note's Space, and the re-home falls out automatically.
- **OFF** — a Space is one wide desktop spanning every screen, so crossing displays doesn't change the Space at all; the move is purely coordinates, and "remember where I put it" is already the coordinate-memory behaviour. (Running OFF also costs Split View and Stage Manager and blanks the other display in full-screen, so it's a minority configuration — but the rule holds either way.)

### DECIDED — what a preset captures: three independent axes (resolves review-005 F16)

Review-005 F16 asked whether a preset's geometry is stored in absolute points or proportionally to the display it was captured on. Neither, exactly — the question had a false premise, and answering it properly changed the shape of a preset.

**The opening frame (superseded).** The first proposal was a three-mechanism split: built-in tiling as a proportional recipe, a **user preset as a named place — (display, exact rect)** — and manual drag as a pure move. That last part survives untouched; the middle part did not.

**Why the "named place" model broke.** Fixing every preset to a display is too blunt. The user's counter: *"I might want a preset that just creates the note at a specific size, and I don't want it to move to a different screen. I also might want size and placement. I also might want size, placement, and screen."*

**A preset is a named set of three independently-toggled axes: Size · Position · Display.** Any subset is valid, and every combination is something a person actually wants:

| Axes set | Meaning |
|---|---|
| Size | "Make this 400×600, wherever it is" |
| Position | "Top-left of whatever screen it's on" |
| Display | "Send it to the Studio, unchanged" — Move to Display, saved and named |
| Size + Position | The classic "left rail", applied to the current screen |
| All three | A fully pinned place |

**Consequence — positions are stored display-local, not in global desktop coordinates.** Otherwise *Position without Display* is undefined: a saved x of 3000 is meaningless on a laptop. Display-local means position resolves against the **recorded** display when that axis is on, and against the note's **current** display when it's off, then clamps to the visible frame.

### DECIDED — each dimension is a measurement or a share (resolves review-005 F16, second half)

**An earlier claim, corrected:** built-in tiling was said to already cover the proportional case, making a per-preset proportional flag unnecessary. **Wrong** — the built-ins are halves and quarters only, so *"full height, 280pt wide"* is not expressible by them at all.

**The failure the absolute-only model produces.** "Left rail" = full height, 280pt wide, saved on a 27" Studio. Applied on a 16" laptop, the height exceeds the visible frame, so the clamp fires and the note becomes laptop-full-height *by accident*. Drag it back to the Studio and it stays laptop-sized, because drag never resizes. Re-applying the preset does repair it — so the damage is to the *note*, not the preset — but that is a weak defence: a preset that cannot mean the same thing on two screens, and an accident the user must notice and undo, is a broken preset.

**Why one proportional/absolute flag per preset won't do it: height and width want opposite things.**

- **Height is screen real estate.** "Full height" means full height *of whatever screen you're on* — inherently a share.
- **Width is typographic measure.** 280pt is a line length. A rail that narrows to 210pt on a laptop is worse, not "proportionally correct".

This is why the user's own example instinctively mixed the two. So the unit choice is **per-dimension, not per-preset**:

> **Each of a preset's width and height is independently either a measurement (points) or a share of the display.** The same treatment answers Position, so it is one idea rather than two.

"Left rail" = height *100% share*, width *280pt*. Studio: full height, 280pt. Laptop: full height, 280pt. Symmetric, no decay, no clamping accident. The eighth-of-the-screen variant is the same preset with width as a share instead.

**The clamp demotes to a pure safety net** — it fires only on an absolute size that genuinely won't fit, rather than being the mechanism that silently reinterprets a preset. Also decided: a preset whose captured size is below the decided **minimum window size** clamps up to the minimum; shrinking never clips, because a note is a scrolling text surface.

**No inference on capture (rejected).** A "snap-to-fill" heuristic was proposed — if a dimension matches the display's visible frame within a tolerance, record it as a share, on the grounds that dragging a note to full height and hitting Save means "full height". **Rejected by the user: it must be explicit.** The user states whether a dimension is fixed pixels or a proportion; the app never guesses. Consistent with the product's wider refusal to be clever on the user's behalf.

*Not adopted: a proportional/absolute flag at whole-preset granularity — see the height/width asymmetry above.*

**Rerouted to space-homing — how a home is *identified*.** The first reading was that a home must be recorded as a **(display, Space)** pair, since the private-API space list is returned per managed display and "Space 2" on the laptop is not "Space 2" on the external. The user's counter is probably right and is the reason it's a research question rather than a decision here: if a Space UUID is inherently bound to one display, then handing macOS "move this window to space UUID ABC" resolves the display implicitly and the pair is over-modelling — and with the setting OFF, geometry alone decides the display anyway. **note-window's side is settled** (the rule above); the storage model is space-homing's. *(Rerouted 2026-07-28.)*

---

### Preset Authoring — ~~DECIDED: both menu items are hand-offs to the manager~~ creating on the note, curating in Settings

The preset **model** is decided above; the surfaces behind the two submenu items were not. The spike covers the **Move to ▸** submenu itself (state 7) but stops there — **"Save current as…" and "Edit Presets…" had never been drawn** — and per-dimension units gave them real content to carry.

*From: management-window · discussion · 2026-09-22*

**The ask: relax the "never in-place dialogs" idiom for one case — creating a preset from the fumi you are looking at.** `Save as Preset…` in a fumi's corner menu opens a small sheet **on the note**: a name field, the two dimensions with their `pt` / `%` toggles, and Save. It does not open the Settings window.

**What is being contradicted.** note-window generalised a rule when it routed the preset editor to management-window (resolves review-005 F21):

> *The surface follows the object, not the entry point.* An act performed on this note, or derived from its current state, happens on the note; curating a global library as a library happens in the manager, even when reached from a note. Generalised idiom: **note-side menu items that concern global objects are pre-filled hand-offs into the manager — never in-place dialogs** (retention's "Change…" link already has this shape).

**Why the generalisation overreaches, in its own terms.** The rule's first sentence draws a distinction its second sentence then collapses. *"An act performed on this note, or derived from its current state, happens on the note"* — capturing this fumi's geometry is derived from its current state. *"Curating a global library as a library happens in the manager"* — reordering presets, deleting them, renaming existing ones, assigning their keyboard shortcuts. Creating one preset out of the note in front of you is the first kind of act, not the second. The idiom bundles them.

**The cited precedent is a different act.** The rule points at version retention's *"Change…"* link as the established shape. That link edits a **global setting that already exists** — genuinely curation, and the hand-off is right for it. It is not a precedent for creating a new object out of the thing the user is currently looking at.

**What changed since the rule was written.** When it was set down, "the manager" was one window. management-window has since decided a **two-window split** (user, 2026-09-21): a **Library** window for the fumi list, and a **separate Settings window** carrying the panes, opened by `⌘,`. Presets is a Settings pane. So under the existing idiom, picking `Save as Preset…` on a fumi sitting on Desktop 2 makes a *settings window* appear over the desktop, for an act whose whole content is "name it, done". The hand-off got heavier, not lighter.

**What the sheet contains, and what stays in the pane.** The sheet carries exactly the creation: the name, and each dimension's value with its unit toggle — which is all the common case needs, since capture is raw `pt` on both dimensions and the user flips whichever should be a share. The Presets pane keeps every library act: reorder, delete, rename an existing preset, assign shortcuts, and edit dimensions after the fact.

**What this does not change.** The preset model is untouched — three independently-toggled axes, per-dimension units, display-local positions, no inference ever, presets global rather than per-note, clamping as a safety net. The corner-menu glyph vocabulary is untouched. The Presets pane still exists and is still management-window's. Only the route from a note to a *newly created* preset changes.

**Related, already decided in management-window and offered here as context rather than as an ask:** the Moom-style grid-drag editor has been parked on the roadmap (`grid-drag-preset-editor`, horizon `next`), on the ground that a fumi is its own direct-manipulation editor — you drag the window to the shape you want and save it, where Moom needs a proxy box because it arranges other applications' windows. Nothing becomes unreachable: a full-height rail is drag-tall, save, flip height to `%`.

#### 2026-09-22 — revised

*Trigger: triage from management-window: "Creating a preset from a fumi is a sheet on the note, not a hand-off into the manager" — the manager became two windows, so the hand-off now summons a preferences window to name a rectangle.*

> **Creating a preset happens on the note. Curating the library happens in Settings.**

- **`Save as Preset`** — management-window's label, minus its ellipsis — captures the note's geometry at click time and **saves it there and then**, under a derived name (`280 × 1329`). Nothing opens on the note; a system notification confirms it and carries an **Edit** action into the Presets pane. Naming and the `pt` / `%` flip happen there, when you want them.
- **`Edit Presets…`** is unchanged — a hand-off into Settings' Presets pane, which keeps every library act: reorder, delete, rename an existing preset, assign shortcuts, edit dimensions after the fact.

**The premise moved, which is what justifies reopening it rather than disagreement.** The idiom was written when "the manager" was one window the user was plausibly heading to anyway. Under management-window's two-window split, Presets is a pane behind `⌘,`, so the hand-off puts a *preferences* window over your desktop in answer to a menu item on a fumi — a category error in the interaction, not merely a heavier route. **And the cited precedent was never this act:** retention's "Change…" edits a global setting that already exists, where this creates a new object out of the note in front of you. The idiom's own first clause — *derived from its current state* — always covered the creation case; the second clause collapsed it.

**The generalised idiom narrows rather than falls:**

> **Note-side menu items that *edit or curate* a global object are pre-filled hand-offs into Settings — never in-place editors. Creating one out of this note's own state is not that act.**

**There is no box. `Save as Preset` saves immediately, and the note shows nothing.** management-window's text says a sheet; the class rule read as pointing at a beaked popover; a beakless panel in the chain was tried after that. All three are gone, and the research that killed the last of them is why: **the search for a precedent found none — no app it reached opens a named-input surface attached to a small window from that window's own menu**, and the one app doing this exact job hands off to settings instead. *Stated as what the search found rather than as a universal: four searches and three fetches, recorded below, are not a survey of macOS.* The sheet died at the board on a measurement; the rest died on the absence of precedent. *The item's ellipsis goes with them, under a rule this document already states two decisions up: "on macOS an ellipsis promises further input" — the `Delete` row lost its own for exactly this reason when its confirm was dropped.*

**🎨 Spiked 2026-09-22 — what the drawing found:**

| | Sheet | Free-floating panel |
|---|---|---|
| **at 300pt** | fits, but is **223pt tall against a 130pt note** | unchanged; the note is untouched |
| **at the 240pt floor** | the `pt` / `%` segment **wraps to two lines** — the dimension row does not fit | unchanged; the identical panel at both widths |
| **what it does to the note** | the window **grows to hold it** — 117pt on the drawn note | nothing; it overflows the note's bounds by design |

**The height is the finding the width question was hiding.** A sheet is clamped to its parent window in *both* axes, and a fumi is a small object — 130pt tall on the board against a 223pt sheet — so presenting one is a **resize**, not an overlay. That is not cosmetic on this surface: `size` is authored and synced, a resize is what writes it, and the entire preset model rests on a note's geometry meaning what the user set it to. A sheet would need an exception saying this particular resize is not a resize, which is the kind of carve-out *a home is intent; where a note sits is resolution* exists to avoid. The floor failure is the smaller half and could be designed around by stacking the rows; the growth cannot be, because it is what a sheet *is*. **The sheet direction was deleted from the board rather than archived**, per the rule that a superseded surface left on the canvas is read as current.

**Then the panel died too, and the research is why.** With the sheet gone, three shapes were drawn for the surviving box and the user rejected each in turn: a beaked popover anchored to the highlighted `Save as Preset…` row with the chain still open; the same popover anchored to the `•••` after the chain dismissed; and a third beakless panel in the chain, positioned as a submenu. The objection that finished it is unanswerable — *"you click a menu icon, a menu appears, you select one of the items, that panel disappears, and then another panel appears, but this time with a beak. The first set of options didn't have a beak. That's entirely inconsistent."*

**Researched rather than reasoned, because three attempts had each broken a different rule.** What the search found:

- **Moom** — this topic's own cited reference for preset editing, and the closest functional analogue that exists — does the **settings hand-off**: `Save Layout…` from its menu opens Moom's settings *"with the newly-added action selected and ready to edit"*, and it **pre-names by default**, showing the captured app names until you change them. ([custom actions](https://manytricks.com/moom/help/customactions.html), [walkthrough](https://www.podfeet.com/blog/2022/07/moom-window-management/))
- **Apple's HIG** puts a popover on *a control* — *"a transient view that appears above other content when people click or tap a control"* — a sheet on focused one-time input, and a panel on repeated input-and-observe. Nothing sanctions a panel or popover opening from a menu item. ([popovers](https://developer.apple.com/design/human-interface-guidelines/popovers), [sheets](https://developers.apple.com/design/human-interface-guidelines/components/presentation/sheets/))
- **Refero** has no macOS corpus, as this document already recorded; its web answers are all centred modal dialogs, which is the sheet, already dead here for a different reason.

**The search turned up no precedent for a menu item on a small window opening a named-input surface attached to that window.** Every answer it did find is a sheet on a window big enough to carry one, or a hand-off. That is an absence of evidence rather than proof of none — but it is the whole of what four searches and three fetches reached, and the one directly comparable app is on the hand-off side. The premise was wrong, not the placement.

> **`Save as Preset` — no ellipsis — saves immediately under a derived name. Nothing opens on the note. A system notification confirms it and carries an **Edit** action into the Presets pane.**

**Why this is better than the hand-off Moom actually ships**, which was the other option with precedent: the settings window opens only if you ask for it. Under the two-window split it is a *preferences* window, and having it appear over your desktop because you named a rectangle is what management-window objected to in the first place. Here it appears when you want to rename or flip a unit, and not otherwise.

**The notification is a channel this topic already uses, not a new component.** The first-delete education is a system notification on exactly these grounds — *"a platform primitive… the natural voice for a menu-bar app"*, chosen over an in-app toast because a toast *"would mean inventing a component used exactly once"*. The refusal surface uses one too. The frequency is safe: presets are *"applied constantly and created a handful of times"*, and a system notification dismisses itself, so the banner-fatigue objection that killed the sync banner never arises.

**Nothing-at-all was the failure to avoid, and this avoids it.** A silent save is *"indistinguishable from a drop that missed the window"* — the refused-file decision's words. The notification says it happened; the derived name in `Move to ▸` says what got saved.

**The derived name is what the pre-fill becomes.** `280 × 1329` — the captured geometry, which is also what the old pre-filled row would have shown. Moom's default does the same thing with app names. It reads legibly among human-named presets on board `05`, and its **missing shortcut** marks it as new without any extra state.

***Rejected: keeping the ellipsis.*** It promises further input, and there isn't any. The label reverts to the plainer form, which is also what management-window settled for a different reason (*"I think Save as preset is fine… it's pretty clear really what that does"*).

**The cost is narrower than "you have to go and finish it", and stating it precisely is what exposes the real problem.** The saved preset **is usable the moment it exists** — it applies to any note as `280 × 1329`, exactly that shape, on any screen. What a visit to the Presets pane buys is the **unit**, not the name: turning that captured `1329` into a `100%` share, so the preset means *full height of whatever screen you are on* rather than *1329 points*. Absolute presets — *"make this 400×600 wherever it is"*, *"top-left of whatever screen"* — need no visit at all.

**So the unit flip was the only thing any of the four drawn surfaces ever bought.** The name was always derivable and always renameable later; the geometry is captured either way. A surface hunt that produced a sheet, two popovers and a chain panel was, underneath, about one segmented control.

**And that is a smell in the model, not in the surface** *(the user's read: "that's a different thing, isn't it? Which actually makes me think that this is the wrong shape")*. **No inference, ever** is decided and right — the snap-to-fill heuristic was rejected by name — but it has a consequence nobody had followed through: **a share-valued preset cannot be created in one step by any means.** Either a surface asks for the unit at capture, or the app guesses, and both are refused. The two-step is what is left, and it is structural rather than a shortfall of this particular answer.

**Parked rather than solved, at the user's steer** — *"in the interest of just getting this built, it's something that we can circle back to"*. `in-place-preset-creation` sits on the product roadmap under **next**, sourced back here: creating a preset complete in one step, units included. What it inherits is the finding above — it is not "add a popup", because four shapes were drawn and all four failed on placement grounds that will not have changed. Whatever solves it has to either find a surface with precedent or revisit the no-inference rule, and the second is note-model's ground, not this topic's.

**Beak construction, corrected on the board in the same pass.** The beak is a triangular tip butted against the panel's edge in the panel's exact fill, drawn over the panel so no seam crosses the join — the side-facing form of the rule the corner-menu beak already carries. A **rotated square** reads as a detached diamond floating in the gap however carefully it is positioned — it has to be an actual triangle, drawn over the panel in the panel's exact fill so no seam crosses the join. **The corner menu's own anchoring was wrong on both frames that show it against a fumi** — and correcting it is what exposed the beak contradiction, then the offset that depended on it. It now anchors as a menu does: the panel's own corner radius straightening just left of the `•••`, opening downward with a clear gap. Corrected on frame `1` and on the preset frame, which are the only two that draw it against a note. **The corner menu's own beak was reopened in the same pass and settled against it** — it is a menu, it carries none, and it never had one drawn; see *the corner menu carries no beak*.

**Both halves of the old refusal survive, which is the tell that it was right.** It rejected a note-side naming box on two grounds: the unit controls would exist on two surfaces, and creating a preset is rare so optimising it is backwards. Nothing here duplicates a control, and the rare act now costs one visit to an editor that has to exist anyway. What the refusal got wrong was only its *remedy* — opening the editor unasked — which the notification's **Edit** action fixes without reopening the reasoning.

**And the naming problem dissolves rather than being answered.** The entry below flagged that *"Save current as…"* promises a save-and-name box and delivers an editor, preferring *"New Preset from This Note…"*. With no box at all and no ellipsis, the label promises nothing it doesn't do. The weak preference is withdrawn.

*Sibling check: management-window — its decided text holds the two-window split (a Library window and a Settings window behind `⌘,`), the note-side item as `Save as Preset…` opening a sheet on the fumi, the Presets pane keeping reorder, delete, rename, shortcut assignment and after-the-fact dimension editing, and the grid-drag editor parked on the roadmap. All adopted except the box, which its text gives as a sheet on the fumi and which is this topic's surface to call: **there is no box.** A correction was rerouted there while the answer was still "an anchored popover" (concern 021), and a second, superseding one landed once the answer settled (concern 022). Rerouted to management-window triage (2026-09-22).*

#### Initial

**The surface rule (also answers review-005 F21).** F21 flagged that two landed decisions chose differently: retention pushes its "Change…" out to the manager, while presets are created and managed from a per-note corner-menu submenu. The split was implicit. The rule that resolves it:

> **The surface follows the object, not the entry point.** An act performed *on this note*, or derived from its current state, happens on the note. Curating a global *library* as a library happens in the manager — even when you reached it from a note.

Applied: **applying** a preset is an act on this note → corner menu (already decided). **Authoring** a preset touches a global library object → manager. Retention's "Change…" alters a global setting with no relationship to the note you're standing in → links out. Same rule, different answers, which is what makes it a rule rather than a preference.

**A rejected middle position.** The first proposal carved an exception: *Save current as…* would open a **small naming sheet on the note**, because its input is this note's geometry at the moment you have it right, and bouncing to the manager to type a name seemed absurd. **Rejected — the frequency premise was wrong.** Presets are *applied* constantly and *created* a handful of times, so optimising the rare act at the cost of building the unit controls on two surfaces is backwards. Dropping the exception also makes the rule above hold without qualification.

**Both items are pre-filled hand-offs:**

- **"Save current as…"** captures the note's geometry **at click time**, opens the manager's Presets section, and creates a new row pre-filled with those values, name field focused.
- **"Edit Presets…"** is the same destination without the seeded row.

**The generalised idiom** — worth holding across the product, since retention's "Change…" already has this shape:

> **Note-side menu items that concern global objects are pre-filled hand-offs into the manager — never in-place dialogs.**

**Consequences:**

- **Pre-fill is raw points on both dimensions.** The user flips whichever should be a share. The capture stays dumb and honest; the editor is where intent gets expressed. Consistent with the no-inference decision above.
- **The manager appearing cannot disturb what you are saving** — geometry was captured at click time, before the window opened.
- **Naming:** *"Save current as…"* promises a save-and-name box but now opens an editor. **"New Preset from This Note…"** is the more honest label. Flagged as a weak preference, not pinned.

### DECIDED — the preset row's location glyph: draw what's proportional, mark what's absolute

Positioning decided that each preset row carries a **small location glyph**, using the same mini-layout language as the built-in tiling icon grid, because a name like "Reading pane" tells you nothing about *where* it lands. That decision assumed every preset **has** a location. Under the three-axis model they don't — a size-only preset has nothing to draw — so the glyph has to encode *which axes are set*.

**The rule.** What can be drawn to scale is exactly what is **proportional**. A *share* is a fraction of the screen, so it draws accurately inside a frame. A *measurement* cannot: 280pt is a different fraction of every display, so any rectangle drawn for it is a lie. Position is always drawable because positions are display-local. Display is not geometry at all.

> **Draw what's proportional, mark what's absolute, leave what's unset blank.**

| Mark | Means |
|---|---|
| **Filled, to scale** | Axis set as a share — drawn accurately |
| **Dimension arrow on that edge** | Axis set as a measurement — indicative shape, flagged as fixed |
| **Outline / absent** | Preset doesn't touch it; the note keeps what it has |

The absolute marker is a **dimension arrow** — the draughtsman's convention for "this length is specified" — a small double-headed arrow across the edge. *Considered and rejected: printing the real numbers inside the glyph (the user's first instinct) — at ~14pt "200×300" is texture, not text; and a bare `×` mark, which can only say "absolute" about the whole rect, where arrows say it **per edge**. The mixed case is the common one, so per-edge wins. Real numbers live in the editor, where there is room.*

Resolved cases:

- **"Left rail"** (height share, width pt) — frame, strip hugging the left edge drawn accurately full-height, one horizontal arrow across its width. The mixed case draws best of all.
- **Halves / quarters** (both shares) — pure drawing, no arrows. Identical to the built-in tiling grid, which is correct: they are the same thing.
- **Size only** — bare rect, no frame, arrows on both edges.
- **Position only** — frame with an outline rect at the spot. "Lands here, keeps its size."
- **Display only** — no geometry to draw.

A glyph is therefore **readable backwards**: what is filled, arrowed, or blank tells you which axes the preset sets — which was the glyph's original job.

**Display leaves the glyph entirely.** Two screen shapes at menu-row size would be mud, and by the rule above Display isn't geometry anyway. It becomes a **dimmed display name trailing the glyph** — honest, since "Studio Display" is a name, not a shape.

*The same vocabulary is needed by the preset editor, so it rides along with the reroute below. Treated as spike-tweakable, like the other visual details in this document.*

### DECIDED — preset shortcuts are app-scoped; global is reserved for summoning (resolves review-005 F19)

Presets can carry keyboard shortcuts (shown right-aligned in the corner-menu row, e.g. `⌃⌥1`). Review-005 F19 flagged that these are **user-assigned**, which moves collision risk to runtime — unlike the formatting shortcuts, which we picked ourselves and validated (the ⌥⌘C / Copy Style lesson). The illustrative `⌃⌥1` also sits next to macOS's own `⌃1…⌃9` Mission Control Space switching, which is unusually loaded territory for an app whose signature feature is Space homing.

**The convention.** App-focused is the norm — a user doesn't expect PhpStorm to hear keystrokes when its window isn't focused. Mixing the two scopes is nevertheless standard practice (Things' quick entry, Drafts, Bear, Raycast all ship one or two global bindings and keep everything else app-scoped), under a clean rule:

> **Global hotkeys are for getting *into* the app. App-scoped shortcuts are for acting *within* it.**

**Preset shortcuts are app-scoped — and this is forced by semantics, not chosen by policy.** "Send to left rail" requires a referent: *which* note? With no focused fumi there is no answer. The only way to make it global is to apply it to the most-recently-focused note, which is exactly the implicit magic that produces "why did that one move?". Rejected.

**The legitimate global case is New fumi** (quick capture) — inverted for the same reason: it needs no referent, it *creates* one. That is the summon action. Possibly alongside a show/hide-all, if one is wanted.

**Collision detection — carried to management-window.** App scope does **not** confer safety: **system shortcuts beat app key equivalents**, so binding `⌃1` means simply never receiving it while Mission Control owns it. The shortcut recorder should **detect and warn at assignment time** rather than let the user discover a dead binding; for a global hotkey the stakes are higher still, since it competes with every app at once. management-window's brief already claims *"user-mappable keybindings"* and quick capture, and under the **surface-follows-the-object** rule a keybinding map is global state — so the recorder lives in the manager. **note-window only displays the resulting shortcut** right-aligned in the preset row.

**Rerouted to management-window** (2026-07-28) — the preset editor itself: the Presets section, the per-dimension unit controls, and the **Moom**-style grid-drag idiom the user raised (Moom lets you set explicit sizes *and* drag boxes on a grid, which makes a share directly manipulable rather than a number in a field). note-window owns the model and the apply surface; the editor is the manager's.

---

## Drop Interaction

### Context

*Rich-content authoring: two-zone drop interaction. Rerouted from note-model · discussion · 2026-07-22.*

**Model context already settled in note-model** (for reference — do not re-decide): a fumi is a **bundle** (`{uid}/` = `content.md` + `assets/` + intrinsic state). A non-text item has one property: **placement kind** — *in-body* (positioned; referenced at a cursor location in `content.md` via `fumi://asset/<id>`) or *note-level attachment* (carried, unpositioned). **All assets are copy-only** — always copied into the bundle's `assets/` (link/alias dropped for v1: machine-specific, breaks multi-Mac sync).

*From: storage-and-sync · discussion · 2026-08-09*

storage-and-sync changed the size ceiling from a soft one to a **hard limit**: an asset over the ceiling is **refused at the moment it is added** — at every entry route, drop, paste and remote fetch — and never enters the bundle. The `excluded` state and its placeholder are gone at source *(absorbed separately — see the amendment under Asset Reference States)*. What lands **here** is the ask storage-and-sync explicitly did not decide: **what the user sees at the moment of a refusal.** Their own text had delegated it — *"note-window owns the attach-time warning + the placeholder"* — and that sentence is struck along with the mechanism it pointed at. The one thing they fixed is that a refusal happens; the entire user-facing treatment is this topic's.

Two things carried from the entry rather than re-derived. **This is a v1 constraint, not a design position** — chunked-asset spanning post-launch lifts the ceiling, so whatever surface is built for the refusal should be cheap to retire rather than load-bearing, and lifting the limit is purely additive. And the accepted cost is named at source: a **single-Mac user loses a capability**, because an oversized file used to become a working local-only asset and, with link/alias dropped for v1, now has no route into a fumi at all. That cost becomes visible exactly at this surface, so the copy must not pretend the file is coming back later.

### DECIDED — everything drops in-body at the caret; no attachment zone

**Note-level attachments are dropped as a user-facing concept.** Dragging an asset in places it **at the caret**, or ~~**at the end of the content if the note wasn't focused**~~ **at the end of the content when the pointer is over the note but not over content**. *(Amended 2026-09-01, resolves review-010 F1 — the struck clause was rejected by name in the very next decision, *a tracking insertion caret, not a drop zone*: "**Focus is irrelevant**… (Considered and refined: 'unfocused → append at end'. **Rejected** in favour of pointer position, which preserves the same fallback while keeping precision available without a preparatory click.)" The fallback is unchanged; what decides it is the pointer, not focus.)* Images and Mermaid render inline where they land; PDFs, spreadsheets and the like become **chips in flow** at that position. There is no separate footer/attachment area.

**Why this is better than the two-zone overlay discovery sketched:**
- **It fits the settled model rather than fighting it.** note-model made placement *derived* — an asset is "note-level" precisely when nothing references it. This doesn't remove that state; it means **the GUI never deliberately creates it**.
- **The common case is visually identical.** "Attach the deck to this note" is served by dropping it at the end — exactly where a footer attachment would have rendered.
- **It removes a targeting decision** that only ever disambiguated one narrow case (a *non-renderable* file inline-at-cursor vs as a footer attachment). Images want to be inline wherever you drop them; the zones charged every drop for a choice that rarely mattered — on a note that may be only ~200px tall.
- **It inherits a rule we already made:** "at the caret, or at the end if unfocused" is the same behaviour settled for clicking a note's title bar (focus without a click-point puts the caret at the end).

**Consequences to carry forward, not rediscover:**
1. **The unreferenced-asset state still exists — just never user-created.** Storage ref-counts assets while *any retained version* links them, so an asset can sit in the bundle without the *current* content referencing it. That's normal and already handled. Downstream should not build UI for *creating* that state.
2. **Deleting a chip removes the reference, not necessarily the file.** The asset survives while retained versions still link it, then is GC'd at retention. Already consistent with storage's ref-count-by-link decision; nothing new required.

### DECIDED — a tracking insertion caret, not a drop zone

**No drop overlay.** The overlay existed to present a choice that no longer exists. Instead, two signals:

- **"This note will accept it"** — the note under the pointer takes a subtle **drop-target state** (a highlight on the panel) as a compatible drag enters.
- **"It will land here"** — a **text caret tracks the pointer** continuously through the content as you drag; releasing drops the asset exactly there.

*A zone is a **region you target** — discrete, "here or there". A tracking caret is a **position**, and is strictly more precise: you can place a chip between two specific sentences rather than "somewhere in the content area". This is also **native macOS text drag-and-drop behaviour** — dragging into any text view already shows an insertion caret following the pointer — so it's inherited, not invented.*

**Where the drop lands — decided by the pointer, not by focus:**

- **Pointer over content** → the caret tracks it and the asset drops there. **Focus is irrelevant** — drag-tracking doesn't depend on keyboard focus, and macOS already behaves this way (drag a file over an unfocused TextEdit window and you get an insertion point). Requiring a click first to gain precision would read as a missing capability. The drop focuses the note.
- **Pointer over the note but not over content** — the chrome band, the margins → **append at the end of the content**. *(Considered and refined: "unfocused → append at end". Rejected in favour of pointer position, which preserves the same fallback while keeping precision available without a preparatory click.)*

**Drop targets whole blocks, never their interiors.** If the pointer is over a table, code fence, Mermaid render or image, the caret **snaps before or after** that block. **You can *type inside* a block but you *drop around* it** — a deliberate asymmetry: an image dropped into a table cell wrecks the layout, and a chip inside a cell is cramped to uselessness. Consistent with "blocks are units" from the two-step-delete and click-to-edit-source decisions.

**Multi-file drop:** all files insert **in sequence at the caret, in drag order**. Surfacing that order in the UI isn't worth solving.

### DECIDED — a refused file: the drag says no, the drop says why (2026-08-10)

**The hole the hard limit opened.** Our position was *"Nothing is said at drop time"*, and the reasoning was explicit: the fact stayed visible **afterwards**, on the chip's metadata line. Under a soft ceiling the drop succeeded and the label carried the truth from then on. A hard limit has no afterwards:

```
soft ceiling   drag 60 MB video → chip appears → "60 MB · Local only"   ← the label is the answer
hard limit     drag 60 MB video → nothing added, no chip, no label
                                → under the old rule, the app does nothing at all
```

Nothing-at-all is indistinguishable from a drop that missed the window, which is the worst available reading: the user's next move is to try again, harder. So the surface has to speak.

Two properties shape the answer. **The file is not lost** — the user still has it and has only lost the ability to put it *in a fumi*, so the register is a refusal with a reason, never an error. And **the refusal is knowable before the drop completes**, since the size is available while the drag is over the window — a route the post-hoc label never had.

> **The drag says *no*. The drop says *why*.**

- **During the drag, the whole note takes a refusal state** — the drop-target highlight it already has for accept, rendered instead in the **reserved system-state space**, with the tracking caret absent and the system's rejection cursor. Same element, no new component; it reads as *this note is declining* rather than *your cursor changed*. It is transient by construction — alive only while the drag is over the note, gone when you drag away or release — so there is **nothing to dismiss**, the property the recency tint was built on.
- **On release, nothing happens in the note** and a **system notification** carries the reason.

**Why the whole note, when the drop overlay was rejected by name.** Because **accept and refuse want opposite things.** Accept needs precision — *where does this land* — which is exactly why there is a tracking caret and no overlay. A refusal has no landing point at all, so the whole-note treatment that was wrong for accept is right here. Same reasoning, opposite conclusion.

**Why the reason is not drawn on the note.** This was the proposal and it lost to the small-note case: the **minimum window is the chrome band plus one line, ~240pt wide** *(raised from ~180–200pt on 2026-08-10 — see* the width floor is set by the band*)*, so a note may have nowhere to put a sentence. The pointer also sits on the note with the system's drag image under it, occluding whatever did fit, and the user is moving. Words at drag time are the one thing this surface cannot reliably deliver. Every placement fails for its own reason as well — the **chrome band** is a fixed 30px already doing two jobs, a **top banner** reflows content ~40px under the cursor mid-drag (the fault the conflict spike caught), and an **overlay** covers the content it is not the moment to read.

**Why a system notification rather than an in-app toast.** The platform primitive is already this document's answer for the first-delete education, for the same reason: an in-app toast would be **a component invented for one use**. It also cannot attach to anything here — the drop never happens, so there is no chip, no block, no insertion point to hang it from.

**One notification per transfer, never per file.** Twenty oversized videos in one drag produce one message naming what was left out.

### DECIDED — a mixed transfer is never refused whole (2026-08-10)

> **What fits lands; what doesn't is dropped, and one notification names what was left out.**

Inherited rather than invented: rich-text paste already *"drops what the dialect doesn't model rather than inventing syntax"*. An oversized image is the same shape — the transfer succeeds, one item does not arrive. Three files where one is too big, and a web paste whose text is fine but whose hero image isn't, are the same rule.

**Which route gets which surface falls out of what is knowable when, not from a choice:**

| Route | Size known before commit? | Surface |
|---|---|---|
| **Local file drag** | yes — during the drag | whole-note refusal state, then the notification on release |
| **Paste** (a file, or an image inside pasted content) | yes, at paste | notification; the rest of the paste lands |
| **URL drag / user-initiated remote fetch** | **no** — only after fetching | nothing renders, then the notification |
| **Agent write or fetch** (CLI / MCP) | n/a | **no notification** — the error returns to the agent |

**The URL drag is the awkward one and needs nothing new.** It is a drag, so it wants the drag-time refusal, but the size is unknown until the bytes are fetched — so it degrades to the paste shape. *Atomic and silent* already covers it: content appears once the bytes are in, so an item that never arrives simply never appears. Specifically **not** a *fetching…* placeholder, which is the shape of state two absorbed concerns have just finished deleting.

**An agent-caused refusal does not notify.** A system notification for something an agent did — possibly while the user is away from the machine — is the *announce it* pattern already killed for sync arrivals and agent writes. The agent gets a clear error and reports it in its own conversation, where the user is actually looking. **Rerouted to agent-surface** as a constraint on the error contract, the same shape as hard-delete being routed there as a constraint on the verb set.

**The copy names the limit rather than pinning it** — the number is storage-and-sync's and still open, and as a hard refusal the ceiling becomes a product statement (*a fumi holds files up to X*) rather than a judgement about upload practicality. It must also not imply the file arrives later, because it never will.

**Accepted cost, stated rather than buried: notification permission and Focus mode both swallow the reason silently.** Under either, the user gets a refusal with no explanation, every time. This is weaker than the first-delete precedent, where the notification taught a rule **once** and the safety net existed regardless — here it is the only channel carrying the *why*. Accepted, because *refused, reason unknown* is a different universe from *nothing happened*, and the drag-time state carries the refusal itself without any permission at all. Two consequences: the refusal state must be unmistakable on its own, and **the limit wants a discoverable home** rather than existing only at the moment of failure — which is management-window's or onboarding's, not this surface's.

#### Decision — the band's `attach` control is a direct file picker, and it is the table's fifth route (2026-09-01, resolves review-010 F6)

`attach` was decided as an element and never as a behaviour. The layering table pins the bar's contents as *"Four items: `Aa` · task list · table · attach — what you can't type"*, *chrome appears on focus OR hover* lists it among the controls that act on the insertion point, and the ~240pt width floor is derived from *"a four-item capsule at roughly 126pt"* — so the minimum-window decision rests on it existing. Nothing said what clicking it does.

The sharper half is that it leaves a hole in a table already built. *A mixed transfer is never refused whole* routes the size limit by what is knowable when, and `attach` has no row — while storage-and-sync's ceiling refuses an oversized asset at **every** entry route. It is also the one route with no drag to carry the drag-time refusal state and no paste to piggyback on.

> **`attach` opens the system file picker directly — multi-select — and inserts at the caret exactly as a drop does. For refusals it takes the paste shape: what fits lands, what doesn't is dropped, and one notification per transfer names what was left out.**

| Route | Size known before commit? | Surface |
|---|---|---|
| Local file drag | yes — during the drag | whole-note refusal state, then the notification on release |
| Paste | yes, at paste | notification; the rest of the paste lands |
| URL drag / remote fetch | no — only after fetching | nothing renders, then the notification |
| Agent write or fetch | n/a | no notification — the error returns to the agent |
| **`attach` picker** | **yes, at selection** | **notification; the rest of the selection lands** |

**Insert-at-caret is inherited, not chosen.** *Everything drops in-body at the caret* already made that the rule for every asset arrival, and the control only exists while the note is focused and editable, so an insertion point always exists. There is no unfocused case to define.

***Rejected: a menu behind the icon.*** Apple's paperclip is a menu because iPadOS has several sources behind it — Photos, Files, Scan, Camera. With assets copy-only and no camera or scan story, that menu carries exactly one live item, which is a button wearing a hat. If a second source is ever added, a menu is the additive change.

**One improvement this route can make that the others cannot.** An open panel can refuse a selection in its own dialog, so `attach` is the only entry route able to say *why* at the moment of choosing rather than afterwards — which is what every other route settles for a notification to do. Worth taking where it works; the notification remains the guaranteed floor, since it is what covers a multi-file selection where only some items are refused.

*Sibling check: storage-and-sync — its decided text holds the size ceiling as a **hard limit**, refusing an oversized asset at the moment it is added at every entry route, with the number still open and the user-facing treatment explicitly this topic's. Adopted as written; what is decided here is only which surface this route uses, which its "every entry route" wording requires rather than permits.*

#### Decision — a note that cannot accept *anything* uses the same refusal state (2026-08-10, resolves review-009 F10)

The refusal vocabulary above was scoped to one cause, the size ceiling. There is a second: *what works in a non-live state* blocks **drop and paste** on a note previewing a version and on a note in Recently Deleted. The two are not obviously alike — an oversized file is a note declining *that file*, where a previewing note would decline anything, including one it would take happily a moment later.

> **Same treatment during the drag. The release differs, because one has something to point at and the other does not.**

| | During the drag | On release |
|---|---|---|
| **File over the limit** | refusal state | system notification — nothing on screen to point at |
| **Note not editable** | refusal state | **pulses the state's primary action** — *Done* when previewing, *Put Back* when deleted |

One vocabulary, because the alternative is worse on its own terms: an accept highlight with a tracking caret that then swallows the drop is the *nothing happened* failure the size decision exists to eliminate, and worse here, since the caret actively promised a landing point.

**No notification for the read-only case.** The banner is already on screen saying why, so firing one would announce a fact the note is showing — the rule that killed the hard-deleted-link dialog. The blocked-input rule supplies the better answer anyway: these states have a primary action, and pulsing it says what to do about it.

**The system rejection cursor does not carry over.** On an oversized file it is honest — that file can never go in a fumi. On a previewing note it overstates: nothing is wrong with the file or the note, you are looking at history. The note's own refusal treatment carries it; the cursor is left alone.

**Sibling check: storage-and-sync — its decided text holds the ceiling as a hard limit refusing an oversized asset at the moment it is added at every entry route, with `excluded` and its placeholder struck, and explicitly hands the user-facing treatment here (*"note-window owns the attach-time warning"*, the mechanism behind it now struck). The number itself is theirs and still open; this topic pins no value. note-model — its self-containment invariant and engine-side materialisation on every `content.md` write are unaffected: nothing here changes what a write does, only what is shown when one is refused.**

---

*Original rerouted proposal (superseded by the two decisions above), kept for provenance:*

**The interaction is note-window's to design** (inspired by Spark's email composer, where dropping into the body embeds vs dropping into the footer attaches):
- When content is dragged over a note, a **drop overlay** appears, split into two zones — **top = content area**, **bottom = attachment area**.
- Drop in **content** → inserts **at the cursor**. Renderable types (image/GIF/Mermaid) render inline; non-renderable types (PDF/Excel/…) insert as a **chip at the cursor**.
- Drop in **attachment** → adds as a note-level attachment **chip** (footer-style).
- Each placed item (image / chip / rendered block) exposes a **hover options control** to edit or remove it (no linkage modes — assets are copy-only).

## Inline Rendering

### Context

*Inline rendering behaviours. Rerouted from note-model · discussion · 2026-07-22.*

> ⚠️ **Partly superseded by the Editing UX decisions** (review-004 F10). The "rendered ↔ raw toggle" below is now the **Edit as Markdown escape hatch**, not a co-equal mode; markers are concealed with **no inline reveal-on-cursor**. Original rerouted text kept for provenance.

Rerouted from note-model, which settled *which* content types a fumi supports; **rendering them is note-window's**:
- Live Markdown render — **GFM base + Fumi-custom syntax** — with a **rendered ↔ raw toggle** where the raw/code layer shows the underlying Markdown/Mermaid source.
- **Mermaid** ` ```mermaid ` blocks render to diagrams in the rendered view (source shown only in the raw layer).
- Fenced **code blocks** render **syntax-highlighted**.
- **Animated GIFs** animate.
- **Emoji** render natively (Unicode — free).
- Rendering fidelity is **Fumi-only** — external-tool rendering is explicitly *not* a goal, so custom syntax/render treatments are fair game.

Complexity flag carried from discovery: true live/render-as-you-type Markdown (Obsidian/Bear-style, hiding syntax markers around the cursor) is one of the meatier GUI pieces — size it honestly.

### Settled upstream by the Editing UX decisions (not reopened)

Markdown renders live with **markers permanently concealed**; **code fences, Mermaid, tables and images are block constructs** (two-step delete, click-in to edit source); **code spans do *not* conceal their contents**; the old rendered↔raw toggle is now the **Edit as Markdown** escape hatch. This subtopic owns only how each content type **looks and behaves when rendered**.

### Decision — per-type rendering treatments

- **Mermaid** — renders as a diagram in place, on a **debounce** once the fence parses. While you edit, keep showing the **last good render** rather than flashing empty. On a syntax error, show the **source with an inline error** — never a blank space or an alarming red box.
- **Code fences** — syntax-highlighted monospace, language taken from the fence info string. **No chrome at rest** (consistent with the whole product); the **language label and a copy button appear on hover** only.
- **Images** — inline at a sensible max width (note width minus padding), aspect ratio preserved. Large images scale **down**; small ones render at natural size rather than stretching up. Click selects (for two-step delete); hover exposes the options control (see Drop Interaction).
- **Animated GIFs** — **always animate**. Considered play-on-hover (a wall of animating notes could be busy) and rejected: you chose to put it there, and always-animate is what's expected.
- **Task checkboxes** — `- [ ]` renders as a real **interactive checkbox**; clicking toggles it and writes `[x]` to the buffer as **its own undo step** (per the undo decision). **Checked items strike through their text** — validated in the Paper spike, reads well.
- **Emoji** — native Unicode, nothing to build.
- **External links** (`https://…`) — link text with the URL concealed, styled distinctly but not garish; **click opens the default browser**, hover shows the target. Distinct from `fumi://` links (peek/open a note → Note-Link Interaction).
- **Block quotes** — indented with a **subtle vertical rule** on the left. *(Not in tension with discovery's hard-rejected accent-edge: that was chrome on the note itself; this is inside the content and is the universal convention.)*
- **Horizontal rules** (`---`) — a light divider line at full content width.
- **Nested lists** — indent per level, bullet glyph varying by depth per Markdown convention.
- **Attachment chips** (PDF, Excel, zip) — note-model's "carried, not previewed" types: icon + filename chip. Interaction below.

### Decision — attachment chip interaction

note-model said "opens in its native app **on click**" but explicitly left the interaction to note-window. **Refined**, following Finder's conventions — a single click launching an external app and switching context is too big a jolt for one click, and single-click-select is needed anyway for the two-step delete agreed for blocks:

**Visual treatment** (reworked after the user judged the first pass "not very Apple" — it read as a flat white sticker):
- **Translucent fill so the glass shows through** (vibrancy-like), not an opaque white capsule — the chip belongs to the material rather than sitting on it.
- **A real macOS-style document icon** — white page with a folded corner and a **coloured extension band** (`PDF`, `XLSX`), rather than a generic outline glyph.
- **Filename in medium weight + file size as secondary metadata** — the metadata is what makes it read as a system attachment rather than a web tag. *(Amended 2026-09-14 — the name drawn here is the **link label in `content.md`**, written as the filename at insert, not the stored `originalFilename`; see* the chip's label is written into the note *under Asset Reference States. The treatment is unchanged.)*

States:
- **Hover** → the chip lifts subtly and reveals an **options control** (replace · remove · reveal in Finder), in its own rounded well.
- **Single click** → **selects** the chip (consistent with block selection; enables backspace-to-delete).
- **Space** → **Quick Look.** The important addition: glancing at a PDF without leaving the note is what you want most of the time, it's pure macOS muscle memory, and the system provides Quick Look for PDF/Excel/etc. for free.
- **Double click** → opens in the **native app**.

*"Carried, not previewed" was note-model's **storage** stance — we don't render the file inline. It never meant you shouldn't be able to peek at it, and Quick Look delivers that at no cost.* Pleasing consistency: attachments use the **system's** Quick Look; the `.fumi` Quick Look extension routed to storage-and-sync would make Fumi's own notes previewable the same way.

### Decision — math / LaTeX rendering (new content type)

**Supported — both inline (`$…$`) and block (`$$…$$`).** Purely a *rendering* decision: `$…$` is ordinary Markdown text in `content.md`, so the note model is unchanged and note-model needs no reopening (same shape as Mermaid — the model says "content is Markdown"; what renders is note-window's).

**Delimiter disambiguation uses the established convention** (Pandoc's rule, adopted by GitHub for inline math) — no new machinery needed:
- opening `$` **not** followed by whitespace
- closing `$` **not** preceded by whitespace
- closing `$` **not** followed by a digit — this is precisely the currency rule: *"costs $5 and $10 more"* doesn't match because the candidate closer is followed by `1`. `$PATH` fails too (no closer on the line). `\$` escapes a literal.

**An Equation item in the formatting menu** inserts the delimiters, so the common path never involves typing `$` — which reduces misfire exposure further.

*Deferring inline math was proposed and **rejected by the user** — correctly. The reasoning ("inline is harder, and `$` collides with currency") was over-cautious: the collision is a solved, standardised problem, not one we'd be inventing an answer to.*

Renderer: **MathJax with SVG output** — see the render-once-to-SVG decision below. *(KaTeX was proposed first and **superseded**: it's faster, but it emits HTML+CSS, not SVG, so it can't use the cached-native-render architecture. Since we render once and cache rather than per-frame, MathJax's extra cost doesn't land anywhere that matters — consistency wins.)*

### Implementation findings (from the `pluk-inc/markdown-preview` reference, MIT)

- **Parser: `swift-markdown`** — Apple's own, cmark-gfm-backed, matching the settled GFM dialect. Decisive reason beyond provenance: it yields an AST **with source ranges**, which is exactly what concealment needs — every construct must map back to precise buffer offsets to know what to hide and where the caret sits. That rules out the alternatives (`Down`, `Ink`, and Foundation's `AttributedString(markdown:)`, which is for simple inline formatting and handles neither tables nor fences properly).
- **Parse strategy: full reparse on change**, since notes are small. **Named fallback if that proves too slow: block-scoped reparse** — Markdown block structure is essentially line-scoped, so the dirty block can be reparsed instead of the document. Measured during the editor spike; the fallback is decided now, not deferred.

### Decision — render once to SVG, cache, display natively (Mermaid + math)

There is **no native option** for either: Mermaid is a JS-ecosystem format with no production-grade Swift port, and it needs a DOM to measure text (so JavaScriptCore alone won't do). But **we do not embed a live web view per diagram**:

**Render once in an offscreen web view → take the SVG → display it natively → cache it.** Re-render only when the source changes.

Why it matters for this design, not just implementation: blocks must feel like **static rendered units** (consistent with two-step delete and click-to-edit-source). A wall of notes each hosting a live browser is the opposite of calm furniture — and would be a memory and battery problem on a desktop covered in notes.

This is what selects **MathJax over KaTeX** for math: MathJax emits SVG, KaTeX emits HTML+CSS, so only MathJax fits the same pipeline. One architecture serves both renderers.
- *Not a model for our editor:* that app renders via **WKWebView** with a separate raw Edit Mode — the two-mode approach we rejected. It sidesteps concealment/caret rather than solving it. Mild evidence our path is the harder one (already the named spike), but Bear / iA Writer / Obsidian ship it natively.

### Decision — table rendering & horizontal scroll

Text reflows to fit the note; **tables can't**. So rather than compressing a table until it's unreadable:

- The table keeps a **minimum width** (driven by column count) and does **not** shrink below it.
- It **scrolls horizontally within the note** — the note itself is never forced wider.
- **Directional edge fades make the scrollability obvious**, and indicate which way there's more:
  - scrolled fully **left** → **right edge faded** (more to the right)
  - scrolled to the **middle** → **both edges faded**
  - scrolled fully **right** → **right edge solid** (you see the table's true right border), **left edge faded**

A common, well-proven responsive-web pattern. Considered and rejected: letting wide tables clip with a static fade (no directional signal, and no way to reach the rest).

**Refinements from reviewing the spike (user):**
- **No left/right border on the scroll viewport** — only top and bottom. A hard border down a faded edge contradicts "content continues past here"; content must dissolve sideways with nothing stopping the eye.
- **The fade is an ALPHA MASK, not a painted overlay** — the decisive point, found by trying both. Painting a tinted band over the content will *always* read as a band on a translucent surface, because it's an opaque rectangle sitting on the glass. Masking makes the content (and the panel's own top/bottom borders) genuinely **fade to transparency**, letting the glass show through. In the build this is SwiftUI `.mask()` with a `LinearGradient`. Verified in the spike — the difference is large.
- **Not edge-to-edge.** Considered (the user raised it) and rejected: the note's 1px luminous border and 14px rounded corners are load-bearing parts of the glass material — a table bleeding into them would fight the panel edge and break at the corners. Inset content with no side borders achieves the same effect without touching the panel.
- The spike's table is **representative, not the target look** — the real fade should be considerably softer.

### Spike — content rendering (Paper, 2026-07-26)

Second artboard in the Fumi Paper file: **"Fumi — content rendering spike"** (same file, `01KY2JBXY2MTMYVTA5ZXSR2CW9`). Built strictly from decided treatments — no invented chrome, content-only at rest (no close/`•••` shown). Covers: task list w/ strike-through, syntax-highlighted code fence, Mermaid diagram, tag pills, scrollable table w/ directional fades, image + PDF/XLSX chips, and a **dense mixed note** (external link + block quote + horizontal rule + nested list + inline code + chip). Reuses the established glass recipe and the four tints.

**What it proved:**
- **Dense content stays calm.** The mixed note — quote, rule, nested list, inline code and a chip together — reads as furniture, not clutter. This was the real risk and it holds.
- **A shared "inset block" treatment emerged and should be adopted:** code fences, Mermaid renders and tables all sit in the same container — **~8px radius, a subtle dark tint over the glass (~4–6% black), a hairline border, 12px padding**. Using one treatment for all block constructs gives visual coherence and reinforces "blocks are units" (they *look* like units).
- **Checkbox + strike-through, tag pills and file chips all read well** at note scale.

**What it corrected:** the table fades were **far too heavy** on the first pass — they read as solid grey panels rather than a fade, obscuring content instead of hinting at it. Tuned down to a soft ~28px gradient. Real lesson for the build: the fade must be *subtle enough to see content through*, or it looks like a rendering bug.

**Limits (same as the first spike):** static mock — no real Liquid Glass refraction. **Additionally: Paper renders transparency but not a convincing backdrop *blur*** — content behind a translucent panel stays sharp, so glass reads as "see-through" rather than "frosted". Panel opacities in the mock are therefore tuned for legibility, and the real build should be **more transparent than the mock**, because true blur turns background text into an indistinct wash (visible in the user's macOS reference captures).

**Second pass (after user review):** the table scroll viewport lost its **left/right borders** and its fades were retinted to the note's own fill and widened/softened — content now dissolves sideways instead of ending at a hard line. A **chip-states** note was added showing all three: *at rest*, *hover* (lifts, options control appears), *selected* (accent ring). **No `⏎` shortcut** — Enter inserts a newline in a text context and means rename in Finder; opening is double-click.

### Asset Reference States (child of Inline Rendering — DECIDED 2026-08-06)

#### Context

*From: note-model · discussion · 2026-07-30*

note-model made *"every asset is referenced by content"* an invariant (note-level attachments were killed as a concept — this topic had already dropped them user-facing, and storage's ref-count GC collects any asset nothing references). The inverse is **not** guaranteed: a `fumi://asset/<id>` token can point at an asset that isn't here. The model's stance mirrors note links — **the token renders as a placeholder and is never rewritten or removed**, because the target may return and destroying the reference makes recovery impossible. But absence has **two meanings**, distinguishable because storage-and-sync gives each asset its own child record (`originalFilename` / `addedAt` / `excluded`), so **the record syncs even when the bytes don't**:

*(Amended 2026-08-10 — the two field names read `original_filename` / `added_at` here and in the sibling check below. They arrived through a rerouted concern written before storage-and-sync's casing rule landed and were quoted verbatim, correctly at the time; the rule is **per layer, not per record** — `meta.json` and the `CKRecord` are serialisations of the struct and take camelCase, SQLite is the query index and takes snake_case. The asset child record is record-layer, so the camelCase names are canonical. `excluded` is one word and unaffected. Nothing about the states or their treatment changes.)*

| State | Meaning |
|---|---|
| **present** | bytes are here — renders |
| ~~**excluded**~~ | ~~record exists, bytes deliberately not synced (storage's >50 MB local-only rule). Exists elsewhere — on the Mac that added it. Actionable, not an error.~~ **Retired 2026-08-10 — see the amendment below.** |
| **missing** | no record. Genuinely unavailable. |

This topic owns how each reads. The parallel offered: the same shape as the note-link soft-deleted vs hard-deleted distinction already decided here, with "excluded" as the asset analogue of soft-deleted.

*From: storage-and-sync · discussion · 2026-09-14*

storage-and-sync settled what happens to the assets manifest when a note's `meta.json` is damaged, and handed the surface question here. The manifest — `id → {originalFilename, addedAt}` — is *metadata about* assets rather than the record of which assets exist: the files sit in `assets/` and the references are `fumi://asset/` tokens in the text, so rendering and ref-counting survive a damaged sidecar untouched. The manifest is **reconstructed from the note's asset child records** where the store has them, and **nothing is invented** where it does not. For a store with sync switched off there are no child records to rebuild from, and — on their reading — the manifest was the filename's only home, so those filenames are permanently unrecoverable.

The ask: the note is open, the chip is for a non-renderable asset, the bytes are present and clicking it still opens the file. There is simply no name to put on it. Two shapes were visible from their side — render the file's **kind** drawn from the on-disk extension (`.pdf` → *PDF*, `.mov` → *Movie*), which invents nothing because the extension is real and on disk; or render **no label at all**, leaving an unnamed affordance that still opens. Rare either way, and self-healing on a synced store: the manifest rebuilds the moment a fetch completes. Storage added that they are deliberately confined to what is stored — *"no filename is written and none is invented"* — and that there is no third state to model and no new field, the absence of a manifest entry being the whole signal.

#### Amendment — `excluded` is retired; one absent state remains (2026-08-10)

*From: note-model · discussion · 2026-08-08, ratified by storage-and-sync · discussion · 2026-08-09*

storage-and-sync made the 50 MB ceiling a **hard limit**: nothing over it enters a bundle at all. `excluded` was the record of a file that *had* been admitted and then deliberately not synced — so with nothing oversized ever admitted, the state has no instance left to describe. The flag is gone from the asset child record at source.

> **The pair collapses to one. `missing` is the only absent state**, reachable solely by agent error or a damaged bundle.

Which is what note-model always called it — *"an error state, not a transport state"*. The frequency argument the two-state design rested on stops being something the design has to protect and becomes simply true: sync can no longer produce an absent asset at all.

**What retires with it:**

- **The Excluded column** of the treatment table below.
- ***excluded is inert, and reads that way honestly*** — it exists solely to argue that two absences are worth telling apart. With one absence there is nothing to tell apart, and its own admission that *"nothing works on either state"* is what is left.
- ***the source Mac says so too*** — its whole subject is a chip reading `60 MB · Local only` on the Mac that added the file, which describes a file that can no longer be in a fumi.

**What survives untouched**, because none of it was ever about `excluded`: `missing`'s treatment (chip with no fill, dashed outline, broken-file glyph; the same dashed inset block for an image), the **filename at full strength**, **shape and glyph carrying the state with colour reinforcing** from the reserved space, and the **token never rewritten or removed**. A single absent state does not need the shape-vs-colour rule any less — it still has to be distinguishable from a present asset, and it still must not be signalled by colour alone.

**The conditional branch did not fire.** note-model wrote this a day before storage-and-sync ratified, so it carried a fallback for the decline: materialisation that cannot obtain the bytes writes **plain Markdown text and no `fumi://` token at all**, built from the filename and the reason — which would have left two things here to decide, the wording of that degraded text and whether the clipboard carries a `fumi://note/` link back to the source so the copy can be redone where the bytes are. Ratification means no paste can reach that path. Recorded because it is a real design that exists nowhere else, and would be the starting point if a chunked-asset mechanism ever reintroduces an asset that is present on one Mac and not another.

*Note this is the second time a design here has been dissolved rather than answered by an upstream ruling, in the same direction both times: the mechanism gets simpler because the state stops existing. Recorded as an observation, not a lesson — the reroute is what made it visible.*

**Sibling check: storage-and-sync — its decided text now holds the ceiling as a hard limit, with the `excluded` flag struck from the asset child record and the accept-then-exclude mechanism retired outright; every asset a bundle holds is present on every Mac. note-model — its decided text holds `missing` as an error state rather than a transport state, and the token-never-rewritten rule, both of which this amendment leans on rather than revises. This topic decides only what its own surface stops rendering.**

#### Decision — the treatment

The complication the note-link parallel doesn't carry is that an asset renders **two ways** — a **chip** for carried types (PDF, spreadsheet, zip) and an **inline image** for pictures — so each state needs both forms.

| | **Missing** (gone) |
|---|---|
| **Chip** | no fill, **dashed outline**, broken-file glyph |
| **Image** | placeholder in the **shared inset-block container** (the treatment code fences, Mermaid and tables already use), carrying the filename, **dashed outline** |

*(Amended 2026-08-10 — the table carried an **Excluded** column: chip keeping its fill with a not-here glyph and a metadata line reading "Not synced — over the size limit"; image as an ordinary inset-block placeholder. Struck with the state — see the amendment above. The inset-block container survives as `missing`'s image form, which it always also was.)*

Reusing the inset block rather than inventing a placeholder is the same move the document has made throughout: an absent image is a block-shaped thing, and the container that already says *"this is a block"* says it here too.

**Shape and glyph carry the distinction; colour reinforces** — the rule inherited from the note-link states, and for the same reason: these are **system states**, so their colour comes from the reserved space resolved per swatch, never the note's palette.

**The filename stays at full strength in both cells** *(read "all four" until 2026-08-10, when the Excluded column went)*. Directly the correction made to deleted note-link pills: the label is the user's own words, and making it unreadable because the *target* went away is editing their note by other means. ~~`originalFilename` is exactly that.~~ *(Amended 2026-09-14 — the label is the **link text in `content.md`**, not `originalFilename`; see* the chip's label is written into the note*, below. The rule is unchanged and in fact lands better: "the user's own words" is now literally true of what the chip draws, where the struck clause was claiming it of a value stored elsewhere.)*

**The token is never rewritten or removed** — adopted from note-model, and the third time this document applies the rule (hard-deleted note link, absent asset token, dangling `preset_id`): the target may return, and a destroyed reference cannot recover.

#### Amendment — the chip's label is written into the note, not read from the manifest (2026-09-14)

The concern above asks what a chip draws when its name is gone, and offers two shapes. A third was weighed here before the premise gave way — the kind moved off the name line and onto the metadata line beside the size, where descriptive facts about a file already live, so the missing name stays visibly missing instead of being papered over by something that reads as one:

```
today                        [PDF]  Q3-board-pack.pdf
                                    2.4 MB

kind on the name line        [PDF]  PDF Document
                                    2.4 MB

no label                     [PDF]  2.4 MB

kind on the metadata line    [PDF]  PDF Document · 2.4 MB
```

**None of the three is taken, because the premise is false** — and it was the user who put weight on the premise rather than the options. The session had the third shape argued and was moving to land it; the push back was *"this feels like a hole in how we store things"*, aimed a level above the surface question. It is, and checking where the hole actually sits is what dissolved the question instead of answering it.

The concern rests on the manifest being the filename's only home. Two sibling documents disagree about that, and neither cites the other (`grep -n "fumi://asset" .workflows/fumi/discussion/note-model.md`, `grep -n "originalFilename" .workflows/fumi/discussion/storage-and-sync.md`):

| | |
|---|---|
| `note-model.md:353` | a non-renderable asset's content form is **link syntax** — `[report.pdf](fumi://asset/<id>)` — and the renderer draws that as a chip |
| `storage-and-sync.md:157` | the search corpus pulls each asset's `originalFilename` out of the manifest because *"the filename is **not** in the note's text"* — in a decision whose own corpus rule keeps link labels |

A chip whose Markdown form carries a label has the name in `content.md`; a corpus that has to fetch the name from a sidecar does not. Both cannot hold.

**What settles it was never written down: nothing says what label is written when a file is inserted.** Insertion is this topic's surface — drop, paste and the band's `attach` picker all land at the caret — and none of those decisions said what goes in the brackets. The two documents drifted apart in the space that left, and the unrecoverable-filename case is downstream of the gap rather than the cause of it.

> **Inserting a file writes its filename as the link label. The chip renders the label. `originalFilename` stays on the record as what the file *is* — what it reveals as in Finder, opens as, and drags out as — and is no longer what the chip reads.**

**This is *inserting with no selection pre-fills the label* reaching the other token type** — decided earlier the same day for note links, on reasoning that transfers without adjustment: the picker never writes an empty label, because a pill whose visible text is derived from elsewhere is a pill whose words exist nowhere in the note's own bytes. A chip labelled from the manifest is that pill exactly. Writing the name into the buffer at insert makes it the user's text from that moment, which is the state every other visible token in a fumi is already in.

**The concern's state stops being reachable at this surface.** Storage's repair rule keeps `content.md` untouched, so a damaged sidecar on a sync-off store costs the Finder name and leaves the chip's label where it always was. There is nothing to draw a fallback for, which is why no fallback is drawn — the kind-on-the-metadata-line shape is recorded above as a rejected option rather than a held one. *(The second time this subtopic has had a treatment dissolved rather than answered, and in the same direction: the state stops existing. Recorded as an observation, not a lesson.)*

**What the label being real text costs, named.** It is ordinary content, so it is editable: rename the chip in your note and it stays renamed, with the file underneath unaffected. That is *label — as written, not the live title* reaching assets, and it is the behaviour a Markdown link already has everywhere else in the buffer. A renamed chip still reveals and opens under `originalFilename`, which is the fact the label was never carrying.

*Sibling check: note-model — its decided text holds the non-renderable asset's content form as `[label](fumi://asset/<id>)` drawn as a chip, and holds that a materialised copy inherits `originalFilename` as "what the chip labels and opens with". The form is adopted as written and is what this decision rests on; the second clause is the half this contradicts — the chip labels from the link text, and opens with `originalFilename` — and a correction is rerouted there. storage-and-sync — its decided text holds the on-disk asset name as `<ulid>.<ext>`, the manifest as `id → {originalFilename, addedAt}`, and its search corpus as `content.md` plus each referenced asset's `originalFilename` on the stated ground that the filename is not in the note's text. The record and the manifest are untouched here; that ground is what a label in content falsifies, and a correction is rerouted there — including whether the corpus still needs the manifest pull once the label is indexed like any other link text.*

#### ~~Decision — excluded is inert, and reads that way honestly~~ *(retired 2026-08-10)*

> ⚠️ **Retired with the state — kept for provenance.** Both blocks below argue about `excluded`; neither has a subject any more. See *`excluded` is retired; one absent state remains*.

~~**Nothing works on either state.** No Quick Look, no open, no reveal — there are no bytes on this Mac. So excluded is **soft-deleted-shaped visually and hard-deleted-shaped behaviourally**, which breaks the note-link parallel the reroute offered: there, soft-deleted stayed actionable (Space peeks, double-click opens, Restore available).~~

~~**Kept anyway, because the two states are worth telling apart even when neither is actionable.** The difference is *"I have lost this file"* versus *"I am on the wrong machine"* — which is not an action but is a genuinely different thing to know, and it changes what the user does next (walk to the other Mac) rather than what the app can do for them. A single indistinct broken state would collapse a recoverable situation into an unrecoverable-looking one.~~

~~**No which-Mac field is chased.** Naming the machine would need a field the asset record does not carry, and the user's call was that it is not worth adding for now. *(Amended 2026-08-06 — the line this recorded, "not on this Mac", was weaker than it needed to be: **why** the asset is absent is the `excluded` flag itself, already on the record, so the copy reads **"Not synced — over the size limit"** with no new field. Only **which machine** holds it remains deferred.)*~~ *The which-Mac question dies rather than staying deferred: it only ever meant "which Mac holds the bytes you can't see", and there is no such Mac now.*

#### ~~Decision — the source Mac says so too (2026-08-06, resolves review-008 F11)~~ *(retired 2026-08-10)*

~~The three states describe an asset **as seen from a Mac that lacks its bytes**. On the Mac that *added* an oversized file, nothing reads as unusual at all: the chip renders, Quick Look works, double-click opens. So the consequence is visible everywhere except where the choice was made — which breaks the premise every *say nothing* precedent in this document rests on, that **the state explains itself on screen**.~~

> ~~**The chip's metadata line carries it.** It already shows filename plus file size; local-only assets add the fact.~~

```
this Mac      chart-final.mov     60 MB · Local only
other Mac     chart-final.mov     Not synced — over the size limit
```

~~Same line, same place, honest on both machines, no new element and nothing to dismiss. *Mark it, don't announce it* — the rule that killed the sync banner — applied to a standing property rather than a change.~~

~~**Images take it in the hover options control.** An inline image has no metadata line and content-only-at-rest forbids giving it one, so the fact lives where *replace* and *remove* already do.~~

~~**Rejected: a one-time system notification** on the first oversized drop, mirroring the first-delete education. The precedent is close, but it is the weaker fix: delete's notification teaches a rule the user then applies themselves, whereas this is a **per-file fact** they would have to retain file by file. A label that is always right beats a lesson that has to be remembered, and costs less.~~

~~**Nothing is said at drop time.** The drop's two signals — drop-target state and tracking caret — are unchanged.~~ **Superseded 2026-08-10 — see *a refused file: the drag says no, the drop says why* under Drop Interaction.** This line was correct while the ceiling was soft, because the drop succeeded and the chip's label carried the fact from then on. A hard limit leaves no label to carry it.

*One thing here is worth carrying rather than losing: the **review-008 F11 premise** that produced this block — a state must explain itself where the choice was made, not only where the consequence lands — is a general rule and survives its subject. The rejected notification is also worth remembering as a rejected shape, for the same reason it lost: a per-file fact taught once is a fact the user has to retain.*

**Sibling check: note-model — its decided text holds that every asset is referenced by content, that note-level attachments are gone as a concept, and that an unresolvable asset token renders as a placeholder and is never rewritten or removed; this topic adopts those and decides only how the placeholder reads. ~~storage-and-sync — its asset child record (`originalFilename` / `addedAt` / `excluded`) and the >50 MB local-only rule are what make the two absences distinguishable at all, and are used as-is.~~** *(Field names amended 2026-08-10 — see the note under Context. The clause itself struck the same day: the `excluded` flag is gone from the record and the local-only rule is a hard limit, so there is one absence, not two. The record's remaining fields are still used as-is.)*

### Parked — webpage preview on hover (V2 candidate)

Hovering an external link could **fetch and preview a snapshot of the page**. Usefulness is unproven, so **deferred — not v1**. Would pair with the `fumi://` note-peek interaction if it ever lands.

## Note-Link Interaction

### Context

*Note-to-note link: peek + open interaction. Rerouted from note-model · discussion · 2026-07-22.*

The **representation** is settled in note-model: a note-to-note link is a standard Markdown link with a custom protocol — `[label](fumi://note/<uid>)` — keyed off the stable **UID**, never the title. The model reserves it (costs nothing); the **interaction is note-window's, and the feature itself is optional / possibly not first-cut**:
- **Hovering** a `fumi://` link spawns a **peek** of the linked note to the side of the current note, only while hovering.
- **Clicking** it **opens** the linked note (as its own floating fumi, or another open affordance).
- Coordinate with the parallel **tag-click** navigation (a tag filters/peeks; a note-link opens) — the two "navigate from inside a note" affordances should feel consistent. (Tag-click behaviour itself is owned by the note-model **tags** subtopic + management-window.)

Decide whether note-linking is in the first cut, and design the peek/open interaction if so.

**Deleted-target states (from note-model F6):** links are soft UID references that degrade gracefully — note-window owns the visuals. Distinguish **soft-deleted** vs **hard-deleted** targets, ideally by **colour**, and **show the state on hover**. A **soft-deleted** target still resolves — you can **open it** (flagged as in Recently Deleted, with restore); a **hard-deleted** target shows an **"unavailable"** state (non-destructive; clicking says the note no longer exists). Model side is settled (soft refs, no enforcement/cascade); this is purely the presentation.

*From: search-and-retrieval · discussion · 2026-09-12*

search-and-retrieval decided its corpus as **the index holds what the user put there** — a note's own `content.md`, plus each referenced asset's `originalFilename`, minus `fumi://` URL targets. The whole decision turned on one failure mode: the user reads a word inside a note, searches it, and gets nothing. That reads as "search is broken" rather than "search doesn't do that", and eliminating it is why attachment filenames were pulled into the index at all.

This topic's note-link rule creates one surviving instance of it. The pill shows the label as written and *"fall[s] back to the live title only when the label is empty"*, so an empty-label link — `[](fumi://note/<uid>)` — renders the **target note's** title as text that exists in neither the linking note's `content.md` nor its assets manifest, while the URL target is stripped by the corpus rule. The user reads *Q3 planning* on a pill inside a meeting note, searches those words, and the meeting note does not come back.

Search accepted it rather than fixed it, and the boundary is worth knowing: pulling the target's derived title into the linking note's index row would make one note's searchability a function of another note's first line, so renaming *Q3 planning* would force a re-index of every note linking to it. Every other input to a note's index row lives inside that note's own bundle. The trade was priced on frequency, and the frequency is this topic's to state — if the picker writes the target's title in as real text at insert time, empty-label links come only from agents emitting bare references and the accepted cost is negligible; if the picker leaves the label blank, this is the ordinary path and search priced it wrongly. The link editor's decided shape — a title-search field over notes plus a results list, no UID and no `fumi://` surfaced, no label field when a selection exists — is untouched by the question, and was separately adopted by search-and-retrieval as its title-search mode.

### DECIDED — scope: note links ship working, not half-built

**Not an MVP.** The user's framing: *"I want a fully functioning product. That doesn't mean we necessarily do everything, but in this case what I don't want to do is half a feature."* Note links are in, working.

There is also a **floor that was never optional**: the `fumi://note/<uid>` scheme is already reserved in the model, and **agents can emit links trivially** because they know UIDs. An agent writing "see also your Q3 planning note" produces one whether or not we designed for it — so shipping nothing would render as raw Markdown or a dead link inside the user's own note.

### DECIDED — the tag-click rejection does not transfer

The first move here was to argue that clicking a note link is the same act note-model rejected for tags. **Wrong, and the user corrected it:** the tag rejection was about **fan-out** — a tag can sit on a hundred fumis, and "click a tag → open every note with it" means a hundred windows scattering across Spaces. Nobody wants that. **A note link is one-to-one.** The multiplicity was the objection, not the navigation.

*(The Space concern was independent of the analogy and survived it — resolved by the open-behaviour decision below.)*

### DECIDED — note links inherit three existing patterns and invent nothing

The interaction turned out to be **already decided in this document**, spread across three subtopics:

- **Peek — an anchored popover, not the side panel** (see the correction below). Note-level accessories sit beside the note; a token-level preview anchors to its token.
- **Select and act — the attachment-chip model.** *Single click selects · **Space peeks** · double-click opens · backspace deletes* (the two-step delete falling out of selection). Note the payoff: **Space-on-a-selected-object is already an accepted exception here**, so no new rule is needed to free the key. A note peek is literally **Fumi's own Quick Look**, which the chip decision already anticipated when it noted the `.fumi` Quick Look extension would make Fumi's notes previewable the same way.
- **Render — the tag-pill model, not the chip model.** A chip carries icon + filename + file size: a substantial object that would shatter a sentence. Note links live **in prose** ("see also *Q3 planning*"), so they take the borderless translucent **pill**, with a small note glyph where a tag has its `#`.
- **Label — as written, not the live title.** Markdown says the label is content; an agent that wrote "see also your Q3 planning note" chose those words, and substituting the live title would wreck the prose. A renamed target therefore leaves a stale label — accepted, because **the peek carries the live title** and is one hover away. Fall back to the live title only when the label is empty.

**A rejected inheritance: reverting to raw Markdown for editing.** The tag model was initially carried over wholesale, including *"backspacing across a tag reverts it to plain `#text`"*. **Rejected — it contradicts "no inline reveal-on-cursor".** The principle that separates them: **a tag has no concealed syntax to reveal** (the `#` is shown inside the pill by decision, because it is how you *read* the token), whereas a note link's raw form `[label](fumi://note/<uid>)` is almost entirely concealed. Reverting a tag exposes nothing; reverting a link would expose everything.

### DECIDED — editing a link never reveals its syntax

- **Backspace from the right of a link selects it; backspace again deletes it whole.** The two-step delete already decided for block constructs, applied to an inline object.
- **To edit it, click to select, then use a link item in the formatting menu** — the same item that *inserts* a link. It presents the **target note, chosen by searching notes by title**, never by UID.
- **The `fumi://note/<uid>` form is an implementation detail and is never surfaced in the editor.** The user picks a note; the app writes the reference.
- **No separate label field when a selection exists** — the selection **is** the label. A label field is only needed when inserting with nothing selected. *(From the Refero pass below; the one finding of it that survived platform scrutiny.)*

*The note picker stays on the note rather than handing off to the manager: under the **surface-follows-the-object** rule, the object being acted on is **this note's content**. Choosing a reference is not curating a library. It reuses the manager's search capability as a component, not as a destination.*

**The editor's surface — DECIDED (2026-07-29): a popover anchored to the selection.**

Now that the formatting surface is settled, this closes. **The link editor is a popover with a beak, anchored to the selected text** — not a row inside the `Aa` popover, and not a standalone dialog.

**Why anchored to the selection**, rather than expanding in place on the `Aa` panel (the candidate carried over from the discarded Refero pass): it is the *same argument that decided the note-link peek*. A link editor acts on **one specific run of text**, and a surface that doesn't point at it can't say which. Anchoring is the disambiguation. It also avoids a popover opening from inside another popover.

**Consequences:**

- **It is a panel of controls, so it takes a beak** — centred, with the popover centred on the selection, per the popover rule.
- **No label field**, because the selection is the label. A label field appears only in the insert case, where there is no selection.
- **Contents are a title-search field over notes plus a results list.** No UID, no `fumi://`, no syntax anywhere.
- **Four routes, one surface:** ⌘K · the `Aa` popover's link icon · the selection context menu's *Link…* · the corner menu's *Format ▸ Link…*. Every route opens the same popover in the same place.

**🎨 Spiked** — *`09 — Note Links`*. *(Amended 2026-08-10 — this cited `10 — Formatting Surface`, frame 8, on a board that carried seven frames and was subsequently dissolved. See* board `10` was dissolved *below.)*

*Superseded by the above:* What is decided above is the link editor's **content and rules**. How it is presented is not — and it should not be settled here, because ⌘K / *Link* is one action among many that the same surface must host. Designing it in isolation would fix a convention for the whole formatting system as a side effect of a link decision.

*A first pass drew a standalone "Link to a fumi" popover on the spike board — a title, a `Text` field, a search field, and result rows carrying `edited 2d ago` metadata. **Removed from the board.** The metadata was never discussed at all, the `Text` field is redundant against a selection, and leaving invented layout on a canonical board is how it quietly hardens into a decision.*

#### Refero pass — and why most of it was discarded

Research was run for small anchored config/edit popovers. **Screens: 3 searches, ~30 reviewed, 2 inspected at full size.**

- **Resend** (`refero.design/pages/37f2bd38…`) — selection raises a floating toolbar (`Text ⌄` style dropdown, then link · B · I · U · S · code · align). The link icon **expands a second row on the same toolbar**: one field, *"Paste a link"*, with a ✓. No modal.
- **Slab** (`refero.design/pages/83d01829…`) — identical structure, and its **colour** control also expands a second row in place rather than opening a popover.
- **Medium** — third instance of the floating-on-selection toolbar.

**The user rejected the conclusion on platform grounds, correctly.** Refero's corpus is **web and iOS only — there is no macOS in it.** And the specific failure is worse than a mismatch: **web apps float a toolbar on selection because they have no menu bar.** They are solving a constraint Fumi does not have — we ship a real Format menu and system-wide shortcuts. "Three products converge" was really "three products with the same missing affordance converge."

**What survived** (platform-independent):

1. **No label field against a selection** — a content decision, adopted above.
2. **Sub-options expand in place** rather than opening a popover from a popover — a layout idea, reached independently by two products for two different features. Carried to `formatting-surface` as a candidate, not a conclusion.

**What was discarded:** that a floating selection toolbar is the right surface. Genuinely open.

*Method note for later passes: Refero's nearest usable proxy for Apple-native composition is **iOS** (`platform: "ios"`) — Apple's own Notes formatting panel is a floating panel. Touch targets don't transfer; composition partly does.*

**🎨 Spiked** — *`09 — Note Links`*: the pill in prose, the selected state, the anchored peek with **Open**, and soft- vs hard-deleted pills. *(~~The link editor is deliberately **not** on this board — its surface belongs to `formatting-surface`.~~ **Struck 2026-08-10** — `formatting-surface` has no board: `10` was dissolved into `01` and `05`, and the link editor came here, which is what the Spike Index has said all along.)* The board deliberately shows **label ≠ live title** — the pill reads *"the board pack"* while the peek header carries *"Q3 board pack"* — because that is the decision, and having them coincide would have demonstrated nothing. *(A first pass also put tag pills on the board to show the two token types side by side; the user cut them — the board is about links, and the comparison muddied it.)*

### DECIDED — inserting with no selection pre-fills the label with the target's title (2026-09-14)

Two routes into a link, and only one ever had a stated label. With a selection, *the selection is the label*. With nothing selected, *"a label field is only needed when inserting with nothing selected"* named the field and never said what is in it:

```
insert with a selection      [board pack](fumi://note/01J9…)     ← the user's own words
insert with no selection     [??????????](fumi://note/01J9…)     ← never stated
```

> **The label field opens pre-filled with the target's derived title, written into the buffer as ordinary text. The picker never writes an empty label.**

**What a blank field would cost, and it is not only search.** Blank lands `[](fumi://note/<uid>)`, which this topic's own fallback renders as the target's *live* title — text existing nowhere in the linking note's bytes. Against a corpus of *"what the user put there"*, the pill reads *Q3 planning* and searching those words does not return the note holding it: the visible-but-unfindable failure search-and-retrieval's corpus rule exists to eliminate, surviving in the one place it could.

**The deciding factor is this topic's own label rule, not the index.** *Label — as written, not the live title* exists because substituting a live title *"would wreck the prose"* — a sentence changing under the user when someone renames a note elsewhere. A blank label is that substitution made permanent for the whole pill, which puts the live-title fallback at odds with the rule sitting beside it. Writing the title at insert makes it the user's text from that moment: it goes stale on a rename exactly as a selection-inserted label does, which is behaviour already accepted rather than a new kind.

**The cost, named.** Inserting a link plants text the user did not type, and a later rename leaves the note carrying the old name with no signal. Accepted because it is the identical trade the selection route already makes — one rule for both routes, rather than one route quietly behaving better than the other.

**The empty-label render is untouched and becomes agent-only.** An agent emitting a bare `[](fumi://note/<uid>)` still renders the live title and still searches the way search-and-retrieval describes. What changes is frequency: the hole leaves the ordinary human path, which is the corner-case pricing their accepted cost was taken on.

*Sibling check: search-and-retrieval — its decided text holds the corpus as `content.md` plus each asset's `originalFilename` minus the `fumi://` URL targets, and records the empty-label pill as an accepted exception priced on frequency, with the frequency question handed here. Adopted as written; this answers that question rather than revising the corpus, and the exception stands for the agent-emitted case it now covers alone. note-model — its decided text holds the title as the derived first line, display-only, re-derived live, and never an identifier. Unchanged: the picker writes a snapshot of that derivation into prose at insert, which is a label like any other and is never read back as identity.*

### DECIDED — the peek is anchored to the link, not a side panel (corrected at the spike)

The peek was first drawn as a **side panel beside the note**, reusing the version-history / conflict placement. **Wrong, and the user rejected it: this is a different UX and needs a different treatment.**

The decisive argument is semantic, not stylistic: **a side panel cannot say which link it belongs to.** Version history and the conflict reconciler are *note-level* accessories — they concern the whole note, so sitting beside it is unambiguous. A peek concerns **one token inside the text**. Put three links in a note and a panel floating alongside is anyone's guess.

**So the peek is a popover anchored to the pill, with a beak pointing at it** — reusing the ~~corner-menu popover's~~ beak construction rules recorded under the corner menu (already spiked, already corrected once). *(Amended 2026-09-22 — the corner menu itself carries no beak; the rules stayed on its site and the peek still inherits them. See* the corner menu carries no beak*.)* The anchor *is* the disambiguation. It overflows the note's bounds, as a popover should.

**No explanatory copy.** The first pass carried a footer line — *"Read-only preview. Held while hovering, or pinned by Space."* **Cut.** The user is not stupid and knows they are previewing; narrating the obvious is clutter, and it is the same instinct that produced the rejected agent-activity header. *If a state needs a caption to be understood, the state is wrong.*

### Correction (from the spike) — deleted pills keep their label at full strength

The deleted-target pills were first drawn with the **label text faded** along with the container. **Wrong on our own terms, twice over:**

- **It breaks *"neither state edits your prose."*** The label is the user's own sentence. Making those words unreadable because the *target* went away is editing the sentence by other means.
- **It ignores *"shape and glyph carry it, colour reinforces."*** Fading the text is neither shape nor glyph.

**The label stays at full strength in both states. The container and the glyph carry the distinction:**

- **Soft-deleted** — filled pill, slightly lighter than live, **trash glyph**.
- **Hard-deleted** — **no fill, dashed outline**, **broken-link glyph**. Dashed reads as *not real* by long convention, and it is legible at pill size in a way a fade is not.

**But *Edit as Markdown* always shows `[label](fumi://note/<uid>)`.** The user was initially "potentially against" revealing the syntax even there, and reversed on the argument:

- **That view is not part of the concealment layer — it is the escape hatch *out* of it.** Its whole promise is *"this is what is actually in the file"*, and Model B decided the buffer **is** the Markdown.
- **Hiding it would make the two views disagree about reality.** The source view would show a `[label]` with nothing behind it, or the bare label as prose. Either way it isn't the file, and copying from it silently loses the links.
- **It is the view where agent-written content is legible as agent-written content.** Agents emit exactly this syntax, and a wrong UID is invisible in the rendered view but obvious in source — which is precisely what the escape hatch is for.

**Concealment and the escape hatch are a pair, not a tension.** Concealment is defensible *because* an honest view sits one menu item away; weaken the honest view and concealment starts costing something.

### DECIDED — open behaviour: honour the target's home, and jump to it

**Opening a linked fumi honours everything the target already knows about itself** — its home Space, its display, its coordinates, its size, its colour. If that home is another Space, **macOS jumps to that Space**.

*Why this is right rather than jarring:* jumping Spaces to reveal a window is **native macOS behaviour** — it is exactly what ⌘-Tab does. We are not inventing a jolt, we are using the one users already have. And the peek earns it: you have already seen the content, so opening is a deliberate *"take me to it"* — you presumably intend to work on it.

Two cases fall out without extra rules: a target **already open on another Space** simply focuses (and jumps); one **already open on the current Space** simply focuses, no jump.

**This also avoids carving an exception into the positioning rule.** The alternative — opening the target on *your* current Space — would collide with *"wherever you put it is its new home"*: following a reference would silently re-home someone else's note. Following a reference must not move the thing it references. If you *do* want it beside you, move it with ordinary macOS window handling, and then it re-homes because you meant it to.

### DECIDED — deleted-target states

The reroute brief proposed distinguishing the two states *"ideally by colour"*. Two landed decisions constrain that: **colour is never the sole signal**, and **system-state cues come from a reserved colour space the user swatch cannot touch** so they stay legible under any swatch including the CVD ones. A broken reference is a system state, so it draws from the reserved space, not the note's palette — and **shape and fill must carry the distinction, with colour reinforcing**.

- **Soft-deleted** — the pill keeps its shape but goes **muted**, and the note glyph swaps for a **trash glyph**. Still a live thing, just filed away. **Space still peeks**, and the peek shows the content with an *"In Recently Deleted"* line and a **Restore**. Double-click still opens it, flagged the same way.
- **Hard-deleted** — the pill loses its fill and becomes a **dashed outline** with a **broken-link glyph**. **Space does nothing. Double-click does nothing.** The only available act is select-and-delete: there is nothing to preview and nothing to restore. The state is explained **on hover**; the pill's own treatment already says it.

*This supersedes the brief's "clicking says the note no longer exists"* — a dialog announcing a fact the pill already shows is exactly the unnecessary prompt the product refuses. An unavailable-state peek panel was also proposed and dropped for the same reason: a panel that opens to say "nothing here" is a wasted surface.

**Non-destructive throughout.** Neither state edits your prose — the text stays exactly as written, because deleting a target should never rewrite a sentence you wrote.

Two consequences fall out free:

- **Restoring a target silently repairs every link to it.** These are live UID references, so there is no fix-up pass and no stale state to reconcile.
- **The label survives both states**, because it is as-written — the sentence still reads properly even when the target is gone.

## Editing UX

### Context

*Note authoring: text-style dropdown & auto-title (editing UX). Rerouted from note-model · discussion · 2026-07-22.*

**Model settled** (reference — do not re-decide): block styles map 1:1 to Markdown (Title = H1 `#`, Heading = H2 `##`, Subheading = H3 `###`, Body = paragraph, Monospace = code, Bulleted/Numbered = `-`/`1.`, Block Quote = `>`); there is **no separate styling state** — a style is just its Markdown construct. Title = derived first line; a new note's first line defaults to a real `# ` H1.

**Note-window owns the editing UX** (modelled on Apple Notes — user shared a screenshot of Apple's `Aa` style menu):
- A **text-style dropdown** to set the current block's style; each entry applies the Markdown construct above.
- **First line auto-defaults to Title** as you type a new note; pressing **Enter drops to Body**. Any line's style is changeable (incl. making the first line Body).
- Rendering: Title renders as a large **H1 with natural bottom padding**, giving a gap before the first body line.
- **Live-styling as you type** (render-as-you-type), plus the rendered ↔ raw toggle already noted above.
- Apple's dashed-vs-bulleted list split is cosmetic — not needed (Markdown = bulleted + numbered).

Ties into Inline Rendering.

*From: search-and-retrieval · discussion · 2026-09-12*

search-and-retrieval settled index freshness: **anything saved is findable the instant it is saved; text still sitting in an unsaved editor buffer is not searchable.** One rule covers every writer, because storage-and-sync refreshes the index inline *in the same transaction as the bundle write*, and that write is the same event for a local edit, an agent write over the socket, and an inbound change applied from another Mac — so an agent's read-after-write is safe by construction rather than by timing. The unsaved buffer was deliberately left out: having the manager search an in-memory editor buffer is real machinery for a sub-second window, and it is consistent with this topic's own rule that previewing a snapshot *"temporarily makes the buffer not the note"*.

The consequence for this topic: always-on autosave is decided here, but **no cadence was ever pinned anywhere**, and this decision makes that number user-visible in a way it was not before — the autosave interval *is* the delay between the user typing a word in an open fumi and being able to find that note from the manager or from an agent. Raised as a consequence to weigh when the cadence is chosen, not a request to change anything: nothing in search depends on a particular number, the rule holds whatever is picked, and the point is only that the choice has a second consumer a cadence chosen purely against write amplification or battery would not have known about. *(Related and handled there: while a global index rebuild is running, indexing a note the user just saved takes priority over backfilling history, so ordinary editing stays at normal freshness mid-rebuild.)*

### Decision — the autosave settle window (2026-09-14)

**Settled by derivation** — not discussed. Determined by the costs the cadence would have been weighed against having already been absorbed by storage-and-sync's enqueue dedup and this topic's separate snapshot cadence, leaving no counterweight to freshness.

> **Autosave fires on a short idle settle — a working value of ~500ms after typing stops — and flushes immediately on blur, hide and close.**

**Every reason to be slow has already been designed away elsewhere, which is what makes this a derivation rather than a judgement call.** Sync traffic: storage-and-sync's enqueue is an idempotent deduped marker, so *"fifty autosaves in a burst are one pending entry"* and the wire timing belongs to `CKSyncEngine`'s scheduler regardless. Version churn: snapshots run on their own cadence — focused-but-idle or on-blur, only-if-changed, with its own settle window — so autosave frequency does not reach version history at all. Disk: an atomic bundle write of a small Markdown file. Nothing is left pulling the other way, and one decision already leans on the interval being short — engine-architecture's exit reasoning holds that *"autosave is always on and the blob debounce is a few seconds, so what is at risk is seconds of geometry rather than content"*, which is only true while autosave is the fast one of the two.

**The value is build-time, in the same spirit as the 30px band and the ~240pt width floor.** What is pinned is the shape: an idle settle short enough that nobody perceives the gap, plus explicit flushes at the moments the user has visibly stopped — never a fixed timer, and never on-blur alone, which would make the delay unbounded on the one note being actively typed into.

**A consequence worth stating, because it is larger than the concern that raised it.** engine-architecture holds that an **open** note's editor buffer is the live copy and every write to that note goes through it whatever channel it arrived on, while a closed note is written to the bundle directly. So the two paths differ exactly here:

```
note closed    agent appends a line → bundle write → index refreshed   → findable at once
note open      agent appends a line → the editor buffer                → findable at next settle
```

Read-after-write is unaffected — the buffer is the live copy, so a read sees the write — but *search*-after-write on an open note waits for the settle. Since **open is the resting state** for a fumi, that is the ordinary case rather than the edge one, and it is a second reason the settle is short rather than a reason to build anything.

*This falsifies a supporting claim in search-and-retrieval's own freshness decision — that the bundle write "is the same event" for all three writers, and that an agent's read-after-write is therefore safe by construction. Read-after-write is safe; the generalisation is not. **Rerouted to search-and-retrieval triage (2026-09-14)**, which reopened that topic. Nothing here depends on how they restate it — the consequence is recorded on this side either way.*

*Rejected: flushing the buffer before any client reads the note* — a freshness guarantee that does not depend on the number at all. Real machinery bought for a sub-second window, on a path every note write would pay; the flush points above already cover every moment the user has stopped typing. It is also the same trade search-and-retrieval made when it declined to search the in-memory buffer, and taking the opposite side of it here would put the two documents at odds for no gain.

*Sibling check: search-and-retrieval — its decided text holds that anything saved is findable the instant it is saved and that an unsaved editor buffer is not searchable, and hands the cadence here as a consequence rather than a constraint. Adopted as written; nothing about the freshness rule changes. storage-and-sync — its decided text holds that every durable local write enqueues, that enqueue is an idempotent deduped marker rather than an upload, and that it rejected enqueue-on-blur for coupling transport to history cadence; all relied on, none revised. engine-architecture — its decided text holds the open note's editor buffer as the live copy that every write routes through, with closed notes written directly; cited as the reason the two paths differ, not revised.*

### The central fork — the editor's document model (DECIDED — Model B)

The cluster's load-bearing decision, and the "meaty GUI piece" discovery flagged twice. **Not** a polish question — two genuinely different architectures:

- **Model A — structured rich-text tree** (Apple Notes / Notion / Craft). Buffer = a document tree. Typing `## ` fires an **input rule** that **consumes** the syntax and converts the block; markers never persist or reappear. Serialised to Markdown on save. Substrate exists: macOS 26 SwiftUI `AttributedString`-bound `TextEditor`.
- **Model B — Markdown-source buffer + policy-based concealment** (Bear / Obsidian Live Preview / iA Writer). Buffer **is** the Markdown text; markers always present, visually **concealed**. Lossless by construction. No framework support — bespoke TextKit 2.

**Discarded framing (mine, corrected):** an earlier A/B/C split (full-live vs toggle-only vs hybrid) was wrong — it treated live-WYSIWYG and hybrid as different architectures when they're the same engine at different coverage. It also missed the Apple-Notes model entirely (markers *consumed*, never stored), which the user surfaced. The real fork is tree-vs-source.

**Key insight — concealment is a *policy*, not an architecture.** One Model-B engine yields all three behaviours from one code path: **always-conceal** (markers never visible → Apple Notes feel, the proposed default), **reveal-on-cursor** (the Bear behaviour the user liked, as a preference), **show-source** (raw — the already-settled rendered↔raw toggle, i.e. concealment off). So the user's "make it togglable" instinct isn't a compromise between designs; it's the natural expression of Model B.

**Where each model sits on the constraint set** (user editing · formatting menu · Markdown typing · agent authoring via MCP/CLI):

- **Agent surface is the decisive input.** Agents write `content.md` directly — Mermaid fences, `fumi://` refs, Fumi-custom syntax. Under **A**, an agent's construct that the tree doesn't model can be **silently mangled** on the next user keystroke (parse → tree → re-serialise). That's **data integrity**, not taste — and a risk Notion/Craft never face because nothing else writes to their store. **B** is lossless: buffer = file, so agent syntax survives untouched.
- **A's structural advantage evaporates here.** Its edge is expressing what a text format can't — but note-model fixed content as Markdown, so anything the editor can express must be Markdown-expressible anyway. A would carry round-trip risk to buy an advantage the content model forbids.
- Both serve the **formatting menu** (B's commands edit Markdown source rather than a tree) and both accept **typed Markdown** (trivially so in B — typing Markdown into a Markdown buffer).
- **B's honest cost:** the harder engine — bespoke concealment, and caret/selection across hidden markers is the fiddly part (needed anyway for reveal-on-cursor mode).

**Pressure-tested** by a perspective pair (User-Centric → argued **Model A**; Capability-First → argued **Model B**) plus synthesis. Cache: `perspective-004-*`, `synthesis-004.md`. The lenses' restatements were *aligned* (both framed it as buffer-is-bytes vs buffer-is-tree) but reached opposite conclusions.

**Common ground the pair established** (not in dispute): the parser + serialiser + dialect spec is shared work in **both** models identically — concealment is GUI-only, so CLI/MCP gain nothing from it, and "one engine, four clients" overstates B's win. The **default surface shows no markers in either model** (conceded identical). **Silent content loss is unacceptable** either way. Mermaid, highlighted fences, interactive checkboxes, tag pills, inline images, asset chips and `fumi://` peek are **custom attachment/layout/hit-testing work in both** — no delta. And **caret/selection across concealed runs is B's load-bearing risk**, agreed by both.

### Decision — the editor surface: Apple-Notes look, Markdown as hidden accelerator

**Grounded in a real non-technical user** (the user's partner, a genuine prospective user who doesn't know Markdown): to bold, she'd **select the word and press ⌘B**; for headings and lists she'd **expect a formatting menu**. That's the mental model to serve.

**Markdown is a hidden accelerator, not a visible surface.** Type `## ` → it renders immediately as a Heading 2; the syntax is never displayed. Both audiences are served by one surface at two speeds: your partner never meets Markdown, a fluent user skips the menu. *"Don't allow Markdown at all" was considered and rejected — it feels wrong, and it's a false choice.*

**How editing works without visible syntax** (the user's stated worry — "how does that work when the md bits disappear?"): the **formatting menu is the editing mechanism**. The text-style dropdown always reflects the construct the caret sits in — caret in a heading → dropdown reads "Heading 2" → pick "Body". Select a word + ⌘B to un-bold. Caret in a line → pick "Bulleted List". Never any need to see syntax to change something. (Precedent: Notion, Craft, Linear all ship Markdown-as-accelerator this way.)

### Decision — "Edit as Markdown" escape hatch (corrected; resolves review-004 F6/F7)

**🎨 Spiked** — *CANONICAL SPIKE — note chrome & states*, states 5 & 6 (rendered vs Edit-as-Markdown, side by side). Two things decided while spiking:

- **The raw view drops the styling as well as revealing the markers** — it reads as a *source* view (monospace, plain, markers dimmed amber) rather than a styled view with markers bolted on. Follows from "view the full Markdown": you're looking at the file, not a decorated version of it.
- **The source sits in the shared inset-block panel** — the same treatment as code fences, Mermaid and tables (≈8px radius, subtle dark tint over the glass, hairline border, 12px padding). Raw source *is* code-like content, so one visual language covers all of it, and the containing panel is what signals "different mode". Loose monospace text directly on the note surface was tried first and read as unframed and wrong.

*Mock artifact, not a design intent:* the spike lays body text out as explicit per-line rows, because Paper wraps whole nodes and so cannot flow a bold run inline within a wrapping paragraph. The real editor wraps naturally.

**A source view exists, as an escape hatch — not a mode.** A menu item (*Edit as Markdown*, Note menu + corner menu) flips the **focused** note to raw and back. Never the default, not a preference, no persistent chrome toggle. It exists for when something renders wrong or you want to hand-write something exotic. **Nearly free in Model B** — raw is simply *concealment switched off*: same buffer, same bytes, same caret, same undo stack.

**Correction — the earlier "no source view" decision rested on a false premise.** It was dropped on the reasoning that `content.md` "is a real file, openable in any editor." Verified against storage-and-sync, that hatch **does not exist**:
- *"Engine is sole writer… **No FSEvents in v1** — nothing outside the engine writes the store"* → an external edit is never noticed, and would be silently overwritten by the next engine write.
- ***"External editing unsupported"*** is an explicit format-posture; raw external changes are "out-of-contract, best-effort."
- The bundle is an **opaque `.fumi` package** — reaching `content.md` needs "Show Package Contents."

Without it, malformed or unrenderable content had **no repair path at all**, in-app or out.

**Paired prevention — validate at the engine write boundary.** Agent writes (MCP/CLI) pass through the engine as sole writer, so it can **validate against the canonical dialect and reject**, returning a clear error — which is *better* for an agent than silent acceptance (LLMs retry well against explicit errors). Deliberately **prevention, not recovery**, and it cannot cover the class alone:
- **"Malformed" barely exists in Markdown** — it's permissive by design (an unclosed fence just runs to end-of-note; `**bold` with no closer is literal asterisks). So validation is against *our dialect rules*, which must be defined — there's no parse failure to catch.
- **Inbound sync bypasses it** — content arriving via CloudKit from another Mac (possibly a different app version) is already committed there; it isn't a request to reject.
- **Valid-but-wrong slips through** — well-formed Markdown can still render as something unintended, or use a construct an older build doesn't know.

*(Validation mechanism likely belongs to **agent-surface** / **engine-architecture**; note-window's stake is that it exists and that the escape hatch backs it up.)*

### Decision — marker integrity & selection semantics (resolves review-004 F3, F4)

**Guiding principle: the visible text is the user's coordinate space; concealed markers are an implementation detail of range formatting.** Edits behave *as if formatting were an attribute on a range* (Apple Notes semantics) and the engine rewrites markers to preserve that meaning. Invisible corruption is therefore structurally impossible — there is no orphan-marker state to reach.

- **Selection is character-exact — no snapping.** You can select half a bold word, exactly like Apple Notes. *(A snap-outward-to-construct-boundaries rule was proposed and **rejected by the user** — "selection is just text selection and should feel the same as Apple Notes." Correct call: snapping is the weird-feeling option, and it isn't needed once markers are maintained automatically.)*
- **Caret/selection see only visible characters.** Concealed marker runs are effectively **zero-width for navigation** — arrow keys skip them with no dead presses; selection never contains them.
- **Cross-boundary deletion repairs, never orphans.** Deleting a selection running from inside `**bold**` into following plain text yields `**b**` + surviving plain text — "b" still bold, the rest plain. The engine repairs the pair rather than leaving half of it.
- **A construct dies with its content.** Delete a link's entire label → the link goes. Delete *part* of the label → the link and its **UID survive** (the UID is unretypeable by hand, so this matters), like any editor's hyperlink. Same for bold/italic/code spans.
- **Prefix stacks remove one level at a time, innermost first** (they're runs, not pairs): `- [ ] task` → `- task` → `task`; `> - item` → `- item`. Standard list behaviour, already familiar.
- **Block constructs are exempt** — tables, code fences, Mermaid and images have no pair semantics, so they're handled as units (two-step delete, click-to-edit) rather than by marker repair. See *block-construct editing*.
- **Nesting follows from the principle** — `**bold with a [link](…)**`: editing the label touches only the label; the enclosing bold is untouched unless *its* content is fully removed.
- **Code spans don't conceal their contents**, so literal `**` inside a code span stays literal and visible (see Escaping).

**Refinement — the caret carries a formatting-active state** (from the user's hands-on Apple Notes test: bold word mid-sentence, caret placed inside it, dragged right into plain text, delete).

*Observed:* the surviving bold characters stayed bold and the following plain text shifted up **without** becoming bold — i.e. the marker pair was **repaired closed** (`some **bol**d here`), confirming the no-orphan rule. **But** the caret was left *inside* the bold context: the **B was highlighted in the formatting menu and typing continued bold** until toggled off.

*Why this needs stating for Model B:* with markers concealed, **one visible caret position maps to two buffer offsets** —
- `some **bol|**d here` → before the closer, *inside* bold → typing is bold
- `some **bol**|d here` → after the closer, *outside* → typing is plain

Identical on screen, different behaviour. So the caret **cannot be a visible-text position alone**; it carries a formatting-active state (which is also what lets the formatting menu highlight **B**), and the buffer offset is what disambiguates inside-vs-outside.

*Rules adopted (mirroring Apple Notes):*
- After deleting a selection that **began inside** a construct, the caret lands **inside** that construct and typing continues formatted; **⌘B (etc.) toggles it off**.
- The caret **inherits the formatting context of where the selection started**.
- The formatting menu / style dropdown always reflects the caret's active formatting.
- **Spike detail:** exact boundary behaviour for arrow-key traversal *onto* a boundary (which side you land on, and therefore whether typing is formatted) — resolve against Apple Notes behaviour during the caret spike.

**Why this matters beyond the edge cases:** the **interaction layer now behaves like Model A while the storage layer keeps Model B's byte fidelity** — Apple Notes' feel *and* lossless agent round-tripping. That's the outcome both perspective lenses were reaching for from opposite ends, and it retires the concern that B's hidden characters must leak into the editing feel.

### Decision — copy & paste (resolves review-004 F5)

**Copy puts multiple flavours on the clipboard** — standard rich-editor behaviour, and it avoids having to pick one:
- **Markdown** as the plain-text flavour → round-trips exactly into another note, a code editor, a terminal, or an agent prompt. Free (the buffer *is* Markdown).
- **RTF** for rich targets → Mail / Pages / Word prefer RTF, so copying a bold word into an email gives **real bold**, not `**bold**`.

**Paste of text is byte insertion, so it renders as Markdown — exactly as if typed.** Not really a choice: with a Markdown buffer there's no separate "interpret" step to disable. Predictable, and matches Obsidian/Bear. *Known hazard:* pasting a shell script full of `# comments` yields headings — same answer as typing (use a code fence; a **Paste as Code Block** affordance is worth adding later), or use the escape below.

**⇧⌘V (paste and match style)** = the escape hatch — inserts visible text without interpreting constructs. Standard shortcut, standard meaning.

**Paste of rich text/HTML** (e.g. from a browser): convert to the nearest Markdown constructs; **drop what the dialect doesn't model rather than inventing syntax** — unmodellable content lands as plain text.

**Paste at a formatting-active caret** follows the caret-state rules: pasted *plain* text adopts surrounding formatting; pasted *formatted* content keeps its own.

**Files/images pasted** → Drop Interaction's remit (copied into `assets/`, inserted at the cursor, same as a drop).

**Content carrying an asset token** → see *pasting content that references an asset*, below.

**Copying an asset *out* of a note (2026-08-06, resolves review-008 F10).** The two flavours were specified against text and never asked about assets, while *pasting into a non-Fumi app carries the literal token text* answered only for the **plain-text** side. That answer is right there — the token *is* the Markdown, and round-tripping into a code editor or an agent prompt is a stated goal — but left alone it means copying two sentences and the chart between them into Mail delivers `![chart](fumi://asset/01J9…)` to the recipient.

> **The existing split already decides it: plain text carries the *source*, RTF carries the *rendered form*.** Bold is the precedent — `**bold**` in one flavour, real bold in the other. **RTF embeds the image.**

- **Images** — embedded in the RTF representation, via a **promised** pasteboard payload so a large picture is not copied until a receiving app asks for it.
- **Chips** (PDF, spreadsheet, zip) — RTF cannot meaningfully inline them, so the pasteboard **offers the file itself** as an additional flavour: pasting into Mail or Finder yields the actual document. Chosen over a bare filename because it is the same mechanism **drag-out** wants, and it is what a Mac user expects of an attachment. *Held lightly — the alternative (filename as plain text) costs nothing to fall back to if the promise mechanism proves awkward, and the exchange that settled this was brief.*
- **A missing asset** has no bytes to embed, so the rich flavour degrades to the filename. Honest, and needs nothing new. *(Amended 2026-08-10 — read "An excluded or missing asset"; `excluded` is retired, and the behaviour is unchanged for the one state that remains.)*

**Uncontrolled ingress, handled gracefully:** paste is the ingress the synthesis noted neither lens priced. Under Model B a pasted footnote or nested table we don't render **survives in the bytes and renders plainly** — the graceful-degradation property B was chosen for.

**Feasibility check (asked explicitly).** Platform-provided: `NSPasteboard` multi-representation; `AttributedString(markdown:)` (macOS 12+) and native `NSAttributedString` RTF export for the Markdown→RTF path; `pasteAsPlainText:`; `NSUndoManager` grouping; native typing-attributes for caret state; TextKit 2 attachment view providers for inline block views (Mermaid/images/code). **Real but bounded:** rich-text/HTML→Markdown conversion (no built-in for that direction; well-trodden), and table-cell editing over pipe syntax. **Genuinely uncertain:** only the concealment + caret/selection semantics in TextKit 2 — already the named spike. **Evidence it's possible: Bear, iA Writer and Obsidian ship exactly this on the same platform, built by small teams.** The honest caveat is scale, not feasibility — the editor is the single biggest piece of the app (ties to the synthesis's editor-budget point).

### Decision — pasting content that references an asset (2026-08-06)

#### Context

*From: note-model · discussion · 2026-08-03, narrowed 2026-08-05*

note-model specified asset self-containment in terms of how an asset *arrives* — dropped, pasted as a file, fetched from a URL — and never covered **content moving between notes**, which reaches the same place by another route:

```
note A   "…see the chart: ![chart](fumi://asset/01J9…)"
                     │ ⌘C ⌘V
                     ▼
note B   "…see the chart: ![chart](fumi://asset/01J9…)"
         assets/ is empty — the token travelled, the bytes did not
```

Note B is born holding a reference to bytes it does not have, through the GUI, with no agent involved and nothing damaged. ~~The same applies wholesale to a **Duplicate note** command.~~ *(Struck 2026-08-06 — see* ***no Duplicate command****, below.)* The invariant recorded in note-model: **any transfer of content that carries an asset token carries the asset** — copying a passage copies the referenced bytes into the destination bundle and mints a **new id** there; duplicating a note duplicates its assets. This is the existing copy-only principle applied to a route nobody had walked, and it matters beyond tidiness: note-model characterises `missing` as *"an error state, not a transport state"*, and this topic is designing its visual treatment on that basis. If ordinary copy-paste produced `missing`, the treatment would be designed against the wrong frequency.

**The first ask was withdrawn two days later.** The original entry left four things here — what the clipboard carries, feedback on a large copy, partial-failure handling, and duplicate-note semantics. note-model then found that an agent performs the identical transfer through **text alone** (`read` note A, `append` the passage to note B), and a text-write API has no means of carrying bytes even if it wanted to. So the question was never *whether* each surface carries them, but who does the carrying:

> **On any write to `content.md` — GUI, CLI or MCP — the engine scans the incoming content for asset tokens. A token naming an asset the destination bundle does not hold is *materialised*: the bytes are copied in from wherever they live, a new id is minted, and that one token is rewritten to it.** An id that cannot be resolved is left exactly as written and renders `missing`.

Paste therefore becomes an ordinary content write. **No asset payload is needed for a Fumi-to-Fumi transfer** — the engine materialises the bytes from the source bundle on write — and partial-failure handling dissolves (a paste is never rejected — an unresolvable token simply renders in a state this topic already has a visual for). What remains this topic's is the **feedback** question and one **excluded-asset** case.

*(Amended 2026-08-10 — this read "**Nothing goes on the pasteboard**", followed by "Pasting into a non-Fumi app carries the literal token text and resolves nowhere: accepted, not a problem to solve." Both were superseded by *copying an asset out of a note* (review-008 F10) and never refreshed: the pasteboard **does** carry the decided flavours — plain text carries the source, **RTF embeds the image** via a promised payload, and a chip **offers the file itself** as an additional flavour — precisely so that copying a passage with a chart into Mail does not deliver `![chart](fumi://asset/01J9…)` to the recipient. What the materialisation ruling actually establishes is the narrower claim now stated: no asset payload is needed **between fumis**, because the engine copies the bytes at the destination.)* ~~And duplicate is the same story.~~ *(Struck 2026-08-06 — see* ***no Duplicate command****, below.)*

#### Decision — no Duplicate command (2026-08-06, resolves review-008 F12)

The two struck clauses above asserted behaviour for a command **no surface in this topic carries**: the corner menu's contents are the role strip, `Format ▸`, `Move to ▸`, `Move to Display ▸`, Float on Top, Edit as Markdown, Version History… and Delete; the menu bar has File → New Note `⌘N` and Close `⌘W`. note-model's entry was conditional — *"which management-window has not ruled out"* — and the conditional was dropped when the concern was folded in here.

**Decided: Fumi has no Duplicate note command.** Considered on its merits — it is a conventional document command, the corner menu is explicitly the note's menu bar, and the cost would have been one menu row over mechanisms already decided (content copy plus asset cloning). Rejected anyway, on what a fumi is for: **copy and paste already covers it**, and duplicating a whole note is not a thing these are used for. Adding a row to a product whose north star is *furniture* needs a real want behind it, and there isn't one.

**Nothing is lost by striking the clauses.** The self-containment invariant is enforced at the **engine's write boundary**, on *any* write to `content.md` from any client — so whatever routes exist, now or later, are covered without this topic naming them. *(If management-window ever ships a duplicate in its note list, it inherits the same rule for free; that surface is theirs.)*

#### Decision — the paste is atomic and silent, because there is no copy to wait for

Materialisation must finish before the token can be rewritten, so the paste's cost is a local disk copy. Two shapes were weighed:

- **A — atomic and silent.** The paste appears once the bytes are in. Nothing announced.
- **B — optimistic.** Text lands instantly and the asset fills in behind it. **Rejected:** it buys a fourth visual state for the asset — *materialising* — and pays for it by making a healthy asset briefly indistinguishable from the broken one, days after we designed that broken state to mean something.

**A, and not merely because a copy is fast.** A symlink into the destination bundle was proposed (render instantly, copy behind) and **rejected**: it is the **link/alias** this project already dropped for v1, reintroduced as a *transient* state, which is worse than a permanent one because it is a race rather than a condition. In that window sync sees a link rather than bytes, so a note syncing mid-copy arrives at the other Mac with nothing; deleting the source note dangles it — the exact failure the invariant exists to prevent; and a crash leaves a bundle holding a symlink, an invalid state nothing else in the system understands.

> **The bytes are cloned, not copied — APFS `clonefile`, copy-on-write at the filesystem level.**

Instant regardless of size, no extra disk, and it produces a **genuine file**, so the destination bundle is self-contained the moment the paste lands. No window, no background job, nothing to go wrong. Both bundles sit in the same note store on the same volume, so it always applies; a non-APFS store falls back to an ordinary copy, which is behaviour A anyway. It composes with a property already decided: **assets are immutable once added** — copied in, never edited in place — so the copy-on-write divergence that would eventually cost disk never happens and the clone is free permanently.

**And the case would have been thin without it**, which is worth recording so nobody re-optimises it: an NVMe copy runs at roughly 1–3 GB/s, so a 50 MB asset is tens of milliseconds and the 2 GB video nobody has is a second or two. B was building a visual state for a case that does not arrive.

⚠️ **Implementation checkpoint, stated rather than asserted:** the exact API path — `copyfile` with `COPYFILE_CLONE`, or `clonefile` directly — and confirmation that `FileManager` does not quietly fall back to a byte copy.

#### ~~Decision — pasting a reference to an excluded asset says nothing~~ *(retired 2026-08-10)*

> ⚠️ **Retired with the state — kept for provenance.** This decision and the amendment beneath it both concern `excluded`, which storage-and-sync's hard limit removed at source on 2026-08-09. See *`excluded` is retired; one absent state remains* under Asset Reference States. **The requirement they were protecting was right and was answered by deletion rather than by mechanism** — there is no longer a paste that can produce an absent asset, because there is no oversized asset to reference.
>
> **What the amendment proposed, and why it is worth not re-proposing:** *don't mint until you can copy* — leave the token pointing at the original id, let materialisation complete on a Mac that holds the bytes. note-model rejected it on a point that outlives the state: **materialisation fires on write**, so a deferred token leaves the destination note rendering an asset out of the *source* note's bundle indefinitely — a live cross-bundle reference rather than a deferred repair, breaking *every asset a fumi renders is owned by that note and stored in its bundle*. Moving the repair to a background reconciler was rejected separately, on payoff: the repaired copy would itself be over the ceiling.
>
> **And one claim below was false independently of the retirement:** that the deferred shape *"also covers a case neither state was written for: an asset **still downloading**"*. Fully-eager sync means bytes and record arrive together — note-model had already struck *"a restore or sync arriving out of order"* on exactly that basis (review-004 F9). We were claiming coverage of a state nothing can produce.

~~Storage keeps assets over 50 MB **local-only**: the record syncs, the bytes stay on the Mac that added them. Paste a passage referencing one on a Mac that does not hold the bytes and there is nothing to materialise.~~

~~**The editor says nothing.** The reference renders in its **excluded** state, and that placeholder already explains itself. Announcing it would be the banner killed for sync arrivals (*"mark the change; don't announce it"*) and the dialog killed for hard-deleted note links (*"a dialog announcing a fact the pill already shows"*). Third application of the same rule, and the paste still succeeds.~~

#### ~~Amendment — the excluded paste is a requirement on the engine, not a given (2026-08-06, resolves review-008 F9)~~ *(retired 2026-08-10)*

~~The clause above asserts an outcome the mechanism does not obviously produce. Excluded and missing are told apart by **whether a record exists**, and a paste on a Mac without the bytes leaves the destination bundle with neither bytes nor record:~~

```
note A (this Mac)   holds asset 01J9… — record synced, bytes excluded (>50 MB, on the other Mac)
                    ⌘C the passage
note B              ⌘V → materialise: find the bytes, mint a new id, rewrite the token
                    …no bytes here to copy
                    note B's bundle: no asset, no record  →  reads as MISSING
```

~~**Two failures, one cause.** The wrong glyph is the lesser one: `missing` is characterised as *"an error state, not a transport state"*, and this topic designed the pair on that frequency — if ordinary copy-paste reaches it, the characterisation is false. The **worse** failure is minting anyway: a new id then names an asset with no bytes **anywhere, ever**, so walking to the Mac that holds the original still does not link up, because the token points at a fresh id nothing was ever written for. Permanently broken on every machine, from an ordinary paste.~~

> ~~**Both dissolve if the engine does not mint until it can copy.** The token stays pointing at the original id, which still names a record whose `excluded` flag is set — so it renders honestly — and materialisation completes on a Mac that holds the bytes.~~

~~Same self-healing shape as a dangling `preset_id` re-binding when the settings zone catches up, and it also covers a case neither state was written for: an asset **still downloading**, where record and bytes are simply out of step for a while.~~

~~**This topic's requirement, stated as a requirement:** *a pasted reference to an excluded asset must read **excluded**, never **missing**.* Nothing has gone wrong and the user is one machine away from the file; rendering the error state would be a lie about a recoverable situation, and would falsify the frequency argument the two-state design rests on.~~

~~**The copy improves for free, without reopening the device-provenance call.** Two things were tangled: **why** the asset is absent — over the size limit, not synced — is the `excluded` flag itself, already on the record; **which machine** holds it is the field deliberately set aside. So the placeholder can read *"Not synced — over the size limit"* rather than the weaker *"not on this Mac"*, with no new field.~~

~~Rerouted to note-model triage (2026-08-06).~~ *Answered 2026-08-08 and folded here 2026-08-10 — see the retirement notice above.*

**Sibling check: note-model — its decided text holds the self-containment invariant, engine-side materialisation on every `content.md` write from any client, and that a paste is never rejected for an unresolvable token; those three stand and this topic still adopts them. ~~storage-and-sync — the >50 MB local-only rule is used as-is.~~** *(Struck 2026-08-10 — that rule is now a hard limit, which is what removed the excluded case this block was deciding.)*

### Decision — escaping / literal Markdown characters (resolves review-004 F1)

Keep escaping out of the user's face; make common misfires impossible instead. In priority order:

1. **Undo-after-autoformat is the primary escape** — conventional, nothing to learn, already decided above. Type `## `, it fires, ⌘Z, keep the literal.
2. **Inline code is the honest path for writing *about* syntax** — `` `**bold**` `` is what you'd naturally write anyway, and **code spans don't conceal their contents** (so literal markers inside them stay visible — this is also the answer for code spans containing `**`).
3. **Tighten accelerators so fewer things misfire.** `#` requires a **letter** to be a tag (note-model already excluded purely-numeric tags, so `#1` is plain text); `#!` never fires anything (shebangs are safe); heading requires `# ` + space at line start, per note-model's settled rule.
4. **Backslash escapes are honoured, not authored** — if `\#` appears in the file we respect it, but users are never asked to type escapes.

Rejected: making the user type backslash escapes. In a concealed buffer `\#` is itself a marker — conceal it and you can't tell literal from formatted; show it and it breaks "syntax never displayed."

### Decision — undo semantics (resolves review-004 F2)

**Follow the platform/editor convention** — what users already expect from Notion / Craft / Linear / Apple Notes:

- **A fired accelerator is one undoable step.** Typing `## ` then ⌘Z **restores the literal characters** (`## ` shown as text, formatting off) — *not* a character-by-character un-typing with the line flipping between heading and body. Needed because in Model B the accelerator mutates no text (the bytes were already `## `; only concealment changed), so naive undo would be per-character and feel broken.
- **Undo-then-continue suppresses re-firing** — after undoing an auto-format the rule doesn't immediately re-trigger, so you can keep the literal syntax. This is the conventional escape mechanism (and partly answers the literal-characters problem — see Escaping).
- **Formatting-menu commands are one step too** — consistent with typed accelerators; a menu-applied Heading and a typed `## ` undo identically (one step each).
- **Checkbox toggles (`[ ]` → `[x]`) are their own single step** — a buffer mutation the user didn't type, so it must not merge into a typing group.
- **Ordinary typing coalesces** into normal word/pause groups, per platform behaviour.
- **Undo is per-note**, not global — each note window owns its stack (standard macOS per-document undo), which matters with many notes open.

### Decision — formatting menu, accelerators & shortcuts

Block styles were settled 1:1 with Markdown in note-model; this pins the **menu contents, typed accelerators, and default shortcuts**.

| Style | Markdown | Typed accelerator | Default shortcut |
|---|---|---|---|
| Title | `# ` | `# ` | ⌘1 |
| Heading | `## ` | `## ` | ⌘2 |
| Subheading | `### ` | `### ` | ⌘3 |
| Body | *(none)* | — | ⌘0 |
| Bulleted List | `- ` | `- ` or `* ` | ⇧⌘8 |
| Numbered List | `1. ` | `1. ` | ⇧⌘7 |
| Task List | `- [ ] ` | `- [ ] ` | ⇧⌘L |
| Block Quote | `> ` | `> ` | *(menu only)* |
| Monospace / code block | `` ` `` / fence | ```` ``` ```` | *(menu only)* |

| Inline | Markdown | Typed accelerator | Default shortcut |
|---|---|---|---|
| Bold | `**x**` | `**x**` | ⌘B |
| Italic | `*x*` | `*x*` / `_x_` | ⌘I |
| Link | `[x](url)` | paste a URL over a selection | ⌘K |
| Strikethrough | `~~x~~` | `~~x~~` | *(menu only)* |
| Inline code | `` `x` `` | `` `x` `` | *(menu only)* |

**Insert items** (menu-only, no default shortcuts — they insert a construct rather than restyle a selection): **Equation** (`$…$` / `$$…$$`), **Table**, **Mermaid diagram**, **Code Block**. These are the discoverable path for constructs most people won't type by hand — and for Equation in particular it means the common path never involves typing `$`.

**Principle — only assign a default where a strong convention exists; otherwise menu-only.** Inventing chords for rarely-keyboarded operations is how you collide with the system. Sources: ⌘1/2/3 headings (Bear + most Markdown editors, chosen over Apple Notes' letter-based ones since numeric scales); ⇧⌘7 / ⇧⌘8 lists (Word / Google Docs); ⇧⌘L task list (Apple Notes' own checklist binding); ⌘B / ⌘I / ⌘K (near-universal — ⌘K is *insert link* essentially everywhere, not strikethrough).

**Rejected: ⌥⌘C for inline code** — it's **Copy Style** on macOS (TextEdit, Pages, Mail). Caught by the user; a good illustration of why the build must validate defaults against real system/OS-reserved bindings rather than trusting a paper list.

**No underline** — Markdown has none, so ⌘U does nothing rather than inventing `<u>`.

**Shortcuts are user-overridable** — an **in-app keyboard-shortcuts pane** (the standard Mac pattern, and more discoverable than the alternative): ship our defaults, let users add or rebind, with custom slots empty until set. Bonus: because every formatting action also lives in the **menu bar**, macOS's System Settings → Keyboard → App Shortcuts can rebind any of them by name for free — another reason to keep everything menu-bar-backed, not corner-popover-only.

### Formatting Surface (child of Editing UX — DECIDED)

The formatting **actions** are fully decided above — menu contents, typed accelerators, default shortcuts, user-overridable via a shortcuts pane, everything menu-bar-backed. **What was never decided is the pointer-reachable surface on the note.**

The gap is visible in the spike: the corner menu carries colour swatches, Move to, Float on Top, Edit as Markdown, Version History and Delete — **no formatting**. So today, setting bold with the mouse means a trip to the app menu bar, from a small frameless note. Discovery flagged this and parked it: *"a formatting bar (possibly floating) — wanted but deferred."* It was never picked up, which means **Editing UX was marked decided while overstating its coverage**.

**The real tension, and why it isn't a lookup:**

- **macOS convention wants persistent chrome.** Apple Notes and Bear on the Mac both put a **persistent toolbar** at the window top — precisely what *content-only-at-rest* forbids on a frameless sticky note.
- **The menu bar** works and is already built, but it is a long trip from a small floating note — and the note is the whole product.
- **The right-click context menu** is the native selection-time affordance and has not been discussed at all.
- **A floating panel** resolves both, but is a web/iOS idiom rather than a Mac one — see the Refero pass under Note-Link Interaction for why that evidence was discarded.

**Candidates to weigh** (none decided):

1. Menu bar only
2. A floating panel on selection
3. A `Format ▸` submenu in the corner menu
4. A persistent bar on the note *(probably dead — fights content-only-at-rest)*

**The user leans toward a floating panel but wants spikes to choose from**, so this wants several drawn directions rather than one proposal.

**It also owns the link editor's surface**, which was rerouted here from Note-Link Interaction: ⌘K / *Link* is one action among many the same surface must host, and settling it in isolation would fix a convention for the whole formatting system as a side effect of a link decision. Carried in from the discarded Refero pass as a **candidate**: sub-options expanding **in place** on the surface rather than opening a popover from a popover.

#### Apple Notes on iPadOS 26 — live audit by the user (2026-07-28)

The user walked the app directly. **The most useful finding is the first one: selecting text does nothing.** Apple raises no formatting toolbar on selection — which retires "floating panel on selection" as an Apple idiom and independently confirms why the Refero (web) evidence was wrong.

**What Apple actually ships, and it splits by *scope*:**

| Scope | Surface |
|---|---|
| Document / insert — `Aa` styles, checklist, table, attach, Apple Intelligence, markup, share, `•••` | **Persistent top bar** (Liquid Glass, "floating circular bar" motif, buttons as circles/pills, a wobble as the pointer moves across it) |
| Selection — cut/copy/paste as a labelled icon row, then Delete, Writing Tools, Autofill, **Add Link**, Attach File, **BIU Format ▸** (slide-out), Add to Playground, Find Selection, Look Up | **Selection context menu** |

The `Aa` panel holds Title / Heading / Subheading / Body / Mono, then B/I/U/S, colours, bullets, numbers, indentation, block quote — **one entry point, a rich panel behind it.**

**The load-bearing detail: Apple puts *Add Link* and *BIU Format* in the selection context menu**, not in a format bar. Both of our open cases, answered by Apple, in the menu the selection raises.

*Research limits, stated honestly: Refero has no macOS corpus and no Apple Notes (its iOS set is third-party — Bear, Craft, Raycast — and mostly pre-Liquid-Glass); the HIG page would not fetch; the bundled Apple design skill covers the `.glassEffect()` APIs but not menu composition. Press descriptions gave direction only — "floating circular bar motif", compact, frosted, circular/pill buttons, grey round-cornered rectangles for selected items ([AppleInsider](https://appleinsider.com/articles/25/06/11/markdown-and-menu-bars-how-apple-notes-on-ipados-26-has-matured), [MacStories](https://www.macstories.net/stories/ios-and-ipados-26-the-macstories-review/3/)). **User screenshots are the reliable path and are pending.***

#### The reframe that lowers the stakes

Typed accelerators (`# `, `- `, `> `) and shortcuts (⌘1/2/3, ⇧⌘8, ⌘B, ⌘K) are already decided, and every action is menu-bar-backed. So **the pointer surface is not the fast path — it is the discoverable one.** It has to be findable by someone who does not yet know the shortcuts. That is a much easier bar, and it argues against spending chrome on speed.

**Which also kills right-click as the *primary* path** (user's objection): many people never right-click, and some don't know how to on a trackpad. It fails the discoverability test for precisely the people it exists to serve. A convenience for those who already know — the opposite of what is needed.

#### The user's proposal — a bar that appears only while editing

*"A small formatting menu bar that is only visible when you type."* This is stronger than any of the earlier candidates because **it is not a new concept — it is a fourth condition on a state model already decided.** The note goes *hidden at rest → faded when focused → full on hover*; adding **editing** is consistent. Content-only-at-rest survives untouched, because *at rest* means not editing: a reader sees a clean note, a writer sees their tools.

**Placement is constrained harder than it looks:** the note's top is the chrome band plus the first-line-as-title, so a bar there fights both; pushing content down as it appears makes text jump under the caret; overlaying covers what you are writing. That points at **attaching it outside the note's box** — tethered to the bottom edge. Zero reflow, covers nothing, leaves the title alone.

**Four paths, distinct jobs rather than redundancy:** editing bar = discoverable · context menu = convenient · menu bar = exhaustive and rebindable · shortcuts = fast.

**Open:** whether the bar appears on **typing** or on **focus**. Focus is steadier and already means intent in our model; typing ties it to actual writing but risks appearing and vanishing mid-session as you pause.

#### 🎨 Spiked — `10 — Formatting Surface (directions)` (Paper, 2026-07-28)

Four directions, same content in each so the comparison is fair. **Nothing decided — this board exists to be chosen from, with Apple Notes screenshots still to come.**

- **A · Bottom-attached bar** — a glass pill tethered under the note: `Aa ⌄ | B I S <> 🔗 | ☰⌄ +⌄`. Reads calm and disturbs nothing. *(The "floating panel on demand" candidate is this same bar with a summon trigger instead of automatic — a trigger difference, not a form difference, so it isn't drawn separately.)*
- **B · Top-attached bar** — Apple's placement, **drawn specifically to test it here**, and it fails visibly: it wedges between the chrome dots and shoves the title down, reflowing content the moment it appears.
- **C · `Format ▸` in the corner menu** — zero new chrome, but two clicks deep for every formatting act, and the menu grows long.
- **D · Selection context menu** — where Apple actually puts Link and BIU. Native, free, no chrome; undiscoverable for anyone who doesn't right-click.

*Material note: the bar is drawn in the same `#EDEFF6` family as the corner-menu popover, keeping one language for "our floating chrome". Real Liquid Glass — and the wobble the user noticed on Apple's `Aa` — is an implementation checkpoint, not a spike target.*

**All four rejected by the user.** Reasons on the record: the caret `/` palette and the shared app-level palette were dismissed outright (*"the system Font panel is fucking terrible"*); a side-attached strip *"doesn't feel very Liquid Glass"* — and it has a concrete fault too, since notes are resizable and often short, so a vertical strip needs height a small note may not have, while the top and bottom edges are always long enough. **E — a formatting row inside the corner-menu popover — was accepted as *a* location** (*"maybe we should do that anyway"*). The user's summary of the deadlock: *"the right thing feels like putting it across the top, but I think that ruins the aesthetic of the note."*

#### The reframe — B failed on layout, not on placement

The instinct that top is right was probably correct, and **B was a bad test of it.** Its two faults were both consequences of one mistake — the bar was drawn **inside** the note:

1. It collided with the chrome band.
2. It reflowed content.

A was *outside the box, below*; B was *inside the box, above*. **"Outside the box, above" was never drawn** — which is the top placement the instinct wants with neither objection. That was a gap in the option set, not a dead end.

#### 🎨 Spiked — directions H and I (added 2026-07-28)

- **H · Tethered above, outside the box.** Top placement, no collision (it sits above the chrome band, not in it), no reflow (outside the box entirely). **Flips below when the note is near the top of the screen — the same rule the version panel already uses**, so it's an existing concept rather than a new one.
- **I · The chrome band fills while editing.** The band is *already reserved*: ~28px holding two 13px dots at the extreme corners, with the entire middle permanently empty. The controls sit in space that is empty anyway. Band grows 28→34px, so content shifts **6px, not 40** — the reflow objection reduced to near nothing.

**The honest tension with I:** the agent-activity header indicator was cut partly on *"text in the chrome band has never existed on a fumi."* This is icons for an editing *mode* rather than text for a transient *event*, which is a different claim — but the band would be doing two jobs.

#### Apple Notes on **macOS** — screenshots (2026-07-29)

The user supplied desktop screenshots. Desktop Liquid Glass is **subtler than iPad**: icons don't move under the pointer, no wobble. The user's read — *"more suitable"* — and agreed.

**The finding that changed the design is the count, not the material: Apple's toolbar holds four items.** `Aa` · checklist · table · attach. Bold, italic, underline, strikethrough, link and every block style are **not** in it — they live behind `Aa` or in menus.

> **The toolbar holds what you can't type.** Inserts, plus one entry point to the style panel. Everything typeable stays on the keyboard.

The bar first spiked here had **nine** items and was solving the wrong problem.

**Conventions read directly off the screenshots:**

- **Groups are separate capsules, not dividers.** `[Aa ☑ ▦ 📎]` `[↑ •••]` `[🔍 Search]` — three pills. Our first pass used dividers inside one pill; **Apple groups by container.**
- **A beak means popover, not menu — and the distinction is what's inside.** The user spotted that `Aa` has a tail while the paperclip menu and the right-click menu don't. `Aa` is a **panel of controls** → beak. The others are **lists of commands** → no beak. ~~This retro-justifies the beak on our corner menu, which carries a role strip.~~ *(Amended 2026-09-22 — it does not, and the bullet two rows down in the distilled block says why: control rows are legitimate menu furniture, so a role strip does not make the corner menu a popover. The corner menu is a menu and carries no beak; see* the corner menu carries no beak*.)*
- **The `Aa` panel renders each style *as itself*** — "Title" set in Title, "Monostyled" in mono, "Bulleted List" with its bullet. A live specimen sheet, not a list of names. **Adopted.**
- **Panel structure:** inline toggles across the top (B I U S, pen, colour dot) → inset separator → block styles as a list → inset separator → Block Quote alone.
- **Inset separators throughout**, never edge-to-edge. Already our convention; now confirmed as theirs.
- **Selection is a filled rounded-rect in an accent colour.** ⚠️ **Corrected by the user:** the gold is **not** their system accent — it is Apple Notes' *own* colour. So Notes runs a **bespoke accent rather than the system one**, which is counter to the claim first made here and weakens *"the system accent, not ours"* as a universal rule (that decision stands where it was made — version history — but is no longer evidenced as an Apple-wide convention). ~~**Holding blue for now; a Fumi accent is an open question.**~~ *(Closed 2026-09-01, resolves review-010 F4 — no Fumi accent; the system accent stands. A fixed Fumi accent is the same object as a fixed reserved signal value, which cannot read on both Paper and Midnight, and a per-swatch one stops being recognisable as an accent. See* the system accent colour, not ours*'s 2026-09-01 entry. The observation above is untouched — it just stops being an argument, since Notes' gold is a brand hue this product doesn't have.)*
- **The beak sits dead centre of the popover, *and* directly under its trigger** — both conditions at once, which means **the popover is positioned so its centre aligns with the trigger's centre**. It is not edge-aligned to the trigger with the beak slid across. Better rule than the alternative: the beak stays put while the panel can be any width. **Adopted; the spike took two passes to get right — the user rejected the first, which had the beak centred in the panel but the panel offset from the button.**
- **`Add Link…` is the first item in the context menu**, above Look Up and Cut/Copy/Paste.
- **Menus are comprehensive and long** — the Notes context menu runs to ~25 items with `Font ▸` and `Paragraph Styles ▸` submenus carrying the full shortcut list.

**This materially changed the H-vs-I comparison.** A four-icon capsule is roughly a third the width of the original bar — small enough to sit between the chrome dots without crowding. The main objection to **I** (a stuffed band) does not survive at Apple's actual scale, so **H and I were both redrawn with the corrected capsule** rather than being judged against an over-built one.

**🎨 Spiked — direction J** on the same board: the four-item capsule with the `Aa` popover open — centred beak, inline toggles, inset separators, block styles rendered as themselves, accent-filled hover row.

#### Board revision (2026-07-29) — after the user reviewed it

- **A and B deleted.** The bottom-attached bar and the inside-the-note top bar are both retired; the board keeps only live candidates.
- **H was drawn wrong, not designed wrong.** The capsule rendered *behind* the note — a z-order bug the user caught. Corrected per their steer: it now **floats on top, centred, straddling the note's top edge**, which reads as a handle attached to the note rather than a slab hovering above it.
- **`I` at rest added.** The user asked what the note looks like with no controls, and correctly recalled that an unfocused note has **no chrome at all**. *(The grey dots in the other frames are the **focused, pointer-elsewhere** state from the canonical chrome spike — faded controls, not at-rest.)* Drawn: no dots, no controls, content only.

### DECIDED — the band is a fixed height; content never moves

The first pass drew the band at **28px empty and 34px filled**, so content dropped 6px every time the note was focused. **The user caught it and rejected it** — *"I don't think that's good UX"* — and was right; a 6px jump under your own caret reads as jitter, and it is free to avoid.

> **The chrome band is one fixed height whether it is filled or empty. Controls fade in and out within it; content never moves.**

Height is therefore chosen for the controls' sake, not the empty state's — **30px**, which holds 23px controls with room to breathe. At rest that reads as ordinary top padding. *(The alternative — shrinking controls to ~22px to squeeze into the original 28px band — was rejected: it buys a couple of pixels at the cost of every click target, and the whole point of a pointer surface is that it is easy to hit.)*

This removes the last reflow objection to **I**: at-rest and focused notes are now **dimensionally identical**.

*Spike hygiene note (the user caught this twice): the at-rest frame was first drawn as a **separate, differently-sized note** — 320px wide against I's 400px — so it compared nothing. Rebuilt by **duplicating I and deleting the chrome**, which is the only honest way to show a state difference. The residual misalignment after that was **the note's 11px flex gap**: with a band present the title sits below band + gap; with padding alone it sits 11px higher. Keeping the band element and merely emptying it makes the two identical, which is also exactly how it must behave in the real app.*

### The corner menu hosts `Format ▸`

The corner menu is **Surface & Chrome's** and lives on board `01`. Formatting joins it as a **`Format ▸` submenu** — the full set with shortcut hints, which is how people learn the shortcuts. It sits above *Move to*, keeping the destructive *Delete* last.

*Board `10` had briefly carried its own stripped-down corner menu, drawn back when "`Format ▸` in the corner menu" was one of the competing directions. It was never the real menu — no role strip, no Delete — and it has been deleted now that the direction is settled: one menu, on the board that owns it.*

### DECIDED — the chrome band is the formatting surface (direction I)

**The band fills with formatting controls while the note is live, and empties when it isn't.** No new box, nothing added to the screen, no movement between states.

**What decided it — every alternative that leaves the note's frame is unshippable.** Both floating variants (**H** above, **A** below) put a bar outside the note's bounds, and the user's own screenshot settled it: a Sticky **hard against the menu bar** has nowhere to grow. That isn't a top-edge problem, it's an *any-edge* problem — a note can be placed against any boundary, so a design that needs space outside the frame needs a fallback for the case where there is none, and that fallback would reintroduce exactly what it was avoiding. **The constraint forces us inside the frame.**

**A rejected variation worth recording:** rather than a floating pill, extending the note's own Liquid Glass *into* a bar shape above it — visually much better than a detached capsule, since it reads as one object. Killed by the same constraint.

**And the resting gap was checked against the real thing.** The user placed a macOS Sticky beside the spike: its title sits closer to the top than ours. Ours is kept deliberately, for two reasons neither of which is "we need somewhere to put controls":

- **Glass needs more clearance than flat colour.** A Sticky is flat yellow, so text can sit near the edge with nothing to fight. Our note carries a specular highlight along its top edge — text crowding that band loses contrast against it *and* flattens the edge, so the material stops reading as material.
- **The first line is doing double duty.** It *is* the title, with no title bar anywhere. Clearance above is what makes it read as a title rather than as the opening sentence of a paragraph. Stickies has a window title affordance and doesn't need this.

Top-heavier than bottom (~~≈33 above~~, 24 below) is also normal typographic practice where a heading leads — equal padding tends to read bottom-heavy. *(Amended 2026-09-01, resolves review-010 F1 — the figure is **41 above**: reserved band 30 + flex gap 11. *The space above the first line is band + gap, not a padding value* named this exact ≈33 as one of the three disagreeing figures and replaced all three, but struck only the 28px site. The top-heavier reasoning is what that amendment kept — it argues for more clearance, not less.)*

### DECIDED — chrome appears on focus OR hover; formatting only on focus

The three-state model — *hidden at rest → faded when focused → full on hover* — was decided and spiked early, and **survived only because nobody asked what happens when you hover an unfocused note.** The user asked, and it doesn't hold.

**A false step on the way, corrected — worth recording because the reasoning was wrong, not just the outcome.** The first revision collapsed this to a hard binary: *unfocused → nothing, focused → chrome*, with hovering an unfocused note doing nothing. The argument was that a binary makes it **structurally impossible for two notes to show chrome at once**.

**That argument was overclaimed.** What actually fixes the busy-wall problem is the **single quiet treatment**, not the binary. Two notes showing chrome was only bad when they showed it at *different strengths* — one faded, one full — which reads as two competing states. Once every visible control renders identically, a focused note and a hovered note both showing quiet chrome reads as "both available", and the hovered one is under the pointer anyway.

**And the binary cost something real, which the user caught:** closing a background fumi became **two clicks** — click to focus, then click `✕`. On a desk designed to hold several notes that is worse on every note you weren't already using, and macOS supports one-click close on inactive windows precisely because it matters.

**The rule that replaced it — and the distinction that makes it coherent.** The two kinds of control are not the same thing:

- **`✕` and `•••` act on the window.** Valid whether or not the note is focused — closing a note you aren't using is a perfectly coherent act.
- **`Aa`, task list, table, attach act on the insertion point.** That only exists when the note is focused. Offering them on an unfocused note offers actions that cannot apply.

| Condition | `✕` · `•••` | Formatting band |
|---|---|---|
| Unfocused, not hovered | hidden | hidden |
| **Unfocused, hovered** | **visible, quiet** | hidden |
| Focused | visible, quiet | **visible, quiet** |
| **Focused, but not editable** | visible, quiet | **hidden** |
| Pointer on a specific control | that one lights up | that one lights up |

One-click close on any note; the band stays tied to editing; no control is ever offered where it wouldn't work.

**This largely restores review-002 F4** rather than superseding it — its resolution said unfocused notes reveal controls on hover, and that is true again. What genuinely dies is only the three-tier *strength* model.

#### Amendment — the band tracks the *editing context*, not focus (2026-07-29, resolves review-006 F12)

The heading's "formatting only on focus" was **too weak a rule** and the boards had already drifted from the text: `07`, `08` and `09` drew the band on notes whose editing is blocked, while the behavioural rules put *"the formatting menu"* on the blocked list for preview and Recently Deleted.

**Restated:** the band is present when the note is **focused *and* has a live rendered editing context**. Focus is necessary, not sufficient.

| State | Band | Why |
|---|---|---|
| Focused, editable | **visible** | the insertion point exists |
| **Edit as Markdown** | hidden | *(already decided)* the controls act on the rendered context, which isn't the one on screen |
| **Previewing a version** | **hidden** | read-only; the buffer on screen isn't the one you'd be editing |
| **Previewing the other Mac's version** (reconciler) | **hidden** | same reason — it is a preview |
| **Recently Deleted** | **hidden** | read-only until Put Back |
| **Conflict-pending, own version showing** | **visible** | *the note stays editable throughout a conflict* — decided under Conflict Reconciler |

*The conflict case is the one that shows the rule is about the **buffer**, not about "something unusual is happening". A conflict banner does not make a note read-only — you can keep typing while you decide. What removes the band is that **the text on screen is not the text you would be editing**, which is true of a preview and untrue of a conflict. A first draft of this amendment put conflict-pending in the hidden column and was wrong.*

**The precedent was already ours** — Edit as Markdown hides the band rather than greying it, for exactly this reason — and it settles the disabled-vs-hidden question the same way each time. The user's call: *"hide it, same as edit as markdown."*

**Why hide rather than disable**, stated because we chose the opposite elsewhere (`Restore` is *disabled* on `CURRENT`, not removed): a **disabled control still asserts the action is possible here, just not now.** On `CURRENT` that is exactly right and informative — Restore is real, you're simply already there. In a read-only state the whole *category* of action is unavailable, so five greyed icons are noise that also makes the state look temporarily broken rather than deliberately read-only.

**Two consequences that fall out:**

- **Nothing reflows.** The chrome band is a **fixed height whether filled or empty** (decided under the two-state chrome model), so the icons vanish and the content does not move. This is the payoff for that earlier decision.
- **Blocked input still pulses the state's primary action**, unchanged — but now only *typing* and *clicking into content* can trigger it, because there is no band left to click. Fewer paths, same behaviour.

**Board rollout, done in the same pass:** band **removed** from `07`'s version-preview note and `08`'s *previewing the other Mac* note. Band **kept** on `08`'s conflict-at-rest and reconciler-with-own-version-showing notes (editable), on `04`'s rendered pane, and on `09`'s ordinary notes. `06`'s deleted note never had one. The removal is `visibility: hidden`, not deletion — the reserved band height must still be visible on the board, since "nothing reflows" is the point.

**The "faded" tier was doing real work, but it didn't need to be a state.** What it bought was a focused note staying calm. That is achieved by making the chrome **quiet by design** — one treatment, tuned recessive — rather than two treatments that must both be specified and can drift apart.

**Corollary — the formatting band hides in *Edit as Markdown*.** Same rule: those controls act on the *rendered* editing context, and source mode isn't that. An `Aa` panel showing block styles rendered as themselves, over a monospace buffer you are hand-editing, is incoherent. Window controls stay. *(Caught by the user from the spike, where the source panel was also crowding the band — it now sits lower.)*

**And hover feedback is a third mechanism again** — the old "state 3" look survives intact, but it was **misfiled as a window state when it is per-control feedback**:

> **Hovering a control** darkens it and reveals its glyph — the close circle shows its `✕`, a formatting icon takes a rounded fill. **Only the control under the pointer changes**, and it behaves identically whether the note is focused or merely hovered.

**Corollary: window state decides which controls *exist*, not how they *light up*.** The two mechanisms are orthogonal, which is what lets the table above stay short — there is no separate "hovered control on an unfocused note" case to specify.

That is macOS traffic-light behaviour, monochrome. **One divergence:** traffic lights reveal glyphs *as a group* because they are three adjacent buttons reading as a cluster. Ours sit at opposite corners with the formatting band between them, so they are not a cluster and behave **per control**.

**Geometry is identical in every state.** The band is a fixed 30px whether filled or empty.

### Rollout (2026-07-29)

The two decisions above — the band, and the two-state model — were rolled out across the whole file rather than left to accumulate as drift:

- **`01 — Surface & Chrome`** reordered and relabelled; the formatting band added to every focused note; the hover frame corrected so **only the hovered control** changes.
- **Every note drawn as focused** on boards `04`, `07`, `08` and `09` gained the band.
- **Every note drawn at rest** on board `03` took the increased top padding, so at-rest and focused notes stay dimensionally identical everywhere.
- **The note-link peek** was re-centred on its pill under the new popover rule (popover centre aligns to trigger centre, beak dead centre) — it had been edge-aligned.

### ~~🎨 Canonical — `10 — Formatting Surface`~~ — board `10` was dissolved (2026-08-10, resolves review-009 F8)

> ⚠️ **Board `10 — Formatting Surface` no longer exists.** It was normalised out of the competing directions on 2026-07-29 and then **dissolved into `01` and `05`** in the same pass — *"a two-frame board is just somewhere for things to drift out of sync"* — with `10` reassigned to **Agent Activity**. This section kept describing it as canonical, which is how the stale citations below it survived. The frames all still exist; only the board they were on doesn't. **Where each went:**
>
> | Frame | Now on |
> |---|---|
> | **1**–**5** unfocused · unfocused+hovered · focused · pointer on a control · `Aa` popover | `01 — Surface & Chrome` — its index row already claims the chrome conditions, the band and the `Aa` popover |
> | **6** selection context menu | `05 — Corner Menu` — already listed in its index row |
> | **7** link editor | `09 — Note Links` — already claimed by its index row, and the "deliberately not on this board" note there is struck |
>
> Nothing is redrawn: all three boards already carry these frames. What was stale is this heading and the two references pointing at a dissolved board.

Board normalised from a set of competing directions into the decided design (2026-07-29). Losing directions **deleted, not archived** — A (bottom-attached), B (inside the note, top), H (tethered above), and the standalone capsule study.

~~Seven numbered frames: **1** unfocused · **2** unfocused + hovered · **3** focused · **4** pointer on a control · **5** `Aa` popover open · **6** selection context menu · **7** link editor.~~ *(The corner menu is not here — it belongs to Surface & Chrome, board `01`.)*

*Frames 1–3 are the same note duplicated with chrome added or removed, never redrawn — the only honest way to show a state difference.*

#### The layering

A small bar holds six or seven things; the corner menu can hold all of them **with shortcut hints, which is also how people learn the shortcuts.** So the bar never has to solve everything:

| Surface | Job |
|---|---|
| **Bar (H or I)** | **Four items: `Aa` · task list · table · attach** — what you can't type |
| **Corner menu (E)** | Everything, with shortcuts shown |
| **Menu bar** | Exhaustive, rebindable in System Settings — a **top-level `Format` menu**, per the menus amendment |
| **Context menu** | Convenience for those who use it |

### Decision — agent writes into a note you're editing (resolves review-004 F8)

The classic **collaborative-editing undo problem** — the general solution (selective undo, transforming your ops against others') is genuinely hard. Fumi gets a clean way out because the right mechanism already exists.

**Two mechanisms, two jobs:**
- **⌘Z undoes *your* typing** — personal, ephemeral, per-note.
- **Version history reverts *anyone's* changes, including the agent's** — durable, attributed ("Claude via MCP changed this 2 minutes ago"), deliberate. Backed by the pre-agent-write snapshot + author attribution rerouted to storage-and-sync.

So the agent is **not in your undo stack** — not because it's blocked, but because it has a better home that survives quitting the app and records who did what.

**The agent's edit must never block undo:**
- Your stack is **never cleared or frozen**. When an agent edit lands, your entries are **rebased** — offsets shift so ⌘Z still targets the right text.
- If the agent rewrote the exact text one of your entries targets, **that entry is dropped** (can't undo text that no longer exists) — but **the rest of the stack survives**. No dead end.

**Viewport & caret:** the view **holds your caret position** rather than following incoming text — no scroll-jumping under you. Edits elsewhere in the note apply silently while the agent shimmer indicates activity (see Agent-Activity Presentation).

### Decision — no inline reveal-on-cursor

**No inline reveal-on-cursor.** The Bear behaviour the user originally liked (caret enters `**bold**` → markers appear) is **dropped** for inline constructs, in favour of the calmest, most Apple-Notes-like surface. Consequences accepted: repair of a mis-fired construct goes through the formatting menu rather than editing the marker; hidden markers must therefore behave **atomically** (backspace at a construct boundary removes the marker pair and cleanly un-formats — what users expect anyway). *Reversible:* the architecture supports caret-aware concealment, so this can be added later without a rewrite.

**Upstream note reconciled:** note-model recorded an intent for a "rendered ↔ raw toggle." **Honoured** — as the *Edit as Markdown* escape hatch above, plus block-level source access — rather than as a co-equal mode you live in.

**Block constructs — decided below** (see *block-construct editing*).

### Decision — block-construct editing & deletion (resolves review-004 F11; closes the block hole)

Block constructs = tables, code fences, Mermaid diagrams, images. They have no pair semantics (a table is multi-line pipe rows; a fence's closer is a separate line), so character-level marker repair doesn't apply — they're **units**.

- **Blocks delete as a unit.** Backspace at the boundary never crawls into cells or code lines.
- **Two-step delete: first backspace *highlights* the block, second deletes it.** A real convention (**Notion** does exactly this; the select-first pattern is common for images/embeds) — the user reached for it from experience. It also fits Fumi's own principles: discovery wanted destructive acts respected *and* ruled out unnecessary prompts, and select-then-delete is precisely that — deliberate and visible, **without a dialog**.
- **Click into a block to edit its content.** Click a table cell → edit that cell's text (engine maintains the pipe row); click inside a code block → edit the code, with backspace behaving normally *within* the block.
- **Click-in *is* the block source affordance.** Clicking a rendered **Mermaid** diagram reveals its fence source in place, editable; click away and it re-renders. Same principle as a code block, just with a rendered result. (Obsidian works this way.)
- **Images** can't be "content-edited" — click selects; the hover options control (see Drop Interaction) handles replace/remove.

**Three distinct affordances, no longer muddled** (this was the review's question):

| | Scope | Nature |
|---|---|---|
| **Click into a block** | one block | in-place, no mode change |
| **Edit as Markdown** | whole note | escape hatch for repair |
| ~~Raw view as a co-equal mode~~ | — | rejected |

~~*Detail for later:* table **structure** editing (add/remove row/column) needs its own small control — noted, not designed.~~ *(Closed 2026-09-01 — see* table insertion and structure editing*, below.)*

### Decision — table insertion and structure editing (2026-09-01, resolves review-010 F7)

The table was designed in the middle and open at both ends: rendering, minimum width, edge fades, click-into-a-cell editing and two-step block delete are all settled, while what `Insert ▸ Table` produces was never stated and structure editing was flagged above and dropped. The second gap is the one with teeth — it is the single place *click into a block to edit its content* cannot reach, because there is no way to click into a row that does not exist.

**Scope, set by the user and worth stating before the mechanics:** *"own the limitations of our tables. It's md still. We aren't building Excel in fumis here."* The operation set is therefore add/delete row and column and nothing else — no merged cells, no per-cell styling, no alignment UI. Those are things a rich-text table can offer and pipe syntax cannot, and the dialect is not being stretched to reach them.

#### Insertion

**`Insert ▸ Table` produces a small empty table directly — no size picker.** A grid-hover widget is a whole component for a choice that add-row and add-column undo in one click each.

**The header row is not a choice.** note-model fixed the dialect as **GFM base**, and a GFM table has no headerless form — the delimiter line is mandatory syntax. So an inserted table is a header row plus body rows, necessarily, and the question the gap appeared to pose ("header row or not") does not exist.

**Working value: header + 2 body rows × 2 columns**, in the same spirit as the 30px band, the ~240pt floor and note-model's 360 × 420 creation default — sensible now, tuned in the build.

#### Structure editing

> **While the table is focused and hovered, small `+` affordances sit at its trailing edges — one below the last row, one beyond the last column. Deletion lives in the menus.**

**Focus-gating is not a new condition; it falls out of a split already decided.** *What works in a non-live state* holds that **reading actions stay live and editing actions don't** — which is why the code fence's copy button and the image's options control are hover-only (reading), and why the formatting band requires the note to be *focused **and** editable*. A `+` writes to the buffer, so it is an editing control and takes the band's rule. Hover then does what hover does everywhere else here: positions it, and keeps a table you are merely reading clean.

**`+` covers growth only, and that asymmetry is deliberate.** Adding is the frequent, in-place act performed while looking at the cell you want to extend from; deleting a row is rare and deliberate. So **delete row / delete column live in `Format ▸ Table ▸`**, acting on the caret's row and column — which is what the layering table already assigns that surface: the bar is *what you can't type*, the menu bar is *exhaustive and rebindable*. No third mechanism is introduced.

**And `Tab` in the last cell appends a row** — the universal convention in every table editor anyone has used, free to honour, and the fast path most people actually take.

#### Journey

The first proposal was to give the table **the hover options control** that code fences, images and attachment chips already carry — a fourth instance of an established pattern rather than a new element class. Apple Notes was checked against it and the comparison moved the design twice.

*What Apple does* (from recollection, not measured — the insertion size deliberately left unstated rather than asserted): clicking into a table reveals thin **grab handles** along the top edge and down the left, one per column and row; clicking a handle selects that row or column and pops a menu carrying *Add Row Above / Below*, the deletes, and row-level cut/copy/paste. `Tab` in the last cell appends a row. Their tables are rich-text objects rather than Markdown, which is what lets them offer merges and per-cell styling — and is why the header-row question is a choice for them and not for us.

**First correction: reveal on engagement, not on hover.** Apple's handles are focus-revealed. That is right for a table specifically — the hover pattern suits blocks whose control is a small fixed set acting on the block as a whole, while a table's controls are per-row and per-column and have to be positioned against structure you are already inside. A rail of handles appearing on a table you are only reading is noise. The principle inherited is *reveal on engagement*; the affordance is shaped by what is being edited.

**Second correction, and it came from the user: `+` beats handles-with-menus.** A handle that selects and then opens a menu is two gestures and a component for an operation set with four members. Two `+` affordances at the growth edges are one gesture, need no menu, and are self-explanatory. What they cannot express is deletion — which is what sends it to the menus above, rather than being a shortfall.

*Rejected: on-block chrome for deletion too.* It would double the affordance count on the block to serve the rarer half of the operation set, on a surface whose north star is furniture.

*Sibling check: note-model — its decided text fixes content as Markdown on a **GFM base**, which is what makes the header row mandatory rather than chosen; nothing about the content model is revised here, only how this topic's surface creates and reshapes a construct that model already admits.*

### Historical — the raw view as an editable mode (superseded)

Synthesis flagged this as the **highest-leverage unresolved question** — each lens had silently assumed a different answer. **Settled: one editable surface with two views** — view the full Markdown or view it rendered, **editable in both states**. Rationale: with agents writing `content.md`, a hand-editable source layer is the trust-but-verify escape hatch (something renders wrong, or you want to paste raw Markdown verbatim → drop to source and fix it). A read-only preview can't do that.

### DECIDED — Model B (Markdown-source buffer)

The buffer **is** the Markdown bytes. Reached after the pair, the synthesis, and a deliberate round of the user arguing *for* Model A "purely to ensure we are picking for the right reason" — which materially improved the decision. **The winning argument is not the one this section originally gave.**

**The decisive argument — concurrent agent editing of an open note.** Fumi is a sticky-notes app: notes live open on the desktop as furniture (close = hide), so **"open" is the resting state**, unlike a document editor where files are opened around edits. Combined with always-on autosave, an agent write means **two writers on one file, in real time** — the common case, not an edge case. (Synthesis had flagged exactly this as the pivotal unresolved question, and the *pro-A lens's own breakdown condition* conceded that if agent traffic is continuous and concurrent, B "earns its cost outright.")

- **B:** the change arrives as a **text diff** → apply a minimal patch; the caret is a **character offset**, shifted by the delta. Selection survives, undo survives (text edits compose), and an edit elsewhere in the note doesn't disturb you. Standard, solved machinery — how every text editor and language server handles external change. GUI, CLI and MCP share one notion of *where*: "line 12" means the same thing to all three, including the caret.
- **A:** reparse into a **new tree** — a different object graph. The caret lived in the old one, and the tree↔offset mapping is derived and transient. An in-flight user edit must merge with the agent's *in tree space*, which has no natural merge. Undo dies or points at a dead document.

A's mitigations are all bad: lock while focused (breaks the agent surface), queue writes until blur (a floating note may never blur), or prompt to reload (ruled out by the settled no-unnecessary-prompts principle). **This is a coordinate-space problem, so no dialect design fixes it.**

**Supporting arguments (independent of dialect):**
- **Dropping reveal-on-cursor makes B markedly easier than Bear.** The hard part of Bear-style editing is *dynamic* reveal/conceal on caret movement. Permanently-concealed markers give a **static, deterministic buffer↔display mapping** and one finite rule set: the caret never lands inside a marker run; backspace at a construct boundary removes the pair atomically (which is what users expect anyway).
- **Substrate maturity.** TextKit 2 has shipped for years and is what every nominated reference app (Bear / iA Writer / Obsidian) runs on. A's `AttributedString`-bound `TextEditor` is macOS-26-new with **unproven block-level extension points** — and we need Mermaid views, asset chips and interactive checkboxes hanging off it.
- **Asymmetric downside.** B failing = an editor that feels janky at the caret (a polish problem, solved by peers). A failing = silently mangled agent content, "recoverable in theory, one-way in practice" once a normalised corpus exists.
- **No write-locking needed** — see Agent-Activity Presentation. Avoiding a defensive mechanism outright is itself a point for B.

**False path — the argument that didn't survive (recorded deliberately).** The section originally led on *editable-raw is native to B* plus *fidelity/round-trip*. Both were dissolved:
1. **Editable raw view was dropped entirely** — `content.md` is a real file in a user-visible bundle, so "show me the whole file as text" is served by opening it in any editor. Building that view duplicates Finder.
2. **The fidelity argument was defeated by the user's counter:** define the dialect *as* a canonical Markdown subset (always `-` bullets, `**` bold, ATX headings) that maps 1:1 to the tree — then parse→serialise is lossless **by definition**, and version-history churn shrinks to a bounded one-time normalisation. Conceded. *(Note the weak form of that counter — a bespoke DSL like `<BOLD>x</>` — costs more than it saves: LLMs are natively fluent in Markdown and merely competent in an invented tag language, and it forfeits readable diffs and hand-editability.)*
   What survives the canonical-dialect counter is only **uncontrolled ingress**: hand-edits in an external editor, paste from the web, app-version skew — B tolerates (renders wrong, survives), A normalises or drops.

**Accepted costs / open risks:**
- **B's load-bearing risk is caret/selection semantics through concealed runs** — plus IME/CJK composition, dictation, VoiceOver, and copy/paste not capturing half a marker pair. This is the one layer the framework *does* carry and that concealment necessarily perturbs. Mitigating counterweight: **TextKit 2 is mature and is precisely what the nominated reference apps (Bear / iA Writer / Obsidian) run on**, whereas A's `AttributedString`-bound `TextEditor` substrate is macOS-26-new with **unproven block-level extension points** (needed for Mermaid views, asset chips, checkboxes). Maturity risk sat on A; plumbing risk sits on B.
- **Fidelity refinements A would have needed are now moot** (per-block original-byte spans, an edit-locality gate — synthesis noted A's proposed byte-stability gate tested *no-op* fidelity, not edit locality).
- **Spike (carried to implementation — now validation, not a decision gate):** does caret/selection motion through concealed runs *feel* right in real TextKit 2? Named by Capability-First as its own falsifier. Materially de-risked by always-conceal (static mapping, no dynamic reveal), and the fallback is known. Same discipline as colour: prove it in the real build, not on paper.
- **Formatting-menu commands are text surgery in B** (insert/remove marker characters) rather than "set the block type" — must define undo granularity, caret landing, and behaviour on a line already carrying a construct (e.g. applying Heading to a `> ` quote line).

## Tag Rendering

### Context

*Tag rendering & live-preview polish (references). Rerouted from note-model · discussion · 2026-07-22.*

> ⚠️ **Partly superseded by the Editing UX decisions** (review-004 F10): **syntax-marker reveal-on-cursor was dropped** — markers are permanently concealed. The tag-pill rendering and token behaviour below still stand. Original rerouted text kept for provenance.

### DECIDED — tag pill treatment (at rest)

**🎨 Spiked and locked** — both canonical artboards. Pinned here so it stops drifting between spikes:

- **A full pill** (fully rounded), padding ~3px 9px.
- **Inter Medium, 11.5px**, colour ≈ `#1C2029B8` (dark, ~72% alpha).
- **Translucent white fill** ≈ `#FFFFFF9E` — the glass shows through, so the pill sits *in* the material.
- **No border** — consistent with the attachment-chip rule; a hairline on glass reads as a web component.
- **The `#` is shown inside the pill.** Unlike `**` or `#` heading markers, the hash is *meaningful* — it's how you read the token as a tag — so it is **not concealed syntax**.

*Process note: an earlier bordered variant survived in one note after the borderless rule was agreed. Spiking incrementally risks exactly this drift — when a treatment changes, roll it back across every artboard and pin the value here in the same pass.*

**Model settled**: tags are inline `#hashtag`s in content (Option A); a tag is an editable content token; placement is the user's choice. **Note-window owns the rendering + in-note behaviour:**
- **Tag at-rest** renders as a small **badge/pill** — Bear-style (a `#`/icon inside a rounded pill), our own calm visual take.
- **In-note tag token behaviour:** click to select/edit; backspacing across a tag reverts it to plain `#text`. Not a navigation trigger (filtering lives in management-window).
- **Syntax-marker reveal-on-cursor** (live-preview): raw Markdown markers (`**`, `#`, …) show only around the cursor's current span and hide elsewhere — e.g. `**Harness**` reveals its `**` only when the cursor is inside it. User shared Bear examples; flagged as a nice-to-have (this is the "meaty live-render" GUI piece flagged in discovery — size honestly).
- Other Bear affordances seen, worth considering (not mandates): an **H1/heading indicator** glyph by the heading, **collapse/expand** a section, a hover **"…" menu**.

**Guiding principle (user):** use **Bear, Apple Notes, and Obsidian as references** — build off what these giants have settled, adapt to Fumi's calm/furniture aesthetic, don't copy wholesale.

## Conflict Reconciler

### Context

*Sync-conflict display: badge + tabbed version reconciler. Rerouted from storage-and-sync · discussion · 2026-07-22.*

Storage settled that live multi-Mac edits sync via CloudKit (`CKSyncEngine`), and on a genuine concurrent edit to the **same** `content.md`, the engine **keeps both versions** rather than auto-merging or picking a winner. The divergent version is **not a separate note** — the *one* note enters a **`conflicted` state** with the alternate stored as a subordinate candidate (one note, not two — matches the "one Fumi with a conflict badge" model). Disjoint changes (colour on one Mac, text on another) auto-merge silently; only same-content concurrent edits produce a conflict, which is expected to be **rare** (single-user tool, fast sync). On resolution the chosen version becomes the note's content, the pre-resolution state is snapshotted first (undoable), and the losing candidate is dropped.

**note-window owns how a conflicted note looks and how the user reconciles it:**
- The affected fumi wears a **conflict affordance** — a badge / icon / colour tint (a standard macOS "attention here" pattern), **not** two separate windows.
- Opening it presents a **tabbed reconciler** — "version 1 / version 2 / …" (or "clash 1 / clash 2") — showing the divergent versions so the user picks/keeps.
- Never auto-discards a side; the user resolves, then the extra fork is cleaned up.

Design the visual state + the reconciler interaction. Keep it calm/furniture-consistent — a conflict should read as "here are two versions, choose", never as data loss.

### DECIDED — the reconciler *is* the version panel, not a tabbed view

The reroute brief asked for a **tabbed** reconciler ("version 1 / version 2"). **Rejected** — by the time this subtopic ran, the surface already existed.

A conflict is: *browse a small set of candidate versions, preview each, commit to one.* That is exactly what the version panel does. Its placement, flip behaviour, lifecycle, note-as-its-own-preview-pane and header-mounted primary action are all decided and all directly applicable. Tabs would be a second mechanism for an act we already have a mechanism for.

Reused unchanged: panel geometry, row structure, and the `CURRENT` badge. Only two things change — the header label reads **Two versions**, and the action verb is **Keep** rather than *Restore*.

**One inherited rule that does NOT carry over — `Keep` is never disabled.** The version panel disables *Restore* on the `CURRENT` row, and that rule was initially carried across. **Wrong, and the user caught it:** *Restore* is disabled because restoring what you already have is a no-op, whereas **keeping the local version in a conflict is a real act** — it resolves the conflict, drops the other candidate and clears the banner. Disabling it would make *"mine wins"* unreachable, which is half of all resolutions. Both rows are therefore always actionable. *(The same trap as the tag-click precedent earlier in this session: a rule was reused without checking whether its **reason** still applied.)*

**The labelling improves for free.** "Version 1 / version 2" never tells you which one is yours; the panel's existing uniform attribution reads ~~**"This Mac · 11:26"** / **"MacBook Pro · 11:25"**, with the same `You` / `Claude via MCP` treatment already decided~~ a device name plus a timestamp, carrying the panel's attribution row unchanged. *(Amended 2026-08-22 — two things in the struck text. The `You` / `Claude via MCP` clause named a two-way user-vs-agent label the attribution model does not carry; the reconciler inherits whatever the panel renders, settled under* what the attribution row says*. And "This Mac" / "MacBook Pro" was a spike illustration resting on a fact nothing produced — see* the row's device label*, below.)*

**An explainer line sits above the list** — *"Both were edited before they could sync. Pick one to keep. The other is saved to history."* — because "conflict" is jargon. This is an explanation, not a prompt.

### DECIDED — the row's device label (2026-08-22)

The spike's `"This Mac · 11:26"` / `"MacBook Pro · 11:25"` needed a fact nothing in the record model produced. storage-and-sync keys devices by **hardware platform UUID** — an identifier, not a name — the per-device record was write-only from its owner's side (*"nobody queries another Mac's layout"*), and the child records carry `via` and `by`, no device at all.

**Three answers were on the table before the name source turned out to be free.** **A — drop the device label entirely**, leaving `CURRENT` + timestamp + attribution, identical to the version panel; two candidates written seconds apart by the same actor would then be separated by timestamp alone. **B — "This Mac" / "Another Mac"**, needing one bit rather than a name, and landing on the axis this topic already uses for delete origin and the recency tint — *whether you did it, here*. **C — real names**, which looked expensive: a new field, a name source, and a cross-device read the storage model avoids. B was the recommendation, on the observation that **"This Mac" restates the `CURRENT` badge** — the badge already means *what you keep by closing*, which in a conflict is this Mac's side, so the whole device label reduced to one word on the *other* row.

**The user's question — can't we use the host name? — dissolved C's cost**, and B survived as its fallback rather than its rival. That is what makes the decision safe to take ahead of its dependencies.

**The name source is the one the platform already shows the user.** Measured while deciding this:

`scutil --get ComputerName` → `Lee’s MacBook Pro`

Not the hostname — `hostname` gives `Lees-MacBook-Pro.local` and `scutil --get LocalHostName` gives `Lees-MacBook-Pro`, both Bonjour-derived slugs. **ComputerName** is what the user sets in System Settings → General → About → Name, and what AirDrop and Finder's sidebar already show them for that Mac. The command above returned it with no permission prompt on a non-sandboxed process, which is the case that matters here. *Observed, not measured: that the SystemConfiguration dynamic store publishes name changes, so a rename is observable without a relaunch. Nothing here breaks if it doesn't — the name is read at display time, so the worst case is a stale label until the next draw. Worth a small check at build, alongside the `IOPlatformUUID` one storage-and-sync already flagged.*

**The name is resolved at display time, never stamped on the version.** Store the device key; look the name up when the row draws. Rename the Mac and every row it ever wrote re-labels, including last year's — which is what the user expects of a rename, and what stamping would break by leaving history full of a name they no longer use. Same shape as this topic's positioning ruling: *a home is intent; where a note sits is resolution; fallbacks resolve but never rewrite.*

**Both rows carry their name** — `Lee's MacBook Pro` / `Lee's Mac mini`. `CURRENT` continues to carry the separate fact of which one you keep by closing, so the label is not restating the badge.

**Where the name cannot be resolved, the row reads "Another Mac."** No device record, never synced, purged, or an unreadable ComputerName — all one state, and a complete label on its own. This is what makes the decision safe to take before its dependencies land: refusing them costs the names, not the reconciler.

**Device identity shows in the reconciler only, not in version history.** The reconciler is the one place two rows sit seconds apart, written by the same person, where *which of my Macs* discriminates. In history the timestamp answers *when* and the attribution row answers *who*; a third fact per row is noise.

**Two dependencies rerouted to storage-and-sync** (2026-08-22), each separately decidable there: the **per-device record carrying its ComputerName**, refreshed by its owner on the `lastSeenAt` write it already makes; and **conflict candidates recording the writing device's key**, without which there is nothing to resolve from. The second carries a question this topic could not settle — the conflict is detected by whichever Mac pushes second, so whether the local-versus-remote assignment is symmetric on both Macs is not written down anywhere, and if it is not, a stored key is what makes the label truthful on both.

**Sibling check: storage-and-sync — its decided text holds the device key as the hardware platform UUID, one record per device whose owner is its exclusive writer, refreshed with `lastSeenAt` on sync, and holds that nobody queries another Mac's layout. The key and the exclusive-writer property are adopted as written; the last of those is what the first reroute asks it to revisit for the name field alone — the layout map stays unqueried. Nothing there is revised by this topic.**

### DECIDED — no diff for v1: hold the frame still and the comparison emerges

The open question was whether preview-in-place is enough to choose between two conflicting versions, given that here you are choosing which edits *survive*.

**It is, on three grounds:**

1. **Conflicts are rare and typically tiny** — the same note touched on two Macs inside a sync window is usually a few words.
2. **Stabilised flicking genuinely works.** If the window does not move and the scroll position does not jump, switching candidates makes only the **differing words** move. The eye catches motion far better than static difference — it is the blink comparator, and we get it by *refusing* to animate rather than by building anything.
3. **The resolution is undoable.** Storage snapshots the pre-resolution state, so a wrong pick is recoverable through version history. The reconciler is not a one-way door and therefore need not be a forensic tool.

**A deliberate divergence from version preview: the reconciler must not animate geometry.** Version preview animates the note to that version's recorded size; for a conflict that is actively harmful — the window resizing while you read two texts against each other. Content only, frame held still.

*The parked diff idea (see Agent-Activity Presentation) upgrades this later without changing the shape.*

### 🎨 Spiked — *CANONICAL SPIKE — conflict reconciler* (Paper, 2026-07-28)

Three states: the conflict at rest, the reconciler open showing this Mac's version, and the same panel switched to the other Mac's. The spike confirmed the panel reuse carries unchanged — and corrected two things, which is what it was for.

**Correction 1 — the conflict state is a banner, not a chrome glyph.** The proposal was a reserved-space tint plus a glyph in the chrome band. Drawing it made the better answer obvious: **the deleted state already established a banner** for precisely this shape of thing — persistent whole-note state carrying an action — so the conflict reuses that banner's geometry exactly, in a different hue, with **Review** where *Put Back* sits. No new chrome element, and the action has somewhere to live.

*Note this is the case where a **persistent** indicator is justified, unlike agent activity: a conflict is standing state requiring an action, not an ephemeral event. The same reasoning that cut the agent header indicator argues for one here.*

**Correction 2 — the still-frame claim was wrong as first drawn.** Stacking the two states to test the blink comparison immediately showed the *Previewing* banner pushing the body down ~40px, so the frame was **not** held still — the whole note shifted, defeating the comparison the decision rests on. **Fix: while the reconciler is open the note always wears a `Showing ·` banner**, so switching candidates changes the label and nothing else. Symmetric across both candidates, and it doubles as a label for what you are looking at.

**Colour — conflict is violet.** The deleted banner already owns warm amber in the reserved system-state space (`#8C6A3F` family), so conflict took a muted **violet** (`#5B4BA8` family, `#463887` text). Distinct at a glance from both the deleted state and the blue system accent — and **not red**, because a conflict must never read as data loss.

**Selection rule (caught by the user reviewing the spike).** **Exactly one row is highlighted at all times**, because the note is always displaying exactly one version — including the `CURRENT` row when the note is showing the local version. Blue means *"this is what you are looking at"*; the `CURRENT` badge separately means *"this is what you revert to if you close without choosing"*. Two different facts, two marks, no clash — the badge inverts to a light treatment on the blue row.

*This refines **Version-History UI** too: the panel highlights the row currently displayed, including `CURRENT` on open, rather than leaving nothing selected.*

### DECIDED — the note stays editable while a conflict is pending

No lock, for the same reason agent writes don't lock: a note refusing keystrokes is a modal dialog in disguise. Your edits accrue to the local side; the held candidate is unaffected.

**Boundary with the recency tint:** a sync arrival that **merges cleanly** gets the tint. One that **conflicts** gets this banner instead. Never both.

## Delete UX

### Context

*Delete UX: confirm prompt, deleted-state display, open-from-Finder. Rerouted from storage-and-sync · discussion · 2026-07-22.*

Storage settled the *mechanism*: soft-delete is a **flag** (`deleted` + `deleted-at`) on the note (not a folder move); soft-deleted notes still sync and are filtered out of the normal list into a Recently-Deleted view (the bin lives in management-window). Hard-delete removes the record + writes a tombstone; **no auto-purge** (notes sit in Recently Deleted until the user clears them). Discovery earlier decided delete should show a **dismissible confirm prompt** ("Don't show again") — deleting is the one destructive act, and its safety is recoverability + a single confirm, not a barrage of prompts.

*From: status-and-alerts · discussion · 2026-09-12*

status-and-alerts asked whether the first-delete lesson is once per Mac or once per person, on the reading that this topic had never stated it. It arrived because that topic had just pinned a cadence for its **own** conditions and chose per-Mac — *"the notification fires the first time this Mac's engine observes the condition, and never again for that condition on that Mac… each Mac announces for itself, because each is telling the person sitting in front of it, who may only ever sit at one of them"* — and its sibling check declined to extend that rule here, on the grounds that the reason behind per-Mac might not transfer. The weighing it offered: **per person** (a synced flag) matches what education is for and teaches once ever; **per Mac** costs teaching a rule the user already knows, on their second machine, mid-delete; and a third reading, that the education is cheap either way, since it fires at most twice for a two-Mac user and may never fire at all under a denied permission. It also carried one fact this topic did not have when it decided: **status-and-alerts has since decided Fumi requests notification authorisation once during first run**, so the permission is likelier to be granted than the original decision could assume.

*The premise is false — this topic did state it, and states it still: "**The flag is per machine, not synced**", recorded with its own correction from an earlier synced reading. See the ratification note under* the first-delete notification *below; nothing was reopened.*

### DECIDED — delete is immediate, with no confirm (revises discovery)

**🎨 Spiked** — *CANONICAL SPIKE — lifecycle states*.

**Deleting a note does not prompt.** The note leaves the screen immediately, and it's recoverable from Recently Deleted.

**Close and delete are distinguished by motion** (resolves review-005 F3) — once the confirm went, both simply made the window leave, and nothing separated them:
- **Close = hide** → a **very subtle fade**. Weightless and reversible, which is what hiding is.
- **Delete** → **instant**. A hard cut reads as final in a way a fade cannot.

*Rejected: giving delete directional motion "toward" Recently Deleted. Mail's swoosh-to-trash and Finder's genie work because the destination is visible on screen; our Recently Deleted lives in the manager window, usually closed — so the motion would point at nothing and be decorative rather than informative.*

**Low stakes, deliberately.** The user picked a distinct menu item, so the motion is *reinforcement*, not the primary signal. There's no strong macOS convention for deleting without a visible destination. Exact timings are a build-time feel judgement — a static spike can't validate motion.

**This deliberately revises discovery's "dismissible confirm prompt".** The revision is right because the premise changed: discovery framed delete as *"the one destructive act"*, but once storage settled soft-delete as a **reversible flag** — the note keeps syncing, lands in Recently Deleted, and **never auto-purges** — deleting stopped being destructive at all. Confirming a fully reversible action is precisely the *unnecessary prompt* discovery's own principle forbids, and it contradicts the reasoning that made **close** weightless (close is light *because* it's recoverable; delete is equally recoverable).

**Validated against the platform** (user tested it live): **Apple Notes deletes with no prompt** — it just slides away. Mail and Finder behave the same. The macOS line is **reversible → no prompt; irreversible → confirm**. The confirm belongs to *permanent* deletion (Empty Trash / Delete Permanently), not to binning.

Consequences:
- **⌘Z does *not* undo a delete — undo is content-only** (resolves review-005 F2). An earlier draft claimed it did; that was wrong and is retracted.

  **Why it can't work.** Undo was already decided as **strictly per-note** — each note window owns its stack. Delete removes the window, so the stack that would hold the entry goes with it, and focus lands on a neighbouring note, where ⌘Z would undo *that note's typing* instead.

  **An app-level undo stack** (Finder's model — file operations get their own undo, separate from text) was considered and **rejected on two grounds**:
  1. **Interleaving is indeterminate.** Finder's precedent is clean because Finder has almost no text editing to interleave with; we have plenty. Sharing one ⌘Z between "undo my typing" and "undo a note-level operation" orders them by wall-clock rather than context — type in note B, delete note A, press ⌘Z, and the user cannot know whether they'll backspace B or resurrect A. That isn't a safety net.
  2. **It may be unreachable.** Deleting the last visible note can leave Fumi with no windows, so macOS moves focus to another app entirely and ⌘Z never reaches us.

  **Consequence:** the no-confirm decision now rests on **two** legs rather than three — the action is recoverable, and the first-delete notification teaches where from. This puts more weight on the **discoverability of Recently Deleted**, which is **management-window's** to deliver.
- **The "Don't ask again" checkbox disappears**, along with the preference behind it. One less setting.
- **The confirm moves to permanent delete**, in the Recently Deleted view → **management-window** (rerouted).

**First-delete education.** The one real risk is a user not knowing delete is recoverable. So **the very first time a user deletes a fumi, show a one-time macOS system notification** — *"Deleted. You can always recover this from Recently Deleted."* Teaches the safety net once, then never again — far lighter than a permanent confirm, and it's what makes dropping the prompt safe.

**A system notification, not an in-app toast.** An in-app toast was proposed and rejected: it would mean **inventing a component used exactly once**. A system notification is a platform primitive, is the natural voice for a menu-bar app, and **persists in Notification Centre** — so if it's missed in the moment it remains available. Not spiked; there's no bespoke design to draw.

*Known limitation, accepted:* system notifications require permission, so if it isn't granted the education never appears. Acceptable because this is **education, not safety** — the actual safety net is Recently Deleted + no auto-purge. *(Amended 2026-08-06 — this listed "+ ⌘Z" as a third leg; **⌘Z does not undo a delete**, retracted under *delete is immediate, with no confirm*, which concluded the no-confirm decision rests on two legs.)* Worst case a user finds the bin later rather than sooner; nothing is lost either way. **Dependency rerouted:** notification permission → **onboarding-and-permissions** (landed in its Triage; that topic's research phase was started to receive it).

### DECIDED — delete from outside the note window (resolves review-005 F4)

Everything decided about delete assumed the corner menu. Three other paths exist in settled scope: the manager's **Recently Deleted** surface, an agent **`rm`** through CLI/MCP, and a delete **arriving by sync** from another Mac.

**The split is on *whether you did it, here*** — the same axis used for the recency tint (*you were there vs you weren't*). Note this is **not** a multi-user distinction: a sync-originated delete is still **your own** action on **your own** other Mac. What differs is only that you were not present at *this* machine to see it happen.

| Origin | The open window |
|---|---|
| **You, on this Mac** — corner menu, menu bar, or manager | **Closes.** You performed the act and know what happened. The first-delete notification applies. |
| **Not by you, here** — an agent via CLI/MCP, or a delete arriving by sync from another of your Macs | **Transitions to the deleted state** — banner, read-only, **Put Back**. It explains itself instead of silently disappearing. |
| **Hard-delete** *(always from Recently Deleted — see below)* | **Closes.** Nothing left to render — and no fade, it is simply gone. **The window that vanishes is always one already showing the deleted state**, never a live one. |

*(Amended 2026-08-06 — row 2 read "**Restore**"; the banner's verb was settled as **Put Back** under *how a deleted note reads*, review-005 F6, precisely because both buttons can be on screen at once.)*

#### Decision — hard delete is only reachable from Recently Deleted (2026-07-29, resolves review-006 F17)

The review found *"hard-delete, **any origin**"* over-claimed: the origins listed elsewhere are your own delete, an agent `rm` (which we placed in the **soft**-delete row), and a sync arrival — while the permanent-delete confirm was routed to the manager's Recently Deleted view, implying the manager was hard delete's only home. It also left one case genuinely uncovered: a hard delete arriving by sync **while the note is open and being typed into**, where the window would vanish mid-keystroke with no banner and no notification.

**The user's rule (which dissolves the case rather than answering it):**

> **You cannot hard-delete a note unless it is already in Recently Deleted.**

**Everything that follows falls out of that gate:**

- **Every delete, from every origin, is a soft delete.** Corner menu, menu bar, manager, agent `rm`, sync arrival — all produce a recently-deleted item. There is no path that skips the bin.
- **A soft-deleted note is read-only.** *"You can't type into a recently deleted item"* — which is the same conclusion the formatting-band amendment reached independently, from the other direction.
- **The uncovered case cannot occur.** To hard-delete on your other Mac you must first soft-delete it there; that soft delete syncs and puts **this** window into the deleted state — visible, explained, read-only. Only then can the hard delete land. **So a window that disappears is always one that already said "Deleted"**, never a live note vanishing under your cursor. *The gate removes the failure mode; nothing needed special-casing.*
- **`Hard-delete, any origin` is now accurate for a different reason** than when it was written: not because every origin closes the window, but because by the time a hard delete exists, the window is always already in the deleted state.

**Hard delete is a user-only act, and is not exposed to agents** (user: *"maybe we don't expose that via the MCP or the CLI"*). Consistent with **irreversible → confirm**: the confirm is the user's consent to something unrecoverable, and **an agent cannot consent on the user's behalf** — nor can a CLI invocation carry one meaningfully. Agents get `rm` as a soft delete, which is reversible and therefore needs no confirm. **Routed to agent-surface** as a constraint on the verb set, not a suggestion.

*Consequence worth stating for management-window: **Recently Deleted is the sole hard-delete surface**, which makes it load-bearing rather than a convenience — it is already carrying the permanent-delete confirm, the Empty/Clear action, and now the only route to permanence at all.*

**Two rejected answers on the way here, both instructive.**

*First:* the window closes on **every** delete, with a fade when the origin was remote. **Rejected by the user** — a soft-delete is a **state change, not a removal**, and we had already designed a state that represents a deleted fumi. Rendering it is what that state is *for*; a fade explains nothing.

*Second:* the window transitions to the deleted state on **every** delete, with no origin-dependence, on the argument that this is what makes the no-confirm decision safe — Restore on screen the instant the delete lands. **Also rejected**: when *you* delete a note you expect it to go. Leaving a deleted note sitting on your desk after you deliberately deleted it is clutter, not safety.

**What the final split gets that neither did:** the deleted state appears exactly where it is useful — when something *else* deleted your note and you would otherwise be looking at an unexplained disappearance — and nowhere it would be noise.

**And it repairs the first-delete notification's justification.** Under the second answer that notification was being undercut: if the deleted state always appeared in place, the note never vanished and nothing needed explaining. Under this split, a self-delete **does** remove the note from view, so nothing on screen says what happened — which is precisely the gap the notification was designed to fill. It is doing its original job, and only in the case that needs it.

### DECIDED — the first-delete notification: user-initiated, per machine

The one-time notification (*"Deleted. You can always recover this from Recently Deleted."*) exists to teach **you** the safety net the first time **you** delete something.

- **It fires only on a delete you performed** — corner menu, menu bar, or manager. That is the case where the note leaves the screen and nothing remains to explain it.
- **A delete from elsewhere never fires it.** An agent `rm`, or a delete arriving by sync, shows the **deleted state** on the note instead; that is self-explanatory and needs no notification.
- **A remote delete does not consume it either.** If an agent deletes a note before you have ever deleted one yourself, the notification is still waiting for your first delete. It is not "the first delete that happened", it is **the first delete you performed**.
- **The flag is per machine, not synced.** *(Corrected — first recorded as synced.)* It is **machine-local state**, which the storage model already houses in the central non-synced store; syncing a one-shot "seen it yet" flag would be syncing a triviality. Re-showing once on a second Mac costs nothing, whereas a synced flag means a second machine never teaches the safety net at all.

*(Ratified 2026-09-14 — status-and-alerts asked whether "once" means per Mac or per person, reading this as unstated. It is stated in the bullet above, and this topic had already been on the other side of it once and moved. The rule stands unchanged, and the two topics' cadences agree **for different reasons**, which is the thing worth having on the record rather than the answer itself: status-and-alerts announces per Mac because a condition is a fact about the machine in front of you, so the Mac you are sitting at should be the one to speak. This flag is per machine for the opposite kind of reason — not because a lesson belongs to a machine, but because the **failure modes are asymmetric**. Re-teaching a rule the user already knows costs one notification they ignore; a synced flag means a second Mac never teaches the safety net at all, to a user who may reach that Mac first and delete something believing it gone. The cheap error is the one taken. status-and-alerts' own weighing agrees on the arithmetic and reaches it by a third route — the education fires at most twice for a two-Mac user, so per-person buys nothing worth a synced marker.*

*One thing genuinely changed underneath this, and it strengthens the decision rather than reopening it: status-and-alerts has since decided **Fumi requests notification authorisation once during first run**. The accepted limitation recorded above — that a denied permission means the lesson never appears — was written when nothing asked for the permission at all, so the safety net's only teacher depended on the user having granted it for some other reason. It is now asked for deliberately, which makes the education likelier to land without changing what happens when it doesn't: Recently Deleted with no auto-purge is still the actual safety net, and this is still education rather than safety.)*

### DECIDED — how a deleted note reads

**🎨 Spiked** — *CANONICAL SPIKE — lifecycle states*. Opened from Recently Deleted, or reached via a `fumi://` link to a deleted target:

- **A banner across the top** — "In Recently Deleted" with a **Put Back** action.

**"Put Back", not "Restore"** (resolves review-005 F6). Version History is a *reading* action, so it's available on a deleted note — which means two buttons can be on screen at once meaning different things: the banner's un-deletes the note, the panel's replaces its content with a snapshot. **Finder already solves this**: recovering from the Trash is *Put Back*. It's the native term for exactly this action, it disambiguates completely, and it reads better in isolation — putting something back where it was is precisely what un-deleting does.
- **Restore** → this *version's content* becomes current.
- **Put Back** → the *note* returns from Recently Deleted.

**Both banners can stack** — a deleted note being previewed at an old version shows the "In Recently Deleted" state banner and the "Previewing · {age}" banner. They describe different things (where the note lives vs what you're looking at), and with distinct labels there's no ambiguity.
- **Content is faded**, signalling inactive at a glance.
- **Read-only until restored.** Two of the three reasons you open a deleted note (checking before clearing it; following a link to it) are *reading*, not editing — and editing-implicitly-restores would be a silent state change the user didn't ask for. Matches Apple Notes / Photos / Mail, which all require an explicit Recover first.
- **Typing pulses the Put Back button** rather than doing nothing — a dead keyboard is confusing; this answers "why isn't this working?" without a dialog. *(Amended 2026-08-06 — read "Restore"; that is the version panel's verb, and this banner's was settled as **Put Back** three bullets above.)*
- **Double-clicking a soft-deleted bundle in Finder** opens this same state (storage left the call to us). Refusing is unhelpful; silently restoring decides for the user.

*Spike note: the Restore button's styling isn't yet convincingly macOS — accepted as-is for now, flagged for the real build.*

> ⚠️ **Superseded — kept for provenance.** The rerouted text below still describes the **dismissible confirm prompt**, which the decisions above deliberately removed. Read the DECIDED blocks, not this.

**note-window owns the per-note delete interaction + deleted-state visuals:**
- The **delete action** in the per-note corner menu, with the **dismissible confirm prompt**.
- How a note reads once soft-deleted if surfaced (opened from Recently Deleted, or via a `fumi://` link to a deleted target) — a "deleted / in Recently Deleted — Restore?" state. (Coordinate with the "Deleted-target states" note under Note-Link Interaction — same soft-vs-hard-deleted visual language.)
- **Double-clicking a soft-deleted note's bundle in Finder** — define behaviour (open in the deleted/restore state? refuse? restore?). Storage left this as note-window's call.

## Version-History UI

### Context

*Version-history browse & restore UI. Rerouted from storage-and-sync · discussion · 2026-07-23.*

*From: note-model · discussion · 2026-07-30*

This topic's version-history decisions were explicitly conditional on note-model's size ruling — *"if size lands as machine-local, which would make a snapshot's recorded geometry meaningless on a different Mac, this decision, the preview animation, and part of the scrubber-rejection reasoning all need revisiting."* **Size landed intrinsic, so preview-animates-to-recorded-size and restore-takes-geometry both stand unchanged.** Two additions fall out of the ruling and are this topic's to confirm: **(1)** a snapshot records `preset_id` alongside `size` — the binding is part of the note's geometry intent, degrading through the existing dangling-preset fallback; **(2)** preview of a *bound* note should re-resolve the binding against the current display rather than animating to the recorded absolute rect, since animating to a Studio-shaped rectangle on a laptop misrepresents what committing would produce. And on the write side: a snapshot records the **authored** size, never the resolved rect; **preview writes nothing**, while committing a restore writes `size` and `preset_id` as a deliberate act.

*Outcome: both confirmed, plus a third rule the exchange surfaced — preview never moves the note. See **the dependency discharged; preview animates size and never position**, below.*

That topic decided the **version-history model**: per-note append-only immutable markdown snapshots of `content.md`, captured on a **focused-but-idle (~1 min) or on-blur, only-if-changed** cadence, synced via CloudKit, with user-tunable retention (Off / 30 / 90 / 180 / 365 days / Forever, default 90). **Restore** replaces current content with a snapshot and snapshots the pre-restore state first (undoable). Storage flagged the **browse/restore UI as the genuinely hard part — and note-window's to design.**

**note-window owns the experience:**
- How the user **enters** history (a per-note affordance — history icon in the corner menu?).
- How they **scrub / browse** versions — a slide-out **sidebar**, a **popover**, or a Time-Machine-style scrubber; scroll through timestamped snapshots, preview each.
- **Restore** affordance from a selected version (with the "restore is itself snapshotted" behaviour surfaced sensibly).
- **Asset fidelity in old versions:** a snapshot may reference assets still present (ref-counted while any version links them) — render them; the model keeps them faithfully within retention, so old versions generally show their images.
- Keep it calm/furniture-consistent; history is a premium feature (per commercialization), so it should feel polished but unobtrusive.

*From: storage-and-sync · discussion · 2026-08-10*

**The panel displays "You" vs "Claude via MCP", a distinction the attribution model deliberately does not carry.** storage-and-sync's *Attribution — record what we know, never what we'd have to guess* holds attribution as **`via`** (channel: `app`/`cli`/`mcp`, engine-known, unspoofable) plus **`by`** (optional, self-reported, absent means unknown), with *"deliberately no user-vs-agent field, since the CLI is a shared surface and the actor isn't determinable"* — while this topic's decided text reads *"Attribution reads 'You' or 'Claude via MCP' in the same treatment"* and the carried-in editing-ux block reads *"each version reads as 'you' vs 'Claude via MCP'"*. Neither document cites the other on the point and the two cannot both be implemented: the row wants a per-version answer to *was this me, or an agent*; the record answers *which channel did the write arrive through*.

The reroute arrived before the thing it depended on was settled — storage-and-sync rerouted version-author display here as note-window's to design, and it was designed against the looser statement carried in from the editing-ux session, then never revisited once the mechanism was pinned. Three cases had no answer under the old text: a **human** typing `fumi append` (`via: cli`, `by` absent, either label wrong some of the time), an **agent** writing through the app surface, and any write where **`by` is absent**, which the model defines as unknown while the display offered no unknown state. Two adjacent sites inherit whatever this settles — the **conflict reconciler**, which reuses the panel wholesale, and the **device-name half** of its `"This Mac · 11:26"` label.

*From: search-and-retrieval · discussion · 2026-09-13*

search-and-retrieval decided that **version history is searchable behind an *include history* switch**, and — after working through what a result should look like — that **a history hit surfaces the note, never a version**. The first draft had the row read *"Q3 planning — 3 older versions match"* with click-through to the matching version, and it was dropped for a UX reason: a search term is often present in *every* version of a note, so a version-level result list produces forty rows for one note. The replacement carries an explicit hand-off into this topic:

> *"Finding which version holds the text is a step taken inside that note's own history, where a scan is cheap because it is one note."*

**The gap that hands over.** This topic's version panel is a scrollable list of timestamp-plus-author rows — described here as one that *"must hold a hundred versions"* — with selection previewing the historical content in the note. There is no find. So the user turns on *include history*, searches a paragraph they deleted last month, gets *Q3 planning · in history*, opens Version History, and meets a hundred timestamps with no way to locate the paragraph except selecting each row and reading. Rejecting *note-scoped find only* as the **whole** answer to history search did not create the note-scoped find; search-and-retrieval assumed it existed here and built the hand-off on it. What search needs is only that the step exists; the affordance is entirely this topic's to design.

### DECIDED — a version list panel beside the note

**🎨 Spiked** — *CANONICAL SPIKE — lifecycle states*. (The rejected scrubber variant was built, compared, and then deleted from the artboard — the reasoning is recorded below so it isn't relitigated.)

**Entry point:** **Version History…** in the corner menu (and the Note menu).

**The design problem is space.** A note is ~300px; a version browser normally wants a list *and* a content pane. The resolution: **the note is its own preview pane, and only the list slides out.**

- A **panel slides out beside the note**, listing versions newest-first: timestamp, relative age, and **author**. Scrollable — it must hold a hundred versions.
- **A header bar carries the title and the primary action.** `Version History` with a clock glyph on the left; **Restore** as a filled primary button plus a close **✕** on the right. *Grounded in Refero research (Hashnode Revision History, InVision, Vimeo, Editor X): the primary action consistently sits in the header, never stranded at the foot of the list. An earlier version had Restore at the bottom next to the retention line, where it read as a footnote.*
- **The live version wears a `CURRENT` badge**, right-aligned and **top-aligned to the timestamp line** (Vimeo's pattern, repositioned). Stronger than a plain "Current / now" row: it makes the anchor point obvious at a glance.
- **Each row is timestamp + author only — no relative-age column.** An earlier version carried both an absolute timestamp *and* a relative age ("Today, 09:14" … "2h"), which says the same thing twice. Dropping it gives the row a clean split: **left for content, right for status.**
- **Selecting a version previews it in the note itself**, which wears an unmistakable **"Previewing · {age}"** banner so it can't be confused with the live note.
- **Restore** acts on the previewed version. **Done / close** returns to current, unchanged.
- **Retention is stated in the panel footer** — the current setting left, **"Change…" pushed to the right edge**, opening the manager's settings. Stating the limit without a way to alter it is a dead end.

  **⚠️ This link exposes a destructive action** (resolves review-005 F13). Shrinking retention permanently destroys snapshots, and we've adopted *"reversible → no prompt; irreversible → confirm"*. Two consequences were **rerouted to their owners**: the **confirm naming the cost** ("47 versions across 12 fumis") → **management-window**, which owns the settings surface; and **default Forever + a lazy purge with an eligibility clock** → **storage-and-sync**, which owns the retention model. *Reasoning behind the default change: snapshots are markdown only and negligible in size — assets are the real cost, so retention is asset garbage collection rather than history policy, and losing history by default is the wrong trade.* The footer copy here should reflect whatever default lands.
- **Separators are inset, never full-bleed** — including under the header. *(An earlier full-width header border contradicted the rule already recorded for the corner-menu popover; caught by the user.)* Native nuance for the build: macOS panels typically reveal the header separator **only once content scrolls beneath it** — since this list scrolls, that's the real behaviour; the static mock simply shows it present.

### DECIDED — what works in a non-live state (preview, deleted)

**The governing principle: reading actions stay live; editing actions don't.** Applies to both states the note surface can enter — *previewing a version* and *in Recently Deleted* (resolves review-005 F5, F7).

**Still works** — scrolling; **Quick Look** on an attachment chip (Space); **opening** an attachment in its native app (double-click); following an **external link**; viewing source via *Edit as Markdown* (read-only in these states); **Version History** itself.

**Blocked** — typing; **checkbox toggling** (a buffer mutation like any other); drop and paste; click-into-a-block editing; the formatting menu; the two-step block delete. Blocked input **pulses the state's primary action** rather than doing nothing — the precedent set for the deleted banner, now applied to preview too.

**Snapshots are immutable.** They are never edited and **never autosaved into**. Preview loads historical content into the buffer for *display only* — **autosave does not run against it**, so the live note is never overwritten by something you were merely looking at. This resolves the invariant clash: autosave is always-on, but preview temporarily makes the buffer *not the note*, and autosave knows it.

**Restore is forward-only, always.**
- The snapshot's content **becomes the current content**; the snapshot itself is untouched.
- The **pre-restore state is snapshotted first** (per storage), so the restore is itself reversible.
- **Restoring never truncates or rewrites what came after it.** History only ever grows — a restore **appends a new version at the head**.
- **Two identical versions in the list is expected and fine.** That's simply what an append-only history looks like when you go back to an earlier state.

### DECIDED — Restore takes geometry as well as content

Resolves review-005 F12. Preview animates the note to the version's recorded size, but Restore was defined as replacing *content* only — which would make the note **snap back** to its current size the instant you commit, immediately after you'd been looking at it correctly sized.

**Restore therefore takes geometry too.** You've been previewing at that size; committing keeps what you were looking at. Anything else is a jarring snap at the moment of confirmation.

~~**Two clamps apply, not one:**~~
1. ~~**The current display** — a geometry captured on a larger screen is bounded to what fits.~~
2. ~~**The decided minimum window size** — chrome band + one line, ~180–200px wide. A snapshot from a very small note still respects that floor.~~

**Superseded 2026-08-06 — see *what Restore writes*, below.** The two were listed as one kind of thing; they are not, and reading them as symmetric makes Restore write a display fit.

#### Amendment — what Restore writes: the authored size, floored, never fitted (2026-08-06, resolves review-008 F8)

The clause above says a geometry captured on a larger screen is *"bounded to what fits"* on commit. Read as a rule about the **written value** it collides with two things settled since: snapshots record the **authored** size and never the resolved rect, and a display fit **is never written back**. Restoring a Studio-captured 1440 while sitting at the laptop would write 900 into a synced field, leaving the note laptop-shaped on the Studio forever — the two-Mac ratchet, arriving through a third door.

> **Restore writes the snapshot's authored `size` (and `preset_id`), floored at the minimum window size. The display fit applies afterwards, as it does to any note, and is never written.**

**The snap the original decision feared does not fire**, because the fit produces the same picture on both sides of the write:

```
Previewing on the laptop    snapshot size 1440 → fitted → shows 900
Commit                      writes size = 1440
After restore               1440 → fitted → shows 900
```

The snap that decision actually prevented was a different one — preview showing the version's size and then reverting to the note's *current* size on commit — and it stays prevented. *Which* number is written was never what caused it.

**The two clamps are asymmetric, which is why listing them together caused this.** Adopted from note-model rather than re-derived:

| | Kind | Written? |
|---|---|---|
| **Maximum** (the current display) | machine-specific — 2560pt is invalid on a laptop and fine on a Studio, so the value is right somewhere else | **never** — a display-time fit |
| **Minimum** (chrome band + one line, ~240pt) | identical on every Mac — a sub-minimum size is not "invalid here", it is invalid **everywhere, forever** | **yes** — a floor validated wherever `size` is written |

note-model names restoring from a snapshot predating the floor as one of the writes that floor guards, alongside a preset whose captured size is below it and an agent write. A manual resize cannot produce one, because the drag is already clamped.

**One rule now covers preview, restore and ordinary display:** re-resolve a bound share, take the authored value otherwise, fit for display, write nothing but a deliberate act.

**Sibling check: note-model — its decided text holds the maximum as a display-time fit that is never written and the minimum as a floor enforced wherever `size` is written, and that restore writes the restored `size` and `preset_id` to the Note tier as a deliberate act. Both are adopted; this topic decides only that Restore takes the authored value rather than the fitted one.**

**Dependencies — recorded as current intent, not settled fact.** This rests on two reroutes that have not yet landed:
- *"Snapshots record note geometry"* → **storage-and-sync**
- *"Is live note size intrinsic or machine-local?"* → **note-model**

**Current intent (user):** geometry is **syncable** — i.e. size is intrinsic and travels with the note. That is the direction note-model is expected to take. If either topic decides otherwise — particularly if size lands as machine-local, which would make a snapshot's recorded geometry meaningless on a different Mac — **this decision, the preview animation, and part of the scrubber-rejection reasoning all need revisiting**, and triage will reopen this topic to do so.

#### Amendment — the dependency discharged; preview animates size and never position (2026-08-06)

*From: note-model · discussion · 2026-07-30*

**The escape clause above does not fire.** Both reroutes landed the way this decision assumed: note-model ruled `size` (authored, absolute points) and `preset_id` **intrinsic and synced**, and storage-and-sync ratified snapshots recording them. So *Restore takes geometry as well as content*, the preview animation, and the scrubber-rejection reasoning all **stand unchanged** — this block records what the ruling adds, not a revision of it.

**A snapshot records `preset_id` alongside `size`.** A version is a historical state of the note, and the binding is part of that state's geometry *intent*. It degrades with no new machinery: restore a `preset_id` whose preset has since been deleted and it hits the existing fallback — the binding dangles, the recorded `size` renders.

**Snapshots record the *authored* size, never the resolved rect.** A resolved rect is machine-specific and would make history meaningless on a second Mac. This decision's own wording already assumed it — *"animates the note to that version's recorded size, **clamped to the current display**"* is a recorded value with a display-time fit.

**Preview animates size. It never moves the note.**

The size animation exists so a version's content is shown at the shape it was written in — a version written long, then trimmed with the note shrunk to suit, would otherwise render as a wall of text crammed into a small note. Position carries no such argument, and a note skating around the desk as you arrow down the version list would be absurd. *(This sits between the two neighbours rather than beside either: the **conflict reconciler** holds the frame completely still, because there you are reading two texts against each other and any movement defeats the comparison; version preview is not a comparison, so size may move and position may not.)*

**Where a snapshot carries a binding, preview re-resolves it against the current display** rather than animating to the recorded number — and only the **Size** axis, since position doesn't animate.

The recorded number is right for the screen it was captured on and wrong everywhere else, which makes the preview lie about what committing produces. Worked: Friday, on a 27" Studio, the note is bound to a **half-height** preset; full height is 1440, so the snapshot records **720**. Sunday, on a ~900pt laptop, you preview Friday.

| | What preview shows | What Restore then produces |
|---|---|---|
| **Recorded number** | 720 — fits, no clamp, so a note filling **80%** of the laptop screen | re-binds and re-resolves to **450** — snaps at the moment of commit |
| **Re-resolve the binding** | **450** — half the screen, which is what the preset means | 450 — identical |

Preview exists to show what committing produces, so the second is forced rather than chosen. An **unbound** snapshot has only its recorded number, which stands as written, fitted to the display if it doesn't fit.

**Preview writes nothing.** Only committing a restore writes, and it writes `size` and `preset_id` to the note's intrinsic state as a deliberate act — after which the binding is honoured in full, so the note may move at that point even though the preview never did.

**Sibling check: note-model — its decided text holds that a snapshot records `preset_id` alongside `size`, that the recorded value is the authored size rather than the resolved rect, and that restore writes both back to the Note tier while preview writes nothing. This topic adopts those rulings; what is decided here is the preview behaviour they imply — size-only animation and re-resolution of a bound snapshot's Size axis.**

### DECIDED — panel placement and lifecycle

Resolves review-005 F11. "Slides out beside the note" left the mechanics open; the corner-menu popover got a full anchor treatment and this needs the same.

- **Opens on the right by default, flips left when there isn't room** — a screen edge or a second display. Same anchoring discipline as the corner menu.
- **It tracks the note.** As an accessory it stays attached: drag the note and the panel follows; resize the note and it stays beside it. That is what "beside the note" has to mean given notes move.
- **Panel height is independent of the note's.** It's a list with its own scroll — a note at the ~240pt minimum does not get a 240pt panel. It sizes to content up to a sensible maximum.
- **One panel at a time, app-wide.** Opening history on another note closes the first. Two live version browsers is a state nobody wants, and it removes a class of edge cases.
- **Closes when the window goes:** the ✕, **Esc**, **⌘W**, hiding the note, or a delete that *removes* the window. **Not on focus loss** — it takes no focus, so focus loss isn't meaningful for it.

#### Amendment — a delete that keeps the window keeps the panel (2026-08-10, resolves review-009 F11)

~~The bullet above read *"...hiding the note, or **deleting it**"*.~~ That was written when every delete removed the window, so *"deleting it"* was shorthand for *"the window goes"* rather than a claim about the act. **The delete-origin split broke the shorthand:** a delete arriving from an agent `rm` or by sync from another Mac leaves the window on screen and *"transitions to the deleted state — banner, read-only, **Put Back**"*.

Read literally against that, the bullet contradicts *what works in a non-live state*, which holds Version History to be a **reading** action and therefore live on a deleted note — and draws the stacked case explicitly: *"a deleted note being previewed at an old version shows the 'In Recently Deleted' state banner and the 'Previewing · {age}' banner."*

> **A delete that keeps the window keeps the panel. The trigger is the window's removal, not the delete.**

Three things point the same way. The **stacked state is already designed**, and closing would make it reachable only by opening history *after* a delete, never by being in it when one lands — a distinction with nothing behind it. Closing is a **surface vanishing with no action of the user's**, which is the shape the hard-delete gate exists to make unreachable. And the case for closing — that it makes the state change legible — is the banner's job, already done.

**Restore goes disabled, not hidden.** The panel's own precedent decides it: Restore is *disabled* on the `CURRENT` row because *"a disabled control still asserts the action is possible here, just not now"*, which is exactly the deleted note's situation — restoring a version is a real act, gated behind Put Back rather than unavailable in kind. Clicking it **pulses Put Back**, per the blocked-input rule. This is deliberately the opposite treatment from the formatting band, which *hides* in read-only states: there the whole category of action is unavailable and five greyed icons would read as broken, where here one specific action is merely gated.

**On the note resizing beneath it:** preview animates the note's geometry, which moves the panel. Unlike the rejected scrubber this is fine, and the distinction is the same one that killed the scrubber — **the panel sits beside the note rather than inside it, and its controls are not a precision drag target.** You click a row; you are never mid-gesture when the geometry changes.

### DECIDED — sparse and boundary states for the panel

Resolves review-005 F10. The panel was designed for the dense case; these are the reachable thin ones.

- **Restore is disabled when the selection is `CURRENT`.** There is nothing to restore to, and restoring current-onto-current would append a duplicate snapshot for no reason. Since `CURRENT` is the default selection on open, the header's primary button starts disabled — which also covers the empty-history case, where `CURRENT` is all there is.
- **No snapshots yet** (a brand-new note) → show the `CURRENT` row plus a quiet line: *"Earlier versions will appear here as you edit."* Explains the emptiness rather than presenting an empty box.
- **Retention set to `Off`** (a valid storage setting) → the footer reads *"Not keeping version history · Change…"*, and the body says history is off, carrying the same link. **The link stays** — turning it back on is precisely what someone in this state would want.
- **A single prior version** — no minimum; the panel works with one row.
- **A row expiring at the retention boundary while it is selected and previewing** → **leave the preview alone**. The content is already loaded and harmless; drop the row from the list and note it on close. *The alternative — exiting preview the instant the row expires — is more literally correct but yanks content away mid-read.*

### DECIDED — the panel carries a find over that note's own history (2026-09-14)

**The scenario the panel could not serve.** You deleted a paragraph from *Q3 planning* last month, search for it with *include history* on, get one row — *Q3 planning · in history* — open the note, open Version History, and meet a hundred timestamps. Selecting each row and reading is the only route to the paragraph.

> **A find in the panel filters the row list to the versions containing the text, and highlights the matches in the preview when a row is selected.**

**It is a third corpus mode of the one search facility, not local matching.** search-and-retrieval decided one facility with one tokeniser precisely so surfaces do not drift apart on accents and case, and this topic's link picker is already a mode of it — adopted there as *"this facility's title mode"*. What varies between modes is the corpus, never how a query is read: main search over everything, the picker over derived titles, this over one note's snapshots. Same forgiving normalisation, same last-token-as-prefix behaviour, same `"quoted phrase"` exception. Growing a private substring match here is the exact failure the one-facility decision exists to prevent.

**Journey — the filtered-index route was proposed first, by the user, and it is the obvious one.** *"We don't have to build a whole new search index. We just have to allow ourselves to search with filters"* — same facility, same query, scoped to one note and its history. It is the right instinct about the **facility**, which is why that half survives above, and it fails on the **corpus** for a reason that is not about size. Pressed further on whether a scan was acceptable at all — *"I don't want to do any type of brute forcing. We have a search index exactly for this reason"* — the answer turned out to be that the scan is not the compromise it sounds like, and that the index cannot do the job whatever we think of scanning. Both halves are below.

*A false step on the way, recorded because the correction is what made the answer solid: this session first called it a scan without establishing what it scans. That is the same move search-and-retrieval made — its framing assumed the capability — and it was only worth anything once storage-and-sync was actually read for where snapshots live and how big they are. The objection was right to be made; the answer needed the figures, not the assertion.*

**The corpus is scanned, not queried — forced, not chosen.** The global history index holds the **union of distinct blocks** a note has ever contained, deduplicated, and search-and-retrieval removed version provenance from it deliberately: *"A count of matching versions, and navigation from a hit to the version holding it, both require knowing which snapshots each indexed block came from. Deduplicated text does not carry that."* So filtering that index to one note answers *does this note's history contain the word* — which the global result row already said — and cannot answer *which version*. The structural gap is why the step was delegated here in the first place, which means the index cannot be the thing that closes it.

**A scan is cheap because of what a snapshot already is, not because the corpus is small.** storage-and-sync holds snapshots **local in the bundle** (`{ulid}.fumi/versions/…`), *"text snapshots are KB"*, and eager download is unqualified — *"all snapshot markdown and their assets download to every Mac — no lazy asset fetch, no 'downloading…' state to design."* Every version of every note is on every Mac already. Their own measurement puts a daily-worked note at **~200 snapshots a year** (the pessimistic read, since blur-settle collapses a session into one), and the CloudKit **750-child budget** caps a note at roughly four years of that before something else gives — so the corpus is a few megabytes of local text at its ceiling. **Read once when the panel opens, matched in memory as you type**: no per-keystroke I/O, no network. Reading snapshot files is routine in this design already — storage-and-sync's dirty predicate hashes the latest snapshot on *every write path*, having rejected a stored flag because *"the predicate cannot lie."*

*Confidence: the figures are storage-and-sync's and search-and-retrieval's, read rather than re-measured. It is not close enough to warrant measuring — what would make it close is a note's history running to thousands of snapshots or tens of megabytes, against KB-sized files under a 750 ceiling.*

**Not in tension with search-and-retrieval's rebuild cost, and the quantity is what separates them.** Their reason for giving the history index its own slower background job is that *"walking every snapshot on the same path would make an ordinary rule change an expensive foreground event"* — every snapshot of **every note**, on a derivation-rule change. This walks one note's versions, on demand, while its panel is open.

***Rejected: rerouting to reopen the dedup decision.*** Version-level provenance in the global index was not removed on cost — it was removed because a search term is usually present in *every* version, so a version-level result list is forty rows for one note. That UX call is about the **global result row** and stands; restoring provenance would relitigate it while giving this panel nothing a scan does not already give it. Nothing is owed back either way — search-and-retrieval's concern asked to be told only if this topic concluded the panel should *not* carry a find, and its own framing already assumed this shape: *"a find-within-history covers it by scanning that one note's snapshots on demand, no index at all."*

**The find field opens empty, and does not inherit the term that brought you here.** *(Settled by derivation — put to the user twice alongside the alternative and not contested.)* Pre-filling would close the loop from a global search hit with no retyping, and the route to this panel is two deliberate steps — open the note, corner menu, *Version History* — by which point the user may be doing something else entirely. A panel showing three of a hundred rows because of a field nobody was looking at is a version list lying about how much history exists, and the tell is off-screen. Retyping a word is seconds; a silently filtered history is the kind of error that costs an hour once.

**It ships whether or not global history search does.** search-and-retrieval named history search *"the first thing to drop if v1 needs scope back"*. Because this is a scan of files that are local regardless, it is untouched by that decision — and if history search does drop, this becomes the only way to find text in history at all, which makes it more load-bearing rather than less.

*Sibling check: search-and-retrieval — its decided text holds one search facility with one tokeniser and two normalisations, the history corpus as deduplicated distinct blocks carrying no version provenance, a history hit surfacing the note rather than a version, and the find-within-history step delegated here. All adopted as written; this decides only the affordance it delegated, and takes the scan its own framing assumed. storage-and-sync — its decided text holds snapshots as append-only immutable markdown local in the bundle's `versions/`, downloaded eagerly to every Mac with no lazy fetch, and the dirty predicate reading the latest snapshot on every write path. Relied on, none revised.*

### Refinement (from the conflict spike, 2026-07-28) — the displayed row is always highlighted

**Exactly one row is highlighted at all times**, because the note is always displaying exactly one version — **including the `CURRENT` row** when the note is showing current, rather than opening with nothing selected. Blue means *"this is what you are looking at"*; the `CURRENT` badge separately means *"this is the note's live content"*. Two facts, two marks, no clash — the badge inverts to a light treatment when it lands on the blue row.

### DECIDED — the panel is an accessory; the list is current when it opens

Resolves review-005 F9 — the concern that opening version history could itself trigger a snapshot and insert a row into the list you're reading.

**It can't, because the snapshot has already landed.** Opening the panel takes two clicks: the `•••`, then *Version History*. **Clicking the `•••` is the editing-session boundary**, so the on-blur snapshot fires *there* — before the menu even opens. By the time the panel appears, **the list is already current**. No row inserts itself mid-read.

**The panel is an accessory, not a window** — it takes no key focus, doesn't join **⌘\`** note cycling, and the note **stays focused and stays *looking* focused** (~~three-state chrome unchanged~~ its focused chrome unchanged) for as long as the panel is open. *(Amended 2026-09-01, resolves review-010 F1 — there is no three-state model left to be unchanged: *chrome appears on focus OR hover* struck the strength tiers outright — "the **strength tiers** are gone"; "What genuinely dies is only the three-tier *strength* model." The claim this bullet is making survives exactly as it was: the panel takes no focus, so the note's chrome does not change while it is open.)* Selecting a version doesn't move focus. Same behaviour as the corner-menu popover.

**The idle timer still applies** if the panel is left open on a focused note with unsaved changes: a snapshot fires and appears at the top. That's correct rather than a glitch — and the arrival animation decided above makes it legible.

### DECIDED — an agent write arriving while you're previewing

Resolves review-005 F8. The scenario: you're previewing Friday's version, an agent writes to the live note, you press **Restore** — Friday's content becomes current, apparently discarding an agent edit that landed seconds ago and that you never saw.

**The reframe that settles it: because every change is snapshotted regardless of author, restore can never *lose* anything.** The agent's version remains in history whatever you do, and restore is forward-only, so it only ever appends. This is therefore **not a data-safety problem — it's an awareness problem**, and awareness is solved by visibility rather than by blocking.

- **The write applies to the live note underneath, as normal.** Agents are never locked out — unchanged.
- **The new version appears in the list**, which is live. Hiding it would be strictly worse.
- **The shimmer still fires.** It means "an agent is working on this note", which is true regardless of what you're currently looking at.
- **Arrival is made visible:** a new version animates in at the top of the list with a brief emphasis as it lands, and while previewing, a quiet line notes that newer versions have arrived since you opened — a backstop for when the list is scrolled away from the top. Restore is then never a *silent* discard; you can see there's something you haven't looked at.
- **Restore is not blocked.** *(Considered and rejected: locking agent writes during preview — a heavy fix that breaks a settled decision to prevent a loss that cannot occur.)*

### DECIDED — the system accent colour, not ours

#### 2026-09-01 — revised

*Trigger: review finding — the accent is decided here and reopened under the Apple Notes screenshot pass ("a Fumi accent is an open question"), with nothing since closing it (review-010 F4).*

> **The question is closed. The accent stays the system's, and Fumi ships no accent of its own.**

**The argument that closes it was not on the table when the question was opened, and it is this document's own.** *"Reserved" means reserved slots, resolved per swatch* exists because no single tint reads on both **Paper** at 96% lightness and **Midnight** at 30% — a fixed signal colour is legible on Wash and fails on half the set. **A fixed Fumi accent is that same object.** To be safe it would have to resolve per swatch, at which point it is not an accent at all but another signal row — and an accent that changes with the swatch is not recognisable as *the* accent, which is the only job an accent has.

**Apple Notes is not the precedent it looked like.** Its gold is the notes-are-yellow identity surfacing in the chrome — a single brand hue they have and this product deliberately does not, being ten swatches wide by design. So the observation stands as an observation and stops being an argument: it shows an app with a brand hue using it, not a rule that apps should.

Trade-off accepted, unchanged from the entry below: the legibility guarantee stays forfeit, because the accent is the user's to set. The defences that already exist are what carry it — foreground derived from the accent's luminance, never a state resting on colour alone, the accent variants honoured.

*Sibling check: no overlap found. The accent, the swatch model and the reserved signal slots are all this topic's; `controlAccentColor` is a platform value no sibling document defines.*

#### 2026-07-27

Selected rows and primary buttons use the **macOS system accent colour** (`controlAccentColor` / SwiftUI `.tint`) — whatever the user has chosen in System Settings → Appearance. If their accent is pink, our selection and Restore go pink along with the rest of their Mac.

**The accent is NOT part of the reserved system-state colour space** (corrects an earlier claim; resolves review-005 F14). That space was reserved on the guarantee that **Fumi controls those colours**, so state signals stay legible under any swatch including the CVD palettes. `controlAccentColor` inverts that property — the *user* picks it in System Settings and we cannot design around it. The accent is simply *not ours*, and it carries no legibility guarantee.

**We use it anyway**, because inheriting the user's accent is the right thing for a Mac app — but the failures are handled defensively rather than assumed away:

- **Never pin a foreground colour against it.** The corner-menu hover row was pinned as "accent fill, **white** text"; that breaks on a light accent (yellow, or Graphite). **Derive the foreground from the accent's luminance** instead.
- **State must never rest on the accent alone.** Every state signal carries a non-colour cue as well — shape, position, or a border — so meaning survives an accent that collides with the note's own tint (system-accent pink on a blush note is the worst case: ring and button lose separation from the surface).
- **Honour the accent variants** — Graphite and Multicolour are real settings, alongside the Increase Contrast handling Colour already committed to.
- **CVD users** may run a carefully separated CVD swatch *and* a system accent that isn't part of that design. The non-colour cue above is what keeps that workable; the swatch model cannot cover the accent.

*Considered and rejected: using a Fumi-controlled state colour so the reserved-space guarantee genuinely holds. It would restore the guarantee but forfeit the native feel, which is the main reason to use the accent at all.*

**Applied consistently:** the **Put Back** button in the deleted-note banner uses the same accent-filled treatment as **Restore** in the version panel. They were briefly styled differently. **Rule: the surface's tint communicates *state* (e.g. the warm "In Recently Deleted" banner); the button communicates *action*, and primary actions look identical everywhere.** *(Amended 2026-08-06 — this read "the **Restore** button in the deleted-note banner… **they're the same action doing the same job**". Both halves were wrong under *how a deleted note reads*: the banner's verb is **Put Back**, and the two are deliberately **different** actions — one un-deletes the note, the other replaces its content. The styling rule is unaffected, and is in fact stronger stated this way: primary actions look identical because they are primary, not because they do the same thing.)*

**Rejected: a scrubber rail inside the note** (variant B) — a horizontal timeline with a draggable handle. Two decisive faults, both the user's:
1. **It fights the size-animation decision.** The scrubber lives *inside* the note, and the note **resizes as you scrub** (previewing each version at its recorded geometry) — so the control moves under your cursor mid-drag. The two features are incompatible; the panel isn't affected because it sits outside the note and isn't a precision target.
2. **It doesn't scale.** A hundred versions cannot fit a horizontal timeline; a list simply scrolls.

*(Also considered and rejected: a Time-Machine-style 3D stack — a full-screen takeover for a desk object; a separate history window — heavy and disconnected from the note. The chosen shape matches the dominant pattern in **Notion, Google Docs and Craft**; Apple Notes and Bear have no in-app version history, so there is no Apple-native precedent to copy — part of why storage called this the hard part.)*

**Refero research (10 screens reviewed; Hashnode, Vimeo, InVision, Editor X inspected).** The two-pane shape — version list one side, content the other, primary action in the header — is the consistent industry answer, and every reference shows **all authors in the same treatment** beneath the timestamp, independently supporting the decision below.

**Agent and human versions are styled identically.** ~~Attribution reads "You" or "Claude via MCP" in the same treatment.~~ An earlier variant gave agent versions their own colour and icon — **rejected**: it implies an agent edit is a suspect or special class of change. It isn't; it's just who made it. *(Amended 2026-08-22 — the struck clause named a two-way user-vs-agent label the attribution model does not carry. What the row renders is settled under* what the attribution row says*; the identical-treatment rule this paragraph exists for is unaffected, since it was always about treatment rather than the label.)*

**Geometry:** previewing a version animates the note to that version's recorded size (see the storage reroute), **clamped to the current display**. This is why the panel must sit outside the note.

Design the entry point + the scrub/browse/restore interaction.

### DECIDED — Version History when unentitled (resolves review-005 F20)

The free/paid boundary is **parked with commercialization**; the *presentation* is note-window's regardless of where that boundary lands.

**The corner-menu row is shown and enabled, and opens the panel.** Not hidden — nobody upgrades for a feature they do not know exists. Not disabled — that is the worst of both, visible and unexplained and dead, in a menu where every other row does something.

**Snapshots are always captured, entitled or not.** This is the load-bearing decision; the other two follow from it.

- Gating *capture* means upgrading hands you an **empty history**, and the feature only becomes useful weeks later.
- Worse: someone loses work, upgrades **in order to recover it**, and finds nothing was ever recorded. That is a refund, not a sale.
- The mechanism runs anyway; the only cost is disk — and ~~since **everything syncs locally between the user's own Macs with no hosted service**,~~ that disk is the user's own, not ours. *(Amended 2026-09-01, resolves review-010 F1 — the struck reason is false: storage-and-sync made **CloudKit** the transport, which this document relies on elsewhere ("content arriving via CloudKit from another Mac"). The conclusion is unaffected and in fact needs no repair — snapshots land in the user's own iCloud storage and on their own disks, so the cost of always-capture still falls on them rather than on us. Only the no-hosted-service framing goes, which positioning-and-audience was separately told not to claim.)*

**The panel shows the real list — with preview and Restore gated.** Actual timestamps, actual attribution. You can see that Tuesday morning's version exists; *acting* on it is what you are paying for. An empty state or a marketing panel would be neither honest nor concrete, and this makes the upsell **self-evident** — the value is visible rather than described, so it needs no persuading copy.

**The retention footer's "Change…" stays live**, still linking to the manager. Retention governs what is being captured **right now**, which is real whether or not you are entitled. What is gated is preview and Restore, not the setting.

*Parked dependency: **commercialization** may revisit always-capture — retention for a non-paying user has a storage cost, even on their own disk, and a shorter free-tier window is that topic's call. Our side works the same either way, since the panel shows whatever was captured. Reopen from commercialization via triage if it changes.*

### DECIDED — what the attribution row says (2026-08-22)

The row is built from the two fields the record actually holds, and says the most true thing each one supports.

**A false path worth keeping, because the correction is the decision's foundation.** The fork was first put as *pure channel* versus *actor where knowable*, with the second resting on a claim that `app` **is** determinable — the note window being a keyboard surface with no programmatic door. **The user knocked that out immediately: an agent can drive the GUI itself through computer use.** So no channel proves an actor, and the choice stopped being *can we know* and became *what posture do we take when we can't* — which is where "best effort" came from, and why it is written down as a limit rather than papered over.

**A near-miss on the record, worth naming because a reader will hit it too.** The question came up whether `via` had been dropped. It has not: what was dropped is its **SQLite projection** — storage-and-sync decided on 2026-08-02 that `lastVia`/`lastBy` are deliberately not projected, since *"the scrubber displays attribution from version child records, not from the note."* The fields are in `meta.json`'s full v1 set and on the CKRecord, and engine-architecture gave `via` more machinery afterwards, not less — derived engine-side from the connecting peer's PID and never sent on the wire. Reading the SQLite schema alone makes the field look absent.

**The shared-surface argument applies to one channel of three, not all three.** That is what the old text got wrong — it generalised `cli`'s ambiguity across the whole enum.

| `via` | Who could be behind it | What the row can say |
|---|---|---|
| `app` | you at the keyboard — or an agent driving the GUI through accessibility | **You** |
| `mcp` | an agent; a human hand-crafting MCP frames is not a case | **an agent**, named when `by` is set |
| `cli` | genuinely either — the shared surface storage-and-sync's argument is about | **neither** |

**Best effort is the posture, and it is already this design's posture.** The computer-use hole under `app` is real and is **named rather than designed around**, on the precedent storage-and-sync set for the other advisory half of the pair: *"`by` is advisory provenance, not authenticated identity — a client claims it and we believe it. That is correct for a single-user local tool with no threat model, but it must be written down so nothing later is built to trust it."* The same sentence now covers `app` → **You**. Nothing may be built to trust either.

**The row:**

- **`via: app` → "You".** `by` never shows here — it is a CLI flag / MCP field the GUI never sets. Still "You" when the write came from the app on your other Mac: this is not a multi-user distinction, the same axis the delete-origin split uses.
- **`via: mcp` → "Claude via MCP"** with `by`, **"Via MCP"** without.
- **`via: cli` → "Claude via CLI"** with `by`; bare, **"Command line"**.
- **`via` absent → "Unknown"** — a real designed row, not an omission. Reachable for a snapshot predating the fields, where storage-and-sync holds `via` *"falls back to the absent-means-unknown honesty `by` already has — never fabricated."*

```
Today, 09:14                  CURRENT
You

Today, 09:02
Claude via MCP

Yesterday, 17:40
Command line

12 Aug, 11:26
Unknown
```

**"Command line" is deliberately inert** — it reports the door and leaves the actor to the reader. *Rejected: spelling the ambiguity out (`"Command line · you or an agent"`)* — truthful, clumsy, and repeated on every such row. The accepted cost is that it can read as a denial when it sits next to a row saying "You"; it is an absence of knowledge, not a claim of authorship elsewhere.

*Rejected: pure channel throughout (`Fumi` / `CLI` / `MCP`).* Consistent and never wrong, but it discards two facts the record does support and makes every row read like plumbing.

**The topic's equality principle is untouched.** *"Agent and human versions are styled identically"* was always about treatment rather than the label, and refusing to assert an actor the system cannot know is more consistent with it than a confident guess would be.

**Sibling check: storage-and-sync — its decided text holds `via` as `app`/`cli`/`mcp` derived from the connection and unspoofable, `by` as optional and self-reported with absent meaning unknown, no `user | agent` field because the actor is not determinable, and `via` absent rather than fabricated where genuinely unknowable. All four are adopted as written; this topic decides only what the row renders from them, which that decision explicitly leaves here — *"any 'by me / by Claude' framing is a **display** decision built from the two, and display is note-window's."* engine-architecture's derivation ruling is consistent and adds one case: an unrecognised peer resolves to `cli`, so a user's own script lands in the ambiguous row, which is the right home for it.**

### Carried in (from the editing-ux session, 2026-07-26) — author attribution

~~**Versions are tagged with who changed them** — the user, or an agent (by client: MCP / CLI, ideally which agent). **note-window owns displaying that** in the history scrubber: each version reads as "you" vs "Claude via MCP", so it's clear who changed what and what to revert.~~

*(Superseded 2026-08-22 — kept for provenance. This was the loose statement of the mechanism the panel was designed against; storage-and-sync pinned it afterwards to `via` + `by` with no user-vs-agent field. The ownership half stands — displaying attribution is still note-window's — and what the row renders is settled under* what the attribution row says*.)*

Consistent with discovery's rejection of a persistent "Written by Claude" byline *on the note surface* — attribution belongs in the **version record**, not as note chrome.

*The mechanism (agent-write cadence trigger + the author field on the snapshot model) was **rerouted to storage-and-sync**, whose cadence — "focused-but-idle or on blur" — assumed a human typist and so **missed agent writes to an unfocused note** entirely.*

---

## Spike Backlog

**Five entries outstanding.** *(Amended 2026-09-22 — two were added and both landed the same day, on board `05`: the retired eighth cell's removal, and the `Save as Preset` surface, which resolved to a single list row after four drawn shapes were rejected. Amended 2026-09-14 — a fifth was added with the version panel's find. Amended 2026-09-01 — a fourth was added with the table's structure-editing controls. Amended 2026-08-06 — this read "**Empty.** Every board the discussion called for is drawn." That became false the same day: *Asset Reference States* pins a four-cell visual treatment carrying no **🎨 Spiked** marker, and this document's own hygiene rule — "when a treatment changes, roll it back across every artboard and pin the value here in the same pass" — makes it owed. Amended again 2026-08-10 — that entry halved and a second was added. Amended 2026-08-22 — a third was added with the reconciler's device label.)*

| Board | Outstanding |
|---|---|
| `03 — Content & Inline Rendering (Bulletin)` | The **two asset-reference cells**: chip and inline image, both **missing**. Board `03`'s remit already covers "attachment-chip states", so this is that board's content rather than a new board. The other three blocks folded in on 2026-08-06 are behavioural and add no drawn state. *(Halved 2026-08-10 — this read **four cells**, chip and image × excluded and missing; the excluded column retired with the state, so the board never has to draw it.)* |
| `01 — Surface & Chrome` | The **drop-target states**: accept (highlight plus tracking caret) and **refuse** (reserved-space treatment, no caret), side by side. Added 2026-08-10 with the refused-file decision. Neither had ever been drawn, and the refusal is only meaningful against the accept state it inverts — one frame pair, not a board. The notification carries no drawn design. |
| `08 — Conflict Reconciler` | The **row's device label**: resolved ComputerNames on both rows in place of the drawn `"This Mac"` / `"MacBook Pro"`, plus the **"Another Mac"** fallback row. Added 2026-08-22 with the device-label decision. A row-content change to a board that exists, not a new board — but the fallback is a state it has never shown, and the drawn placeholder is the text that made the ungrounded label look settled. *(Amended 2026-09-14 — this read "Board `07` needs no pass: the attribution row's wording changed, and its rows are already drawn." True of the attribution row and no longer true of the board, which now owes the find; see its own entry below.)* |
| `07 — Version History` | The **find**: the field in the panel header, the row list filtered to matching versions, and a match highlighted in the preview. Added 2026-09-14 with *the panel carries a find*. A never-drawn affordance on a board that draws the panel fully without it, and the filtered list is the state that has to prove it still reads as a version list rather than as a short one — the whole reason the field opens empty. The empty-field resting state is the board's existing frame. |
| `03 — Content & Inline Rendering (Bulletin)` | The table's **structure-editing controls**: the `+` affordances at the trailing edges, drawn in the focused-and-hovered state they appear in, against the table the board already carries. Added 2026-09-01 with *table insertion and structure editing*. A never-drawn interaction on a construct the board renders fully at rest, so the `+` is only meaningful beside it — a state on an existing frame, not a new board. The `Format ▸ Table ▸` deletes carry no drawn design. |

| Board | Landed |
|---|---|
| ~~`05 — Corner Menu` · the retired eighth cell~~ | ✅ 2026-09-22 — swatch submenu frame deleted, the strip redrawn at seven chips on all four menu instances, `New Preset from This Note…` relabelled `Save as Preset…` |
| ~~`05 — Corner Menu` · the `Save as Preset` surface~~ | ✅ 2026-09-22 — four shapes drawn and all four deleted, along with the frame built to compare them: a save puts nothing on the note, so the only thing to draw is a derived-name row, which goes in the `Move to ▸` list the board already shows. The corner menu's own anchoring was corrected in the same pass; the findings are under *Preset Authoring* |
| ~~`02 — Colour & Material`~~ | ✅ 2026-07-29 |
| ~~`10 — Agent Activity`~~ | ✅ 2026-07-29 |
| ~~Formatting surface directions~~ | ✅ normalised into `01` + `05`, 2026-07-29 |
| ~~`Format ▸` · `Move to ▸` redrawn · `Move to Display ▸`~~ | ✅ `05 — Corner Menu`, 2026-07-29 |
| ~~Note-link pill, peek, deleted-target states, link editor~~ | ✅ `09 — Note Links`, 2026-07-28/29 |
| ~~Conflict affordance + reconciler~~ | ✅ `08 — Conflict Reconciler`, 2026-07-28 |

**A retracted claim, kept because it was wrong in an instructive way.** The shimmer, the recency tint and the substrate-relative treatments were first ruled **not spikeable** — motion and material, where a static mock produces a picture we'd have to distrust. **The user overruled it, and was right:** a static board still fixes **colour, intensity and placement** at a single moment, which is most of the argument. Drawing them proved the point twice over — the first shimmer attempt was a full-bleed colour wash that the note's own backdrop-filter absorbed, and correcting it to a **stroked edge** is a real finding a written description would never have produced.

**What stays an implementation checkpoint** (not a board's failure, a board's limit): the shimmer's *travel*, the tint's *decay*, and the true Liquid Glass material — including that Paper cannot composite a backdrop blur over sibling layers, so panel translucency on the boards is indicative only.

---

## Summary

### Key Insights

1. **Concealment is a policy, not an architecture.** One Markdown-buffer engine yields marker-free, reveal-on-cursor and raw-source behaviour from one code path — which dissolved a fork that looked structural.
2. **What *triggers* a snapshot and what a snapshot *records* are different things.** Separating them let geometry ride on version history without filling history with resize noise.
3. **The interaction layer can behave like Model A while the storage layer stays Model B.** Treating concealed markers as an implementation detail of range formatting gives Apple Notes' feel *and* lossless agent round-tripping — the outcome both perspective lenses were reaching for from opposite ends.
4. **A changed premise justifies revising a decision; disagreement doesn't.** Delete lost its confirm because soft-delete had become reversible underneath the original call — not because the call was wrong when made.
5. **Spikes earn their keep by failing.** The alpha-mask fade, the beak construction rules, the flat-white chip, Restore-at-the-foot-of-the-list and the scrubber rail were all corrected by building them, not by reasoning about them.
6. **Precedent beats judgement on convention.** Refero research moved the primary action into the panel header and added the `CURRENT` badge; the user's live Apple Notes test killed the delete confirm outright.
7. **The right axis to split on is rarely the one the concern arrived on.** Agent activity and sync arrival looked like *agent vs sync*; they are actually *live vs missed*, and once split that way one mechanism covers both. Equality was achieved by writing a rule that never names the actor.
8. **Reusing a rule is not the same as reusing its reason — and this caught us twice.** "Clicking a tag scatters windows across Spaces" looked like it applied to note links, but the actual objection was *fan-out*: a hundred targets, not one. Then *Restore is disabled on CURRENT* was carried into the reconciler, where keeping the local version is a real resolution rather than a no-op — disabling it would have made "mine wins" unreachable. Check what a precedent was arguing against, not what it concluded.
9. **A signal that requires an action is the wrong signal.** The banner died not on aesthetics but on arithmetic — dismissing it for every agent write is as absurd as dismissing one for every keystroke of your own. Marking the change instead of announcing it removed the action entirely.
10. **An accessibility palette is *used*, not adapted.** Okabe–Ito was twice broken by improving it — first invented from scratch, then lightened into pastels to match the house style. Its validity *is* those exact values, so any adjustment voids it. And a corollary that cost several rounds: **"it looks good to me, so it must be wrong" can never converge** — a CVD-safe set is *supposed* to look fine to normal colour vision, so that heuristic rejects every correct answer. Validation is by simulation, not impression.
11. **"Reserved" should mean ownership of a *slot*, not a fixed value.** A single conflict tint cannot read on both Paper (96% lightness) and Midnight (30%). Once state signals became slots each swatch resolves for itself, the guarantee they were reserved *for* — stay distinct, stay legible — was delivered better than a pinned colour ever delivered it. The roles pattern, applied one level up.
12. **Stored intent and resolved presentation are different things, and conflating them loses data.** *A home is intent; where a note sits is resolution; fallbacks resolve but never rewrite.* That one line dissolved the whole display-disconnect problem — a topology change stops being a re-home, so a fortnight on the laptop cannot strand every note there. The same shape as role-versus-swatch, and as normalised opacity over a per-swatch range.
13. **An unknown fact is not an undecidable design — and neither is an excuse for not looking it up.** The display/Space question was deferred twice: once as "we can't decide without the fact", once by routing it away. Both were wrong. The design could be made **independent** of the fact (the resolution ladder), *and* the fact was documented and findable in minutes with tools available the whole time. **The user had to push three times.** Check whether a decision actually depends on the unknown, then go and look.
14. **An upstream ruling can delete a design instead of answering it.** We sent note-model a requirement — *a pasted reference to an excluded asset must read `excluded`, never `missing`* — and got back a hard size limit that removed the state entirely. Both absent-asset states, their four-cell treatment, the two-Mac metadata line and the deferred-minting mechanism retired together, and the requirement is satisfied because nothing can reach the case. Worth naming because the instinct on receiving a hard question is to design harder at it: check first whether the state has to exist.
15. **The accept case and the refuse case want opposite things.** The drop overlay was rejected by name because accept needs precision — *where does this land* — which is what the tracking caret provides. A refusal has no landing point, so the whole-note treatment that was wrong for accept is exactly right for refuse. A rejected shape is rejected for a reason, and the reason is what tells you whether it also applies next door.
16. **A definition leaks into artefacts.** Writing *"Neutral means no hue at all"* became a literal `chroma 0`, and five swatches shipped identical greys where each should have carried its own quiet character. Loose prose in a decision does not stay prose.
17. **An argument's scope is narrower than the enum it was stated over.** *"The actor isn't determinable"* was true of `cli` and got applied to all three channels, deleting a label the record could support. Checking the claim per value rather than per field recovered two of the three — and the same move exposed the remaining assumption, that `app` proves a human, which computer use dismantles. A general claim about a set is worth re-testing against each member; the ones that survive are usually fewer, and the ones that don't are usually where the design was.
18. **A rejected option can survive as the fallback of the one that beat it.** "This Mac / Another Mac" lost to real device names, then became the state real names degrade to — which is what let the decision land ahead of the two storage fields it depends on. An alternative worth arguing for is usually worth keeping as the answer for when the winner can't run.
19. **A guard attached to one branch is a guard the other branches don't have.** The home ladder clamped at rung 3 only, so the rung that carries the ordinary case — a Space UUID that still resolves after an undock — applied a Studio-sized frame to a laptop screen with nothing in the path to catch it. The fix was not a condition on that rung but noticing the clamp was never a rung at all: fitting a rect to the display it lands on is a property of *every* placement. Ask which branches a safeguard is missing from before adding a condition to the one that failed.
20. **A consequence listed under a rule can contradict the rule, and it reads as reassurance.** *Decay needs a return* moved the recency tint off "is the window focused" precisely because a focused window and an empty chair are indistinguishable — then the first bullet beneath it granted watched streaming an exemption that requires telling them apart. Prose written to make a decision feel comfortable is where its own negation hides.
21. **Not intervening is a position, and this document had already taken it.** The instinct on system window management was to protect the furniture premise by opting out of Stage Manager and Hide Others — until *"we can't fight the OS"* landed against a rule the display-disconnect amendment had already written: *do nothing, let macOS relocate the window; intervening would double-move them.* What survived was the sharper half: the OS acting never writes intent, so nothing it does to a window is recorded as something the user did.

22. **A decision settled in one topic does not reach the topic it governs.** The call that the drawn surface is the final material rather than a placeholder was put to the user and answered in `platform-support` on 2026-09-02. Nine days later this document still said *"the real SwiftUI + Liquid Glass rendering takes precedence over anything drawn here… the material wins"*, and it took a concern rerouted back here to notice. The reroute machinery worked in the direction it was pointed; what has no machinery is a settlement travelling *from* the topic that took it *to* the topic it describes. Worth assuming the target does not know.
23. **A behaviour inherited from the platform is a guarantee only while you are using the thing that provides it.** Four decisions rested on materials going opaque under Reduce Transparency automatically — true of a *named* system material, and the note's parameterised blur is not one. The failure would have been silent and selective: chrome and popovers going opaque exactly as promised while the notes stayed frosted. **Check that the free behaviour belongs to the API you actually ended up with**, not to the one the rationale was written against.

24. **An index built for one question cannot be filtered into answering another.** The instinct on needing find-in-history was to scope the existing history index to one note — the same search, narrower. It cannot work, and not for a reason about size: that index stores the *union of distinct blocks* a note has ever held, so the provenance linking text back to a version was dropped as part of what makes it cheap. Filtering it returns the fact you already had. The reflex to reach for the index and widen its filters hides the question of whether the thing being filtered still contains the answer.

25. **Two documents contradicting each other is the tell that a third thing was never decided.** note-model had a chip's Markdown form carrying a filename label; storage-and-sync had the filename *not* in the note's text, and built a search-corpus rule on it. Neither was wrong about its own subject, and neither cited the other — because the fact they disagreed about, *what label insertion writes*, belonged to this topic and had never been stated. The question that arrived — what does a nameless chip draw? — was a consequence of that silence rather than a problem in its own right. **When siblings disagree, look for the decision neither of them owns** instead of adjudicating between them.

26. **A reference is evidence about the object it is a picture of.** Dockset's material picker was real evidence — a shipping app rendering the system's glass on a small floating surface with text on it, and it looked good. It is also a picture of a **neutral** container, whose every colour is the backdrop arriving through it. A fumi's colour is its own, and this topic had already written the rule that makes that difference decisive: the note surface is the one place the platform cannot resolve colour, *because its background is user-chosen and the system cannot see it*. The question a reference answers is not "does this look good" but "what is this a case of" — and the answer moved the decision's load-bearing reason from cost to correctness without changing the decision.

### Open Threads

- ~~**Two reroutes not yet landed, and load-bearing here:** snapshots recording geometry (→ storage-and-sync) and whether live note size is intrinsic or machine-local (→ note-model). The version-preview geometry animation depends on both.~~ **Closed 2026-08-06** — both landed as this topic assumed: `size` and `preset_id` are intrinsic and synced, and snapshots record them. Nothing needed revisiting.
- **Version-history transition treatment parked as a V2 candidate** (2026-07-28) — fading text between versions, or a real diff, reusing the recency-tint vocabulary.
- **Hidden-note change discoverability.** A closed note's tint can't be seen, so "something changed while you weren't looking" has no surface. Rerouted to management-window triage (2026-08-10).
- **Home storage settled here; identity *durability* still with space-homing.** A home is *display identity · Space UUID*, resolved as two independent rules plus a display-time fit. *(Amended 2026-09-01 — this read "a **resolution ladder** — display identity · Space UUID · **ordinal Space index on that display**"; the ordinal rung was removed the same day, so the ordinal is neither stored nor resolved against.)* Research confirmed Space identity **survives** a display disconnect and returns on reconnect, with the *first* Space of the display that stays the one casualty. Still open there: **display** identity durability (two identical monitors, hubs, adapters), and the reported intermittent failure of macOS's own restoration. ~~whether the ordinal is readable in Mission Control's order~~ — moot with the rung gone.
- **Premium boundary parked** — how version history presents when unentitled (→ commercialization).
- **The reconciler's device names rest on two fields that don't exist yet** (2026-08-22) — the per-device record carrying its ComputerName, and conflict candidates recording the writing device's key. Both rerouted to storage-and-sync triage; until they land the row reads "Another Mac", which is the designed fallback rather than a gap.
- **The size limit wants a standing home** (2026-08-10) — the refusal surface states it only at the moment of failure, and notification permission or Focus mode can swallow that. Rerouted to management-window triage (2026-08-10).
- ~~**The note surface's material against the supported OS range** (2026-09-01) — every surface decision here assumes Liquid Glass, a macOS 26 material, while storage-and-sync's `CKSyncEngine` floor is macOS 14. Rerouted to **platform-support** research triage; the answer comes back either as a floor at 26, which leaves these decisions untouched, or as a supported range below it, which owes this topic a defined pre-26 rendering for the panel, the controls, the shimmer and the panel/menu material distinction.~~ **Closed 2026-09-11** — the answer was neither of the two the thread anticipated. The range is macOS 15+, below 26, and **nothing is owed**: the drawn surface was never on a macOS 26 API. See *Decision — the drawn stack is the material*, which also settles what the answer exposed — the checkpoint may tune the bespoke stack but not swap it, so there is one rendering across the range. The thread's own premise, that every surface decision here assumes Liquid Glass, was the thing that turned out to be false.
- **The three-rung ladder is still cited in note-model** (2026-09-01) — its *Why Space UUID alone is insufficient* passage restates the ladder with its ordinal rung while reasoning about why display identity is stored. The reasoning survives; the restatement does not. Rerouted to **note-model** discussion triage, which reopened that topic.
- **Three corrections routed on the chip's label** (2026-09-14) — **note-model** discussion triage, for *"a materialised copy inherits `originalFilename`… what the chip **labels** and opens with"*, whose first half is now wrong; **storage-and-sync** discussion triage, for `notes_fts`'s input path and the rebuild pass, both of which restate *"the filename is not in the note's text"* as their reason; and **search-and-retrieval** discussion triage, for the corpus rule itself, whose deciding failure mode — the filename visible on a chip and absent from the index — cannot occur for an unedited chip now the label is the text. All three reopened their topics. Nothing here waits on them: the chip renders the label under every answer, and whether `originalFilename` stays in the corpus is theirs.
- **One-step preset creation, parked to the roadmap** (2026-09-22) — `Save as Preset` saves immediately and the preset is usable at once, but only as the absolute shape it captured; turning a dimension into a share takes a visit to the Presets pane, because **no inference, ever** means the unit has to be stated and no note-side surface for stating it survived the board. Parked as `in-place-preset-creation` under **next**, sourced back here. What it inherits is that four surfaces were drawn and all four failed on placement, so the answer is either a surface with precedent or a revisit of the no-inference rule, which is note-model's.
- **The system's glass on the note surface, parked to the roadmap** (2026-09-18) — Dockset's first-run material picker reopened the one-rendering call; the launch answer is unchanged, and the exploration is a post-launch product item (`liquid-glass-note-surface`, **next**) rather than a thread this topic holds open. What it inherits is a re-validation of the per-role foregrounds, the control alpha derivation and the reserved slots against a fill that is no longer constant — see the 2026-09-18 entry on *Decision — the drawn stack is the material*.
- **Carried to implementation:** the caret/selection spike through concealed runs; colour + material as a human-in-the-loop checkpoint; the reserved space's **five slots** resolved per swatch, whose values land at that same checkpoint; the **autosave settle window**, whose ~500ms is a working value tuned in the build like the 30px band and the ~240pt floor — the shape is what is pinned, not the number; and what Stickies actually does under Stage Manager, Hide Others and Show Desktop, unmeasured and worth a look though nothing rests on it.

### Current State

The 2026-09-22 sitting drained management-window's two concerns, both about the corner menu, and they moved in opposite directions — one act leaves the note, another arrives on it. **The corner menu's eighth cell is retired** — the role strip is seven role chips, and the swatch is switched from Settings' Swatches pane and from **`View ▸ Swatch ▸`** in the app menu bar, which is where the bar's own established contents put an app-appearance choice once `Note` is ruled out as document-scoped. The cell was admitted in 2026-07-29 on the single ground that the swatch level had no reachable surface, with the scope mismatch noted and accepted at the time; management-window has since built that surface, so what is left is a library-wide act sitting in chip shape among seven per-note chips, which the corner menu's own principle — the note's menu bar, nothing app-scoped — already forbade.

**Creating a preset came back to the note, and turned out to need no surface there at all.** `Save as Preset` — no ellipsis — saves immediately under a derived name like `280 × 1329`; nothing opens on the fumi, and a system notification carries an **Edit** action into the Presets pane for the rarer moment you want to name it or flip a unit. Four shapes were drawn for the box that was supposed to appear — a sheet, a popover on the menu row, a popover on the `•••`, a beakless panel in the chain — and all four were deleted. The sheet died on a measurement: it is clamped to its window in both axes, and at 223pt against a 130pt note, presenting one resizes the fumi, which is a write to authored synced geometry. The rest died on precedent, once the question was researched rather than reasoned: **Moom**, the closest functional analogue and this topic's own cited reference, hands off to its settings window and pre-names by default; Apple's HIG puts popovers on controls and sheets on windows big enough to carry them; and nothing opens a named-input surface attached to a small window from that window's own menu. The same pass corrected the corner menu's position against the `•••` and settled that it carries **no beak** — it is a menu, and the two places saying otherwise were the pre-class-distinction ones. Two long-standing self-contradictions went with it: the class table's **Material** row, which called menus opaque and is false of the platform it was read off, and the absence of any rule for **what wins when a board and this document disagree**, which the 2026-09-11 amendment had struck without replacing. Both are settled in the header.

The most recent upstream folds reshaped three areas: **asset absence collapsed to a single state** when storage-and-sync's hard size limit retired `excluded`, **a refused file gained a surface** as the consequence, and the asset child record's field names were repaired to the record-layer casing.

A later sitting the same day answered storage-and-sync's damaged-sidecar question by falsifying its premise: **a chip's name is the link label in `content.md`**, written as the filename at insert, so the unrecoverable-filename state never reaches this surface and no fallback label is drawn. Two sibling documents disagreed about whether the filename is in the note's text at all, and the thing that settles it — what label insertion writes — had never been stated on this topic's own surface. Corrections went to all three documents that lean on the old reading.

The 2026-09-18 sitting drained one rerouted concern and left the material decision standing on a different footing. **The one-rendering call holds for v1**, no longer on the cost of maintaining two renderings but on what the note surface *is*: a coloured object, which is the case the vibrancy rule already excluded from platform colour resolution. The Dockset reference that reopened it is a neutral container, so it does not reach that argument. **The exploration is not dead** — it is a post-launch product item on the roadmap, carrying both the re-validation it would owe (per-role foregrounds, control alpha derivation, reserved slots, against a fill that is no longer constant, on two renderings) and the case that would settle it: the system's material under a saturated dark tint with light text over a bright backdrop, which no capture in hand shows.

The 2026-09-14 sitting drained four rerouted concerns, three of them from search-and-retrieval's newly-settled ground. **The link picker gained a stated label** — pre-filled with the target's derived title, so an empty-label pill is agent-only and the one visible-but-unfindable case leaves the human path. **Autosave's cadence was pinned** at a short idle settle with flushes on blur, hide and close, having never been given a number: it is the delay between typing a word and finding the note, and on an open note the delay before an agent's write becomes searchable. **The version panel gained a find** over that note's own history — a scan, because the deduplicated history index cannot say *which* version, which is why the step was delegated here at all. And the **first-delete lesson's per-machine rule was ratified rather than reopened**: the concern read it as unstated, and it had in fact been decided, corrected once already, and is unchanged.

The 2026-09-11 sitting drained three rerouted concerns from platform-support and settled the material question they carried. **The drawn stack is the final material** — one rendering across the macOS 15+ range, with the colour-and-material checkpoint tuning it rather than choosing between it and a system material. **Control colour derives from the role's foreground**, replacing the `.glass` text that had been carrying the legibility argument since before the chrome spike superseded it. And **the Reduce Transparency fallback became Fumi's own guarantee** at all four sites that promised it, rather than a behaviour inherited from a material the surface does not use.

The 2026-09-01 sitting reshaped four more. **Home resolution lost its ordinal rung and gained a universal fit** — space-homing's fallback ruling and a measured undock between them turned three ordered rungs into two independent rules, and made clamping a property of every placement rather than of one rung. **The full-screen checkpoint dissolved** on a measurement that a floating window joins a full-screen Space and renders there. **Three named-but-undesigned surfaces were closed** — the band's `attach` control, table insertion and structure editing, and the reserved space's slot inventory. And **two long-standing frames were settled rather than left open**: no Fumi accent, and a fumi opts out of nothing under system window management.

- **Surface & Chrome** — frameless surface, **the drawn stack as the final material** (one rendering across the macOS 15+ range; the colour-and-material checkpoint tunes it and may not swap it for a system material), custom `✕` (close=hide) drawn as a plain filled circle rather than a system glass button, **its colour derived from the role's foreground**, **minimum width set by the fully-populated chrome band (~240pt working value), not by a text measure**, window controls on **focus OR hover**, and the formatting band tracking the **editing context** (focused *and* editable — hidden in previews, Recently Deleted and Edit as Markdown; kept during a conflict), with per-control hover as separate feedback, the formatting band in the chrome band, control geometry and padding pinned, multi-note focus/click/drag model — **the band moves the window everywhere it is not a control**, the formatting capsule's own background included, on the macOS toolbar rule — Float-on-Top tier, menu structure, native key-window focus treatment. **A fumi opts out of nothing under system window management** — Stage Manager, Hide Others, Show Desktop and App Exposé all treat it as an ordinary window — and none of those gestures writes visibility, a home or coordinates, because the OS acting is resolution, not the user placing.
- **Colour** — two-level swatch model (per-note **role** + machine-local **swatch**), **ten fixed swatches with pinned values**, no user authoring, **the swatch switched from Settings and from `View ▸ Swatch ▸` rather than from the note** — the corner strip carries seven role chips and nothing app-scoped, **Okabe–Ito** as the single CVD set plus **Graphite** for achromatopsia, appearance governs **chrome only**, reserved **slots** for system state resolved per swatch — **five of them, split on meaning rather than surface**: attention · deleted · absent · refusal · recency, with soft-deleted-link folding into *deleted* and missing-asset folding into *absent* — swatch-owned foregrounds (no system vibrancy on the note surface), global opacity as a normalised per-swatch range, frosted-fill legibility, and **the Reduce Transparency fallback as Fumi's own guarantee** — switched explicitly at all four sites rather than inherited from the material.
- **Editing UX** — **Model B** (the buffer *is* the Markdown), **autosave on a short idle settle (~500ms working value) with immediate flushes on blur, hide and close** — the interval is the delay between typing a word and finding the note holding it, and on an open note it is also the delay before an agent's write becomes searchable, since an open note's writes route through the buffer. Apple-Notes surface with Markdown as a hidden accelerator, marker integrity via range-attribute semantics, undo/escaping/paste/copy, block constructs as units, agent-write concurrency, formatting menu + shortcuts, *Edit as Markdown* escape hatch. Tables insert small and headered (GFM has no headerless form) with no size picker, and grow via **`+` affordances at the trailing edges while focused and hovered** — an editing control, so it takes the band's focused-and-editable rule — with deletion in `Format ▸ Table ▸` and `Tab`-at-the-last-cell appending a row. Pasting content that references an asset is an ordinary content write — the engine materialises the bytes, the clipboard carries text alone, and the paste is **atomic and silent** because an APFS clone costs nothing. *(The excluded-paste decision and its amendment retired 2026-08-10 with the state itself.)*
- **Inline Rendering** (incl. **Math**, **Asset Reference States**) — per-type treatments, table min-width + alpha-mask fades, shared inset-block container, chip interaction, math via Pandoc/GitHub delimiter rule, render-once-to-SVG pipeline. An unresolvable asset token renders as a placeholder and is never rewritten: **one absent state, `missing`** — dashed outline with a broken-file glyph on a chip, the same dashed inset block for an image, filename at full strength in both. *(The pair collapsed 2026-08-10: storage-and-sync's hard size limit retired `excluded`, so sync can no longer produce an absent asset and `missing` is reachable only by agent error or a damaged bundle.)* **A chip's name is the link label in `content.md`**, written as the filename when the file is inserted, so it is ordinary editable text rather than a value read back from the sidecar — which is why a damaged manifest costs the Finder name and never the chip's label, and why the unnamed-chip fallback the question arrived asking for is not drawn.
- **Tag Rendering** — borderless translucent pill, `#` shown inside.
- **Positioning** (incl. **Preset Authoring**) — a new fumi is born on the **currently active Space of the pointer's display, cascaded from a fixed origin** (size comes from note-model's stamped creation default, not from here) — **including a full-screen Space**, which is ordinary and addressable, and which the note homes to like any other despite being destroyed when the app leaves full-screen. Move-to submenu: tiling icon grid, Move to Display, and moving across displays re-homes the note. **A home is intent, not a location — fallbacks resolve without rewriting**, so a display disconnect never re-homes anything; macOS relocates live windows itself and Fumi places them only at relaunch. A home stores **display identity · Space UUID** and resolves as **two independent rules plus a fit** rather than three ordered rungs — Space: the UUID or the home display's first Space; display: the recorded display or the main one; then a display-time fit that applies to every placement and writes nothing, which is what stops an undock's migrated Spaces from putting a Studio-homed note off the edge of a laptop screen. **Resolution writes nothing at all** now the ordinal rung is gone. A preset is three independently-toggled axes (Size · Position · Display) with each dimension a measurement or a share, positions stored display-local, and no inference on capture. **A binding stands until broken** — the note stores `preset_id` and re-resolves wherever it is placed — and **a gesture breaks it only if it overrides an axis the preset sets**, breaking the whole reference when it does. Bound axes re-resolve and are never clamped; the safety net is for free notes and never writes back. **Creating a preset happens on the note and curating happens in Settings** — `Save as Preset` saves the captured geometry immediately under a derived name and opens nothing, with a system notification carrying an **Edit** action into the Presets pane, while `Edit Presets…` is still a hand-off; the *surface-follows-the-object* idiom narrowed to cover editing and curating a global object rather than creating one out of this note's state. **There is no note-side box**: a sheet resizes a fumi, and the search for a precedent found none — Moom, the closest analogue, hands off to settings and pre-names by default. The preset is usable the moment it is saved, as the absolute shape it captured; turning a dimension into a **share** still takes a visit to the pane, which is **no inference, ever** biting rather than a shortfall of this answer, and is parked as `in-place-preset-creation` on the roadmap. Row glyphs draw what's proportional and mark what's absolute with dimension arrows.
- **Delete UX** — immediate delete with **no confirm** (revises discovery), one-time system notification, deleted state read-only with banner + **Put Back** *(amended 2026-08-10 — read "Restore", which is the version panel's verb; the banner's was settled as Put Back under* how a deleted note reads *precisely because both can be on screen at once. Third and last site carrying the wrong word)*. **Every delete from every origin is a soft delete**; hard delete is reachable *only* from Recently Deleted and is **not exposed to agents** — which makes a live note vanishing under the cursor unreachable rather than merely handled.
- **Version-History UI** — list panel beside the note, note as its own preview pane, header-mounted Restore, `CURRENT` badge, uniform author styling, retention footer. **The panel carries a find** over that note's own history — a third corpus mode of the one search facility, filtering the row list and highlighting matches in the preview, opening empty rather than inheriting the term that brought you here. It **scans** the note's `versions/` on open and matches in memory, because the global history index is deduplicated and carries no version provenance, so it cannot answer *which version*; snapshots are KB and local on every Mac, so the scan is free and survives global history search being cut. The attribution row renders what `via` + `by` support and nothing more: `app` → **You**, `mcp`/`cli` → the agent named by `by` or the bare channel, absent `via` → **Unknown**. Best effort, with the accessibility-driven-GUI hole under `app` named on the same footing as `by`'s advisory provenance. Snapshots record the **authored** `size` plus `preset_id`; **preview animates size and never position**, re-resolving a bound snapshot's Size axis against the current display so the preview matches what committing produces; preview writes nothing, Restore writes both. Selection and primary buttons take the **system accent**, and Fumi ships none of its own — a fixed Fumi accent is the same object as a fixed reserved signal value and fails across the swatch range, while a per-swatch one stops being an accent.
- **Drop Interaction** — everything in-body at the caret, tracking insertion caret (no zones or overlay), pointer decides landing, blocks targeted whole. A file over storage's hard size limit is refused: **the drag says no** (whole-note refusal state in the reserved space, no caret, rejection cursor) and **the drop says why** (one system notification per transfer, nothing added to the note). A mixed transfer is never refused whole — what fits lands, what doesn't is dropped — and the drag-time state exists only where the size is knowable during the drag, so paste and URL-drag carry the notification alone and an agent-caused refusal returns its error to the agent instead. The band's **`attach`** control is the table's fifth route: a direct file picker, multi-select, inserting at the caret like a drop, taking the paste shape for refusals — and the one route able to say why inside its own dialog.
- **Conflict Reconciler** — the version panel *is* the reconciler (not tabs): same geometry, `CURRENT` badge, uniform attribution; header reads *Two versions*, action is *Keep*, never disabled. Rows carry the writing Mac's **ComputerName**, resolved at display time from the device key so a rename re-labels history, falling back to **"Another Mac"** wherever it can't be resolved; device identity appears here and not in version history. Violet banner reusing the deleted-state geometry, with *Review*. No diff for v1 — the frame is held still so only the differing line moves. Note stays editable throughout.
- **Note-Link Interaction** — ships working, not floored. Inherits the chip model (click selects · Space peeks · double-click opens · backspace deletes), the tag pill for rendering, and label-as-written with the peek carrying the live title. **The picker never writes an empty label** — inserting with nothing selected pre-fills the target's derived title as ordinary text, so the live-title fallback is reachable only by an agent emitting a bare reference, and the one place a pill could be visible-but-unfindable leaves the human path. Editing never reveals `fumi://` syntax — but *Edit as Markdown* always does. Opening honours the target's home and jumps Spaces to reach it. Soft-deleted peeks and restores; hard-deleted is inert.
- **Agent-Activity Presentation** — two layers not three (header indicator cut): a Siri-style edge shimmer for presence, streaming text for content, and a subtle recency tint on new text that decays on a **return** — a focus event or real input, never the window merely being focused, so it cannot fade against an empty chair. That holds for streaming you watched too: watching and an empty chair are the same machine state, so the tint waits for a touch either way. No write-locking. *Shimmer = happening now; tint = you missed it* — split on live-vs-missed, never on agent-vs-sync.

**Spikes:** ten Paper artboards, `01`–`10`, one per subtopic or shared component — see the Spike Index. (`00 — DISCOVERY` was deleted on 2026-07-29; it was superseded and was the reference for nothing.) The **Spike Backlog holds five entries** — the two asset-reference cells and the table's `+` structure controls owed to board `03`, the accept/refuse drop-target pair owed to board `01`, the device label plus its fallback row owed to board `08`, and the find plus its filtered list owed to board `07`. *(Amended 2026-09-22 — board `05` was brought current in the same sitting: the swatch submenu deleted, the strip redrawn at seven, and the `Save as Preset` surface resolved to a derived-name row in the `Move to ▸` list the board already draws, its own comparison frame deleted with the shapes it was built to compare. Amended 2026-09-14 — the version panel's find added the fifth. Amended 2026-08-10 — read "one entry — the four asset-reference cells"; the excluded column retired that day, halving the first entry, and the refused-file decision added the second. Amended 2026-08-22 — the device-label decision added the third. Amended 2026-09-01 — the table's structure-editing controls added the fourth. The Spike Backlog section governs.)*

# Spec 1 — Gate-card schema and lifecycle

The contract between everything: parser output, SPA cards, queue rows, MCP Apps, the
ledger. Provisional until the end-of-Phase-2 freeze. Revised after the
FMEA/consistency/sufficiency rounds: identity re-keyed to bridge-owned inputs, ask
detection excludes auto-mode sections, recognition re-keyed to engine surface names, and
state transitions are serialized.

## The card

```ts
type GateCard = {
  id: string;               // stable identity — see below
  kind: GateKind;
  gateType?: string;        // policy type from the surface→type mapping (below); absent for
                            // surfaceless prose cards, which take kind-level policy only
  source: 'tool-result' | 'relay' | 'prose';
  session: { bridgeSessionId: string; askOrdinal: number };
  address: { workUnit?: string; topic?: string; phase?: string };  // lobby gates omit workUnit → stage 0
  surface?: string;         // engine section name, tool-result sourced cards only
  context: string;
  question?: string;        // the ◆ glyph line's text
  options: GateOption[];
  freeText: true;
  confirm: 'tap' | 'typed';
  relayDiverged?: boolean;
  comments?: { unread: number };   // Phase 6 — surfaced on the confirm control
  openedAt: string;
  state: GateState;
  resolution?: { answer: string; via: 'ui' | 'mcp' | 'external'; at: string };
};

type GateOption = {
  key: string; word?: string; label: string;
  recommended: boolean;     // at most one; render marked, never pre-selected
  form: 'cmd' | 'prompt' | 'range';
  range?: [number, number];
};
```

## Gate identity

`id = sha256(bridgeSessionId, askOrdinal, normalizedBody)[0..16]`.

- **`bridgeSessionId`** — bridge-assigned, stable across SDK resumes and compactions
  (the SDK may mint new ids on resume; ours never changes). The `sessions` table maps it
  to the current sdk id.
- **`askOrdinal`** — the count of asks previously detected in this bridge session,
  derived by re-running ask detection over the bridge's own **session journal** (the
  per-session event tee the bridge persists — UI-native state; this is also the "tail"
  answer-while-dead reads, since SDK resume does not re-stream history). Turn numbering
  is *not* an identity input — "turn" is defined (once, for all specs) as the count of
  **human inputs** since session birth (tool-result submissions ride user-role API
  messages but are not user turns — the Phase 0 converter surfaced the ambiguity, and
  this is the resolved reading; REVIEW.md round 6), and is bookkeeping only.
- **`normalizedBody`** — operationally: take the section body (lines after the
  `=== NAME (instruction) ===` header, up to the next `=== ` or end — sections have no
  closing delimiter) or, for grammar-parsed menus, the contiguous option-row block plus
  glyph line; drop the `· · ·` frame line; collapse **all Unicode whitespace including
  NBSP** (the engine pads continuations with U+00A0) to single spaces; trim each line;
  join with `\n`; keep markdown markers (`**`, backticks) verbatim.

Restart recovery and answer-while-dead both verify identity by re-derivation from the
journal; with these inputs the id is invariant under resume. The fixture golden asserts
it: re-parsing a recorded journal yields byte-identical ids.

## Kind taxonomy

| kind | Recognised by | Notes |
|---|---|---|
| `menu` | option rows, ≥2 cmd options | the general card |
| `confirm` | `y/yes` cmd option (+ optional separate ◆ question) | yes/no gate |
| `batch-screen` | **surface names only**: the `DISPLAY: finding batch` + `MENU: finding batch` pair (and siblings the Phase 2 sweep confirms) on the tool-result path. The grammar-only fallback **never claims batch-screen** — numbered rows above key options also describe the start overview; without the surface name it stays `menu`/`pass-through` | never pings on open; escalation applies (spec 5) |
| `walk-raise` | surfacing protocol's one-finding turn (walked-lane heading chrome / follows a drain announce) | in-card conversation |
| `stop-notice` | STOP with no options | acknowledge + free text |
| `pass-through` | anything else turn-final | chat tail + reply box |

## Ask eligibility (shared with spec 2)

A `MENU:`/gate section is an **ask candidate only if its header instruction says STOP**.
The engine renders auto-mode gates with an explicit *"do not stop; continue"* instruction
(`AUTO_GATE_INSTRUCTION`) — task approval, capture log, fix apply and task results all
sail past their own menus under auto. Those sections are context, never cards; building a
card from one (and injecting its key later) was the phantom-gate bug this rule kills.

## The surface→type mapping (single source, same mechanism as never-auto)

A maintained table mapping engine section names to the policy `gateType` spec 5's
laneless table keys on — e.g. `MENU: task approval` → task-loop; `MENU: fix direction` →
task-loop; consult/three-strike surfaces → consult; `MENU: incoherence conflict` →
conflict; verified and extended during Phase 2's surface sweep. Cards without a `surface`
(prose menus) carry no `gateType` and take kind-level policy.

## State machine — transitions are serialized

```
detected → open → answering → resolved            (via: ui | mcp)
open → resolved-externally                        (session advanced past the ask)
open → stale                                      (session ended/superseded, unanswered)
answering → orphaned                              (resume failed; fallback chat offered)
```

Gates are projections, so the arbitration point is explicit: **all transitions for one
session pass through one bridge-side mutex**; a submit against a non-`open` projection
returns the current state to the caller ("already answered by …") — the two-tab race
resolves visibly. During resume-then-inject, verification and injection happen with the
session's event loop held (no interleaved turn admitted between them), and the injected
turn is tagged with the gate id in bridge metadata — a post-hoc mismatch flips the card
to `resolved-externally` rather than standing as a stray instruction.

## The option grammar (parse contract)

Unchanged from the verified engine forms (`surfaces.cjs`):

```
**`◆ {question}`**                       glyph line (optional)
**`{key}/{word}`** → {label}             cmd option
**`{key}`** → {label}                    keyed row
**`{first}–{last}`** → {label}           range option (en-dash)
**{label}** → {description}              prompt option
```

Engine labels may wrap with NBSP-aligned continuations; prose menus are single-line.
Strict parse; structural deviation → `pass-through`. **Two menus in one turn is valid
input** (last one is the ask, earlier ones render as context — spec 2's rule); it lives
in the adversarial corpus only to pin that assertion, not as malformed.

## Never-auto recognition (single source, now with match keys)

`confirm: 'typed'` when any of:

1. **Engine surfaces that stay gated over auto** — the product enumerates these
   (commands.md: the three incoherence-gate variants, the resurface gate, choice-move
   finding gates) and renders them with `AUTO_OVERRIDE_LINE`. Match keys: section names
   `MENU: incoherence conflict` / `incoherence gap` / `incoherence held doc`,
   `MENU: resurface gate`, plus the choice-move finding surfaces — names verified against
   `render.cjs` in the Phase 2 sweep. An upstream `STAYS_GATED_SURFACES` export
   ([UPSTREAM.md](../UPSTREAM.md)) replaces this list when it lands.
2. **Destructive lifecycle confirms** — label patterns (provisional, Phase 2-verified):
   /cancel .*--cascade/, /permanently delete/i, work-unit cancel confirms.
3. **Spec sign-off** — its engine surface name (verified in the sweep).
4. **The suspicion heuristic** on unrecognised surfaces:
   /(discard|overwrite|permanently|cascade|delete .* git|sign[- ]off)/i.

Direction of error is always toward more ceremony. The **prose-only never-auto residue**
(the spec-deviation stop has no rendered surface) is handled by the heuristic plus the
walk-shaped fallback — documented as residue, not solved.

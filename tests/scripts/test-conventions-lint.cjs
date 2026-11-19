'use strict';

// Conventions linter — mechanical enforcement of the DECIDABLE tier of
// CONVENTIONS.md across the skill/agent corpus. Runs in CI forever, so every
// check is calibrated for ZERO false positives: anything that cannot be made
// exact stays out (the judgment tier belongs to humans).
//
// Each check is a pure function `(files) => violations[]` where a violation is
// `{ file, line, message }`. The same function backs both the corpus test
// (must find zero violations) and a negative test (must catch deliberately
// broken temp fixtures). No repo files are mutated.
//
// Layer: unit.

require('./hermetic-env.cjs');

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { RENDER_FORMS: FORMS } = require('../../skills/ledger-engine/scripts/domain/projections/surfaces.cjs');
const { HANDOFF_TARGETS } = require('../../skills/ledger-engine/scripts/domain/handoff.cjs');
const { STOPS } = require('../../skills/ledger-engine/scripts/domain/boot.cjs');

const REPO = path.resolve(__dirname, '..', '..');
const DOT = '·'; // MIDDLE DOT (U+00B7)
const MENU_FRAME = Array(12).fill(DOT).join(' '); // "· · · · · · · · · · · ·"
const FENCE = /^\s*(?:\d+\.\s+)?```/; // a fence delimiter, a numbered list item's included
const FENCE_RUN = /^\s*(?:\d+\.\s+)?(`{3,})(.*)$/; // its backtick run and what follows
// A rendering instruction's opening, a numbered list item's included — checks
// 13 and 24 recognise the instruction by this one prefix.
const RENDER_INSTRUCTION_HEAD = /^\s*(?:\d+\.\s+)?> \*Output the next fenced block as /;

// ---------------------------------------------------------------------------
// Corpus discovery
// ---------------------------------------------------------------------------

function walkMd(dir, acc) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walkMd(p, acc);
    else if (entry.isFile() && p.endsWith('.md')) acc.push(p);
  }
  return acc;
}

function corpusFiles() {
  const files = [];
  walkMd(path.join(REPO, 'skills'), files);
  const agentsDir = path.join(REPO, 'agents');
  if (fs.existsSync(agentsDir)) {
    for (const name of fs.readdirSync(agentsDir)) {
      if (name.endsWith('.md') && fs.statSync(path.join(agentsDir, name)).isFile()) {
        files.push(path.join(agentsDir, name));
      }
    }
  }
  return files.sort();
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function readLines(file) {
  return fs.readFileSync(file, 'utf8').split('\n').map((l) => l.replace(/\r$/, ''));
}

function rel(file) {
  return path.relative(REPO, file);
}

// Parse fenced code blocks. Returns { blocks, inFence } where `blocks` is an
// array of { open, close, lines: [{ n, text }] } and `inFence` is a boolean
// array indexed by 0-based line number (true inside a fence, excluding the
// ``` delimiter lines themselves). A fence closes on a bare run of at least
// as many backticks as opened it, so a ```` fence holds ``` lines as content.
function parseFences(lines) {
  const blocks = [];
  const inFence = new Array(lines.length).fill(false);
  let open = -1;
  let run = 0;
  let content = [];
  for (let i = 0; i < lines.length; i++) {
    const fence = FENCE_RUN.exec(lines[i]);
    if (fence && open === -1) {
      open = i;
      run = fence[1].length;
      content = [];
      continue;
    }
    if (fence && fence[1].length >= run && fence[2].trim() === '') {
      blocks.push({ open, close: i, lines: content });
      open = -1;
      continue;
    }
    if (open !== -1) {
      inFence[i] = true;
      content.push({ n: i, text: lines[i] });
    }
  }
  return { blocks, inFence };
}

// First non-blank content line index after any YAML frontmatter.
function firstContentIndex(lines) {
  let i = 0;
  if (lines[0] !== undefined && lines[0].trim() === '---') {
    i = 1;
    while (i < lines.length && lines[i].trim() !== '---') i++;
    i++;
  }
  while (i < lines.length && lines[i].trim() === '') i++;
  return i;
}

// ---------------------------------------------------------------------------
// Check 1 — chrome keeps its glyphs: a markdown phase title (`# **`…`**`)
// takes ■, and a marker — the sole content line of a fence, `**`… …`**` —
// takes □ for a step or ▪ for a sub-step, never the title's ■. A title on
// any other glyph CONVENTIONS lists (Glyphs) is caught.
// ---------------------------------------------------------------------------

const OTHER_GLYPHS = '□▪○◐●◌→✓⊙⊘⊖◆⚑⏺';

function checkChromeGlyphs(files) {
  const out = [];
  for (const file of files) {
    const lines = readLines(file);
    lines.forEach((line, i) => {
      const h1 = /^# \*\*`(.)/.exec(line.trim());
      if (h1 && OTHER_GLYPHS.includes(h1[1])) {
        out.push({ file, line: i + 1, message: `phase-title chrome uses ■ — found ${h1[1]}` });
      }
    });
    for (const b of parseFences(lines).blocks) {
      if (b.lines.length !== 1) continue;
      const { n, text } = b.lines[0];
      const m = /^\*\*`(.) (.+)`\*\*$/.exec(text);
      if (m && m[1] === '■') out.push({ file, line: n + 1, message: 'marker chrome uses □ or ▪ — ■ belongs to the phase title' });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Check 3 — Menus are engine-rendered, never authored in prose. A menu dot
// rule (a line of three or more spaced middle dots) or a command-option row
// (a code-span key alone on its line or ahead of the arrow, at the line's
// start or after a list marker) is a menu drawn by hand, inside a fence or
// out. A chrome marker's code span always holds a space and a key's never
// does, and the `**term** → gloss` shape prose uses for definitions carries
// no code span, so neither reads as a row.
// ---------------------------------------------------------------------------

const MENU_ROW = /^(?:[-*•] |\d+\. )?\*\*`[^`\s]+`\*\*(?: +→ |$)/;

function isDotRule(t) {
  return /^[· ]+$/.test(t) && (t.match(/·/g) || []).length >= 3;
}

function checkNoProseMenus(files) {
  const out = [];
  for (const file of files) {
    readLines(file).forEach((line, i) => {
      const t = line.trim();
      if (isDotRule(t)) {
        out.push({ file, line: i + 1, message: 'a menu dot rule in prose — menus are engine-rendered: build the menu in code and serve it from a render surface' });
      } else if (MENU_ROW.test(t)) {
        out.push({ file, line: i + 1, message: 'a menu option row in prose — menus are engine-rendered: build the menu in code and serve it from a render surface' });
      }
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Check 5 — Banned navigation verbs after an arrow: a route proceeds or
// returns, so check 6 reads every one. It serves the step model.
// ---------------------------------------------------------------------------

const BANNED_NAV = /→\s*(Go to|Jump to|Skip to|Continue to|Enter |Proceed directly)/;

function checkBannedNav(files) {
  const out = [];
  for (const file of files) {
    const lines = readLines(file);
    lines.forEach((line, i) => {
      // Menu option lines use ` → ` as their key/label separator (option
      // grammar), so a label that happens to open with a navigation verb is
      // not a navigation directive.
      if (/^\s*\*\*.+?\*\* +→ /.test(line)) return;
      const m = line.match(BANNED_NAV);
      if (m) {
        out.push({ file, line: i + 1, message: `banned navigation verb "→ ${m[1].trim()}"` });
      }
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Check 6 — Internal routing-target existence. For "→ Proceed to **X**." and
// "→ Return to **X**." where X is "Step N" or a lettered section ("B. Name"),
// the same file must contain the matching heading. Skips caller returns,
// backbone-escape links, and parameterised ({…}) targets.
// ---------------------------------------------------------------------------

function checkRouting(files) {
  const out = [];
  const routeRe = /→\s*(?:Proceed to|On return, proceed to|Return to)\s+\*\*([^*]+)\*\*/g;
  for (const file of files) {
    const lines = readLines(file);
    // Headings are collected from every line (not fence-filtered): a heading
    // shown inside a fenced example could only ever mask a broken route (a
    // harmless false negative), whereas fence-parity parsing is fragile and
    // could produce false positives — which this linter must never do.
    const headings = [];
    lines.forEach((line) => {
      const hm = line.match(/^#{1,6}\s+(.+?)\s*$/);
      if (hm) headings.push(hm[1]);
    });
    lines.forEach((line, i) => {
      routeRe.lastIndex = 0;
      let m;
      while ((m = routeRe.exec(line))) {
        const tgt = m[1];
        if (tgt.includes('{')) continue; // parameterised
        if (/^\[.*\]\(.*\)$/.test(tgt)) continue; // backbone-escape link
        if (/^Step \d/.test(tgt)) {
          const n = tgt.replace(/^Step\s+/, '').trim();
          const nre = new RegExp('^Step ' + n.replace(/\./g, '\\.') + '(?=[:\\s]|$)');
          if (!headings.some((h) => nre.test(h))) {
            out.push({ file, line: i + 1, message: `routing target **${tgt}** has no matching heading in file` });
          }
        } else if (/^[A-Z]\.\s/.test(tgt)) {
          if (!headings.some((h) => h === tgt)) {
            out.push({ file, line: i + 1, message: `routing target **${tgt}** has no matching heading in file` });
          }
        }
        // else: not a Step/lettered target (e.g. "Invoke the Agent") — skip
      }
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Check 6b/15 — Cross-file section references: a bold lettered-section token
// sharing a line with a reference-file link must name a heading that exists —
// in the linked file (the cross-file read, e.g. "follow **E. Mid-Session
// Check** in **[other-file.md](…)**") or locally (a same-line unrelated
// link beside an intra-file route must never false-positive). A restructure
// that shifts a target file's letters now fails here instead of rotting
// silently; missing linked files are check 7's finding, not this one's.
// ---------------------------------------------------------------------------

function checkCrossFileSections(files) {
  const out = [];
  const tokenRe = /\*\*([A-Z]\.\s[^*]+?)\*\*/g;
  const linkRe = /\[[^\]]*\]\(([^)#]+\.md)[^)]*\)/g;
  for (const file of files) {
    const lines = readLines(file);
    const { inFence } = parseFences(lines);
    const localHeadings = [];
    lines.forEach((line) => {
      const hm = line.match(/^#{1,6}\s+(.+?)\s*$/);
      if (hm) localHeadings.push(hm[1]);
    });
    lines.forEach((line, i) => {
      if (inFence[i]) return;
      linkRe.lastIndex = 0;
      const linked = [];
      let lm;
      while ((lm = linkRe.exec(line))) {
        const target = lm[1];
        if (target.includes('{') || /^[a-z]+:\/\//.test(target)) continue;
        linked.push(path.resolve(path.dirname(file), target));
      }
      if (linked.length === 0) return;
      tokenRe.lastIndex = 0;
      let tm;
      while ((tm = tokenRe.exec(line))) {
        const token = tm[1].trim();
        if (token.includes('{')) continue;
        if (localHeadings.some((h) => h === token)) continue;
        let resolvable = false;
        let anyLinkedRead = false;
        for (const abs of linked) {
          let content;
          try {
            content = fs.readFileSync(abs, 'utf8');
          } catch {
            continue; // missing file — check 7's finding
          }
          anyLinkedRead = true;
          const ok = content.split('\n').some((l) => {
            const hm = l.match(/^#{1,6}\s+(.+?)\s*$/);
            return hm && hm[1] === token;
          });
          if (ok) { resolvable = true; break; }
        }
        if (anyLinkedRead && !resolvable) {
          out.push({ file, line: i + 1, message: `cross-file section reference **${token}** has no matching heading in the linked file(s)` });
        }
      }
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Check 7 — Markdown link resolution: every relative [text](path) link
// resolves to an existing file (anchor fragment stripped). External URLs and
// template-placeholder ({…}) paths are skipped. Links inside fenced code
// blocks (illustrative templates) are exempt.
// ---------------------------------------------------------------------------

function checkLinks(files) {
  const out = [];
  const linkRe = /\[[^\]]*\]\(([^)]+)\)/g;
  for (const file of files) {
    const dir = path.dirname(file);
    const lines = readLines(file);
    const { inFence } = parseFences(lines);
    lines.forEach((line, i) => {
      if (inFence[i]) return; // illustrative template links
      linkRe.lastIndex = 0;
      let m;
      while ((m = linkRe.exec(line))) {
        let target = m[1].trim();
        if (/^(https?:|mailto:|tel:|#)/.test(target) || target.startsWith('//')) continue;
        target = target.split('#')[0];
        if (target === '') continue; // pure in-page anchor
        if (target.includes('{')) continue; // template placeholder
        if (!fs.existsSync(path.resolve(dir, target))) {
          out.push({ file, line: i + 1, message: `unresolved relative link (${target})` });
        }
      }
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Check 7b — a load is its own line (CONVENTIONS: The Reference File, loaded
// by one line): a `Load **[…](…)**` directive opens its line — bare, after an
// arrow or a list marker — or follows a sentence's end on it, never carried
// mid-sentence ("…, else Load …"). Loads inside fences are exempt.
// ---------------------------------------------------------------------------

/** What may stand before a load on its line: nothing, an arrow or a list marker, or a sentence's end. */
const LOAD_OPENS = /^\s*(?:(?:→|[-*]|\d+\.)\s+)?$|[.:?!]\**\s+$/;

function checkLoadLines(files) {
  const out = [];
  for (const file of files) {
    const lines = readLines(file);
    const { inFence } = parseFences(lines);
    lines.forEach((line, i) => {
      if (inFence[i]) return;
      for (const at of [...line.matchAll(/Load \*\*\[/g)].map(({ index }) => index)) {
        if (!LOAD_OPENS.test(line.slice(0, at))) out.push({ file, line: i + 1, message: 'a load carried mid-sentence — end the sentence and give the load its own line' });
      }
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Check 8 — H1 category rule (scoped to the `ledger` and `ledger-*` SKILL.md backbones).
// Processing backbones (ledger-*-process, plus discovery — a phase that
// talks — and the engine) open with a title H1; every other backbone of
// Ledger's — the start skill and the menus of the epic and the roadmap —
// carries none.
// ---------------------------------------------------------------------------

/** Whether a skill is one of Ledger's own — `ledger` or `ledger-*`. @param {string} name */
function isOurs(name) {
  return name === 'ledger' || name.startsWith('ledger-');
}

function skillNameOf(file) {
  // .../skills/<name>/SKILL.md
  const parts = file.split(path.sep);
  const idx = parts.lastIndexOf('skills');
  if (idx === -1 || parts[parts.length - 1] !== 'SKILL.md') return null;
  return parts[parts.length - 2] || null;
}

function checkH1Category(files) {
  const out = [];
  const H1_KNOWN = new Set(['ledger-discovery', 'ledger-engine']);
  for (const file of files) {
    const name = skillNameOf(file);
    if (!name || !isOurs(name)) continue; // only Ledger's backbones
    const mustHaveH1 = /^ledger-.+-process$/.test(name) || H1_KNOWN.has(name);
    const lines = readLines(file);
    const first = lines[firstContentIndex(lines)] || '';
    const isH1 = /^# /.test(first);
    if (mustHaveH1 && !isH1) {
      out.push({ file, line: firstContentIndex(lines) + 1, message: `processing backbone (${name}) must open with a title H1` });
    } else if (!mustHaveH1 && isH1) {
      out.push({ file, line: firstContentIndex(lines) + 1, message: `non-processing backbone (${name}) must not carry an H1` });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Check 10 — Reference-file attribution: files under skills/*/references/ open
// (after the H1) with an italic attribution line in a sanctioned form —
// parent/sub-reference link ("*Reference for **[link](path)**…*") or shared
// ("*Shared reference…*").
// ---------------------------------------------------------------------------

const ATTR_REFERENCE = /^\*Reference for \*\*\[[^\]]+\]\([^)]+\)\*\*.*\*$/;
const ATTR_SHARED = /^\*Shared reference\b.*\*$/;

function posix(file) {
  return file.split(path.sep).join('/');
}

// In scope: reference files under a Ledger skill (skills/*/references/…).
// Matched on path suffix (not repo-anchored) so the same logic drives corpus
// and temp-fixture tests.
function isReferenceFile(file) {
  const p = posix(file);
  return /\/skills\/[^/]+\/references\//.test(p) && !/\.claude\/skills\//.test(p);
}

function checkAttribution(files) {
  const out = [];
  for (const file of files) {
    if (!isReferenceFile(file)) continue;
    const lines = readLines(file);
    const h1Idx = lines.findIndex((l) => /^# /.test(l));
    if (h1Idx === -1) {
      out.push({ file, line: 1, message: 'reference file missing H1 (cannot locate attribution)' });
      continue;
    }
    let j = h1Idx + 1;
    while (j < lines.length && lines[j].trim() === '') j++;
    const attr = (lines[j] || '').trim();
    if (!ATTR_REFERENCE.test(attr) && !ATTR_SHARED.test(attr)) {
      out.push({ file, line: j + 1, message: 'reference file must open with a sanctioned italic attribution line' });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Check 11 — Load-directive footers state the return condition. Within a
// heading-delimited segment (fences excluded), a Load **[...]** directive
// followed by a bare "→ Proceed to **" footer must use the conditional
// "→ On return, proceed to **" form — the bare form reads as the immediate
// next action and overshoots the reference. An intervening **STOP.** gate or
// bold conditional breaks the seam: the routing there is keyed to the user's
// response or a sibling branch, so the bare form is sanctioned.
// ---------------------------------------------------------------------------

function checkLoadFooters(files) {
  const out = [];
  for (const file of files) {
    const lines = readLines(file);
    const { inFence } = parseFences(lines);
    let loadSeen = false;
    lines.forEach((line, i) => {
      if (inFence[i] || FENCE.test(line)) return;
      if (/^#{1,6}\s/.test(line) || /\*\*STOP\.\*\*/.test(line) || /^\*\*(If |Otherwise)/.test(line)) {
        loadSeen = false;
        return;
      }
      if (/Load \*\*\[/.test(line)) {
        loadSeen = true;
        return;
      }
      if (loadSeen && /^\s*→ Proceed to \*\*/.test(line)) {
        out.push({
          file,
          line: i + 1,
          message: 'bare "→ Proceed to" after a Load directive — use "→ On return, proceed to"',
        });
      }
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Check 13 — a fenced block prose authors is static (CONVENTIONS →
// Display). A fence headed by a rendering instruction — a display, a
// marker, a signpost, an ask — carrying anything that varies (a braced token
// or an @if/@foreach directive) is refused: what has a shape of its own or
// reads state renders from the engine, and a plain line naming values the
// conversation holds is Claude's own, said inline, never fenced. The capture
// skills (`ledger-log-*`) are exempt: they are no flow of Ledger's: no
// steps, deliberately structureless.
// ---------------------------------------------------------------------------

// The capture skills, read from the folder directly under the corpus root's
// `skills/`.
function isCaptureSkill(file, root) {
  const [top, skill = ''] = path.relative(root, file).split(path.sep);
  return top === 'skills' && skill.startsWith('ledger-log-');
}

/** @param {string[]} content */
function isTemplated(content) {
  const text = content.join('\n');
  // Any single-line braced token, deliberately wider than the placeholder
  // grammar: `{2 context lines}` varies as surely as `{topic}` does.
  return /\{[^{}\n]+\}/.test(text) || /@if|@foreach/.test(text);
}

// The line of each templated rendered fence's rendering instruction. An
// instruction quoted inside a fence is an example, never a render site.
function templatedRenderSites(file) {
  const lines = readLines(file);
  const { blocks, inFence } = parseFences(lines);
  const blockAt = new Map(blocks.map((b) => [b.open, b]));
  const sites = [];
  lines.forEach((line, i) => {
    if (inFence[i] || !RENDER_INSTRUCTION_HEAD.test(line)) return;
    let j = i + 1;
    while (j < lines.length && lines[j].trim() === '') j++;
    const block = blockAt.get(j);
    if (block && isTemplated(block.lines.map((l) => l.text))) sites.push(i + 1);
  });
  return sites;
}

function checkNoTemplatedRenders(files, root = REPO) {
  return files
    .filter((file) => !isCaptureSkill(file, root))
    .flatMap((file) => templatedRenderSites(file).map((line) => ({
      file,
      line,
      message: "a templated fence rendered from prose — render it from the engine, or say it inline as Claude's own line (CONVENTIONS → Display)",
    })));
}

// ---------------------------------------------------------------------------
// Check 13b — what earns the capture skills check 13's exemption: each
// knows nothing of the engine beyond its one line (18.6.2). Its SKILL.md
// names the engine — its script, its folder or the state — on one line
// past its frontmatter alone, the capture line for its kind; its
// `allowed-tools` grants that line and nothing else; and no other file of
// the skill names the engine at all.
// ---------------------------------------------------------------------------

const ENGINE_WORDS = /engine\.cjs|ledger-engine|\.ledger\b/;
const CAPTURE_LINE = /^node \.claude\/skills\/ledger-engine\/scripts\/engine\.cjs inbox capture (idea|bug|quick-fix)(?: |$)/;

/** The line after a file's frontmatter, 0 where it has none. @param {string[]} lines */
function pastFrontmatter(lines) {
  if (lines[0] !== '---') return 0;
  const close = lines.indexOf('---', 1);
  return close === -1 ? 0 : close + 1;
}

/** A capture skill's file's faults. @param {string} file @returns {{file: string, line: number, message: string}[]} */
function captureFaults(file) {
  const lines = readLines(file);
  const from = pastFrontmatter(lines);
  const named = lines.map((text, at) => ({ text, at })).filter(({ text, at }) => at >= from && ENGINE_WORDS.test(text));
  if (path.basename(file) !== 'SKILL.md') {
    return named.map(({ at }) => ({ file, line: at + 1, message: 'a capture skill names the engine in its SKILL.md\'s one capture line alone — no other file of it names the engine' }));
  }
  const kind = named.length === 1 ? CAPTURE_LINE.exec(named[0].text)?.[1] : undefined;
  if (kind === undefined) {
    const at = named.find(({ text }) => !CAPTURE_LINE.test(text))?.at ?? named[1]?.at ?? from;
    return [{ file, line: at + 1, message: 'a capture skill names the engine on one line alone, its capture line: node .claude/skills/ledger-engine/scripts/engine.cjs inbox capture <kind> …' }];
  }
  const grant = `allowed-tools: Bash(node .claude/skills/ledger-engine/scripts/engine.cjs inbox capture ${kind} *)`;
  const grants = lines.slice(0, from).map((text, at) => ({ text, at })).filter(({ text }) => text.startsWith('allowed-tools:'));
  if (grants.length === 1 && grants[0].text === grant) return [];
  return [{ file, line: (grants[0]?.at ?? 0) + 1, message: `a capture skill's allowed-tools grants its capture line alone — ${grant}` }];
}

function checkCaptureSkills(files, root = REPO) {
  return files.filter((file) => isCaptureSkill(file, root)).flatMap(captureFaults);
}

// ---------------------------------------------------------------------------
// Check 14 — No buried invocation imperatives. A skill invocation is an
// imperative outside any fence (Loading, Invoking, and Handing Off); a line
// inside a fence invoking `/ledger` or `/ledger-*` is payload text the model
// prints instead of executing — the Portal stall class.
// ---------------------------------------------------------------------------

function checkBuriedInvoke(files) {
  const out = [];
  for (const file of files) {
    const lines = readLines(file);
    const { blocks } = parseFences(lines);
    for (const b of blocks) {
      for (const { n, text } of b.lines) {
        if (/^\s*Invoke `\/ledger(?![a-z])/.test(text)) {
          out.push({ file, line: n + 1, message: 'invocation imperative inside a fence — payload is never instruction; put the imperative outside the fence' });
        }
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Check 21 — an engine section's form is its marker's alone. The section
// marker (`=== TITLE …`, `=== DISPLAY[: label] …`, `=== MENU[: label] …`)
// carries the section's handling instruction, and the framework says to
// follow it, so a sentence that names a section kind or emits a section —
// an active emit verb ("emit", "emits", "emitting", "re-emit…") beside a
// section named by its kind or as a "section" — never states a form of its
// own ("as markdown", "(not a code block)", "(markdown)", a text, properties
// or diff code block or its fence, a bare "as a code block" or "in a code
// block", emphasis ignored): that is a second instruction for it. The
// sentence is the unit, so a neighbouring sentence's form is never the
// section's; a bullet whose subject is a section is one unit, its later
// sentences included. Fenced content is out of scope — the engine's API
// reference describes the markers there — as is the rendering instruction of
// a prose-authored block ("Output the next fenced block as …"), which names
// no engine section.
// ---------------------------------------------------------------------------

const SECTION_KIND = /\b(?:TITLE|DISPLAY|MENU)\b/;
const SECTION_NAMED = /\b(?:TITLE|DISPLAY|MENU|[Ss]ections?)\b/;
const SECTION_BULLET = /^\s*[-*] .*\*\*`?(?:TITLE|DISPLAY|MENU)\b/;
const EMITS = /\b(?:re-)?emit(?:s|ting)?\b/i;
const RESTATED_FORM = /\bas markdown\b|\b(?:as|in) an? (?:[\w-]+ )?code block\b|\b(?:text|properties|diff) code block\b|\(not a code block\)|\(markdown\)|```(?:text|properties|diff)\b/;
const PROSE_BLOCK_INSTRUCTION = /Output the next fenced block as/;

function sectionCallSiteFault(unit) {
  if (PROSE_BLOCK_INSTRUCTION.test(unit)) return null;
  const emits = EMITS.test(unit) && SECTION_NAMED.test(unit);
  if ((emits || SECTION_KIND.test(unit)) && RESTATED_FORM.test(unit.replace(/\*\*/g, ''))) {
    return 'an engine section\'s form is stated in prose — its marker is the one instruction';
  }
  return null;
}

function checkSectionFormsAreTheMarkers(files) {
  const out = [];
  for (const file of files) {
    const lines = readLines(file);
    const { inFence } = parseFences(lines);
    lines.forEach((line, i) => {
      if (inFence[i] || !SECTION_NAMED.test(line)) return;
      const units = SECTION_BULLET.test(line) ? [line] : line.split(/(?<=[.!?])\s+/);
      const fault = units.map(sectionCallSiteFault).find(Boolean);
      if (fault) out.push({ file, line: i + 1, message: fault });
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Check 22 — a flag carrying the user's words takes a quoted placeholder. A
// horizon name or a summary holds spaces; bare, `--horizon {h}` word-splits
// in the shell. Fenced commands and inline command spans alike.
// ---------------------------------------------------------------------------

const UNQUOTED_FREE_TEXT_FLAG = /--(?:horizon|summary) \{/;

function checkQuotedFreeTextFlags(files) {
  const out = [];
  for (const file of files) {
    readLines(file).forEach((line, i) => {
      const hit = line.match(UNQUOTED_FREE_TEXT_FLAG);
      if (hit) out.push({ file, line: i + 1, message: `unquoted free-text flag value "${hit[0]}…" — quote the placeholder ("{…}")` });
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Check 24 — a prose-authored block names its form one way. Every rendering
// instruction ("> *Output the next fenced block as …:*") opens on one of the
// four forms — the engine's, taken from surfaces.cjs so they are said in one
// place — with at most a " — note" before its closing ":*", and the fence
// beneath it carries the tag its form names, bare for markdown. A line
// naming the instruction in any other shape is a legacy or reworded form.
// Fenced content — an example of an instruction — is out of scope.
// ---------------------------------------------------------------------------

const RENDER_FORMS = Object.values(FORMS).map((form) => [form, /```(\w+) fence/.exec(form)?.[1] ?? '']);
const RENDER_INSTRUCTION = new RegExp(`${RENDER_INSTRUCTION_HEAD.source}(.*):\\*$`);
const FENCE_OPENER = /^\s*(?:\d+\.\s+)?```(\S*)\s*$/;

function checkRenderForms(files) {
  const out = [];
  const names = RENDER_FORMS.map(([form]) => `"${form}"`).join(', ');
  for (const file of files) {
    const lines = readLines(file);
    const { inFence } = parseFences(lines);
    lines.forEach((line, i) => {
      if (inFence[i] || !line.includes('Output the next fenced block as')) return;
      const said = RENDER_INSTRUCTION.exec(line)?.[1] ?? '';
      const form = RENDER_FORMS.find(([name]) => said === name || (said.startsWith(name) && /^ — \S/.test(said.slice(name.length))));
      if (!form) {
        out.push({ file, line: i + 1, message: `a rendering instruction names no form — "> *Output the next fenced block as {form}:*", the form one of ${names}` });
        return;
      }
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === '') j++;
      const tag = FENCE_OPENER.exec(lines[j] ?? '')?.[1];
      const wanted = form[1] ? `\`\`\`${form[1]}` : 'a bare fence';
      if (tag === undefined) {
        out.push({ file, line: i + 1, message: `no fence beneath "${form[0]}" — the instruction heads the block it names` });
      } else if (tag !== form[1]) {
        out.push({ file, line: j + 1, message: `the fence beneath "${form[0]}" opens \`\`\`${tag} — its form takes ${wanted}` });
      }
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Check 27 — the framework loads once per conversation, at the head of the
// skill the conversation opens on (CONVENTIONS' The Framework Load): each of
// the engine's HANDOFF_TARGETS — every skill a handoff lands on, the start skill,
// the user's way in, among them — opens its `## Instructions` section on the
// framework load. Every other backbone of Ledger's carries neither the section
// nor the load: a skill only ever opened in place runs in a conversation that
// already holds the framework, and the capture skills are exempt.
// ---------------------------------------------------------------------------

const FRAMEWORK_LOAD = 'Load **[framework.md](../ledger-shared/references/framework.md)** and follow its instructions as written';
const INSTRUCTIONS = /^##\s+Instructions\s*$/;
const HEAD_LOAD = /^(?:→\s+)?Load \*\*\[framework\.md\]\(/;

// The `## Instructions` heading's line and the first line written beneath it,
// or null where the backbone has no such section.
function instructionsOpening(lines, inFence) {
  const heading = lines.findIndex((l, i) => !inFence[i] && INSTRUCTIONS.test(l));
  if (heading === -1) return null;
  let i = heading + 1;
  while (i < lines.length && lines[i].trim() === '') i++;
  return { heading, first: lines[i] || '' };
}

function checkFrameworkLoad(files) {
  const out = [];
  for (const file of files) {
    const name = skillNameOf(file);
    if (!name || !isOurs(name)) continue;
    const lines = readLines(file);
    const { inFence } = parseFences(lines);
    if (HANDOFF_TARGETS.includes(name)) {
      const opening = instructionsOpening(lines, inFence);
      if (!opening || !opening.first.startsWith(FRAMEWORK_LOAD)) {
        const line = (opening ? opening.heading : firstContentIndex(lines)) + 1;
        out.push({ file, line, message: `${name} is a skill a conversation opens on — its \`## Instructions\` section opens with the framework load` });
      }
      continue;
    }
    lines.forEach((line, i) => {
      if (!inFence[i] && (INSTRUCTIONS.test(line) || HEAD_LOAD.test(line))) {
        out.push({ file, line: i + 1, message: `${name} is not a skill a conversation opens on — it carries no framework load and no \`## Instructions\` section` });
      }
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Check 28 — every Bash grant in a frontmatter `allowed-tools` carries a `*`,
// and a grant running a script through `node` ends in ` *` (or its prefix
// form `:*`). A grant is a Claude Code permission rule, and one without a
// trailing ` *` matches no call with arguments, which every script call
// carries. The value is read inline or as an indented list.
// ---------------------------------------------------------------------------

const BASH_GRANT = /Bash\(([^)]*)\)/g;
const SCRIPT_GRANT = /^node\s/;

/** Each Bash grant in a file's frontmatter `allowed-tools`, with its line. */
function* bashGrants(file) {
  const lines = readLines(file);
  if (lines[0] === undefined || lines[0].trim() !== '---') return;
  let inGrants = false;
  for (let i = 1; i < lines.length && lines[i].trim() !== '---'; i++) {
    if (/^\S/.test(lines[i])) inGrants = lines[i].startsWith('allowed-tools:');
    if (!inGrants) continue;
    for (const [, grant] of lines[i].matchAll(BASH_GRANT)) yield { line: i + 1, grant };
  }
}

function checkBashGrantsCarryWildcard(files) {
  const out = [];
  for (const file of files) {
    for (const { line, grant } of bashGrants(file)) {
      if (SCRIPT_GRANT.test(grant)) {
        if (grant.endsWith(' *') || grant.endsWith(':*')) continue;
        out.push({ file, line, message: `Bash(${grant}) is a script grant that does not end in \` *\` or \`:*\` — it matches no call with arguments` });
        continue;
      }
      if (grant.includes('*')) continue;
      out.push({ file, line, message: `Bash(${grant}) has no \`*\` — it matches only that exact command, never a call with arguments; a script grant ends in \` *\`` });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Check 29 — the framework's references load once per conversation (The
// Framework Load; 2.10.9): framework.md loads each file it composes once, and
// no other file loads one, so voice, altitude and the rest come into a
// conversation through the framework's load alone.
// ---------------------------------------------------------------------------

const FRAMEWORK_FILE = /\/skills\/ledger-shared\/references\/framework\.md$/;
const LOAD_TARGET = /[Ll]oad \*\*\[[^\]]+\]\(([^)]+)\)\*\*/g;

// Each file a Load directive outside a fence names, resolved, with its line.
function loadsOf(file) {
  const lines = readLines(file);
  const { inFence } = parseFences(lines);
  return lines.flatMap((line, i) => (inFence[i] ? [] : [...line.matchAll(LOAD_TARGET)].map(([, target]) => ({ target: path.resolve(path.dirname(file), target), line: i + 1 }))));
}

function checkFrameworkLoadsOnce(files) {
  const framework = files.find((file) => FRAMEWORK_FILE.test(posix(file)));
  if (!framework) return [];
  const out = [];
  const composed = new Set();
  for (const { target, line } of loadsOf(framework)) {
    if (composed.has(target)) out.push({ file: framework, line, message: `${path.basename(target)} is loaded twice — the framework loads each file it composes once` });
    composed.add(target);
  }
  for (const file of files) {
    if (file === framework) continue;
    for (const { target, line } of loadsOf(file)) {
      if (composed.has(target)) out.push({ file, line, message: `${path.basename(target)} is the framework's — it loads once per conversation, from framework.md alone` });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Check 30 — no design tool is named in Ledger's prose (9.10.19). A
// design lives in the unit as a file and its live link, whatever drew it, so
// the prose names the artifact and never the tool. The list is the tools a
// spike is likeliest to come from, each a proper noun no plain word shares —
// a tool whose name is a common word (Sketch) stays off it, since a sentence
// opening on the word would read as the tool.
// ---------------------------------------------------------------------------

const DESIGN_TOOLS = ['Figma', 'FigJam', 'Penpot', 'Framer', 'Adobe XD', 'Zeplin', 'InVision', 'Canva', 'Balsamiq', 'Whimsical', 'Miro', 'Excalidraw', 'tldraw', 'Lucidchart', 'Uizard', 'Google Stitch', 'v0.dev'];
const DESIGN_TOOL = new RegExp(`(?<![\\w.])(${DESIGN_TOOLS.map((name) => name.replace(/\./g, '\\.')).join('|')})(?![\\w])`, 'i');

function checkNoDesignTools(files) {
  const out = [];
  for (const file of files) {
    readLines(file).forEach((line, i) => {
      const hit = line.match(DESIGN_TOOL);
      if (hit) out.push({ file, line: i + 1, message: `"${hit[1]}" names a design tool — Ledger names the design, its file and its live link, never the tool that drew it` });
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Check 33 — nothing Ledger ships writes the project's CLAUDE.md
// (8.9.5, 8.S27). It loads into every session and subagent and is the
// person's to write: a pointer there to the product record is their line. No
// prose sentence tells a session to write, add to or change it — a sentence
// naming it with a verb of writing, neither negated nor with the person as
// its writer — and no engine or mod code names it outside a comment.
// ---------------------------------------------------------------------------

const WRITE_VERB = /\b(writ(e|es|ing|ten)|wrote|append(s|ed|ing)?|add(s|ed|ing)?|insert(s|ed|ing)?|put(s|ting)?|edit(s|ed|ing)?|updat(e|es|ed|ing)|modif(y|ies|ied|ying)|chang(e|es|ed|ing)|overwrit(e|es|ing|ten)|rewrit(e|es|ing|ten))\b/i;
const NEGATED = /\b(never|not|no|nothing|nor)\b|n't\b/i;
const THE_PERSON = /\b(the person|the user)\b/i;

/** Whether a sentence tells a session to write the project's CLAUDE.md. @param {string} sentence */
const writesClaudeMd = (sentence) => /CLAUDE\.md/.test(sentence) && WRITE_VERB.test(sentence) && !NEGATED.test(sentence) && !THE_PERSON.test(sentence);

/** The shipped code: the engine's and the mods', comments left out. */
function codeFiles(root = REPO) {
  const out = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) { if (entry.name !== 'node_modules' && entry.name !== 'tests') walk(p); }
      else if (/\.(cjs|js|mjs|ts)$/.test(entry.name)) out.push(p);
    }
  };
  walk(path.join(root, 'skills'));
  return out.sort();
}

/** A code line with any comment it carries taken off. @param {string} line */
const uncommented = (line) => (/^\s*(\/\/|\*|\/\*)/.test(line) ? '' : line.replace(/\s\/\/.*$/, ''));

function checkNoClaudeMdWrites(files, code = []) {
  const out = [];
  for (const file of files) {
    readLines(file).forEach((line, i) => {
      if (line.split(/(?<=[.!?;])\s+/).some(writesClaudeMd)) out.push({ file, line: i + 1, message: 'writes the project\'s CLAUDE.md — it is the person\'s to write; Ledger never changes it' });
    });
  }
  for (const file of code) {
    readLines(file).forEach((line, i) => {
      if (/CLAUDE\.md/.test(uncommented(line))) out.push({ file, line: i + 1, message: 'names CLAUDE.md in code — Ledger never writes the project\'s CLAUDE.md' });
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Check 34 — 12.S46: the build's prose names no personal skill, prescribes
// no red-green loop, and never tells the builder to break a task down, keep
// a to-do list, check its own work, or finish rather than leave stubs
// (12.1.7, 12.3.8, 12.8.1). The build's prose is its skill, each reference
// in its folder the skill loads, at any depth, and the definitions of the
// agents it dispatches; a reference it no longer loads is no part of it.
// The agents' templates are test-engine-brief-build.cjs's.
// ---------------------------------------------------------------------------

const BUILD_SKILL = 'ledger-implementation-process';
const BUILD_AGENTS = ['ledger-builder', 'ledger-reviewer', 'ledger-task-writer', 'ledger-consolidation'];
const BUILD_PROSE_RULES = [
  [/~\/\.claude\b|\.claude\/skills\/(?!ledger)|Invoke `\/(?!ledger)/, 'names a personal skill — the build carries its shape in its own prose (12.1.7)'],
  [/red[- ]green|\bTDD\b|\btests? first\b/i, 'prescribes a red-green loop — tests are written from the criteria in any order (12.8.1)'],
  [/break (?:it|the task|this task|tasks?) down|to-?do list|(?:check|verify) (?:your|its) (?:own )?work|\bstubs?\b/i, 'tells the builder to break a task down, keep a to-do list, check its own work or leave no stubs (12.3.8)'],
];
const LINKED_MD = /\]\(([^)#\s]+\.md)\)/g;

/** The build's skill, each reference in its folder it loads at any depth, and its agents' definitions, among `files`. */
function buildProse(files) {
  const skill = files.find((file) => skillNameOf(file) === BUILD_SKILL);
  const agents = files.filter((file) => BUILD_AGENTS.some((agent) => file.endsWith(`${path.sep}agents${path.sep}${agent}.md`)));
  if (skill === undefined) return agents;
  const folder = path.dirname(skill) + path.sep;
  const loaded = [skill];
  for (let at = 0; at < loaded.length; at++) {
    for (const [, link] of fs.readFileSync(loaded[at], 'utf8').matchAll(LINKED_MD)) {
      const target = path.resolve(path.dirname(loaded[at]), link);
      if (target.startsWith(folder) && files.includes(target) && !loaded.includes(target)) loaded.push(target);
    }
  }
  return [...loaded, ...agents];
}

function checkBuildProse(files) {
  const out = [];
  for (const file of buildProse(files)) {
    readLines(file).forEach((line, i) => {
      for (const [rule, message] of BUILD_PROSE_RULES) if (rule.test(line)) out.push({ file, line: i + 1, message });
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Check 35 — the start skill follows boot's stops as data. Boot names each
// stop's marker, screen and what follows it (`STOPS`), and one rule in the
// start skill follows whatever it names: the skill surfaces boot's warnings
// before it follows any stop, runs every boot again with the person's words
// as the first, names the boot call's description — so the tool's label
// reads `Start Ledger`, never the stdin it is given — says the marker where
// a stop names one,
// fetches the screen boot names, carries a bullet for each kind of next a
// stop has — none, or the next's kind — and a load for each reference a
// stop's next names, and gives no stop a heading of its own — a stop joins
// without a word of prose. Ahead of boot, on the bare command alone, it
// fetches the banner, once (18.2.15).
// ---------------------------------------------------------------------------

const START_SKILL = 'ledger';
const STOP_SCREEN = /engine\.cjs render \{surface\} \{args\}/;
const STOP_MARKER = /\*\*`▪ \{marker\}`\*\*/;
const BOOT_WARNINGS = /Surface the answer's `warnings` first/;
const BOOT_AGAIN = /Every boot the start runs again is this one, words and all\./;
const BOOT_DESCRIBED = /the call described as `Start Ledger`/;
const BANNER_BARE = /^On the bare command, with no words, fetch the banner first:$/;
const BANNER_FETCH = /engine\.cjs render banner$/;
const BOOT_CALL = /engine\.cjs boot\b/;

/** @typedef {Record<string, {marker?: string, next: {kind: string, reference?: string}|null}>} Stops */

/** Each reference a stop's next loads. @param {Stops} stops */
const stopLoads = (stops) => Object.values(stops).flatMap(({ next }) => (next?.kind === 'load' ? [String(next.reference)] : []));

/** Each kind of next the stops have, as the start skill's bullet names it: `None`, or the kind in a code span. @param {Stops} stops */
const nextKinds = (stops) => [...new Set(Object.values(stops).map(({ next }) => (next === null ? 'None' : `\`${next.kind}\``)))];

/** @param {string[]} files @param {Stops} [stops] */
function checkBootStops(files, stops = STOPS) {
  const out = [];
  const named = new RegExp(`^#{1,6}\\s.*\`(${Object.keys(stops).join('|')})\``);
  for (const file of files.filter((f) => skillNameOf(f) === START_SKILL && f.endsWith('SKILL.md'))) {
    const lines = readLines(file);
    const { inFence } = parseFences(lines);
    const prose = (/** @type {(line: string) => boolean} */ test) => lines.some((line, i) => !inFence[i] && test(line));
    const screen = lines.findIndex((line, i) => inFence[i] && STOP_SCREEN.test(line));
    const warned = lines.findIndex((line, i) => !inFence[i] && BOOT_WARNINGS.test(line));
    if (screen === -1) out.push({ file, line: 1, message: 'the start skill fetches no stop\'s screen as boot names it — `render {surface} {args}`' });
    if (warned === -1 || (screen !== -1 && warned > screen)) out.push({ file, line: 1, message: 'the start skill surfaces boot\'s `warnings` before it follows any stop' });
    if (!prose((line) => BOOT_AGAIN.test(line))) out.push({ file, line: 1, message: 'the start skill never says a boot it runs again carries the words — "Every boot the start runs again is this one, words and all."' });
    if (!prose((line) => BOOT_DESCRIBED.test(line))) out.push({ file, line: 1, message: 'the start skill never names the boot call\'s description — "the call described as `Start Ledger`"' });
    const bare = lines.findIndex((line, i) => !inFence[i] && BANNER_BARE.test(line));
    const banners = lines.flatMap((line, i) => (inFence[i] && BANNER_FETCH.test(line) ? [i] : []));
    const boot = lines.findIndex((line, i) => inFence[i] && BOOT_CALL.test(line));
    if (bare === -1 || banners.length !== 1 || banners[0] < bare || boot === -1 || banners[0] > boot) out.push({ file, line: 1, message: 'the start skill fetches the banner once, ahead of boot, on the bare command alone — "On the bare command, with no words, fetch the banner first:", then `render banner`' });
    if (Object.values(stops).some(({ marker }) => marker !== undefined) && !prose((line) => STOP_MARKER.test(line))) out.push({ file, line: 1, message: 'a stop names a marker, and the start skill never says it — **`▪ {marker}`**' });
    for (const kind of nextKinds(stops)) {
      if (!prose((line) => line.startsWith(`- **${kind}** — `))) out.push({ file, line: 1, message: `a stop's next is ${kind}, and the start skill has no bullet following it — \`- **${kind}** —\`` });
    }
    for (const reference of stopLoads(stops)) {
      const load = `Load **[${reference}.md](references/${reference}.md)**`;
      if (!prose((line) => line.includes(load))) out.push({ file, line: 1, message: `a stop loads \`${reference}\`, and the start skill has no load of references/${reference}.md` });
    }
    lines.forEach((line, i) => {
      const heading = inFence[i] ? null : named.exec(line);
      if (heading !== null) out.push({ file, line: i + 1, message: `a heading of its own for boot's \`${heading[1]}\` stop — boot names the stop, and one rule follows it` });
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Check 37 — a skill's description is all Claude sees of it until it is
// invoked (18.2.16, 18.2.17). The start skill's opens with its trigger;
// every other skill a handoff lands on (`HANDOFF_TARGETS`) says it is reached
// only through a Ledger handoff, never invoked directly.
// ---------------------------------------------------------------------------

const TRIGGER = /^Use (?:for|when)\b/;
const HANDOFF_ONLY = /Reached only through a Ledger handoff, never invoked directly\b/;

/** The frontmatter's `description`, and its line; null where it has none. @param {string[]} lines */
function descriptionOf(lines) {
  if (lines[0] !== '---') return null;
  for (let i = 1; i < lines.length && lines[i] !== '---'; i++) {
    const field = /^description:\s*(.*)$/.exec(lines[i]);
    if (field !== null) return { text: field[1], line: i + 1 };
  }
  return null;
}

function checkDescriptions(files, targets = HANDOFF_TARGETS) {
  const out = [];
  for (const file of files.filter((f) => f.endsWith('SKILL.md') && targets.includes(skillNameOf(f)))) {
    const description = descriptionOf(readLines(file));
    const line = description?.line ?? 1;
    if (skillNameOf(file) === START_SKILL) {
      if (!TRIGGER.test(description?.text ?? '')) out.push({ file, line, message: 'the start skill\'s description opens with its trigger — "Use for …"' });
    } else if (!HANDOFF_ONLY.test(description?.text ?? '')) {
      out.push({ file, line, message: 'a skill a handoff lands on says in its description it is reached only through a Ledger handoff, never invoked directly' });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Check 38 — no skill keeps a section of its own on resuming after a
// refresh (24.2.6): the engine's note carries the recovery whole.
// ---------------------------------------------------------------------------

const RESUME_HEADING = /^#{1,6}\s.*\b(?:refresh\w*|compaction|resum\w* after)\b/i;

function checkNoResumeSections(files) {
  const out = [];
  for (const file of files) {
    const lines = readLines(file);
    const { inFence } = parseFences(lines);
    lines.forEach((line, i) => {
      if (!inFence[i] && RESUME_HEADING.test(line)) out.push({ file, line: i + 1, message: 'a section of its own on resuming — the engine\'s note carries the recovery whole' });
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Check 36 — a skill that draws a menu whose back draws the start menu loads
// the start menu's reference, so the start menu's rows have their prose when
// that `next` draws it in the skill's conversation. The start skill owns the
// reference. Which menus' backs draw the start menu is the engine's, read
// from no prose: the list below is theirs, held by hand.
// ---------------------------------------------------------------------------

const BACK_TO_START_MENUS = ['epic-menu', 'roadmap', 'manage', 'closed'];
const START_MENU_LOAD = /Load \*\*\[start-menu\.md\]\((?:\.\.\/)+ledger\/references\/start-menu\.md\)\*\*/;

/** The skill a file under `skills/` belongs to, by its folder. @param {string} file */
function skillFolderOf(file) {
  const parts = file.split(path.sep);
  const idx = parts.lastIndexOf('skills');
  return idx === -1 ? null : parts[idx + 1] ?? null;
}

function checkBackToStartLoads(files, menus = BACK_TO_START_MENUS) {
  const draws = new RegExp(`engine\\.cjs render (${menus.join('|')})(?=\\s|$)`);
  /** @type {Map<string, {loads: boolean, draws: {file: string, line: number, menu: string}[]}>} */
  const skills = new Map();
  for (const file of files) {
    const skill = skillFolderOf(file);
    if (skill === null || skill === START_SKILL) continue;
    const seen = skills.get(skill) ?? { loads: false, draws: [] };
    readLines(file).forEach((line, i) => {
      if (START_MENU_LOAD.test(line)) seen.loads = true;
      const drawn = draws.exec(line);
      if (drawn !== null) seen.draws.push({ file, line: i + 1, menu: drawn[1] });
    });
    skills.set(skill, seen);
  }
  return [...skills.entries()].flatMap(([skill, { loads, draws: drawn }]) => (loads ? [] : drawn.map(({ file, line, menu }) => ({
    file, line, message: `${skill} draws the ${menu}, whose back draws the start menu, and loads no start-menu.md`,
  }))));
}

// ---------------------------------------------------------------------------
// Registry + reporting
// ---------------------------------------------------------------------------

const CHECKS = [
  ['1: chrome keeps its glyphs', checkChromeGlyphs],
  ['3: no menus in prose', checkNoProseMenus],
  ['5: banned navigation verbs', checkBannedNav],
  ['6: internal routing-target existence', checkRouting],
  ['7: markdown link resolution', checkLinks],
  ['7b: a load is its own line, never carried mid-sentence', checkLoadLines],
  ['8: H1 category rule', checkH1Category],
  ['10: reference-file attribution', checkAttribution],
  ['11: load-directive footers (On return)', checkLoadFooters],
  ['13: nothing rendered from prose varies', checkNoTemplatedRenders],
  ['13b: a capture skill knows the engine by its one capture line alone', checkCaptureSkills],
  ['14: buried invocation imperatives', checkBuriedInvoke],
  ['15: cross-file section references', checkCrossFileSections],
  ['21: an engine section\'s form is its marker\'s alone', checkSectionFormsAreTheMarkers],
  ['22: free-text flag values are quoted', checkQuotedFreeTextFlags],
  ['24: rendering instructions name one of four forms over a fence carrying its tag', checkRenderForms],
  ['27: the framework loads at the head of the skills a conversation opens on', checkFrameworkLoad],
  ['28: every allowed-tools Bash grant carries a wildcard', checkBashGrantsCarryWildcard],
  ['29: the framework\'s references load once, from framework.md alone', checkFrameworkLoadsOnce],
  ['30: no design tool is named', checkNoDesignTools],
  ['33: nothing writes the project\'s CLAUDE.md', (files) => checkNoClaudeMdWrites(files, codeFiles())],
  ['34: the build\'s prose prescribes nothing the builder does unprompted', checkBuildProse],
  ['35: the start skill follows boot\'s stops as data', checkBootStops],
  ['36: a skill drawing a menu whose back is the start menu loads start-menu.md', checkBackToStartLoads],
  ['37: the start skill\'s description opens with its trigger, and every other skill a handoff lands on says it is reached only through one', checkDescriptions],
  ['38: no skill keeps a section of its own on resuming', checkNoResumeSections],
];

function report(violations) {
  return violations.map((v) => `  ${rel(v.file)}:${v.line} — ${v.message}`).join('\n');
}

// ---------------------------------------------------------------------------
// Temp-fixture harness for negative tests
// ---------------------------------------------------------------------------

function withTemp(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'conv-lint-'));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

function write(dir, relPath, content) {
  const p = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
  return p;
}

// ---------------------------------------------------------------------------
// Corpus tests — every check must find zero violations on the audited tree.
// ---------------------------------------------------------------------------

const CORPUS = corpusFiles();

test('corpus is non-empty and covers both scan roots', () => {
  assert.ok(CORPUS.length > 150, `expected a large corpus, found ${CORPUS.length}`);
  assert.ok(CORPUS.some((f) => f.includes(`${path.sep}skills${path.sep}`)), 'skills/**/*.md not scanned');
  assert.ok(CORPUS.some((f) => f.includes(`${path.sep}agents${path.sep}`)), 'agents/*.md not scanned');
});

for (const [label, fn] of CHECKS) {
  test(`check ${label} — corpus is clean`, () => {
    const violations = fn(CORPUS);
    assert.strictEqual(violations.length, 0, `expected 0 violations, found ${violations.length}:\n${report(violations)}`);
  });
}

// ---------------------------------------------------------------------------
// Negative tests — each check must catch deliberately broken fixtures, and
// must NOT flag the sanctioned edge cases it is designed to permit.
// ---------------------------------------------------------------------------

test('check 1 (chrome glyphs) — catches a phase title on any listed glyph but ■ and a marker on ■, permits ■ titles, □ and ▪ markers and a fence of more than one line', () => {
  withTemp((dir) => {
    const good = write(dir, 'skills/x/good.md', [
      '```', '# **`■ Overview`**', '```', '',
      '```', '**`□ Construct Specification`**', '```', '',
      '```', '**`▪ Extract Sources`**', '```', '',
      '```', '**`■ Not a marker`**', 'a second line', '```', '',
    ].join('\n'));
    assert.strictEqual(checkChromeGlyphs([good]).length, 0, `the chrome's own glyphs pass, got ${report(checkChromeGlyphs([good]))}`);

    const bad = write(dir, 'skills/x/bad.md', [
      '```', '# **`□ Overview`**', '```', '',
      '```', '**`■ Construct Specification`**', '```', '',
      '```', '# **`● Overview`**', '```', '',
      '```', '# **`⚑ Overview`**', '```', '',
    ].join('\n'));
    assert.deepStrictEqual(checkChromeGlyphs([bad]).map((v) => v.line).sort((a, b) => a - b), [2, 6, 10, 14], `a title off ■ — on □, ● or ⚑ — and a marker on ■ are caught, got ${report(checkChromeGlyphs([bad]))}`);
  });
});

test('check 3 (no menus in prose) — catches dot rules and option rows anywhere, permits chrome, definitions, and key references', () => {
  withTemp((dir) => {
    const menu = write(dir, 'skills/x/menu.md', [
      '> *Output the next fenced block as markdown (not a code block):*',
      '',
      '```',
      MENU_FRAME,
      '**`◆ Proceed?`**',
      '',
      '**`y/yes`**      → Conclude',
      '**`n/no`**',
      '**Keep going** → Tell me what else to explore',
      '```',
      '',
    ].join('\n'));
    const v1 = checkNoProseMenus([menu]);
    assert.deepStrictEqual(v1.map((v) => v.line), [4, 7, 8], 'the dot rule, a padded row, and a bare row are each caught — fenced or not');
    assert.match(v1[0].message, /menu dot rule in prose/);
    assert.match(v1[1].message, /menu option row in prose/);

    const loose = write(dir, 'skills/x/loose.md', [
      '   ' + MENU_FRAME,
      Array(11).fill(DOT).join(' '),
      DOT + '  ' + DOT + '  ' + DOT,
      '**`1`** → Auth Flow',
      '- **`b/back`** → Return to menu',
      '2. **`{N}`** → {Format Name}',
      '',
    ].join('\n'));
    assert.strictEqual(checkNoProseMenus([loose]).length, 6, 'nested, malformed, and spaced-out rules and numbered, listed, or templated rows are caught');

    const prose = write(dir, 'skills/x/prose.md', [
      '# **`■ Planning Overview`**',
      '**`□ Construct Specification`**',
      '**`▪ Extract Sources`**',
      '**`◆ Proceed?`**',
      '**pending** → Identified but not yet explored.',
      '**`boot`** — the entry pipeline.',
      'The `b/back` row returns to the menu; **`y/yes`** is the affirmative key.',
      '  ' + DOT + ' advanced-features',
      '',
    ].join('\n'));
    assert.strictEqual(checkNoProseMenus([prose]).length, 0, 'chrome markers, definitions, inline key references, and a bullet dot are not menus');
  });
});

test('check 5 (banned nav) — catches banned verbs, permits Proceed/Return', () => {
  withTemp((dir) => {
    const cases = ['→ Go to **Step 2**.', '→ Jump to **B. X**.', '→ Skip to **Step 3**.', '→ Continue to **Step 4**.', '→ Enter **Step 6**.', '→ Proceed directly to **Step 5**.'];
    cases.forEach((c, idx) => {
      const f = write(dir, `skills/x/${idx}.md`, c + '\n');
      assert.strictEqual(checkBannedNav([f]).length, 1, `must catch "${c}"`);
    });
    const good = write(dir, 'skills/x/ok.md', '→ Proceed to **Step 2**.\n→ Return to caller.\n→ Continue with the session loop.\n');
    assert.strictEqual(checkBannedNav([good]).length, 0, 'sanctioned navigation must pass');
  });
});

test('check 6 (routing) — catches dangling targets, skips exempt shapes', () => {
  withTemp((dir) => {
    const badStep = write(dir, 'skills/x/a.md', '## Step 1: Start\n\n→ Proceed to **Step 9**.\n');
    assert.strictEqual(checkRouting([badStep]).length, 1, 'dangling Step target must be caught');

    const badOnReturn = write(dir, 'skills/x/ar.md', '## Step 1: Start\n\n→ On return, proceed to **Step 9**.\n');
    assert.strictEqual(checkRouting([badOnReturn]).length, 1, 'dangling On-return target must be caught');

    const badLettered = write(dir, 'skills/x/b.md', '## A. First\n\n→ Proceed to **Z. Missing**.\n');
    assert.strictEqual(checkRouting([badLettered]).length, 1, 'dangling lettered target must be caught');

    const good = write(
      dir,
      'skills/x/c.md',
      '## Step 1: Start\n→ Proceed to **Step 2**.\n\n## Step 2: Next\n\n## B. Second Section\n→ Return to **B. Second Section**.\n→ Return to caller.\n→ Return to **[the skill](../SKILL.md)** for **Step 7**.\n→ Proceed to **{next_section}**.\n'
    );
    assert.strictEqual(checkRouting([good]).length, 0, 'resolvable / caller / escape / param targets must pass');
  });
});

test('check 15 (cross-file sections) — catches letter drift, honours local and fenced exemptions', () => {
  withTemp((dir) => {
    write(dir, 'skills/x/target.md', '## A. Read\n\n## E. Mid-Session Check\n');

    const drifted = write(dir, 'skills/x/caller.md', 'follow **D. Mid-Session Check** in **[target.md](target.md)**.\n');
    const v = checkCrossFileSections([drifted]);
    assert.strictEqual(v.length, 1, 'a drifted letter must be caught');
    assert.match(v[0].message, /D\. Mid-Session Check/);

    const good = write(dir, 'skills/x/good.md', 'follow **E. Mid-Session Check** in **[target.md](target.md)**.\n');
    assert.strictEqual(checkCrossFileSections([good]).length, 0, 'a matching reference must pass');

    // An intra-file lettered route sharing its line with an unrelated link
    // must resolve against local headings — never a false positive.
    const local = write(
      dir,
      'skills/x/local.md',
      '## B. Second Section\n\nLoad **[target.md](target.md)**, then → Return to **B. Second Section**.\n'
    );
    assert.strictEqual(checkCrossFileSections([local]).length, 0, 'local heading beside an unrelated link must pass');

    const fenced = write(dir, 'skills/x/fenced.md', '```\nfollow **Z. Nowhere** in **[target.md](target.md)**\n```\n');
    assert.strictEqual(checkCrossFileSections([fenced]).length, 0, 'fenced examples are exempt');

    const missing = write(dir, 'skills/x/missing.md', 'follow **Q. Gone** in **[nope.md](nope.md)**.\n');
    assert.strictEqual(checkCrossFileSections([missing]).length, 0, 'a missing linked file is check 7\'s finding');

    const param = write(dir, 'skills/x/param.md', 'follow **{X}. Something** in **[target.md](target.md)**.\n');
    assert.strictEqual(checkCrossFileSections([param]).length, 0, 'parameterised tokens are exempt');
  });
});

test('check 7 (links) — catches broken links, skips fenced/external/placeholder/scaffolding', () => {
  withTemp((dir) => {
    write(dir, 'skills/x/real.md', '# real\n');
    const bad = write(dir, 'skills/x/a.md', '[missing](nope.md)\n[real](real.md)\n');
    const v = checkLinks([bad]);
    assert.strictEqual(v.length, 1, `only the broken link must be caught, got ${v.length}`);
    assert.match(v[0].message, /nope\.md/);

    const exempt = write(
      dir,
      'skills/x/b.md',
      '```\n[fenced](nope.md)\n```\n[ext](https://example.com/x.md)\n[tmpl]({work_unit}/f.md)\n[anchor](#section)\n'
    );
    assert.strictEqual(checkLinks([exempt]).length, 0, 'fenced/external/placeholder/anchor links must be skipped');
  });
});

test('check 7b (load lines) — catches a load carried mid-sentence, permits one opening its line, after an arrow or a list marker, or after a sentence\'s end, and skips fences', () => {
  withTemp((dir) => {
    const load = 'Load **[choosing-a-horizon.md](choosing-a-horizon.md)** with names = `{name}` and follow its instructions as written.';
    const bad = write(dir, 'skills/x/a.md', `The horizon is the one they named, else ${load}\nFor each they gave none, ${load}\n`);
    assert.deepStrictEqual(checkLoadLines([bad]).map(({ line }) => line), [1, 2]);

    const good = write(dir, 'skills/x/b.md', `${load}\n→ ${load}\n- ${load}\n2. ${load}\nThe person shares a file. ${load}\nOnce it is drawn: ${load}\n**If the answer is yes.** ${load}\n\`\`\`\nsay so, then ${load}\n\`\`\`\n`);
    assert.strictEqual(checkLoadLines([good]).length, 0, 'a load opening its line, after an arrow, a list marker or a sentence\'s end, or in a fence, must pass');
  });
});

test('check 8 (H1 category) — enforces the processing/backbone split', () => {
  withTemp((dir) => {
    const procNoH1 = write(dir, 'skills/ledger-foo-process/SKILL.md', 'One-liner purpose.\n\n## Step 0\n');
    assert.strictEqual(checkH1Category([procNoH1]).length, 1, 'processing backbone without H1 must be caught');

    const startWithH1 = write(dir, 'skills/ledger/SKILL.md', '# Ledger Start\n\nOne-liner.\n');
    assert.strictEqual(checkH1Category([startWithH1]).length, 1, 'start backbone with H1 must be caught');

    const navWithH1 = write(dir, 'skills/ledger-continue-foo/SKILL.md', '# Continue Foo\n\nOne-liner.\n');
    assert.strictEqual(checkH1Category([navWithH1]).length, 1, 'navigation backbone with H1 must be caught');

    const procGood = write(dir, 'skills/ledger-bar-process/SKILL.md', '# Bar Process\n\nOne-liner.\n');
    const menuGood = write(dir, 'skills/ledger-continue-epic/SKILL.md', 'One-liner purpose.\n\n## Step 0\n');
    const roadmapGood = write(dir, 'skills/ledger-roadmap/SKILL.md', 'One-liner purpose.\n\n## The Menu\n');
    const engineGood = write(dir, 'skills/ledger-engine/SKILL.md', '# Ledger Engine\n\nOne-liner.\n');
    const discoveryGood = write(dir, 'skills/ledger-discovery/SKILL.md', '---\nname: ledger-discovery\n---\n\n# Discovery\n\nOne-liner.\n');
    assert.strictEqual(checkH1Category([procGood, menuGood, roadmapGood, engineGood, discoveryGood]).length, 0, 'correctly-categorised backbones must pass');

    const discoveryNoH1 = write(dir, 'skills/ledger-discovery/SKILL.md', 'One-liner purpose.\n\n## Entering\n');
    assert.strictEqual(checkH1Category([discoveryNoH1]).length, 1, 'discovery is a phase that talks: without an H1 it must be caught');
  });
});

test('check 10 (attribution) — catches missing/wrong attribution', () => {
  withTemp((dir) => {
    const missing = write(dir, 'skills/x/references/a.md', '# Some Reference\n\nStraight into content with no attribution.\n');
    assert.strictEqual(checkAttribution([missing]).length, 1, 'missing attribution must be caught');

    const wrong = write(dir, 'skills/x/references/b.md', '# Some Reference\n\n*Loaded by whoever.*\n');
    assert.strictEqual(checkAttribution([wrong]).length, 1, 'non-sanctioned attribution must be caught');

    const refForm = write(dir, 'skills/x/references/c.md', '# C\n\n*Reference for **[skill-name](../SKILL.md)***\n\n---\n');
    const sharedForm = write(dir, 'skills/x/references/d.md', '# D\n\n*Shared reference for all Ledger skills.*\n');
    assert.strictEqual(checkAttribution([refForm, sharedForm]).length, 0, 'sanctioned forms must pass');
  });
});

test('check 11 (load footers) — catches bare proceed after a load, permits gated/branch/fenced shapes', () => {
  withTemp((dir) => {
    const bad = write(
      dir,
      'skills/x/SKILL.md',
      '## Step 1: A\n\nLoad **[a.md](references/a.md)** and follow its instructions as written.\n\n→ Proceed to **Step 2**.\n\n## Step 2: B\n'
    );
    assert.strictEqual(checkLoadFooters([bad]).length, 1, 'bare proceed after a load must be caught');

    const good = write(
      dir,
      'skills/x/ok.md',
      '## Step 1: A\n\nLoad **[a.md](references/a.md)** and follow its instructions as written.\n\n→ On return, proceed to **Step 2**.\n\n## Step 2: B\n\n→ Proceed to **Step 1**.\n'
    );
    assert.strictEqual(checkLoadFooters([good]).length, 0, 'conditional footer and load-free proceed must pass');

    const gated = write(
      dir,
      'skills/x/gated.md',
      '## A. First\n\nLoad **[a.md](a.md)** and follow its instructions as written.\n\n**STOP.** Wait for user response.\n\n→ Proceed to **B. Next**.\n\n## B. Next\n'
    );
    assert.strictEqual(checkLoadFooters([gated]).length, 0, 'STOP between load and proceed re-keys the footer — bare must pass');

    const branch = write(
      dir,
      'skills/x/branch.md',
      '## A. First\n\nLoad **[a.md](a.md)** and follow its instructions as written.\n\n**If nothing to recover:**\n\n→ Proceed to **B. Next**.\n\n## B. Next\n'
    );
    assert.strictEqual(checkLoadFooters([branch]).length, 0, 'bold conditional between load and proceed must pass');

    const otherwise = write(
      dir,
      'skills/x/otherwise.md',
      '## A. First\n\n**If shaped:**\n\nLoad **[a.md](a.md)** and follow its instructions as written.\n\n→ On return, proceed to **B. Next**.\n\n**Otherwise:**\n\n→ Proceed to **B. Next**.\n\n## B. Next\n'
    );
    assert.strictEqual(checkLoadFooters([otherwise]).length, 0, 'bold Otherwise between load and proceed must pass');

    const fenced = write(
      dir,
      'skills/x/fenced.md',
      '```\nLoad **[a.md](a.md)** and follow its instructions as written.\n\n→ Proceed to **Step 2**.\n```\n'
    );
    assert.strictEqual(checkLoadFooters([fenced]).length, 0, 'fenced illustrative seam must be exempt');
  });
});

test('check 13 (nothing rendered from prose varies) — catches a templated fence of any kind outside any fence, skips static fences and the capture skills (6.S21)', () => {
  withTemp((dir) => {
    const sites = (file) => checkNoTemplatedRenders([file], dir).map((v) => v.line);
    const instr = '> *Output the next fenced block as markdown (not a code block):*\n\n';
    const templatedMenu = instr + '```\n· · · · · · · · · · · ·\nContinue "{topic}"?\n\n- **`y/yes`**\n· · · · · · · · · · · ·\n```\n';
    const textInstr = '> *Output the next fenced block as a text code block (```text fence):*';
    const capture = `${textInstr}\n\n\`\`\`text\nLogged idea: {slug}\n\`\`\`\n`;

    const fresh = write(dir, 'skills/x/a.md', templatedMenu + '\n' + templatedMenu);
    const v1 = checkNoTemplatedRenders([fresh], dir);
    assert.deepStrictEqual(v1.map((v) => v.line), [1, 11], 'every templated fence is caught, at its instruction');
    assert.match(v1[0].message, /a templated fence rendered from prose — render it from the engine, or say it inline as Claude's own line \(CONVENTIONS → Display\)/);

    const numbered = write(dir, 'skills/x/f.md', `1. Do the thing.\n4. ${textInstr}\n\n   \`\`\`text\n   Task {id} authored.\n   \`\`\`\n`);
    assert.deepStrictEqual(sites(numbered), [2], 'an instruction after a numbered marker is caught');

    const quoted = write(dir, 'skills/x/h.md', `\`\`\`markdown\n${textInstr}\n\`\`\`\n\nRender the {surface} surface.\n\n\`\`\`bash\nengine render x\n\`\`\`\n`);
    assert.deepStrictEqual(sites(quoted), [], "an instruction quoted inside a fence is an example — the example's closing fence opens no display");

    const outer = write(dir, 'skills/x/i.md', `${instr}\`\`\`\`markdown\n\`\`\`text\nStatic.\n\`\`\`\nTask {id} authored.\n\`\`\`\`\n`);
    assert.deepStrictEqual(sites(outer), [1], 'a four-backtick fence runs past the inner fence it holds');

    assert.deepStrictEqual(sites(write(dir, 'skills/ledger-log-idea/SKILL.md', capture)), [], 'the capture skills are exempt');
    assert.deepStrictEqual(sites(write(dir, 'skills/ledger-log-idea/references/r.md', capture)), [], "the exemption covers the capture skill's whole folder");
    assert.deepStrictEqual(sites(write(dir, 'skills/x/references/skills/ledger-log-idea/SKILL.md', capture)), [1], 'a capture-named folder nested inside another skill is not exempt');
    assert.deepStrictEqual(sites(write(dir, 'skills/ledger-login/SKILL.md', capture)), [1], 'the exemption is the capture skills alone');

    const statik = write(dir, 'skills/x/c.md', instr + '```\n· · · · · · · · · · · ·\nProceed?\n- **`y/yes`**\n· · · · · · · · · · · ·\n```\n');
    assert.deepStrictEqual(sites(statik), [], 'static menu is always fine');

    const marker = write(dir, 'skills/x/d.md', instr + '```\n**`□ Consolidation Pass (phase {N})`**\n```\n\n' + instr + '```\n**`▪ Processing {source}`**\n```\n');
    assert.deepStrictEqual(sites(marker), [1, 7], 'a step or sub-step marker naming anything that varies is caught');

    const signpost = write(dir, 'skills/x/g.md', instr + '```\n> Working on {topic} — questions about gaps\n> and contradictions follow.\n```\n\n' +
      instr + '```\n> @if(resumed) Picking it back up. @else Starting. @endif Lead wherever you want.\n```\n');
    assert.deepStrictEqual(sites(signpost), [1, 8], 'a signpost carrying a placeholder or a directive is caught');

    const nested = write(dir, 'skills/x/j.md', `1. Open the step.\n2. ${instr.trimEnd()}\n\n   \`\`\`\n   **\`□ Interviewing {area} ({n} of {total})\`**\n   \`\`\`\n\n3. ${instr.trimEnd()}\n\n   \`\`\`\n   > Applying {count} corrections.\n   \`\`\`\n`);
    assert.deepStrictEqual(sites(nested), [2, 8], 'a templated marker or signpost under a list number is caught');

    const staticChrome = write(dir, 'skills/x/k.md', instr + '```\n**`□ Document Review`**\n```\n\n' + instr + '```\n> Reconciling the session log against the conversation.\n```\n');
    assert.deepStrictEqual(sites(staticChrome), [], 'a static marker and signpost stay authored in prose');

    const diffForm = write(
      dir,
      'skills/x/e.md',
      '> *Output the next fenced block as a ` ```diff ` code block:*\n\n```diff\n {context}\n-{removed lines}\n+{new lines}\n```\n'
    );
    assert.deepStrictEqual(sites(diffForm), [1], 'any instruction form is inside the check');
  });
});

test('check 13b (capture skills) — 18.S22: catches a second engine line, the state named in prose, a grant wider than the line or for another kind, and a reference naming the engine; permits the one capture line and a skill that is no capture skill', () => {
  withTemp((dir) => {
    const faults = (/** @type {string} */ rel, /** @type {string} */ text) => checkCaptureSkills([write(dir, rel, text)], dir).map(({ line, message }) => `${line} ${message.split(' — ')[0].split(':')[0]}`);
    const line = 'node .claude/skills/ledger-engine/scripts/engine.cjs inbox capture bug [--project {folder}] <<\'ITEM\'';
    const grant = (kind = 'bug') => `allowed-tools: Bash(node .claude/skills/ledger-engine/scripts/engine.cjs inbox capture ${kind} *)`;
    const skill = (/** @type {string} */ head, /** @type {string} */ body) => `---\nname: ledger-log-bug\n${head}\n---\n\nCaptures a bug.\n\n\`\`\`bash\n${line}\n{text}\nITEM\n\`\`\`\n${body}`;
    const at = 'skills/ledger-log-bug/SKILL.md';

    assert.deepStrictEqual(faults(at, skill(grant(), '')), [], 'the one capture line and its grant');
    assert.deepStrictEqual(faults(at, skill(grant(), '\nThen run `node .claude/skills/ledger-engine/scripts/engine.cjs commit --inbox`.\n')), ['14 a capture skill names the engine on one line alone, its capture line'], 'a second engine line');
    assert.deepStrictEqual(faults(at, skill(grant(), '\nIt lands in `.ledger/.inbox/bugs/`.\n')), ['14 a capture skill names the engine on one line alone, its capture line'], 'the state named in prose');
    assert.deepStrictEqual(faults(at, skill('allowed-tools: Bash(node .claude/skills/ledger-engine/scripts/engine.cjs *)', '')), ["3 a capture skill's allowed-tools grants its capture line alone"], 'a grant of the whole engine');
    assert.deepStrictEqual(faults(at, skill(`${grant()}, Read`, '')), ["3 a capture skill's allowed-tools grants its capture line alone"], 'another tool granted beside it');
    assert.deepStrictEqual(faults(at, skill(grant('idea'), '')), ["3 a capture skill's allowed-tools grants its capture line alone"], 'a grant for another kind');
    assert.deepStrictEqual(faults(at, skill('', '')), ["1 a capture skill's allowed-tools grants its capture line alone"], 'no grant');
    assert.deepStrictEqual(faults('skills/ledger-log-bug/references/r.md', '# R\n\nRun engine.cjs.\n'), ["3 a capture skill names the engine in its SKILL.md's one capture line alone"], 'a reference naming the engine');
    assert.deepStrictEqual(faults('skills/ledger-login/SKILL.md', '---\nname: x\n---\n\nRun engine.cjs twice: engine.cjs.\nengine.cjs\n'), [], 'a skill that is no capture skill');
  });
});

test('check 14 (buried invoke) — catches an in-fence imperative, permits one outside a fence', () => {
  withTemp((dir) => {
    const bad = write(dir, 'skills/x/a.md', '```\nInvoke `/ledger-continue-epic pay`.\n```\n');
    const v = checkBuriedInvoke([bad]);
    assert.strictEqual(v.length, 1, 'in-fence imperative must be caught');
    const start = write(dir, 'skills/x/c.md', '```\nInvoke `/ledger`.\n```\n');
    assert.strictEqual(checkBuriedInvoke([start]).length, 1, 'the way in, `/ledger`, is caught as a skill invocation too');
    const good = write(dir, 'skills/x/b.md', 'Invoke `/ledger-continue-epic pay`.\n');
    assert.strictEqual(checkBuriedInvoke([good]).length, 0, 'the imperative outside a fence is the invocation form');
  });
});

test('check 21 (a section\'s form is its marker\'s) — catches a form stated in a section\'s sentence or bullet, permits a section named or emitted with no form, other content\'s forms, fenced content and prose-block instructions', () => {
  withTemp((dir) => {
    const formless = write(dir, 'skills/x/formless.md', [
      'Fetch the gate:',
      '',
      'Emit the call\'s MENU section verbatim per its marker.',
      '',
      'Emit the TITLE section, then the DISPLAY section, then the MENU section.',
      '',
      '- **DISPLAY** — the rendered map. Emit verbatim. Never redraw, reflow, or trim it.',
      '',
      'Then re-emit the `MENU: phase structure gate` section.',
      '',
      'Fetch and emit the receipt — the `DISPLAY: kb warning` advisory (when carried) then the `DISPLAY: confirmation` section — adding `--warn` when the response\'s `warnings` is non-empty.',
      '',
    ].join('\n'));
    assert.strictEqual(checkSectionFormsAreTheMarkers([formless]).length, 0, `a section named or emitted with no form of its own is clean, got ${report(checkSectionFormsAreTheMarkers([formless]))}`);

    // Not a section's form: a neighbouring sentence on the section's line,
    // a passive description, the API reference's fenced description of a
    // marker, and the rendering instruction of a prose-authored block.
    const others = write(dir, 'skills/x/others.md', [
      'Present the full phase structure from the planning file as rendered markdown (not a code block) — goals, ordering rationale, acceptance criteria as the designer wrote them. Emit its `MENU: phase structure gate` section.',
      '',
      'Render the doc file verbatim as markdown. Then re-fetch the gate and emit its `MENU: baseline doc gate` section.',
      '',
      'Draw each diagram in a text code block (```text fence). Then emit the `MENU: task gate` section.',
      '',
      'Read `all_decided` and `unresolved` from its DATA section; nothing from this call is emitted.',
      '',
      '```bash',
      'engine render walkthrough-topic --name <slug> [--menu-only]  # one reference card: TITLE, then the content file\'s prose (markdown) and diagrams (fenced) in file order — no menu, so a card shown mid-conversation carries no gate',
      '```',
      '',
      '> *Output the next fenced block as markdown (not a code block):*',
      '',
      '```',
      '> The DISPLAY above lists the topics.',
      '```',
      '',
    ].join('\n'));
    assert.strictEqual(checkSectionFormsAreTheMarkers([others]).length, 0, `nothing outside a section's own sentence is flagged, got ${report(checkSectionFormsAreTheMarkers([others]))}`);

    const restated = write(dir, 'skills/x/restated.md', [
      'Fetch the gate and emit its `MENU: add gate` section verbatim as markdown (not a code block):',
      '',
      'Emit the MENU section verbatim as markdown.',
      '',
      '- **MENU** — the selection menu. Emit verbatim as markdown (not a code block).',
      '',
      'Emit the TITLE section (markdown), then the DISPLAY section, then the MENU section.',
      '',
      'Emit the DISPLAY section verbatim as a code block, then the MENU section verbatim per its marker.',
      '',
      '- **TITLE** — the view\'s chrome heading. Emit verbatim as markdown, directly above the display.',
      '',
      'Fetch the receipt and emit its `DISPLAY: baseline paused` section verbatim as a code block:',
      '',
      'Emit the `=== DISPLAY` section verbatim **as a code block** — the full picture.',
      '',
      'Render, then emit each returned section verbatim per its marker — the diff body as a ` ```diff ` fence:',
      '',
      'Emit the DISPLAY section verbatim as a text code block (```text fence).',
      '',
      '- **DISPLAY** — the blocker. Emit verbatim per its marker, a properties code block.',
      '',
      'Emit the `DISPLAY: diff` section verbatim per its marker, in its ```diff fence.',
      '',
      'Emit the DISPLAY section verbatim per its marker, as a code block.',
      '',
      'Emit the DISPLAY section verbatim per its marker — in a code block.',
      '',
      'Emit the MENU section verbatim per its marker, rendered as markdown.',
      '',
    ].join('\n'));
    const v = checkSectionFormsAreTheMarkers([restated]);
    assert.deepStrictEqual(v.map((x) => x.line), [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29], `each restating sentence is caught, got ${report(v)}`);
    assert.ok(v.every((x) => /form is stated in prose/.test(x.message)), `a restated form is reported as one, got ${report(v)}`);
  });
});

test('check 22 (quoted free-text flags) — catches a bare horizon or summary placeholder, fenced or inline, permits the quoted form', () => {
  withTemp((dir) => {
    const quoted = write(dir, 'skills/x/quoted.md', [
      '```bash',
      'node engine.cjs roadmap add {name} --horizon "{horizon}" --summary "{one-liner}"',
      '```',
      'Add it: `roadmap add {name} --horizon "{h}" --summary "{one-liner}"`.',
      '',
    ].join('\n'));
    assert.strictEqual(checkQuotedFreeTextFlags([quoted]).length, 0, 'the quoted form is clean');

    const bare = write(dir, 'skills/x/bare.md', [
      '```bash',
      'node engine.cjs roadmap add {name} --horizon {horizon} --summary "{one-liner}"',
      '```',
      'Add it: `roadmap edit {name} --summary {one-liner}`.',
      '',
    ].join('\n'));
    assert.deepStrictEqual(checkQuotedFreeTextFlags([bare]).map((v) => v.line), [2, 4]);
  });
});

test('check 24 (render forms) — catches a bare code block, a legacy or reworded form, and a fence whose tag is not its form\'s, permits the four forms, a note after the form, a numbered item and fenced examples', () => {
  withTemp((dir) => {
    const good = write(dir, 'skills/x/good.md', [
      '> *Output the next fenced block as markdown (not a code block):*',
      '',
      '```',
      '**`□ Step`**',
      '```',
      '',
      '> *Output the next fenced block as a text code block (```text fence):*',
      '',
      '```text',
      '  └─ a tree',
      '```',
      '',
      '> *Output the next fenced block as a properties code block (```properties fence) — it colours the art:*',
      '',
      '```properties',
      '⚑ Blocked',
      '```',
      '',
      '4. > *Output the next fenced block as a diff code block (```diff fence):*',
      '',
      '   ```diff',
      '   +added',
      '   ```',
      '',
      '````markdown',
      '> *Output the next fenced block as a code block:*',
      '````',
      '',
    ].join('\n'));
    assert.strictEqual(checkRenderForms([good]).length, 0, `the four forms over their fences are clean, got ${report(checkRenderForms([good]))}`);

    const bad = write(dir, 'skills/x/bad.md', [
      '> *Output the next fenced block as a code block:*',
      '',
      '```',
      'a tree',
      '```',
      '',
      '> *Output the next fenced block as a text code block (```text fence):*',
      '',
      '```',
      'a tree',
      '```',
      '',
      '> *Output the next fenced block as markdown (not a code block):*',
      '',
      '```text',
      '> a signpost',
      '```',
      '',
      '> *Output the next fenced block as a properties code block (```properties fence — it colours the art):*',
      '',
      '```properties',
      'art',
      '```',
      '',
      '> *Output the next fenced block as a ` ```diff ` code block:*',
      '',
      '```diff',
      '+added',
      '```',
      '',
      '> *Output the next fenced block as a properties code block (```properties fence) — :*',
      '',
      '```properties',
      '⚑ Blocked',
      '```',
      '',
      '> *Output the next fenced block as a text code block (```text fence):*',
      '',
      'No fence follows.',
      '',
    ].join('\n'));
    const v = checkRenderForms([bad]);
    assert.deepStrictEqual(v.map((x) => x.line), [1, 9, 15, 19, 25, 31, 37], `each off-vocabulary instruction and mismatched fence is caught, got ${report(v)}`);
    assert.deepStrictEqual(v.map((x) => x.message.split(' — ')[0]), [
      'a rendering instruction names no form',
      'the fence beneath "a text code block (```text fence)" opens ```',
      'the fence beneath "markdown (not a code block)" opens ```text',
      'a rendering instruction names no form',
      'a rendering instruction names no form',
      'a rendering instruction names no form',
      'no fence beneath "a text code block (```text fence)"',
    ], `each fault is named, got ${report(v)}`);
  });
});

test('check 27 (framework load) — catches a skill a conversation opens on whose Instructions section is missing or opens on anything else, and an Instructions section or framework load on a skill only ever opened in place; permits the opening load with a trailing clause, a recovery protocol\'s re-load, fenced content, a capture skill, and a skill outside Ledger', () => {
  withTemp((dir) => {
    const LOAD = 'Load **[framework.md](../ledger-shared/references/framework.md)** and follow its instructions as written.';
    const start = write(dir, 'skills/ledger/SKILL.md', [
      '---', 'name: ledger', '---', '', 'Entry.', '', '## Instructions', '',
      'Load **[framework.md](../ledger-shared/references/framework.md)** and follow its instructions as written — after the banner.',
      '', '---', '', '## Step 0: Boot', '', 'Boot.', '',
    ].join('\n'));
    const RELOAD = '1. **Re-read this skill file completely, then re-load [framework.md](../ledger-shared/references/framework.md).**';
    const phase = write(dir, 'skills/ledger-review-process/SKILL.md', [
      '# Review', '', '## Instructions', '', LOAD, '', '---', '', '## Resuming After Context Refresh', '', RELOAD, '',
    ].join('\n'));
    const recovering = write(dir, 'skills/ledger-in-place/SKILL.md', ['Work in the conversation already open.', '', '## Step 1: Work', '', RELOAD, ''].join('\n'));
    const capture = write(dir, 'skills/ledger-log-idea/SKILL.md', 'Capture an idea.\n');
    const fenced = write(dir, 'skills/ledger-help/SKILL.md', ['# Help', '', '```markdown', '## Instructions', '', LOAD, '```', ''].join('\n'));
    const tooling = write(dir, '.claude/skills/review-work/SKILL.md', `## Instructions\n\n${LOAD}\n`);
    const ok = checkFrameworkLoad([start, phase, recovering, capture, fenced, tooling]);
    assert.strictEqual(ok.length, 0, `the opening loads, the recovery re-load, fenced content and the tooling skill are clean, got ${report(ok)}`);

    const missing = write(dir, 'skills/ledger-discovery/SKILL.md', ['---', 'name: ledger-discovery', '---', '', 'Discover.', '', '## Step 0: Boot', ''].join('\n'));
    const late = write(dir, 'skills/ledger-roadmap/SKILL.md', ['The roadmap.', '', '## Instructions', '', 'Read the map first.', '', LOAD, ''].join('\n'));
    const inPlace = write(dir, 'skills/ledger-continue-linear/SKILL.md', ['Continue.', '', '## Instructions', '', LOAD, '', '---', '', '## Step 1: Menu', '', `→ ${LOAD}`, ''].join('\n'));
    const v = checkFrameworkLoad([missing, late, inPlace]);
    assert.deepStrictEqual(v.map((x) => [skillNameOf(x.file), x.line]), [
      ['ledger-discovery', 5],
      ['ledger-roadmap', 3],
      ['ledger-continue-linear', 3],
      ['ledger-continue-linear', 5],
      ['ledger-continue-linear', 11],
    ], `each miss is caught once, at its line, got ${report(v)}`);
    assert.match(v[0].message, /^ledger-discovery is a skill a conversation opens on — its `## Instructions` section opens with the framework load$/);
    assert.match(v[2].message, /^ledger-continue-linear is not a skill a conversation opens on — it carries no framework load and no `## Instructions` section$/);
  });
});

test('2.S17 — the framework load holds voice and altitude, once each', () => {
  const framework = path.join(REPO, 'skills', 'ledger-shared', 'references', 'framework.md');
  const loaded = loadsOf(framework).map(({ target }) => path.relative(path.dirname(framework), target));
  for (const name of ['voice.md', 'altitude.md']) {
    assert.strictEqual(loaded.filter((n) => n === name).length, 1, `framework.md loads ${name} once, got ${JSON.stringify(loaded)}`);
  }
});

test('check 30 (no design tool) — 9.S53: catches each listed tool named in a skill, a reference or an agent, fenced or not, in any case; permits the plain words beside them and a name inside another word', () => {
  withTemp((dir) => {
    const named = DESIGN_TOOLS.map((name, i) => write(dir, `skills/x/references/r${i}.md`, `# R\n\nThe board is in ${name}, exported.\n`));
    assert.deepStrictEqual(checkNoDesignTools(named).map((v) => v.message.split('"')[1]), DESIGN_TOOLS);
    const fenced = write(dir, 'agents/ledger-x.md', '```text\nopen it in Figma\n```\n');
    assert.strictEqual(checkNoDesignTools([fenced]).length, 1, 'a fenced name is still named');
    const lower = write(dir, 'skills/x/references/lower.md', '# L\n\nthe figma file, the miro board\n');
    assert.deepStrictEqual(checkNoDesignTools([lower]).map((v) => v.message.split('"')[1]), ['figma'], 'a name in lower case is still named, the first on the line');
    const plain = write(dir, 'skills/x/SKILL.md', 'Sketch the outline, frame the question, canvas the options, stitch the parts; a Framework load; v0.3 of the format.\n');
    assert.strictEqual(checkNoDesignTools([plain]).length, 0, 'plain words and longer words are no tool');
  });
});

test('check 33 (no CLAUDE.md writes) — 8.S27: catches a sentence telling a session to write, add to or change the project\'s CLAUDE.md, and code naming it outside a comment; permits prose that reads it or names its path, a negated sentence, one whose writer is the person, and a comment', () => {
  withTemp((dir) => {
    const writes = write(dir, 'skills/x/references/w.md', [
      '# W', '',
      'Append the pointer to the project\'s `CLAUDE.md`.',
      'Add a line naming the record into CLAUDE.md.',
      'Update CLAUDE.md with the rule.',
      'Write the rule in the project\'s CLAUDE.md so every session reads it.',
      'Use the Edit tool on CLAUDE.md to add the rule.',
      'Nothing is decided here. Then append the pointer to CLAUDE.md.',
      '',
    ].join('\n'));
    assert.deepStrictEqual(checkNoClaudeMdWrites([writes]).map((v) => v.line), [3, 4, 5, 6, 7, 8]);
    const reads = write(dir, 'agents/ledger-y.md', [
      'Read `CLAUDE.md` and the project skills before running anything.',
      '4. **Project conventions**: the `CLAUDE.md` path, the project skill paths.',
      'Do NOT modify commands based on other project documentation (CLAUDE.md, etc.).',
      'The product record is not CLAUDE.md, which is the person\'s to write.',
      'Ledger never writes CLAUDE.md.',
      'Never change CLAUDE.md.',
      'Recorded in the product record, never in CLAUDE.md.',
      'The engine renders the record so a line the person adds to CLAUDE.md can point at it.',
      'The project\'s `CLAUDE.md` when one exists at the project root, and its address.',
    ].join('\n'));
    assert.strictEqual(checkNoClaudeMdWrites([reads]).length, 0, `reading it and naming it are clean, got ${report(checkNoClaudeMdWrites([reads]))}`);
    const code = write(dir, 'skills/ledger-engine/scripts/domain/z.cjs', [
      '// The record\'s file is for a CLAUDE.md line to point at.',
      ' * CLAUDE.md reaches the agent without the brief.',
      'const target = path.join(root, \'CLAUDE.md\');',
      'fs.appendFileSync(target, line); // not CLAUDE.md itself',
      '',
    ].join('\n'));
    assert.deepStrictEqual(checkNoClaudeMdWrites([], [code]).map((v) => v.line), [3]);
  });
});

test('check 34 (the build\'s prose) — 12.S46: catches a personal skill, a red-green loop and an instruction the builder needs no telling in the build\'s skill, a reference it loads at any depth and a build agent\'s definition; permits a reference it no longer loads, another skill and another agent', () => {
  withTemp((dir) => {
    const skill = write(dir, `skills/${BUILD_SKILL}/SKILL.md`, '# The Build\n\nLoad **[loop.md](references/loop.md)** and follow its instructions as written.\n\nInvoke `/my-review` first.\n');
    const loop = write(dir, `skills/${BUILD_SKILL}/references/loop.md`, '# Loop\n\nSee **[deeper.md](deeper.md)**.\n\nWrite the tests first, red-green.\n');
    const deeper = write(dir, `skills/${BUILD_SKILL}/references/deeper.md`, '# Deeper\n\nTell the builder to keep a to-do list.\n');
    const builder = write(dir, 'agents/ledger-builder.md', '# Builder\n\nCheck your own work, and leave no stubs.\nRead ~/.claude/skills/house/SKILL.md.\n');
    const unloaded = write(dir, `skills/${BUILD_SKILL}/references/tdd.md`, '# TDD\n\nRed-green, tests first.\n');
    const other = write(dir, 'skills/ledger-experiment-process/SKILL.md', '# Experiment\n\nBreak the task down; TDD.\n');
    const agent = write(dir, 'agents/ledger-plain-search.md', '# Search\n\nKeep a to-do list.\n');
    const v = checkBuildProse([skill, loop, deeper, builder, unloaded, other, agent]);
    assert.deepStrictEqual(v.map((x) => [posix(path.relative(dir, x.file)), x.line, x.message.split(' — ')[0]]), [
      [`skills/${BUILD_SKILL}/SKILL.md`, 5, 'names a personal skill'],
      [`skills/${BUILD_SKILL}/references/loop.md`, 5, 'prescribes a red-green loop'],
      [`skills/${BUILD_SKILL}/references/deeper.md`, 3, 'tells the builder to break a task down, keep a to-do list, check its own work or leave no stubs (12.3.8)'],
      ['agents/ledger-builder.md', 3, 'tells the builder to break a task down, keep a to-do list, check its own work or leave no stubs (12.3.8)'],
      ['agents/ledger-builder.md', 4, 'names a personal skill'],
    ], `each line is caught once, at its line, got ${report(v)}`);
    const clean = write(dir, `skills/${BUILD_SKILL}/references/loop.md`, '# Loop\n\nThe checklist holds it; Invoke `/ledger-review-process epic x`; run `.claude/skills/ledger-engine/scripts/engine.cjs`.\n');
    assert.strictEqual(checkBuildProse([skill, clean]).filter((x) => x.file === clean).length, 0, 'Ledger\'s own skills and checklists are no personal skill and no instruction');
  });
});

test('check 35 (boot\'s stops as data) — catches a start skill that fetches no screen boot names, surfaces no warnings ahead of the stops or only after them, never says a boot run again carries the words, never names the boot call\'s description, fetches the banner anywhere but once, ahead of boot, on the bare command alone, never says a stop\'s marker, lacks the bullet for a kind of next a stop has or a stop\'s load, or gives a stop a heading of its own, and passes every other skill and the start skill\'s references by', () => {
  withTemp((dir) => {
    const stops = {
      git: { next: null }, lost: { next: { kind: 'gate' } },
      checks: { marker: 'Migration', next: { kind: 'load', reference: 'migration-checks' } }, finish: { next: { kind: 'load', reference: 'migration-review' } },
    };
    const FETCH = ['```bash', 'node .claude/skills/ledger-engine/scripts/engine.cjs render {surface} {args}', '```'];
    const BANNER = ['On the bare command, with no words, fetch the banner first:', '', '```bash', 'node .claude/skills/ledger-engine/scripts/engine.cjs render banner', '```', ''];
    const BOOT = ['```bash', 'node .claude/skills/ledger-engine/scripts/engine.cjs boot <<\'WORDS\'', '$ARGUMENTS', 'WORDS', '```', ''];
    const clean = write(dir, 'skills/ledger/SKILL.md', [
      '## Boot', '', ...BANNER, ...BOOT, 'Run it, the call described as `Start Ledger`.', 'Every boot the start runs again is this one, words and all.', '', 'Surface the answer\'s `warnings` first, whatever else it says.', '', '## Boot\'s Stops', '',
      'Boot names the stop it made in `stop`. Where it names a `marker`, say it on a line of its own, **`▪ {marker}`**.', '', ...FETCH, '',
      '- **None** — the start ends there.', '- **`gate`** — the screen asks the person.', '- **`load`** — load the reference it names:',
      '  - `migration-checks`: Load **[migration-checks.md](references/migration-checks.md)** and follow its instructions as written.',
      '  - `migration-review`: Load **[migration-review.md](references/migration-review.md)** and follow its instructions as written.', '',
    ].join('\n'));
    const cleanText = fs.readFileSync(clean, 'utf8');
    const reference = write(dir, 'skills/ledger/references/migration-review.md', '#### If `finish` answers\n');
    const other = write(dir, 'skills/ledger-roadmap/SKILL.md', '#### If `state` is `lost`\n');
    assert.deepStrictEqual(checkBootStops([clean, reference, other], stops), [], `the rule, its bullets and loads, and headings outside the start skill are clean, got ${report(checkBootStops([clean, reference, other], stops))}`);
    const late = write(dir, 'skills/ledger/SKILL.md', cleanText.replace('Surface the answer\'s `warnings` first, whatever else it says.\n', '') + '\nSurface the answer\'s `warnings` first.\n');
    assert.deepStrictEqual(checkBootStops([late], stops).map((x) => x.message), ['the start skill surfaces boot\'s `warnings` before it follows any stop'], 'warnings surfaced only after the stops are followed');
    const BANNER_RULE = 'the start skill fetches the banner once, ahead of boot, on the bare command alone — "On the bare command, with no words, fetch the banner first:", then `render banner`';
    const misplaced = {
      'fetched after boot': cleanText.replace([...BANNER, ...BOOT].join('\n'), [...BOOT, ...BANNER].join('\n')),
      'fetched again at the opening': `${cleanText}\n${BANNER.slice(2).join('\n')}`,
      'fetched with no bare command named': cleanText.replace(BANNER[0], 'Fetch the banner first:'),
    };
    for (const [fault, text] of Object.entries(misplaced)) {
      assert.deepStrictEqual(checkBootStops([write(dir, 'skills/ledger/SKILL.md', text)], stops).map((x) => x.message), [BANNER_RULE], `the banner ${fault}`);
    }
    const gateOnly = write(dir, 'skills/ledger/SKILL.md', [...BANNER, ...BOOT, '## Boot', '', 'Run it, the call described as `Start Ledger`.', 'Every boot the start runs again is this one, words and all.', 'Surface the answer\'s `warnings` first.', '', ...FETCH, '', '- **`gate`** — the screen asks the person.', ''].join('\n'));
    assert.deepStrictEqual(checkBootStops([gateOnly], { lost: stops.lost }), [], 'the kinds of next come from the stops: with no marker, no load and no ending among them, neither the marker\'s line nor their bullets is asked for');

    const branched = write(dir, 'skills/ledger/SKILL.md', [
      '## Boot', '', '#### If `state` is `lost`', '', '```bash', 'node .claude/skills/ledger-engine/scripts/engine.cjs render state-lost-gate', '```', '',
      '### At `finish`', '', 'Load **[migration-review.md](references/migration-review.md)** and follow its instructions as written.', '',
      '```markdown', '#### If `state` is `checks`', '- **None** — the start ends there.', '**`▪ {marker}`**', '```', '', '**`gate`** — the screen asks the person.', '',
    ].join('\n'));
    assert.deepStrictEqual(checkBootStops([branched], stops).map((x) => [x.line, x.message]), [
      [1, 'the start skill fetches no stop\'s screen as boot names it — `render {surface} {args}`'],
      [1, 'the start skill surfaces boot\'s `warnings` before it follows any stop'],
      [1, 'the start skill never says a boot it runs again carries the words — "Every boot the start runs again is this one, words and all."'],
      [1, 'the start skill never names the boot call\'s description — "the call described as `Start Ledger`"'],
      [1, 'the start skill fetches the banner once, ahead of boot, on the bare command alone — "On the bare command, with no words, fetch the banner first:", then `render banner`'],
      [1, 'a stop names a marker, and the start skill never says it — **`▪ {marker}`**'],
      [1, 'a stop\'s next is None, and the start skill has no bullet following it — `- **None** —`'],
      [1, 'a stop\'s next is `gate`, and the start skill has no bullet following it — `- **`gate`** —`'],
      [1, 'a stop\'s next is `load`, and the start skill has no bullet following it — `- **`load`** —`'],
      [1, 'a stop loads `migration-checks`, and the start skill has no load of references/migration-checks.md'],
      [3, 'a heading of its own for boot\'s `lost` stop — boot names the stop, and one rule follows it'],
      [9, 'a heading of its own for boot\'s `finish` stop — boot names the stop, and one rule follows it'],
    ], `got ${report(checkBootStops([branched], stops))}`);
  });
});

test('check 37 (descriptions) — 18.S73: catches a start skill whose description opens on anything but its trigger or that has none, and a skill a handoff lands on whose description does not say it is reached only through one; passes every other skill by', () => {
  withTemp((dir) => {
    const skill = (name, description) => write(dir, `skills/${name}/SKILL.md`, ['---', `name: ${name}`, ...(description === null ? [] : [`description: ${description}`]), 'user-invocable: false', '---', '', 'Body.', ''].join('\n'));
    const HANDED = 'Ledger\'s review phase. Reached only through a Ledger handoff, never invoked directly; work comes into Ledger through /ledger.';
    const targets = ['ledger', 'ledger-review-process', 'ledger-roadmap'];
    const clean = [skill('ledger', 'Use for any change to what this project\'s code does.'), skill('ledger-review-process', HANDED), skill('ledger-roadmap', HANDED), skill('ledger-log-idea', 'Capture an idea in the inbox.')];
    assert.deepStrictEqual(checkDescriptions(clean, targets), [], `got ${report(checkDescriptions(clean, targets))}`);

    const broken = [skill('ledger', 'Ledger\'s entry. Use for any change.'), skill('ledger-review-process', 'Ledger\'s review phase.'), skill('ledger-roadmap', null)];
    assert.deepStrictEqual(checkDescriptions(broken, targets).map((x) => [skillNameOf(x.file), x.line]), [
      ['ledger', 3],
      ['ledger-review-process', 3],
      ['ledger-roadmap', 1],
    ], `got ${report(checkDescriptions(broken, targets))}`);
  });
});

test('check 38 (no resume section) — 24.S14: catches a heading on resuming after a refresh or a compaction in a skill or a reference, at any level; passes a fenced example, a heading on resuming something else and prose that names resuming', () => {
  withTemp((dir) => {
    const skill = write(dir, 'skills/ledger-x/SKILL.md', ['# X', '', '## Resuming After Context Refresh', '', 'Re-read.', '', '### After a Compaction', '', '```markdown', '## Resuming after a refresh', '```', '', '## Resuming an Experiment', '', 'A topic resumes where it was.', ''].join('\n'));
    const reference = write(dir, 'skills/ledger-x/references/work.md', '#### If the session refreshed\n');
    assert.deepStrictEqual(checkNoResumeSections([skill, reference]).map((x) => [posix(path.relative(dir, x.file)), x.line]), [
      ['skills/ledger-x/SKILL.md', 3],
      ['skills/ledger-x/SKILL.md', 7],
      ['skills/ledger-x/references/work.md', 1],
    ], `got ${report(checkNoResumeSections([skill, reference]))}`);
  });
});

test('check 36 (the start menu\'s load) — catches a skill drawing a menu whose back is the start menu with no load of start-menu.md in any of its files; passes a skill that loads it from a reference, the start skill, and a menu whose back is another', () => {
  withTemp((dir) => {
    const fetch = (menu) => `\`\`\`bash\nnode .claude/skills/ledger-engine/scripts/engine.cjs render ${menu} {work_unit}\n\`\`\`\n`;
    const bare = write(dir, 'skills/ledger-continue-epic/SKILL.md', `## The Menu\n\n${fetch('epic-menu')}`);
    const v = checkBackToStartLoads([bare]);
    assert.deepStrictEqual(v.map((x) => [posix(path.relative(dir, x.file)), x.line, x.message]), [
      ['skills/ledger-continue-epic/SKILL.md', 4, 'ledger-continue-epic draws the epic-menu, whose back draws the start menu, and loads no start-menu.md'],
    ], `got ${report(v)}`);
    const loaded = write(dir, 'skills/ledger-continue-epic/references/back.md', 'Load **[start-menu.md](../../ledger/references/start-menu.md)** and follow its instructions as written.\n');
    const own = write(dir, 'skills/ledger/references/manage-work-unit.md', fetch('manage'));
    const other = write(dir, 'skills/ledger-x/SKILL.md', fetch('manage-unit'));
    assert.deepStrictEqual(checkBackToStartLoads([bare, loaded, own, other]), [], 'a reference\'s load serves its skill, and the start skill owns the reference');
  });
});

test('check 29 (the framework loads once) — catches a file the framework loads twice and a framework file loaded from anywhere else; permits the framework load itself, another shared reference, fenced content, and a corpus without the framework', () => {
  withTemp((dir) => {
    const shared = 'skills/ledger-shared/references';
    const framework = write(dir, `${shared}/framework.md`, [
      '# Framework', '', 'Load **[voice.md](voice.md)** and follow its instructions as written.', '',
      'Load **[altitude.md](altitude.md)** and follow its instructions as written.', '',
    ].join('\n'));
    const opening = write(dir, 'skills/ledger-x/SKILL.md', '## Instructions\n\nLoad **[framework.md](../ledger-shared/references/framework.md)** and follow its instructions as written.\n');
    const other = write(dir, 'skills/ledger-x/references/a.md', 'Load **[devils-advocate.md](../../ledger-shared/references/devils-advocate.md)** and follow its instructions as written.\n');
    const fenced = write(dir, 'skills/ledger-y/SKILL.md', '```markdown\nLoad **[voice.md](../ledger-shared/references/voice.md)** and follow its instructions as written.\n```\n');
    const ok = checkFrameworkLoadsOnce([framework, opening, other, fenced]);
    assert.strictEqual(ok.length, 0, `the framework's own loads, another reference and fenced content are clean, got ${report(ok)}`);
    assert.strictEqual(checkFrameworkLoadsOnce([opening, other]).length, 0, 'a corpus without the framework has nothing to hold');

    fs.appendFileSync(framework, 'Load **[voice.md](voice.md)** and follow its instructions as written.\n');
    const phase = write(dir, 'skills/ledger-z/SKILL.md', '# Z\n\nThen load **[altitude.md](../ledger-shared/references/altitude.md)** and follow its instructions as written.\n');
    const v = checkFrameworkLoadsOnce([framework, opening, phase]);
    assert.deepStrictEqual(v.map((x) => [posix(path.relative(dir, x.file)), x.line]), [
      [`${shared}/framework.md`, 6],
      ['skills/ledger-z/SKILL.md', 3],
    ], `each miss is caught once, at its line, got ${report(v)}`);
    assert.match(v[0].message, /^voice\.md is loaded twice — the framework loads each file it composes once$/);
    assert.match(v[1].message, /^altitude\.md is the framework's — it loads once per conversation, from framework\.md alone$/);
  });
});

test('check 28 (Bash grants carry a wildcard) — catches a bare grant inline or listed and a script grant whose `*` is not a trailing ` *`, permits a script grant ending in ` *`, a wildcard mid-path on another command, other tools, and a grant outside the frontmatter', () => {
  withTemp((dir) => {
    const ENGINE = 'node .claude/skills/ledger-engine/scripts/engine.cjs';
    const starred = write(dir, 'skills/ledger-a-process/SKILL.md', [
      '---', 'name: ledger-a-process',
      `allowed-tools: Bash(${ENGINE} *), Bash(${ENGINE} render *), Bash(${ENGINE} manifest:*), Bash(mkdir -p .ledger/*/.state), Read`,
      '---', '', `Run \`Bash(${ENGINE})\` from the body.`, '',
    ].join('\n'));
    const agent = write(dir, 'agents/ledger-b.md', '---\nname: ledger-b\ntools: Read, Bash\n---\n\nBody.\n');
    const ok = checkBashGrantsCarryWildcard([starred, agent]);
    assert.strictEqual(ok.length, 0, `wildcarded grants, other tools and body text are clean, got ${report(ok)}`);

    const inline = write(dir, 'skills/ledger-c-process/SKILL.md', [
      '---', 'name: ledger-c-process', `allowed-tools: Bash(${ENGINE}), Bash(${ENGINE} *), Bash(git log)`, '---', '',
    ].join('\n'));
    const listed = write(dir, 'skills/ledger-d-process/SKILL.md', [
      '---', 'name: ledger-d-process', 'allowed-tools:', `  - Bash(${ENGINE} manifest)`, '  - Read', 'user-invocable: false', '---', '',
    ].join('\n'));
    const misplaced = write(dir, 'skills/ledger-e-process/SKILL.md', [
      '---', 'name: ledger-e-process',
      `allowed-tools: Bash(node .claude/skills/*/scripts/engine.cjs), Bash(${ENGINE}*), Bash(node --no-warnings tools/run.mjs*)`, '---', '',
    ].join('\n'));
    const v = checkBashGrantsCarryWildcard([inline, listed, misplaced]);
    assert.deepStrictEqual(v.map((x) => [skillNameOf(x.file), x.line]), [
      ['ledger-c-process', 3],
      ['ledger-c-process', 3],
      ['ledger-d-process', 4],
      ['ledger-e-process', 3],
      ['ledger-e-process', 3],
      ['ledger-e-process', 3],
    ], `each bare grant, and each script grant whose \`*\` is not a trailing \` *\` or \`:*\`, is caught at its line, got ${report(v)}`);
    assert.match(v[0].message, /^Bash\(node \.claude\/skills\/ledger-engine\/scripts\/engine\.cjs\) is a script grant that does not end in ` \*`/);
    assert.match(v[1].message, /^Bash\(git log\) has no `\*`/);
    assert.match(v[3].message, /^Bash\(node \.claude\/skills\/\*\/scripts\/engine\.cjs\) is a script grant/);
    assert.match(v[4].message, /engine\.cjs\*\) is a script grant/);
  });
});

test('fence parsing — a numbered list item may open a fence', () => {
  const { inFence } = parseFences(['3. ```bash', 'engine render x', '   ```', 'after']);
  assert.deepStrictEqual(inFence, [false, true, false, false]);
});

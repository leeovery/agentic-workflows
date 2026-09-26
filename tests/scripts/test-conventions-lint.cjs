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

require('./hermetic-env.cjs');

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..', '..');
const DOT = '·'; // MIDDLE DOT (U+00B7)
const MENU_FRAME = Array(12).fill(DOT).join(' '); // "· · · · · · · · · · · ·"
const FENCE = /^\s*(?:\d+\.\s+)?```/; // a fence delimiter, a numbered list item's included
const ZERO_OUTPUT_RULE =
  '> **⚠️ ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.';

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
  walkMd(path.join(REPO, '.claude', 'skills', 'create-output-format'), files);
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
// ``` delimiter lines themselves).
function parseFences(lines) {
  const blocks = [];
  const inFence = new Array(lines.length).fill(false);
  let open = -1;
  let content = [];
  for (let i = 0; i < lines.length; i++) {
    if (FENCE.test(lines[i])) {
      if (open === -1) {
        open = i;
        content = [];
      } else {
        blocks.push({ open, close: i, lines: content });
        open = -1;
      }
      continue;
    }
    if (open !== -1) {
      inFence[i] = true;
      content.push({ n: i, text: lines[i] });
    }
  }
  return { blocks, inFence };
}

// A fence is the workflow-start banner iff it contains an ASCII-art line
// (pure slashes / underscores / pipes / spaces, 10+ chars). The corpus
// contains exactly one such fence; no other display uses these glyphs alone.
function isBannerFence(block) {
  return block.lines.some((l) => l.text.trim() !== '' && /^[\s/\\_|]{10,}$/.test(l.text));
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
// Check 1 — Drawn phase-title borders are retired (banner excepted); the
// markdown H1 chrome pins the ■ glyph
// (● + 47 ─ + ●). The workflow-start banner block is the one documented
// exception and is skipped.
// ---------------------------------------------------------------------------

function checkBorders(files) {
  const out = [];
  for (const file of files) {
    const lines = readLines(file);
    const { blocks } = parseFences(lines);
    const bannerLines = new Set();
    for (const b of blocks) {
      if (isBannerFence(b)) b.lines.forEach((l) => bannerLines.add(l.n));
    }
    lines.forEach((line, i) => {
      const t = line.trim();
      // Drawn borders are retired from prose — the phase title is markdown
      // chrome (`# **`■ Title`**`). Only the workflow-start banner keeps its
      // bordered art (documented exception).
      if (/^●─+●$/.test(t) && !bannerLines.has(i)) {
        out.push({
          file,
          line: i + 1,
          message: 'drawn phase-title borders are retired — use `# **`■ Title`**` markdown chrome (banner excepted)',
        });
        return;
      }
      // The markdown phase title must pair H1 with the filled square.
      const h1 = /^# \*\*`(.)/.exec(t);
      if (h1 && '■□▪○◐✓⊙⊘◆'.includes(h1[1]) && h1[1] !== '■') {
        out.push({ file, line: i + 1, message: `phase-title chrome uses ■ — found ${h1[1]}` });
      }
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Check 2 — Drawn step / sub-step markers are retired. A marker is
// positively identified as the SOLE content line of a fenced block whose text
// begins with "── " or "·· ". Centered "── {Title} ──" content dividers live
// embedded inside multi-line DISPLAY blocks and are therefore never matched.
// ---------------------------------------------------------------------------

function checkMarkers(files) {
  const out = [];
  for (const file of files) {
    const lines = readLines(file);
    const { blocks } = parseFences(lines);
    for (const b of blocks) {
      if (b.lines.length !== 1) continue; // sole-line fence only — engine
      // stage dividers live inside multi-line DISPLAY templates and are
      // a different object (drawn, sized to their content).
      const { n, text } = b.lines[0];
      // Drawn markers are retired — the chrome family is markdown.
      if (/^── .+ ─+$/.test(text) || /^·· .+ ·+$/.test(text)) {
        const kind = text.startsWith('── ') ? 'step marker' : 'sub-step marker';
        out.push({
          file,
          line: n + 1,
          message: `drawn ${kind}s are retired — use **\`□ Name\`** / **\`▪ Name\`** markdown chrome`,
        });
        continue;
      }
      // New-chrome shape: a sole-line marker fence must be exact, and the
      // glyph must match its register (□ step, ▪ sub-step; ■ is the H1's).
      const m = /^\*\*`(.) (.+)`\*\*$/.exec(text);
      if (m && '■□▪'.includes(m[1]) && !'□▪'.includes(m[1])) {
        out.push({ file, line: n + 1, message: `marker chrome uses □ or ▪ — ■ belongs to the phase title` });
      }
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
// Check 4 — Banned STOP variants must not appear, a bare "STOP for the …"
// folded into a sentence included.
// ---------------------------------------------------------------------------

const BANNED_STOP = ['Stop here.', 'Command ends.', 'Wait for user to acknowledge before ending.', 'STOP for the'];

function checkBannedStop(files) {
  const out = [];
  for (const file of files) {
    const lines = readLines(file);
    lines.forEach((line, i) => {
      for (const phrase of BANNED_STOP) {
        if (line.includes(phrase)) {
          out.push({ file, line: i + 1, message: `banned STOP variant "${phrase}"` });
        }
      }
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Check 5 — Banned navigation verbs after an arrow.
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
// Check** in **[rerouted-concerns.md](…)**") or locally (a same-line unrelated
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
// blocks (illustrative templates) and create-output-format scaffolding
// templates (whose links are destination-relative) are exempt.
// ---------------------------------------------------------------------------

function checkLinks(files) {
  const out = [];
  const linkRe = /\[[^\]]*\]\(([^)]+)\)/g;
  for (const file of files) {
    if (file.includes(`${path.sep}create-output-format${path.sep}references${path.sep}scaffolding${path.sep}`)) {
      continue; // destination-relative scaffolding templates
    }
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
// Check 8 — H1 category rule (scoped to workflow-* SKILL.md backbones).
// Processing backbones (workflow-*-process, plus engine and knowledge) open
// with a title H1; entry, navigation, and phase-entry backbones carry none.
// ---------------------------------------------------------------------------

function skillNameOf(file) {
  // .../skills/<name>/SKILL.md
  const parts = file.split(path.sep);
  const idx = parts.lastIndexOf('skills');
  if (idx === -1 || parts[parts.length - 1] !== 'SKILL.md') return null;
  return parts[parts.length - 2] || null;
}

function checkH1Category(files) {
  const out = [];
  const H1_KNOWN = new Set(['workflow-engine', 'workflow-knowledge', 'workflow-baseline', 'workflow-roadmap', 'workflow-help']);
  for (const file of files) {
    const name = skillNameOf(file);
    if (!name || !name.startsWith('workflow-')) continue; // only workflow backbones
    const mustHaveH1 = /^workflow-.+-process$/.test(name) || H1_KNOWN.has(name);
    const lines = readLines(file);
    const first = lines[firstContentIndex(lines)] || '';
    const isH1 = /^# /.test(first);
    if (mustHaveH1 && !isH1) {
      out.push({ file, line: firstContentIndex(lines) + 1, message: `processing backbone (${name}) must open with a title H1` });
    } else if (!mustHaveH1 && isH1) {
      out.push({ file, line: firstContentIndex(lines) + 1, message: `entry/navigation/phase-entry backbone (${name}) must not carry an H1` });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Check 9 — Zero Output Rule blockquote is byte-identical to the canonical
// form wherever it appears.
// ---------------------------------------------------------------------------

function checkZeroOutput(files) {
  const out = [];
  for (const file of files) {
    const lines = readLines(file);
    lines.forEach((line, i) => {
      if (line.includes('ZERO OUTPUT RULE') && line !== ZERO_OUTPUT_RULE) {
        out.push({ file, line: i + 1, message: 'Zero Output Rule blockquote is not byte-identical to the canonical form' });
      }
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Check 10 — Reference-file attribution: files under skills/*/references/ open
// (after the H1) with an italic attribution line in a sanctioned form —
// parent/sub-reference link ("*Reference for **[link](path)**…*") or shared
// ("*Shared reference…*"). Multi-consumer output-format adapter files are
// exempt (a single-parent attribution would be inaccurate).
// ---------------------------------------------------------------------------

const ATTR_REFERENCE = /^\*Reference for \*\*\[[^\]]+\]\([^)]+\)\*\*.*\*$/;
const ATTR_SHARED = /^\*Shared reference\b.*\*$/;

function posix(file) {
  return file.split(path.sep).join('/');
}

// In scope: reference files under a workflow skill (skills/*/references/…) or
// under the create-output-format tooling skill. Matched on path suffix (not
// repo-anchored) so the same logic drives corpus and temp-fixture tests.
function isReferenceFile(file) {
  const p = posix(file);
  const workflowRef = /\/skills\/[^/]+\/references\//.test(p) && !/\.claude\/skills\//.test(p);
  const cofRef = /\/create-output-format\/references\//.test(p);
  return workflowRef || cofRef;
}

function checkAttribution(files) {
  const out = [];
  for (const file of files) {
    if (!isReferenceFile(file)) continue;
    const p = posix(file);
    if (p.includes('/output-formats/')) continue; // multi-consumer adapter exemption
    if (p.includes('/create-output-format/references/scaffolding/')) continue; // template scaffolding exemption
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
// Check 12 — earned chrome, decidable slice. A backbone step whose only
// substance is a single Load directive must not carry a step marker when the
// loaded reference is inert (no STOP gate, no rendering instruction) — pure
// plumbing earns no chrome. Steps with conditional structure (H4), extra
// substance, interactive references, or unresolvable/parameterised targets
// are out of scope: those are the judgment tier.
// ---------------------------------------------------------------------------

// A reference is inert iff it shows the user nothing and does nothing
// watchable: no STOP gate, no rendering instruction, no bash fence — and
// every reference it Loads (resolvable, non-parameterised) is inert too.
// Anything unresolvable is conservatively treated as not inert.
function isInertRef(p, visited) {
  if (visited.has(p)) return true; // cycle: no new activity on this path
  visited.add(p);
  if (!fs.existsSync(p)) return false;
  const text = fs.readFileSync(p, 'utf8');
  // A reference is inert only if it produces nothing the user can watch.
  // Interaction, rendered output, a command, and sub-agent dispatch all count
  // as activity — CONVENTIONS.md names agent dispatch among the shapes that
  // earn a marker, and a fan-out is often the longest wait in a phase.
  if (
    /\*\*STOP\.\*\*/.test(text) ||
    /Output the next fenced block/.test(text) ||
    /^```bash/m.test(text) ||
    /\*\*Agent path\*\*/.test(text)
  ) return false;
  const loadRe = /Load \*\*\[[^\]]+\]\(([^)]+)\)\*\*/g;
  let m;
  while ((m = loadRe.exec(text))) {
    const target = m[1].split('#')[0];
    if (target.includes('{')) return false;
    if (!isInertRef(path.resolve(path.dirname(p), target), visited)) return false;
  }
  return true;
}

function checkInertLoadChrome(files) {
  const out = [];
  for (const file of files) {
    if (!file.endsWith('SKILL.md')) continue;
    const dir = path.dirname(file);
    const lines = readLines(file);
    const { inFence } = parseFences(lines);
    const starts = [];
    lines.forEach((line, i) => {
      if (!inFence[i] && /^## Step /.test(line)) starts.push(i);
    });
    for (const start of starts) {
      let end = lines.length;
      for (let j = start + 1; j < lines.length; j++) {
        if (!inFence[j] && /^## /.test(lines[j])) { end = j; break; }
      }
      let markerLine = -1;
      for (let j = start; j < end; j++) {
        if (inFence[j] && /^\*\*`[□▪] .+`\*\*$/.test(lines[j])) markerLine = j;
      }
      if (markerLine === -1) continue;
      const substance = [];
      let structured = false;
      for (let j = start + 1; j < end; j++) {
        if (inFence[j] || FENCE.test(lines[j])) continue;
        const t = lines[j].trim();
        if (t === '' || t === '---') continue;
        if (/^> \*Output the next fenced block/.test(t)) continue;
        if (/^→ /.test(t)) continue;
        if (/^#{3,4} /.test(t)) { structured = true; break; }
        substance.push(t);
      }
      if (structured || substance.length !== 1) continue;
      const lm = substance[0].match(/^Load \*\*\[[^\]]+\]\(([^)]+)\)\*\*/);
      if (!lm) continue;
      const target = lm[1].split('#')[0];
      if (target.includes('{')) continue;
      const p = path.resolve(dir, target);
      if (!fs.existsSync(p)) continue;
      if (!isInertRef(p, new Set())) continue;
      out.push({
        file,
        line: markerLine + 1,
        message: `marker on a load-only step whose reference (${target}) renders nothing — chrome is earned, not automatic`,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Check 13 — Templated-fence ratchet (render-surfaces D4). A templated
// menu/display fence in prose is a violation: state-derivable output renders
// from the engine. The corpus's remaining sites — sanctioned judgment,
// artefact echoes, chrome one-liners, and the not-yet-converted families —
// are pinned per file below. Any drift fails: a NEW templated fence must
// become an engine surface (or be pinned deliberately, with the PR saying
// why); a converted site must shrink its pin, so the ratchet only tightens.
// Markers and signposts are chrome, out of scope. Static fences (no
// placeholders, no directives) are always fine.
// ---------------------------------------------------------------------------

// THE PINS ONLY EVER GO DOWN. A pin is a legacy-backlog marker, not a
// budget: a new judgment-authored menu/display fence is the signal to build
// an engine render surface, never to raise the pin. Raising one requires the
// user's explicit sign-off, recorded in the PR — "the lint blocked me" is
// the ratchet working, not a reason to adjust it.
/** @type {Record<string, number>} */
const RATCHET_PINS = {
  'skills/workflow-continue-epic/references/summary-backfill.md': 2,
  'skills/workflow-discovery/references/continuity-load.md': 1,
  'skills/workflow-discovery/references/map-operations.md': 2,
  'skills/workflow-discovery/references/opener-pattern.md': 1,
  'skills/workflow-discovery/references/session-loop.md': 1,
  'skills/workflow-discussion-entry/references/gather-context-continue.md': 1,
  'skills/workflow-discussion-entry/references/gather-context-fresh.md': 1,
  'skills/workflow-discussion-process/references/background-agent-surfacing.md': 2,
  'skills/workflow-discussion-process/references/perspective-agents.md': 1,
  'skills/workflow-implementation-entry/references/check-dependencies.md': 2,
  'skills/workflow-implementation-process/SKILL.md': 1,
  'skills/workflow-implementation-process/references/analysis-loop.md': 1,
  'skills/workflow-implementation-process/references/task-loop.md': 2,
  'skills/workflow-investigation-entry/references/gather-context.md': 1,
  'skills/workflow-investigation-process/references/analysis-checkpoints.md': 1,
  'skills/workflow-knowledge/references/knowledge-usage.md': 1,
  'skills/workflow-legacy-research-split/SKILL.md': 3,
  'skills/workflow-legacy-research-split/references/dialog.md': 4,
  'skills/workflow-log-bug/SKILL.md': 1,
  'skills/workflow-log-idea/SKILL.md': 1,
  'skills/workflow-log-quickfix/SKILL.md': 1,
  'skills/workflow-planning-process/references/analyze-task-graph.md': 3,
  'skills/workflow-planning-process/references/author-tasks.md': 5,
  'skills/workflow-planning-process/references/conclude-plan.md': 1,
  'skills/workflow-planning-process/references/output-formats/linear/authoring.md': 1,
  'skills/workflow-planning-process/references/plan-construction.md': 3,
  'skills/workflow-planning-process/references/plan-review.md': 2,
  'skills/workflow-planning-process/references/process-review-findings.md': 1,
  'skills/workflow-planning-process/references/resolve-dependencies.md': 1,
  'skills/workflow-research-process/references/deep-dive-agent.md': 1,
  'skills/workflow-roadmap/references/session-loop.md': 1,
  'skills/workflow-scoping-process/SKILL.md': 2,
  'skills/workflow-scoping-process/references/gather-context.md': 1,
  'skills/workflow-scoping-process/references/write-specification.md': 1,
  'skills/workflow-shared/references/analysis-approval-gate.md': 1,
  'skills/workflow-shared/references/compliance-check.md': 1,
  'skills/workflow-specification-entry/references/display-single.md': 1,
  'skills/workflow-specification-process/SKILL.md': 1,
  'skills/workflow-specification-process/references/process-review-findings.md': 3,
  'skills/workflow-specification-process/references/spec-completion.md': 2,
  'skills/workflow-specification-process/references/spec-review.md': 2,
  'skills/workflow-start/SKILL.md': 1,
  'skills/workflow-start/references/inbox-archived.md': 3,
  'skills/workflow-start/references/inbox-working-set.md': 2,
  'skills/workflow-start/references/knowledge-gate.md': 1,
  'skills/workflow-start/references/view-plan.md': 2,
};

// Count a file's templated menu/display fences: a rendering-instruction line,
// its following fence, marker/signpost kinds excluded, templated = placeholder
// syntax or an @if/@foreach directive (the render-surfaces census scanner).
// The trigger matches ANY instruction form ("as a code block", "as markdown",
// "as a ` ```diff ` code block", future variants) — an instruction-form miss
// would silently exempt that family from the ratchet.
function countTemplatedSites(file) {
  const lines = readLines(file);
  let n = 0;
  for (let i = 0; i < lines.length; i++) {
    // Leading whitespace allowed: instructions nested under list items are
    // real render sites too (anchoring at column 0 hid three of them).
    if (!/^\s*> \*Output the next fenced block as /.test(lines[i])) continue;
    let j = i + 1;
    while (j < lines.length && lines[j].trim() === '') j++;
    if (j >= lines.length || !FENCE.test(lines[j])) continue;
    const start = j + 1;
    let k = start;
    while (k < lines.length && !FENCE.test(lines[k])) k++;
    const content = lines.slice(start, k);
    const text = content.join('\n');
    const isMarker = content.length === 1
      && (/^(── |·· )/.test(content[0]) || /^(# )?\*\*`[■□▪] /.test(content[0]));
    const isSignpost = content.every((l) => l.trim() === '' || l.startsWith('>'));
    // Templated = any single-line braced token or directive. Deliberately
    // wider than the template-placeholder grammar: `{2 context lines}` and
    // `{removed/changed lines}` are placeholders too, and a narrow class
    // would let them slip the ratchet as "static".
    const templated = /\{[^{}\n]+\}/.test(text) || /@if|@foreach/.test(text);
    if (!isMarker && !isSignpost && templated) n++;
    i = k;
  }
  return n;
}

function checkTemplatedRatchet(files, pins = RATCHET_PINS) {
  const out = [];
  const seen = new Set();
  for (const file of files) {
    const key = rel(file);
    const expected = pins[key] || 0;
    const actual = countTemplatedSites(file);
    seen.add(key);
    if (actual > expected) {
      out.push({
        file,
        line: 1,
        message: `${actual} templated menu/display fence(s), ${expected} pinned — render new output from the engine (render-surfaces D4); a genuinely judgment-only site is pinned deliberately, with the PR saying why`,
      });
    } else if (actual < expected) {
      out.push({
        file,
        line: 1,
        message: `${actual} templated menu/display fence(s), ${expected} pinned — a site was converted; shrink its pin (the ratchet only tightens)`,
      });
    }
  }
  for (const key of Object.keys(pins)) {
    if (!seen.has(key)) {
      out.push({ file: path.join(REPO, key), line: 1, message: 'pinned file no longer exists — remove its pin' });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Check 14 — No buried invocation imperatives. A skill-invocation instruction
// lives BEFORE its payload fence (Loading/Invoking/Bridge conventions); a
// line inside a fence starting "Invoke the workflow-" is payload text the
// model prints instead of executing — the Portal stall class.
// ---------------------------------------------------------------------------

function checkBuriedInvoke(files) {
  const out = [];
  for (const file of files) {
    const lines = readLines(file);
    const { blocks } = parseFences(lines);
    for (const b of blocks) {
      for (const { n, text } of b.lines) {
        if (/^\s*Invoke the workflow-/.test(text)) {
          out.push({ file, line: n + 1, message: 'invocation imperative inside a fence — payload is never instruction; put the imperative before the fence' });
        }
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Check 18 — no skill frontmatter declares a SessionEnd hook. Claude Code
// never fires one from skill frontmatter (other events do fire there), so a
// declaration is dead plumbing that reads as cleanup nobody runs. Session-end
// cleanup is the settings-level hook the engine installs in the project's
// `.claude/settings.json`.
// ---------------------------------------------------------------------------

function checkNoFrontmatterSessionEndHooks(files) {
  const out = [];
  for (const file of files) {
    if (path.basename(file) !== 'SKILL.md') continue;
    const lines = readLines(file);
    if (lines[0] === undefined || lines[0].trim() !== '---') continue;
    let inHooks = false;
    for (let i = 1; i < lines.length && lines[i].trim() !== '---'; i++) {
      const line = lines[i];
      if (/^\S/.test(line)) inHooks = line === 'hooks:';
      else if (inHooks && /^\s+SessionEnd:/.test(line)) {
        out.push({ file, line: i + 1, message: 'SessionEnd hook in skill frontmatter — Claude Code never fires it; session-end cleanup is the settings-level hook the engine installs in .claude/settings.json' });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Check 21 — an engine-section call site defers to its marker. The section
// marker (`=== TITLE …`, `=== DISPLAY[: label] …`, `=== MENU[: label] …`)
// carries the section's handling instruction, so a sentence that emits a
// section — an active emit verb ("emit", "emits", "emitting", "re-emit…")
// beside a section named by its kind or as a "section" — says so in the one
// phrasing, "verbatim per its marker" / "verbatim per their markers"; and a
// sentence that names a section kind or emits a section never states a form
// of its own ("verbatim as markdown", "(not a code block)", "(markdown)", a
// text, properties or diff code block or its fence, a bare "verbatim as a
// code block", emphasis ignored) — that is a second instruction for it. The sentence is the unit, so a neighbouring
// sentence's content and form are never the section's; a bullet whose
// subject is a section is one unit, its later sentences included. A passive
// "emitted" describes rather than instructs and is out of scope, as is fenced
// content — the engine's API reference describes the markers there — and the
// rendering instruction of a prose-authored block ("Output the next fenced
// block as …"), which names no engine section.
// ---------------------------------------------------------------------------

const SECTION_KIND = /\b(?:TITLE|DISPLAY|MENU)\b/;
const SECTION_NAMED = /\b(?:TITLE|DISPLAY|MENU|[Ss]ections?)\b/;
const SECTION_BULLET = /^\s*[-*] .*\*\*`?(?:TITLE|DISPLAY|MENU)\b/;
const EMITS = /\b(?:re-)?emit(?:s|ting)?\b/i;
const DEFERS = /\bverbatim per (?:its marker|their markers)\b/;
const RESTATED_FORM = /verbatim,? as markdown|(?:verbatim as a|text|properties|diff) code block|\(not a code block\)|\(markdown\)|```(?:text|properties|diff)\b/;
const PROSE_BLOCK_INSTRUCTION = /Output the next fenced block as/;

function sectionCallSiteFault(unit) {
  if (PROSE_BLOCK_INSTRUCTION.test(unit)) return null;
  const emits = EMITS.test(unit) && SECTION_NAMED.test(unit);
  if ((emits || SECTION_KIND.test(unit)) && RESTATED_FORM.test(unit.replace(/\*\*/g, ''))) {
    return 'an engine-section call site restates its marker\'s form — defer to it ("…section verbatim per its marker")';
  }
  if (emits && !DEFERS.test(unit)) {
    return 'an engine-section call site emits without deferring to its marker — say so ("…section verbatim per its marker")';
  }
  return null;
}

function checkSectionsDeferToMarker(files) {
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
// Check 23 — a question at a gate defers to the set-aside rule. What a reply
// at a gate is lives once, in the framework (instructions.md): a question
// sets the gate aside until the person is ready to move on, and never puts
// it straight back. So a branch keyed on a question arriving at a gate — `If ask`,
// `If the user asks a question`, `If user asked a question`, `If the user
// asks about a number`, `If the comment is a question …`, as an H4 or a bold
// conditional, or a route list's `- **Ask** —` item — says so before whatever
// puts the gate back ("sets the gate aside" … "ready to move on"), or
// delegates the answer to the shared answering-how-it-works.md, whose
// put-back carries the same rule. A heading branch runs to the next heading,
// bold conditional, or rule; a list item runs to the next item or blank line.
// ---------------------------------------------------------------------------

const QUESTION_BRANCH = /^(?:#### If |\*\*If )(?:ask\b|the user asks (?:a question|about a number)|user asked a question|the comment is a question)/;
const QUESTION_ROUTE = /^\s*[-*] \*\*Ask\*\* —/;
const BRANCH_END = /^(?:#{1,4}\s|\*\*(?:If |Otherwise)|---\s*$)/;
const ROUTE_END = /^\s*(?:[-*] |$)/;
const SETS_ASIDE = /sets the gate aside[\s\S]*ready to move on/;
const DELEGATES_ANSWER = /\(\.\.\/\.\.\/workflow-shared\/references\/answering-how-it-works\.md\)|\(answering-how-it-works\.md\)/;

function checkQuestionsSetGatesAside(files) {
  const out = [];
  for (const file of files) {
    const lines = readLines(file);
    const { inFence } = parseFences(lines);
    lines.forEach((line, i) => {
      const route = QUESTION_ROUTE.test(line);
      if (inFence[i] || !(route || QUESTION_BRANCH.test(line))) return;
      const ends = route ? ROUTE_END : BRANCH_END;
      let end = i + 1;
      while (end < lines.length && (inFence[end] || !ends.test(lines[end]))) end++;
      const body = lines.slice(route ? i : i + 1, end).filter((_, k) => !inFence[(route ? i : i + 1) + k]).join('\n');
      if (SETS_ASIDE.test(body) || DELEGATES_ANSWER.test(body)) return;
      out.push({
        file,
        line: i + 1,
        message: 'a question branch puts its gate back without the set-aside rule — say "The question sets the gate aside until the person is ready to move on; to put it back:" before the route or fetch',
      });
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Check 24 — a prose-authored block names its form one way. Every rendering
// instruction ("> *Output the next fenced block as …:*") opens on one of the
// four forms — markdown (not a code block), a text code block (```text
// fence), a properties code block (```properties fence), a diff code block
// (```diff fence) — with at most a " — note" before its closing ":*", and the
// fence beneath it carries the tag its form names, bare for markdown. A line
// naming the instruction in any other shape is a legacy or reworded form.
// Fenced content — an example of an instruction — is out of scope.
// ---------------------------------------------------------------------------

const RENDER_FORMS = [
  ['markdown (not a code block)', ''],
  ['a text code block (```text fence)', 'text'],
  ['a properties code block (```properties fence)', 'properties'],
  ['a diff code block (```diff fence)', 'diff'],
];
const RENDER_INSTRUCTION = /^\s*(?:\d+\.\s+)?> \*Output the next fenced block as (.*):\*$/;
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
// Registry + reporting
// ---------------------------------------------------------------------------

const CHECKS = [
  ['1: phase-title chrome (drawn borders retired)', checkBorders],
  ['2: step / sub-step chrome (drawn markers retired)', checkMarkers],
  ['3: no menus in prose', checkNoProseMenus],
  ['4: banned STOP variants', checkBannedStop],
  ['5: banned navigation verbs', checkBannedNav],
  ['6: internal routing-target existence', checkRouting],
  ['7: markdown link resolution', checkLinks],
  ['8: H1 category rule', checkH1Category],
  ['9: Zero Output Rule byte-identity', checkZeroOutput],
  ['10: reference-file attribution', checkAttribution],
  ['11: load-directive footers (On return)', checkLoadFooters],
  ['12: earned chrome (inert load-only steps)', checkInertLoadChrome],
  ['13: templated-fence ratchet (render-surfaces D4)', checkTemplatedRatchet],
  ['14: buried invocation imperatives', checkBuriedInvoke],
  ['15: cross-file section references', checkCrossFileSections],
  ['18: no skill-frontmatter SessionEnd hooks', checkNoFrontmatterSessionEndHooks],
  ['20: footerless load directives', checkFooterlessLoads],
  ['21: engine-section call sites defer to the marker', checkSectionsDeferToMarker],
  ['22: free-text flag values are quoted', checkQuotedFreeTextFlags],
  ['23: a question at a gate sets it aside', checkQuestionsSetGatesAside],
  ['24: rendering instructions name one of four forms over a fence carrying its tag', checkRenderForms],
];

// ---------------------------------------------------------------------------
// Check 20 — a Load directive is never the last word of a step. CONVENTIONS
// (Load Directive Format): a step is never left with no footer at all —
// silence reads as the end of the step, and the next heading gets treated as
// the fall-through. Within a SKILL.md, a Load **[...]** directive must be
// followed, before the next heading, by a routing line (→ On return / →
// Proceed / → Return), a **STOP.** gate, or a bold conditional — inline or
// as an H4 `#### If`/`#### Otherwise` branch heading — that re-keys the
// routing to its branches. Only an H2/H3 heading is a fall-through target.
// The `## Instructions` framework load composes the whole skill and carries
// no footer by design; the file's final `## ` step is terminal and exempt, as
// is any segment that declares itself Terminal; a trailing `## Notes` is
// documentation, not a step, and never counts as the last step.
// ---------------------------------------------------------------------------

function checkFooterlessLoads(files) {
  const out = [];
  for (const file of files) {
    if (!file.endsWith('SKILL.md')) continue;
    const lines = readLines(file);
    const { inFence } = parseFences(lines);
    const lastH2 = lines.reduce((acc, l, i) => (/^##\s/.test(l) && !/^##\s+Notes\b/.test(l) ? i : acc), -1);
    let pending = -1;
    let segmentStart = 0;
    let instructions = false;
    const flush = (end) => {
      if (pending < 0) return;
      const segment = lines.slice(segmentStart, end).join('\n');
      const terminal = segmentStart >= lastH2 || /\bTerminal\b/.test(segment);
      if (!terminal) {
        out.push({
          file,
          line: pending + 1,
          message: 'Load directive with no footer before the next heading — add "→ On return, …" (or the deferring "→ On return, proceed as the reference directed.")',
        });
      }
      pending = -1;
    };
    lines.forEach((line, i) => {
      if (inFence[i] || FENCE.test(line)) return;
      if (/^#{2,3}\s/.test(line)) {
        flush(i);
        segmentStart = i;
        instructions = /^##\s+Instructions\b/.test(line);
        return;
      }
      if (instructions) return;
      if (/^####\s+(If |Otherwise)/.test(line)) {
        pending = -1;
        return;
      }
      if (/Load \*\*\[/.test(line)) {
        pending = i;
        return;
      }
      if (pending >= 0 && (/^\s*→/.test(line) || /\*\*STOP\.\*\*/.test(line) || /^\*\*(If |Otherwise)/.test(line))) {
        pending = -1;
      }
    });
    flush(lines.length);
  }
  return out;
}

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

test('corpus is non-empty and covers all three scan roots', () => {
  assert.ok(CORPUS.length > 250, `expected a large corpus, found ${CORPUS.length}`);
  assert.ok(CORPUS.some((f) => f.includes(`${path.sep}agents${path.sep}`)), 'agents/*.md not scanned');
  assert.ok(CORPUS.some((f) => f.includes('create-output-format')), 'create-output-format not scanned');
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

test('check 1 (borders) — bans drawn borders, skips the banner, pins the H1 glyph', () => {
  withTemp((dir) => {
    // any drawn border in prose is retired — width no longer matters
    const bad = write(
      dir,
      'skills/x/SKILL.md',
      '```\n●' + '─'.repeat(47) + '●\n  Overview\n●' + '─'.repeat(47) + '●\n```\n'
    );
    const v1 = checkBorders([bad]);
    assert.strictEqual(v1.length, 2, `expected 2 border violations, got ${v1.length}`);

    // banner: ascii art + a 67-wide ● border → must be skipped
    const banner = write(
      dir,
      'skills/workflow-start/SKILL.md',
      '```\n●' + '─'.repeat(65) + '●\n    ___   ____________\n   /   | / ____/ ___/\n●' + '─'.repeat(65) + '●\n```\n'
    );
    assert.strictEqual(checkBorders([banner]).length, 0, 'banner border must be exempt');

    // markdown phase title: ■ passes, any other family glyph is caught
    const good = write(dir, 'skills/y/SKILL.md', '```\n# **`■ Overview`**\n```\n');
    assert.strictEqual(checkBorders([good]).length, 0, 'markdown phase title must pass');
    const wrongGlyph = write(dir, 'skills/z/SKILL.md', '```\n# **`□ Overview`**\n```\n');
    assert.strictEqual(checkBorders([wrongGlyph]).length, 1, 'an H1 with a non-■ chrome glyph must be caught');
  });
});

test('check 2 (markers) — bans drawn markers, skips embedded dividers, pins marker glyphs', () => {
  withTemp((dir) => {
    const drawnStep = write(dir, 'skills/x/a.md', '```\n── Construct Specification ────────\n```\n');
    assert.strictEqual(checkMarkers([drawnStep]).length, 1, 'drawn step marker must be caught');

    const drawnSub = write(dir, 'skills/x/b.md', '```\n·· Sub ' + '·'.repeat(60) + '\n```\n');
    assert.strictEqual(checkMarkers([drawnSub]).length, 1, 'drawn sub-step marker must be caught');

    // centered content divider embedded in a multi-line display fence → not a marker
    const divider = write(
      dir,
      'skills/x/c.md',
      '```\n  Some Display\n  ── Section Title ──\n  more content\n```\n'
    );
    assert.strictEqual(checkMarkers([divider]).length, 0, 'embedded content divider must not be flagged');

    // markdown chrome: □ and ▪ pass; ■ in a marker fence belongs to the H1
    const good = write(dir, 'skills/x/d.md', '```\n**`□ Construct Specification`**\n```\n');
    assert.strictEqual(checkMarkers([good]).length, 0, 'markdown step marker must pass');
    const goodSub = write(dir, 'skills/x/e.md', '```\n**`▪ Extract Sources`**\n```\n');
    assert.strictEqual(checkMarkers([goodSub]).length, 0, 'markdown sub-step marker must pass');
    const wrongGlyph = write(dir, 'skills/x/f.md', '```\n**`■ Construct Specification`**\n```\n');
    assert.strictEqual(checkMarkers([wrongGlyph]).length, 1, 'a marker carrying the phase-title glyph must be caught');
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

test('check 4 (banned STOP) — catches each banned variant', () => {
  withTemp((dir) => {
    for (const phrase of BANNED_STOP) {
      const f = write(dir, `skills/x/${phrase.length}.md`, `Text. ${phrase} More.\n`);
      assert.strictEqual(checkBannedStop([f]).length, 1, `must catch "${phrase}"`);
    }
    const good = write(dir, 'skills/x/ok.md', '**STOP.** Wait for user response.\n');
    assert.strictEqual(checkBannedStop([good]).length, 0, 'sanctioned STOP must pass');
  });
});

test('check 5 (banned nav) — catches banned verbs, permits Proceed/Return', () => {
  withTemp((dir) => {
    const cases = ['→ Go to **Step 2**.', '→ Jump to **B. X**.', '→ Skip to **Step 3**.', '→ Continue to **Step 4**.', '→ Enter plan mode.', '→ Proceed directly to **Step 5**.'];
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

    const scaffold = write(dir, '.claude/skills/create-output-format/references/scaffolding/about.md', '[p](../../../SKILL.md)\n');
    assert.strictEqual(checkLinks([scaffold]).length, 0, 'scaffolding templates must be exempt');
  });
});

test('check 8 (H1 category) — enforces the processing/backbone split', () => {
  withTemp((dir) => {
    const procNoH1 = write(dir, 'skills/workflow-foo-process/SKILL.md', 'One-liner purpose.\n\n## Step 0\n');
    assert.strictEqual(checkH1Category([procNoH1]).length, 1, 'processing backbone without H1 must be caught');

    const entryWithH1 = write(dir, 'skills/workflow-foo-entry/SKILL.md', '# Foo Entry\n\nOne-liner.\n');
    assert.strictEqual(checkH1Category([entryWithH1]).length, 1, 'entry backbone with H1 must be caught');

    const navWithH1 = write(dir, 'skills/workflow-continue-foo/SKILL.md', '# Continue Foo\n\nOne-liner.\n');
    assert.strictEqual(checkH1Category([navWithH1]).length, 1, 'navigation backbone with H1 must be caught');

    const procGood = write(dir, 'skills/workflow-bar-process/SKILL.md', '# Bar Process\n\nOne-liner.\n');
    const entryGood = write(dir, 'skills/workflow-bar-entry/SKILL.md', 'One-liner purpose.\n\n## Step 0\n');
    const engineGood = write(dir, 'skills/workflow-engine/SKILL.md', '# Workflow Engine\n\nOne-liner.\n');
    assert.strictEqual(checkH1Category([procGood, entryGood, engineGood]).length, 0, 'correctly-categorised backbones must pass');
  });
});

test('check 9 (Zero Output Rule) — catches drift from the canonical form', () => {
  withTemp((dir) => {
    const mangled = write(dir, 'skills/x/a.md', '> **⚠️ ZERO OUTPUT RULE**: Do not narrate.\n');
    assert.strictEqual(checkZeroOutput([mangled]).length, 1, 'drifted Zero Output Rule must be caught');

    const good = write(dir, 'skills/x/b.md', ZERO_OUTPUT_RULE + '\n');
    assert.strictEqual(checkZeroOutput([good]).length, 0, 'canonical Zero Output Rule must pass');
  });
});

test('check 10 (attribution) — catches missing/wrong attribution, skips output-formats', () => {
  withTemp((dir) => {
    const missing = write(dir, 'skills/x/references/a.md', '# Some Reference\n\nStraight into content with no attribution.\n');
    assert.strictEqual(checkAttribution([missing]).length, 1, 'missing attribution must be caught');

    const wrong = write(dir, 'skills/x/references/b.md', '# Some Reference\n\n*Loaded by whoever.*\n');
    assert.strictEqual(checkAttribution([wrong]).length, 1, 'non-sanctioned attribution must be caught');

    const refForm = write(dir, 'skills/x/references/c.md', '# C\n\n*Reference for **[skill-name](../SKILL.md)***\n\n---\n');
    const sharedForm = write(dir, 'skills/x/references/d.md', '# D\n\n*Shared reference for all workflow skills.*\n');
    assert.strictEqual(checkAttribution([refForm, sharedForm]).length, 0, 'sanctioned forms must pass');

    const of = write(dir, 'skills/workflow-planning-process/references/output-formats/tick/reading.md', '# Reading\n\n## Listing Tasks\n');
    assert.strictEqual(checkAttribution([of]).length, 0, 'output-format adapters must be exempt');
  });
});

test('check 20 (footerless loads) — catches a load that ends its step, permits footers, gates, branches, and the terminal step', () => {
  withTemp((dir) => {
    const bad = write(
      dir,
      'skills/x/SKILL.md',
      '## Step 0: A\n\n#### Otherwise\n\nLoad **[a.md](references/a.md)** with x = `1`.\n\n---\n\n## Step 1: B\n\nLoad **[b.md](references/b.md)** and follow its instructions as written.\n\n→ On return, proceed to **Step 2**.\n\n## Step 2: C\n\nDone.\n'
    );
    assert.strictEqual(checkFooterlessLoads([bad]).length, 1, 'a load left as the last word of a non-terminal step must be caught');

    const deferred = write(
      dir,
      'skills/y/SKILL.md',
      '## Step 0: A\n\n#### Otherwise\n\nLoad **[a.md](references/a.md)** with x = `1`.\n\n→ On return, proceed as the reference directed.\n\n---\n\n## Step 1: B\n\nDone.\n'
    );
    assert.strictEqual(checkFooterlessLoads([deferred]).length, 0, 'the deferring footer must pass');

    const gated = write(
      dir,
      'skills/z/SKILL.md',
      '## Step 0: A\n\nLoad **[a.md](references/a.md)** and follow its instructions as written.\n\n**STOP.** Wait for user response.\n\n**If `yes`:**\n\n→ Proceed to **Step 1**.\n\n## Step 1: B\n\nLoad **[b.md](references/b.md)** and follow its instructions as written.\n\n**If ready:**\n\n→ Proceed to **Step 2**.\n\n## Step 2: C\n\nLoad **[c.md](references/c.md)** and follow its instructions as written.\n\n## Notes\n\nDocumentation.\n'
    );
    assert.strictEqual(checkFooterlessLoads([gated]).length, 0, 'a STOP or bold conditional re-keys the routing, and the final step before a trailing Notes section is terminal');

    const instr = write(
      dir,
      'skills/w/SKILL.md',
      '## Instructions\n\nLoad **[framework.md](../workflow-shared/references/framework.md)** and follow its instructions as written.\n\n---\n\n## Step 0: A\n\nLoad **[a.md](references/a.md)** with x = `1`.\n\n#### If x is `1`\n\n→ Proceed to **Step 1**.\n\n#### Otherwise\n\nLoad **[b.md](references/b.md)** with x = `2`.\n\n## Step 1: B\n\nDone.\n'
    );
    assert.strictEqual(checkFooterlessLoads([instr]).length, 1, 'the Instructions load and an H4-branched load pass; the Otherwise branch that ends in a load before the next step is caught');

    const ref = write(dir, 'skills/x/references/r.md', '## A. One\n\nLoad **[a.md](a.md)** and follow its instructions as written.\n\n## B. Two\n');
    assert.strictEqual(checkFooterlessLoads([ref]).length, 0, 'references are out of scope');
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

test('check 12 (inert load chrome) — catches unearned markers, skips interactive/structured shapes', () => {
  withTemp((dir) => {
    const marker = '**`□ Load Things`**';
    const step = (body) =>
      '## Step 1: Load Things\n\n> *Output the next fenced block as markdown (not a code block):*\n\n```\n' +
      marker +
      '\n```\n\n> *Output the next fenced block as markdown (not a code block):*\n\n```\n> Loading things.\n```\n\n' +
      body +
      '\n→ On return, proceed to **Step 2**.\n\n## Step 2: Next\n';

    write(dir, 'skills/x/references/inert.md', '# Inert\n\nRead the file. Hold values in memory.\n');
    write(dir, 'skills/x/references/interactive.md', '# Interactive\n\n**STOP.** Wait for user response.\n');

    const bad = write(dir, 'skills/x/SKILL.md', step('Load **[inert.md](references/inert.md)** and follow its instructions as written.\n'));
    const v = checkInertLoadChrome([bad]);
    assert.strictEqual(v.length, 1, 'marker on inert load-only step must be caught');
    assert.match(v[0].message, /inert\.md/);

    const good = write(dir, 'skills/y/SKILL.md', step('Load **[interactive.md](../x/references/interactive.md)** and follow its instructions as written.\n'));
    assert.strictEqual(checkInertLoadChrome([good]).length, 0, 'interactive reference keeps its marker');

    write(dir, 'skills/x/references/dispatching.md', '# Dispatching\n\n- **Agent path**: `../../../agents/some-agent.md`\n');
    const dispatches = write(dir, 'skills/v/SKILL.md', step('Load **[dispatching.md](../x/references/dispatching.md)** and follow its instructions as written.\n'));
    assert.strictEqual(checkInertLoadChrome([dispatches]).length, 0, 'a step dispatching sub-agents keeps its marker — the fan-out is the wait');

    const silent = write(
      dir,
      'skills/z/SKILL.md',
      '## Step 1: Load Things\n\nLoad **[inert.md](../x/references/inert.md)** and follow its instructions as written.\n\n→ On return, proceed to **Step 2**.\n\n## Step 2: Next\n'
    );
    assert.strictEqual(checkInertLoadChrome([silent]).length, 0, 'silent load-only step must pass');

    const structured = write(dir, 'skills/w/SKILL.md', step('#### If ready\n\nLoad **[inert.md](../x/references/inert.md)** and follow its instructions as written.\n'));
    assert.strictEqual(checkInertLoadChrome([structured]).length, 0, 'H4-structured step is judgment tier — skipped');

    const unresolvable = write(dir, 'skills/v/SKILL.md', step('Load **[gone.md](references/gone.md)** and follow its instructions as written.\n'));
    assert.strictEqual(checkInertLoadChrome([unresolvable]).length, 0, 'unresolvable target must be skipped');
  });
});

test('check 13 (templated-fence ratchet) — catches drift both ways, skips static/marker/signpost', () => {
  withTemp((dir) => {
    const instr = '> *Output the next fenced block as markdown (not a code block):*\n\n';
    const templatedMenu = instr + '```\n· · · · · · · · · · · ·\nContinue "{topic}"?\n\n- **`y/yes`**\n· · · · · · · · · · · ·\n```\n';

    const fresh = write(dir, 'skills/x/a.md', templatedMenu);
    const v1 = checkTemplatedRatchet([fresh], {});
    assert.strictEqual(v1.length, 1, 'unpinned templated fence must be caught');
    assert.match(v1[0].message, /render new output from the engine/);

    assert.strictEqual(checkTemplatedRatchet([fresh], { [rel(fresh)]: 1 }).length, 0, 'pinned site is sanctioned');

    const v2 = checkTemplatedRatchet([fresh], { [rel(fresh)]: 2 });
    assert.strictEqual(v2.length, 1, 'stale over-pin must be caught');
    assert.match(v2[0].message, /shrink its pin/);

    const v3 = checkTemplatedRatchet([fresh], { [rel(fresh)]: 1, 'skills/gone/b.md': 1 });
    assert.strictEqual(v3.length, 1, 'pin for a deleted file must be caught');
    assert.match(v3[0].message, /no longer exists/);

    const statik = write(dir, 'skills/x/c.md', instr + '```\n· · · · · · · · · · · ·\nProceed?\n- **`y/yes`**\n· · · · · · · · · · · ·\n```\n');
    assert.strictEqual(checkTemplatedRatchet([statik], {}).length, 0, 'static menu is always fine');

    const chrome = write(
      dir,
      'skills/x/d.md',
      '> *Output the next fenced block as a code block:*\n\n```\n── Review (cycle {N}) ──────────────────────────\n```\n\n' +
        instr + '```\n> Working on {topic} — questions about gaps\n> and contradictions follow.\n```\n'
    );
    assert.strictEqual(checkTemplatedRatchet([chrome], {}).length, 0, 'templated markers and signposts are chrome, out of scope');

    const diffForm = write(
      dir,
      'skills/x/e.md',
      '> *Output the next fenced block as a ` ```diff ` code block:*\n\n```diff\n {context}\n-{removed lines}\n+{new lines}\n```\n'
    );
    assert.strictEqual(checkTemplatedRatchet([diffForm], {}).length, 1, 'the diff-form instruction is inside the ratchet');
  });
});

test('check 14 (buried invoke) — catches in-fence imperatives, permits pre-fence ones', () => {
  withTemp((dir) => {
    const bad = write(dir, 'skills/x/a.md', '```\nPipeline bridge for: pay\n\nInvoke the workflow-bridge skill.\n```\n');
    const v = checkBuriedInvoke([bad]);
    assert.strictEqual(v.length, 1, 'in-fence imperative must be caught');
    const good = write(dir, 'skills/x/b.md', 'Invoke the **workflow-bridge** skill (Skill tool) with the next fenced block as its arguments.\n\n```\nPipeline bridge for: pay\n```\n');
    assert.strictEqual(checkBuriedInvoke([good]).length, 0, 'pre-fence imperative is the canonical form');
  });
});

test('check 18 (frontmatter SessionEnd hooks) — catches a SessionEnd declaration, permits other events', () => {
  withTemp((dir) => {
    const cleanup = 'node "$CLAUDE_PROJECT_DIR/.claude/skills/workflow-engine/scripts/engine.cjs" session cleanup';
    const hookBlock = (event) => `hooks:\n  ${event}:\n    - hooks:\n        - type: command\n          command: '${cleanup}'\n`;

    const plain = write(dir, 'skills/workflow-a-process/SKILL.md',
      '---\nname: workflow-a-process\nuser-invocable: false\n---\n\nBody.\n');
    // Other events do fire from skill frontmatter and stay allowed.
    const preToolUse = write(dir, 'skills/workflow-b-process/SKILL.md',
      `---\nname: workflow-b-process\n${hookBlock('PreToolUse')}---\n`);
    // The event name in the body is prose, not a declaration.
    const bodyMention = write(dir, 'skills/workflow-c-process/SKILL.md',
      '---\nname: workflow-c-process\n---\n\n```\nSessionEnd:\n```\n');
    assert.strictEqual(checkNoFrontmatterSessionEndHooks([plain, preToolUse, bodyMention]).length, 0, 'no SessionEnd declared — clean');

    // A SessionEnd hook declared in frontmatter never fires.
    const sessionEnd = write(dir, 'skills/workflow-d-process/SKILL.md',
      `---\nname: workflow-d-process\n${hookBlock('SessionEnd')}---\n`);
    const v = checkNoFrontmatterSessionEndHooks([plain, preToolUse, sessionEnd]);
    assert.strictEqual(v.length, 1, `expected the SessionEnd declaration to be caught, got ${report(v)}`);
    assert.strictEqual(v[0].file, sessionEnd);
    assert.strictEqual(v[0].line, 4);
    assert.match(v[0].message, /SessionEnd hook in skill frontmatter/);
  });
});

test('check 21 (engine-section call sites defer to the marker) — catches a section emitted without deferring and a restated form in a section\'s sentence or bullet, permits the deferring form, other content\'s forms and emissions, passive descriptions, fenced content and prose-block instructions', () => {
  withTemp((dir) => {
    const deferring = write(dir, 'skills/x/deferring.md', [
      'Emit the call\'s MENU section verbatim per its marker.',
      'Fetch the gate and emit its `MENU: add gate` section verbatim per its marker:',
      'Emit the TITLE section, then the DISPLAY section, then the MENU section, each verbatim per its marker.',
      '- **TITLE** — the view\'s chrome heading. Emit verbatim per its marker, directly above the display.',
      '- **DISPLAY** — the status block. Emit verbatim per its marker. Never redraw, reflow, or trim it.',
      'Emit the `DISPLAY: proposed task` section verbatim per its marker; then the raise, as conversational markdown; then the `MENU: task decision` section verbatim per its marker.',
      'Render and emit each section verbatim per its marker:',
      'Re-fetch with `--view full` and emit its sections verbatim per their markers — the full updated section with the menu minus the view option.',
      'Fetch and emit the receipt — the `DISPLAY: kb warning` advisory (when carried) then the `DISPLAY: confirmation` section, each verbatim per its marker — adding `--warn` when the response\'s `warnings` is non-empty.',
      '',
    ].join('\n'));
    assert.strictEqual(checkSectionsDeferToMarker([deferring]).length, 0, 'the deferring form is clean, alone or across several sections');

    // Not a section's form or emission: a neighbouring sentence on the
    // section's line, a passive description, an emit of prose-authored
    // content, the API reference's fenced description of a marker, and the
    // rendering instruction of a prose-authored block.
    const others = write(dir, 'skills/x/others.md', [
      'Present the full phase structure from the planning file as rendered markdown (not a code block) — goals, ordering rationale, acceptance criteria as the designer wrote them. Emit its `MENU: phase structure gate` section verbatim per its marker.',
      '',
      'Render the doc file verbatim as markdown. Then re-fetch the gate and emit its `MENU: baseline doc gate` section verbatim per its marker.',
      '',
      'Draw each diagram in a text code block (```text fence). Then emit the `MENU: task gate` section verbatim per its marker.',
      '',
      'Read the `sessions` rows only — the response\'s deferral section is the analysis dispatch\'s and is not emitted here.',
      '',
      'Read `all_decided` and `unresolved` from its DATA section; nothing from this call is emitted.',
      '',
      'Emit the lane marker on this drain\'s first screen only — later screens and re-renders skip it:',
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
    assert.strictEqual(checkSectionsDeferToMarker([others]).length, 0, `nothing outside a section's own emitting sentence is flagged, got ${report(checkSectionsDeferToMarker([others]))}`);

    const silent = write(dir, 'skills/x/silent.md', [
      'Fetch and emit the `MENU: revisit phases` section (its numbering follows `revisitable_phases` order):',
      '',
      'Emit the section verbatim.',
      '',
      'Render and emit each section verbatim at its marked instruction:',
      '',
      'Emit the MENU section.',
      '',
      '- **DISPLAY** — the rendered map. Emit verbatim. Never redraw, reflow, or trim it.',
      '',
      'When the person takes it, fetch the card and emit its sections in the order they arrive, each per its own marker:',
      '',
      'The calling flow emits each section verbatim beneath the call that fetched it.',
      '',
      'Then re-emit the `MENU: phase structure gate` section.',
      '',
      'Emit the `DISPLAY: selection` and `MENU: selection` sections verbatim, each per its marker.',
      '',
      'Emit the section per its marker.',
      '',
    ].join('\n'));
    const s = checkSectionsDeferToMarker([silent]);
    assert.deepStrictEqual(s.map((x) => x.line), [1, 3, 5, 7, 9, 11, 13, 15, 17, 19], `each section emitted without deferring in the one phrasing is caught, got ${report(s)}`);
    assert.ok(s.every((x) => /emits without deferring/.test(x.message)), `the non-deferring message names the fault, got ${report(s)}`);

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
    ].join('\n'));
    const v = checkSectionsDeferToMarker([restated]);
    assert.deepStrictEqual(v.map((x) => x.line), [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23], `each restating sentence is caught, got ${report(v)}`);
    assert.ok(v.every((x) => /restates its marker's form/.test(x.message)), `a restated form is reported as one, got ${report(v)}`);
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

test('check 23 (a question at a gate sets it aside) — catches a question branch that puts its gate straight back, permits the set-aside form, a delegated answer, an Ask item in a route list, and branches that carry no question', () => {
  withTemp((dir) => {
    const deferring = write(dir, 'skills/x/deferring.md', [
      '#### If ask',
      '',
      'Answer from the record. The question sets the gate aside until the person is ready to move on; to put it back:',
      '',
      '→ Return to **A. Conclude Gate**.',
      '',
      '**If the comment is a question back or feedback:**',
      '',
      'Answer it. The exchange sets the gate aside until the person is ready to move on; to put it back, re-fetch the gate and emit its MENU section verbatim per its marker:',
      '',
      '```bash',
      'engine render executor-block-gate x.implementation.x',
      '```',
      '',
      '#### If the user asks a question',
      '',
      'Answer it per **[answering-how-it-works.md](../../workflow-shared/references/answering-how-it-works.md)** — the menu it puts back is the home\'s.',
      '',
      '→ Return to **B. Handle Selection**.',
      '',
      '#### If the user asks for the interactive page',
      '',
      '→ Return to **G. Task Gate**.',
      '',
      'Route the answer:',
      '  - **Waiting** (`w/waiting`) — a plain `roadmap add`.',
      '  - **Ask** — answer it. The question sets the gate aside until the person is ready to move on; to put it back, render the gate again.',
      '',
    ].join('\n'));
    assert.strictEqual(checkQuestionsSetGatesAside([deferring]).length, 0, `the set-aside form, a delegated answer, and a non-question branch are clean, got ${report(checkQuestionsSetGatesAside([deferring]))}`);

    const blind = write(dir, 'skills/x/blind.md', [
      '#### If ask',
      '',
      'Answer the user\'s questions about the review.',
      '',
      '→ Return to **F. Fix Approval Gate**.',
      '',
      '**If ask:**',
      '',
      'Answer the user\'s question, then fetch the confirm gate again and emit it as above.',
      '',
      '**STOP.** Wait for user response.',
      '',
      '#### If user asked a question',
      '',
      'Answer the question.',
      '',
      '→ Return to **B. Action Menu**.',
      '',
      '**If the user asks about a number:**',
      '',
      'Answer it. Expanding is not objecting; the screen stands.',
      '',
      '**If the comment is a question or steers the attempt:**',
      '',
      'Answer it. Then re-fetch the gate and emit its MENU section verbatim per its marker — the reply takes these branches again.',
      '',
      '#### If the user asks a question',
      '',
      'Answer it, then put the gate back — the phrase below is fenced content, not the branch\'s own words:',
      '',
      '```',
      'sets the gate aside until the person is ready to move on',
      '```',
      '',
      '## B. Routes',
      '',
      'Route the answer:',
      '  - **Ask** — answer it and talk it through, then render the gate again.',
      '  - **Waiting** (`w/waiting`) — the gate sets the gate aside until the person is ready to move on, the next item\'s words, never the Ask\'s.',
      '',
    ].join('\n'));
    const v = checkQuestionsSetGatesAside([blind]);
    assert.deepStrictEqual(v.map((x) => x.line), [1, 7, 13, 19, 23, 27, 38], `each question branch that puts its gate straight back is caught, got ${report(v)}`);
    assert.ok(v.every((x) => /without the set-aside rule/.test(x.message)), `the fault is named, got ${report(v)}`);
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

test('fence parsing — a numbered list item may open a fence', () => {
  const { inFence } = parseFences(['3. ```bash', 'engine render x', '   ```', 'after']);
  assert.deepStrictEqual(inFence, [false, true, false, false]);
});

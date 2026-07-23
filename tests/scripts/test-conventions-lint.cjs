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

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..', '..');
const DOT = '·'; // MIDDLE DOT (U+00B7)
const MENU_FRAME = Array(12).fill(DOT).join(' '); // "· · · · · · · · · · · ·"
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

function charLen(str) {
  return [...str].length; // code-point count = character count for BMP glyphs
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
    if (/^\s*```/.test(lines[i])) {
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
// Check 1 — Phase-title borders: ●-bordered lines are exactly 49 characters
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
      if (!/^●─+●$/.test(t)) return; // ● … ─ … ●
      if (bannerLines.has(i)) return; // documented banner exception
      const w = charLen(t);
      if (w !== 49) {
        out.push({
          file,
          line: i + 1,
          message: `phase-title border must be 49 characters (● + 47 ─ + ●), found ${w}`,
        });
      }
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Check 2 — Step / sub-step markers are exactly 49 characters. A marker is
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
      if (b.lines.length !== 1) continue; // sole-line fence only
      const { n, text } = b.lines[0];
      if (!/^(── |·· )/.test(text)) continue;
      const w = charLen(text);
      if (w !== 49) {
        const kind = text.startsWith('── ') ? 'step marker' : 'sub-step marker';
        out.push({
          file,
          line: n + 1,
          message: `${kind} must be 49 characters, found ${w}`,
        });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Check 3 — Menu dot frames: any line of spaced middle dots must be exactly
// "· · · · · · · · · · · ·". Leading indentation (menus nested under list
// items) is permitted; the dot pattern itself must be canonical.
// ---------------------------------------------------------------------------

function checkDotFrames(files) {
  const out = [];
  for (const file of files) {
    const lines = readLines(file);
    lines.forEach((line, i) => {
      const t = line.trim();
      if (!/^[· ]+$/.test(t)) return;
      const dots = (t.match(/·/g) || []).length;
      if (dots < 3) return; // a lone "·" is a bullet, not a frame
      if (t !== MENU_FRAME) {
        out.push({ file, line: i + 1, message: `menu dot frame must be exactly "${MENU_FRAME}"` });
      }
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Check 4 — Banned STOP variants must not appear.
// ---------------------------------------------------------------------------

const BANNED_STOP = ['Stop here.', 'Command ends.', 'Wait for user to acknowledge before ending.'];

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
  const H1_KNOWN = new Set(['workflow-engine', 'workflow-knowledge']);
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
      if (inFence[i] || /^\s*```/.test(line)) return;
      if (/^#{1,6}\s/.test(line) || /\*\*STOP\.\*\*/.test(line) || /^\*\*If /.test(line)) {
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
  if (/\*\*STOP\.\*\*/.test(text) || /Output the next fenced block/.test(text) || /^```bash/m.test(text)) return false;
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
        if (inFence[j] && /^── .+ ─+$/.test(lines[j])) markerLine = j;
      }
      if (markerLine === -1) continue;
      const substance = [];
      let structured = false;
      for (let j = start + 1; j < end; j++) {
        if (inFence[j] || /^\s*```/.test(lines[j])) continue;
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

/** @type {Record<string, number>} */
const RATCHET_PINS = {
  'skills/workflow-continue-epic/references/epic-display-and-menu.md': 3,
  'skills/workflow-continue-epic/references/summary-backfill.md': 3,
  'skills/workflow-discovery/references/confirm-trigger.md': 1,
  'skills/workflow-discovery/references/map-operations.md': 9,
  'skills/workflow-discovery/references/name-resolution.md': 2,
  'skills/workflow-discovery/references/opener-pattern.md': 1,
  'skills/workflow-discovery/references/session-loop.md': 1,
  'skills/workflow-discovery/references/show-dismissed.md': 1,
  'skills/workflow-discussion-entry/references/gather-context-continue.md': 1,
  'skills/workflow-discussion-entry/references/gather-context-fresh.md': 1,
  'skills/workflow-discussion-entry/references/gather-context.md': 1,
  'skills/workflow-discussion-process/references/conclude-discussion.md': 1,
  'skills/workflow-discussion-process/references/discussion-session.md': 5,
  'skills/workflow-discussion-process/references/perspective-agents.md': 2,
  'skills/workflow-implementation-entry/references/check-dependencies.md': 4,
  'skills/workflow-implementation-process/SKILL.md': 1,
  'skills/workflow-implementation-process/references/analysis-loop.md': 1,
  'skills/workflow-implementation-process/references/linter-setup.md': 2,
  'skills/workflow-implementation-process/references/project-skills-discovery.md': 2,
  'skills/workflow-implementation-process/references/task-loop.md': 7,
  'skills/workflow-investigation-entry/references/gather-context.md': 1,
  'skills/workflow-investigation-process/references/analysis-checkpoints.md': 3,
  'skills/workflow-investigation-process/references/conclude-investigation.md': 1,
  'skills/workflow-investigation-process/references/findings-signoff.md': 1,
  'skills/workflow-investigation-process/references/fix-exploration.md': 1,
  'skills/workflow-investigation-process/references/fix-validation.md': 2,
  'skills/workflow-investigation-process/references/investigation-plan.md': 2,
  'skills/workflow-investigation-process/references/root-cause-validation.md': 2,
  'skills/workflow-knowledge/references/knowledge-usage.md': 1,
  'skills/workflow-legacy-research-split/SKILL.md': 3,
  'skills/workflow-legacy-research-split/references/dialog.md': 7,
  'skills/workflow-log-bug/SKILL.md': 1,
  'skills/workflow-log-idea/SKILL.md': 1,
  'skills/workflow-log-quickfix/SKILL.md': 1,
  'skills/workflow-planning-entry/references/cross-cutting-context.md': 2,
  'skills/workflow-planning-process/references/analyze-task-graph.md': 3,
  'skills/workflow-planning-process/references/author-tasks.md': 6,
  'skills/workflow-planning-process/references/conclude-plan.md': 1,
  'skills/workflow-planning-process/references/define-tasks.md': 1,
  'skills/workflow-planning-process/references/initialize-plan.md': 1,
  'skills/workflow-planning-process/references/output-formats/linear/authoring.md': 1,
  'skills/workflow-planning-process/references/plan-construction.md': 3,
  'skills/workflow-planning-process/references/plan-review.md': 2,
  'skills/workflow-planning-process/references/process-review-findings.md': 1,
  'skills/workflow-planning-process/references/resolve-dependencies.md': 1,
  'skills/workflow-research-process/references/conclude-research.md': 1,
  'skills/workflow-research-process/references/deep-dive-agent.md': 2,
  'skills/workflow-research-process/references/epic-session.md': 3,
  'skills/workflow-research-process/references/feature-session.md': 2,
  'skills/workflow-research-process/references/topic-splitting.md': 2,
  'skills/workflow-review-process/references/present-review.md': 7,
  'skills/workflow-scoping-process/SKILL.md': 2,
  'skills/workflow-scoping-process/references/complexity-check.md': 2,
  'skills/workflow-discovery/references/first-phase-routing.md': 1,
  'skills/workflow-scoping-process/references/gather-context.md': 1,
  'skills/workflow-scoping-process/references/select-format.md': 1,
  'skills/workflow-scoping-process/references/write-specification.md': 1,
  'skills/workflow-shared/references/analysis-approval-gate.md': 4,
  'skills/workflow-shared/references/background-agent-surfacing.md': 3,
  'skills/workflow-shared/references/compliance-check.md': 1,
  'skills/workflow-shared/references/convergence-analysis.md': 1,
  'skills/workflow-shared/references/drain-triage.md': 1,
  'skills/workflow-shared/references/final-review-menu.md': 1,
  'skills/workflow-shared/references/topic-name-validation.md': 1,
  'skills/workflow-shared/references/triage-landing.md': 1,
  'skills/workflow-specification-entry/references/confirm-continue.md': 4,
  'skills/workflow-specification-entry/references/confirm-create.md': 3,
  'skills/workflow-specification-entry/references/confirm-refine.md': 2,
  'skills/workflow-specification-entry/references/confirm-unify.md': 2,
  'skills/workflow-specification-entry/references/display-single.md': 1,
  'skills/workflow-specification-process/SKILL.md': 1,
  'skills/workflow-specification-process/references/process-review-findings.md': 4,
  'skills/workflow-specification-process/references/spec-completion.md': 2,
  'skills/workflow-specification-process/references/spec-construction.md': 3,
  'skills/workflow-specification-process/references/spec-review.md': 2,
  'skills/workflow-start/SKILL.md': 1,
  'skills/workflow-start/references/absorb-into-epic.md': 4,
  'skills/workflow-start/references/inbox-archived.md': 5,
  'skills/workflow-start/references/inbox-working-set.md': 3,
  'skills/workflow-start/references/knowledge-gate.md': 4,
  'skills/workflow-start/references/view-completed.md': 1,
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
    if (j >= lines.length || !/^\s*```/.test(lines[j])) continue;
    const start = j + 1;
    let k = start;
    while (k < lines.length && !/^\s*```/.test(lines[k])) k++;
    const content = lines.slice(start, k);
    const text = content.join('\n');
    const isMarker = content.length === 1 && /^(── |·· )/.test(content[0]);
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
// Registry + reporting
// ---------------------------------------------------------------------------

const CHECKS = [
  ['1: phase-title borders (49 chars)', checkBorders],
  ['2: step / sub-step markers (49 chars)', checkMarkers],
  ['3: menu dot frames', checkDotFrames],
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
    fs.rmSync(dir, { recursive: true, force: true });
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

test('check 1 (borders) — catches wrong widths, skips the banner', () => {
  withTemp((dir) => {
    const bad = write(
      dir,
      'skills/x/SKILL.md',
      '```\n●' + '─'.repeat(46) + '●\n  Too Short\n●' + '─'.repeat(46) + '●\n```\n'
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

    // a correct 49-char border → clean
    const good = write(dir, 'skills/y/SKILL.md', '```\n●' + '─'.repeat(47) + '●\n  Overview\n●' + '─'.repeat(47) + '●\n```\n');
    assert.strictEqual(checkBorders([good]).length, 0, 'valid 49-char border must pass');
  });
});

test('check 2 (markers) — catches wrong widths, skips embedded dividers', () => {
  withTemp((dir) => {
    const badStep = write(dir, 'skills/x/a.md', '```\n── Too Short ────\n```\n');
    assert.strictEqual(checkMarkers([badStep]).length, 1, 'short step marker must be caught');

    const badSub = write(dir, 'skills/x/b.md', '```\n·· Sub ' + '·'.repeat(60) + '\n```\n');
    assert.strictEqual(checkMarkers([badSub]).length, 1, 'over-long sub-step marker must be caught');

    // centered content divider embedded in a multi-line display fence → not a marker
    const divider = write(
      dir,
      'skills/x/c.md',
      '```\n  Some Display\n  ── Section Title ──\n  more content\n```\n'
    );
    assert.strictEqual(checkMarkers([divider]).length, 0, 'embedded content divider must not be flagged');

    // valid 49-char step marker → clean
    const label = '── Construct Specification ';
    const marker = label + '─'.repeat(49 - charLen(label));
    assert.strictEqual(charLen(marker), 49);
    const good = write(dir, 'skills/x/d.md', '```\n' + marker + '\n```\n');
    assert.strictEqual(checkMarkers([good]).length, 0, 'valid marker must pass');
  });
});

test('check 3 (dot frames) — catches malformed patterns, permits nesting indent', () => {
  withTemp((dir) => {
    const short = write(dir, 'skills/x/a.md', Array(11).fill(DOT).join(' ') + '\n');
    assert.strictEqual(checkDotFrames([short]).length, 1, '11-dot frame must be caught');

    const doubled = write(dir, 'skills/x/b.md', DOT + '  ' + DOT + '  ' + DOT + '  ' + DOT + '\n');
    assert.strictEqual(checkDotFrames([doubled]).length, 1, 'double-spaced frame must be caught');

    const indented = write(dir, 'skills/x/c.md', '   ' + MENU_FRAME + '\n');
    assert.strictEqual(checkDotFrames([indented]).length, 0, 'legitimately nested frame must pass');

    const bullet = write(dir, 'skills/x/d.md', '  ' + DOT + ' advanced-features\n');
    assert.strictEqual(checkDotFrames([bullet]).length, 0, 'a single bullet dot must not be flagged');

    const good = write(dir, 'skills/x/e.md', MENU_FRAME + '\n');
    assert.strictEqual(checkDotFrames([good]).length, 0, 'canonical frame must pass');
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
    const marker = ('── Load Things ').padEnd(49, '─');
    const step = (body) =>
      '## Step 1: Load Things\n\n> *Output the next fenced block as a code block:*\n\n```\n' +
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
    const templatedMenu = instr + '```\n· · · · · · · · · · · ·\nContinue "{topic}"?\n\n- **`y`/`yes`**\n· · · · · · · · · · · ·\n```\n';

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

    const statik = write(dir, 'skills/x/c.md', instr + '```\n· · · · · · · · · · · ·\nProceed?\n- **`y`/`yes`**\n· · · · · · · · · · · ·\n```\n');
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

'use strict';

//
// Migration 051: Frontmatter state moves to the engine's stores
//
// The analysis-state programme (design/analysis-state.md) ended frontmatter
// as a state carrier: background-agent lifecycle lives in per-topic
// `state.json` files under the cache, and staging/candidate/tracking gate
// state lives in the work-unit manifest. In-progress installs still carry
// live state in the old frontmatter. Translate it forward:
//
//   1. Agent cache files (review/deep-dive/perspective/synthesis and the
//      investigation validations) → rows in the colocated state.json.
//      `read` maps to `incorporated`; fix-options drafts carry no state.
//   2. Deferred analysis-candidate files → `phases.discovery.analysis_staging`.
//   3. Staging files (review-tasks-c{N}, analysis-tasks-c{N}) →
//      `staging.c{N}` on the review/implementation item — every cycle,
//      they double as convergence history.
//   4. Tracking files (review-*-tracking-c*.md) → `tracking.{stem}`.
//   5. Fix-tracking files relocate from the cache to the committed
//      implementation directory (their new home).
//
// Legacy frontmatter is left in place, permanently unread (S6: never
// deleted). planning.md's inline approvals are deliberately NOT parsed —
// absent manifest approvals re-present one approval gate, which self-heals.
// Idempotent: existing rows/fields are never overwritten; file moves skip
// when the target exists.
//

const fs = require('fs');
const path = require('path');

const AGENT_KINDS = ['review', 'deep-dive', 'perspective', 'synthesis',
  'root-cause-validation', 'fix-validation', 'fix-exploration'];
const STATUS_MAP = { 'in-flight': 'in-flight', pending: 'pending', acknowledged: 'acknowledged', incorporated: 'incorporated', read: 'incorporated' };

/** @param {string} file @returns {{fm: Record<string, string>, lists: Record<string, string[]>} | null} */
function readFrontmatter(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
  raw = raw.replace(/\r\n/g, '\n');
  if (!raw.startsWith('---\n')) return null;
  const end = raw.indexOf('\n---', 4);
  if (end === -1) return null;
  /** @type {Record<string, string>} */
  const fm = {};
  /** @type {Record<string, string[]>} */
  const lists = {};
  let currentList = null;
  for (const line of raw.slice(4, end).split('\n')) {
    const item = /^\s+-\s+(?:id:\s*)?(.+)$/.exec(line);
    if (item && currentList) {
      lists[currentList].push(item[1].trim());
      continue;
    }
    const kv = /^([A-Za-z_]+):\s*(.*)$/.exec(line);
    if (!kv) continue;
    const [, key, value] = kv;
    if (value === '[]') {
      lists[key] = [];
      currentList = null;
      continue;
    }
    if (value === '') {
      lists[key] = [];
      currentList = key;
      continue;
    }
    currentList = null;
    if (value.startsWith('[') && value.endsWith(']')) {
      lists[key] = value.slice(1, -1).split(',').map((v) => v.trim()).filter(Boolean);
    } else {
      fm[key] = value.trim();
    }
  }
  return { fm, lists };
}

/** @param {string} p */
function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

/** @param {string} p @param {object} data */
function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
}

/** Body sections `## {name}` with `key: value` lines — the candidates shape. */
function readCandidateBlocks(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    return [];
  }
  const blocks = [];
  for (const m of raw.matchAll(/^## (.+)$([\s\S]*?)(?=^## |\n*$(?![\s\S]))/gm)) {
    const body = m[2];
    const get = (/** @type {string} */ key) => {
      const kv = new RegExp(`^${key}:\\s*(.+)$`, 'm').exec(body);
      return kv ? kv[1].trim() : null;
    };
    blocks.push({ name: m[1].trim(), status: get('status'), fanout: get('fanout_offer') });
  }
  return blocks;
}

/** Per-task `status:` lines under `## Task {n}` headings — the staging shape. */
function readStagingTasks(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    return [];
  }
  const tasks = [];
  for (const m of raw.matchAll(/^## Task (\d+)[^\n]*\n((?:(?!^## )[\s\S])*)/gm)) {
    const status = /^status:\s*(\S+)/m.exec(m[2]);
    tasks.push({ n: m[1], status: status ? status[1] : null });
  }
  return tasks;
}

module.exports = {
  id: '051',
  description: 'translate live frontmatter state (agents, staging, candidates, tracking) into the engine stores',
  run({ projectDir, reportUpdate, reportSkip }) {
    const wfRoot = path.join(projectDir, '.workflows');
    let units;
    try {
      units = fs.readdirSync(wfRoot, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
        .map((e) => e.name)
        .filter((wu) => fs.existsSync(path.join(wfRoot, wu, 'manifest.json')));
    } catch {
      reportSkip();
      return;
    }

    let touchedAny = false;
    for (const wu of units) {
      let touched = false;
      const manifestPath = path.join(wfRoot, wu, 'manifest.json');
      const manifest = readJson(manifestPath);
      if (!manifest || typeof manifest !== 'object') continue;
      manifest.phases = manifest.phases || {};

      // 1. Agent cache files → colocated state.json rows.
      const cacheRoot = path.join(wfRoot, '.cache', wu);
      if (fs.existsSync(cacheRoot)) {
        for (const phaseEnt of fs.readdirSync(cacheRoot, { withFileTypes: true })) {
          if (!phaseEnt.isDirectory()) continue;
          const phaseDir = path.join(cacheRoot, phaseEnt.name);
          for (const topicEnt of fs.readdirSync(phaseDir, { withFileTypes: true })) {
            if (!topicEnt.isDirectory()) continue;
            const topicDir = path.join(phaseDir, topicEnt.name);
            const storePath = path.join(topicDir, 'state.json');
            const store = readJson(storePath) || { agents: {} };
            if (!store.agents || typeof store.agents !== 'object') store.agents = {};
            let storeTouched = false;
            for (const f of fs.readdirSync(topicDir)) {
              if (!f.endsWith('.md')) continue;
              const id = f.slice(0, -3);
              if (store.agents[id]) continue; // idempotent
              const parsed = readFrontmatter(path.join(topicDir, f));
              if (!parsed) continue;
              const kind = parsed.fm.type;
              const status = STATUS_MAP[parsed.fm.status];
              if (!kind || !AGENT_KINDS.includes(kind) || kind === 'fix-exploration' || !status) continue;
              // A pre-programme in-flight skeleton is a dead dispatch — a row
              // would let scan promote the frontmatter-only file as a clean
              // report. No row: the file stays inert legacy.
              if (status === 'in-flight') continue;
              const setMatch = /-(\d{3})(?:-|$)/.exec(id);
              store.agents[id] = {
                id,
                kind,
                phase: phaseEnt.name,
                topic: topicEnt.name,
                set: parsed.fm.set || (setMatch ? setMatch[1] : '000'),
                ...(parsed.fm.lens || parsed.fm.thread ? { label: (parsed.fm.lens || parsed.fm.thread) } : {}),
                status,
                announced: parsed.fm.announced === 'true',
                findings: parsed.lists.findings || parsed.lists.tensions || [],
                surfaced: parsed.lists.surfaced || [],
                created: parsed.fm.created || '1970-01-01T00:00:00.000Z',
              };
              storeTouched = true;
            }
            if (storeTouched) {
              writeJson(storePath, store);
              touched = true;
            }
          }
        }
      }

      // 2. Deferred candidate files → analysis_staging.
      for (const analysis of ['research-analysis', 'discovery-gap-analysis']) {
        const file = path.join(wfRoot, wu, '.state', `${analysis}-candidates.md`);
        if (!fs.existsSync(file)) continue;
        if (((manifest.phases.discovery || {}).analysis_staging || {})[analysis]) continue; // idempotent
        const blocks = readCandidateBlocks(file).filter((b) => b.status);
        if (!blocks.some((b) => b.status === 'pending')) continue; // spent gates need no state
        if (blocks.some((b) => /[./]/.test(b.name))) continue; // dot/slash names shatter dot-paths — re-staging fresh self-heals
        const discovery = manifest.phases.discovery = manifest.phases.discovery || {};
        const stagingRoot = discovery.analysis_staging = discovery.analysis_staging || {};
        const fmParsed = readFrontmatter(file);
        /** @type {Record<string, any>} */
        const candidates = {};
        for (const b of blocks) {
          candidates[b.name] = { status: b.status, ...(b.fanout ? { fanout_offer: b.fanout } : {}) };
        }
        stagingRoot[analysis] = {
          gate_mode: (fmParsed && fmParsed.fm.gate_mode) || 'gated',
          candidates,
        };
        touched = true;
      }

      // 3 + 4. Staging cycles and tracking flips from committed topic dirs.
      for (const [phase, dirName] of [['implementation', 'implementation'], ['planning', 'planning'], ['specification', 'specification'], ['review', 'review']]) {
        const phaseRoot = path.join(wfRoot, wu, dirName);
        if (!fs.existsSync(phaseRoot)) continue;
        for (const topicEnt of fs.readdirSync(phaseRoot, { withFileTypes: true })) {
          if (!topicEnt.isDirectory()) continue;
          const topicDir = path.join(phaseRoot, topicEnt.name);
          for (const f of fs.readdirSync(topicDir)) {
            // Staging files live in implementation/{topic}/ but belong to two loops.
            let stagingTarget = null;
            const rt = /^review-tasks-c(\d+)\.md$/.exec(f);
            const at = /^analysis-tasks-c(\d+)\.md$/.exec(f);
            if (phase === 'implementation' && rt) stagingTarget = ['review', rt[1]];
            if (phase === 'implementation' && at) stagingTarget = ['implementation', at[1]];
            if (stagingTarget) {
              const [itemPhase, cycle] = stagingTarget;
              const items = ((manifest.phases[itemPhase] || {}).items) || {};
              const item = items[topicEnt.name];
              if (!item) continue;
              item.staging = item.staging || {};
              if (item.staging[`c${cycle}`]) continue; // idempotent
              const tasks = readStagingTasks(path.join(topicDir, f)).filter((t) => t.status);
              if (!tasks.length) continue;
              /** @type {Record<string, string>} */
              const rows = {};
              for (const t of tasks) {
                if (['pending', 'approved', 'skipped'].includes(t.status)) rows[t.n] = t.status;
              }
              if (!Object.keys(rows).length) continue;
              const fmParsed = readFrontmatter(path.join(topicDir, f));
              item.staging[`c${cycle}`] = {
                ...(itemPhase === 'review' ? { gate_mode: (fmParsed && fmParsed.fm.gate_mode) || 'gated' } : {}),
                tasks: rows,
              };
              touched = true;
              continue;
            }
            const tr = /^review-.*-tracking-c\d+\.md$/.exec(f);
            if (tr && (phase === 'planning' || phase === 'specification')) {
              const items = ((manifest.phases[phase] || {}).items) || {};
              const item = items[topicEnt.name];
              if (!item) continue;
              const stem = f.slice(0, -3);
              item.tracking = item.tracking || {};
              if (item.tracking[stem]) continue; // idempotent
              const fmParsed = readFrontmatter(path.join(topicDir, f));
              const status = fmParsed && fmParsed.fm.status;
              if (status !== 'in-progress' && status !== 'complete') continue;
              item.tracking[stem] = status;
              touched = true;
            }
          }
        }
      }

      // 5. Fix-tracking files relocate to the committed implementation dir.
      const implCache = path.join(wfRoot, '.cache', wu, 'implementation');
      if (fs.existsSync(implCache)) {
        for (const topicEnt of fs.readdirSync(implCache, { withFileTypes: true })) {
          if (!topicEnt.isDirectory()) continue;
          const from = path.join(implCache, topicEnt.name);
          for (const f of fs.readdirSync(from)) {
            if (!/^fix-tracking-.*\.md$/.test(f)) continue;
            const dest = path.join(wfRoot, wu, 'implementation', topicEnt.name, f);
            if (fs.existsSync(dest)) continue; // idempotent
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            fs.renameSync(path.join(from, f), dest);
            touched = true;
          }
        }
      }

      if (touched) {
        writeJson(manifestPath, manifest);
        reportUpdate();
        touchedAny = true;
      }
    }
    if (!touchedAny) reportSkip();
  },
};

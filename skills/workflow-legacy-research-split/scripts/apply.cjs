#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { validate } = require('./validate.cjs');

const MANIFEST_CLI = path.resolve(__dirname, '..', '..', 'workflow-manifest', 'scripts', 'manifest.cjs');

function die(msg, code = 1) {
  process.stderr.write(`Error: ${msg}\n`);
  process.exit(code);
}

function runCli(cwd, args) {
  const r = spawnSync('node', [MANIFEST_CLI, ...args], { cwd, encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`manifest cli failed (${args.join(' ')}): ${r.stderr || r.stdout}`);
  }
  return r.stdout;
}

function runGit(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`git failed (${args.join(' ')}): ${r.stderr || r.stdout}`);
  }
  return r.stdout;
}

function makeDatetimeStamp() {
  // Filesystem-safe ISO-ish stamp: YYYY-MM-DDTHH-MM-SS, no colons.
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
    'T' + pad(d.getHours()) + '-' + pad(d.getMinutes()) + '-' + pad(d.getSeconds())
  );
}

function readSource(cwd, workUnit, name) {
  const out = runCli(cwd, ['get', `${workUnit}.inception.${name}`, 'source']);
  // get strips JSON quoting for primitives — value lands as raw text + newline.
  return out.replace(/\n$/, '');
}

function apply(cwd, workUnit, currentSource) {
  const wuDir = path.join(cwd, '.workflows', workUnit);
  const researchDir = path.join(wuDir, 'research');
  const cacheDir = path.join(cwd, '.workflows', '.cache', workUnit, 'legacy-split', currentSource);
  const sourceFile = path.join(researchDir, `${currentSource}.md`);

  // Re-validate cache before any mutations.
  const v = validate(cwd, workUnit, currentSource);
  if (!v.ok) {
    return {
      ok: false,
      stage: 'validate',
      error: 'cache failed validation at apply start',
      errors: v.errors,
      recovery_hint: 'edit the cache plan/files to fix validation errors and retry',
    };
  }
  const plan = v.plan;

  // Stage 1: mid-flight sentinel. Set before any other mutation so detect-trigger
  // skips this source if we crash partway through.
  try {
    runCli(cwd, ['set', `${workUnit}.inception.${currentSource}`, 'legacy_split_state', 'in-progress']);
  } catch (e) {
    return {
      ok: false,
      stage: 'set_sentinel',
      error: e.message,
      recovery_hint: 'no mutations applied; safe to retry',
    };
  }

  const datetime = makeDatetimeStamp();
  const supersededName = `${currentSource}-superseded-${datetime}`;
  const supersededFile = path.join(researchDir, `${supersededName}.md`);

  // Stage 2: rename source file on disk.
  try {
    fs.renameSync(sourceFile, supersededFile);
  } catch (e) {
    return {
      ok: false,
      stage: 'rename_source_file',
      error: e.message,
      recovery_hint:
        `source file rename failed. Clear sentinel manually: manifest.cjs delete ${workUnit}.inception.${currentSource} legacy_split_state`,
    };
  }

  // Stage 3: rename source research manifest item.
  try {
    runCli(cwd, ['delete', `${workUnit}.research`, `items.${currentSource}`]);
    runCli(cwd, ['init-phase', `${workUnit}.research.${supersededName}`]);
    runCli(cwd, ['set', `${workUnit}.research.${supersededName}`, 'status', 'superseded']);
  } catch (e) {
    return {
      ok: false,
      stage: 'rename_source_research_item',
      error: e.message,
      recovery_hint:
        `manifest mutation failed partway through research-item rename. Source file is at ${supersededFile}; ` +
        `original research item may or may not still exist. Inspect manifest, restore manually, ` +
        `then clear sentinel: manifest.cjs delete ${workUnit}.inception.${currentSource} legacy_split_state`,
    };
  }

  // Stage 4: delete source inception item (releases the source name for theme reuse).
  // From here on, detect.cjs naturally excludes this source — the original file and
  // research item have been renamed, so the filter's file-exists and research-status
  // checks both fail. Manual recovery for crashes past this point is described in
  // the per-stage recovery_hint strings below.
  try {
    runCli(cwd, ['delete', `${workUnit}.inception`, `items.${currentSource}`]);
  } catch (e) {
    return {
      ok: false,
      stage: 'delete_source_inception',
      error: e.message,
      recovery_hint:
        `delete source inception item failed. Source file/research renamed; ` +
        `manually delete: manifest.cjs delete ${workUnit}.inception items.${currentSource}`,
    };
  }

  // Stage 5: apply themes.
  const creates = [];
  const merges = [];
  try {
    for (const theme of plan.themes) {
      if (theme.classification === 'creates') {
        const newFile = path.join(researchDir, `${theme.kebab_name}.md`);
        const cacheFile = path.join(cacheDir, `${theme.kebab_name}.md`);
        fs.renameSync(cacheFile, newFile);
        creates.push({ name: theme.kebab_name, path: newFile });

        runCli(cwd, ['init-phase', `${workUnit}.research.${theme.kebab_name}`]);
        runCli(cwd, ['init-phase', `${workUnit}.inception.${theme.kebab_name}`]);
        runCli(cwd, ['set', `${workUnit}.inception.${theme.kebab_name}`, 'routing', theme.routing]);
        runCli(cwd, ['set', `${workUnit}.inception.${theme.kebab_name}`, 'summary', theme.summary]);
        runCli(cwd, ['set', `${workUnit}.inception.${theme.kebab_name}`, 'description', theme.description]);
        runCli(cwd, ['set', `${workUnit}.inception.${theme.kebab_name}`, 'source', `legacy-split:${currentSource}`]);
      } else if (theme.classification === 'merges') {
        const targetFile = path.join(researchDir, `${theme.target_name}.md`);
        const cacheFile = path.join(cacheDir, `${theme.kebab_name}.md`);
        const cacheContent = fs.readFileSync(cacheFile, 'utf8');
        if (!fs.existsSync(targetFile)) {
          throw new Error(`merge target ${theme.target_name}.md does not exist; cannot append`);
        }
        const sep = cacheContent.startsWith('\n') ? '---' : '\n---\n';
        fs.appendFileSync(targetFile, sep + cacheContent);
        merges.push({ name: theme.target_name, path: targetFile });

        // Extend target inception item's source field (comma-joined, idempotent).
        const targetSourceTag = `legacy-split:${currentSource}`;
        const existsOut = runCli(cwd, ['exists', `${workUnit}.inception.${theme.target_name}`]);
        if (existsOut.trim() === 'true') {
          let current = '';
          try { current = readSource(cwd, workUnit, theme.target_name); } catch { current = ''; }
          const parts = current.split(',').map(s => s.trim()).filter(Boolean);
          if (!parts.includes(targetSourceTag)) {
            parts.push(targetSourceTag);
            runCli(cwd, ['set', `${workUnit}.inception.${theme.target_name}`, 'source', parts.join(',')]);
          }
        }

        // Clean up cache file for merge themes — creates were renamed, merges read+left.
        try { fs.unlinkSync(cacheFile); } catch {}
      }
    }
  } catch (e) {
    return {
      ok: false,
      stage: 'apply_themes',
      error: e.message,
      recovery_hint:
        `theme application failed mid-flight. Source file renamed to ${supersededFile}; ` +
        `source inception item already deleted. Some themes may have been partially written. ` +
        `Inspect ${researchDir} and manifest items, clean up partial themes manually, ` +
        `then re-run /continue-epic.`,
    };
  }

  // Stage 6: git add + commit.
  const addPaths = [
    path.relative(cwd, path.join(wuDir, 'manifest.json')),
    path.relative(cwd, sourceFile),
    path.relative(cwd, supersededFile),
    ...creates.map(c => path.relative(cwd, c.path)),
    ...merges.map(m => path.relative(cwd, m.path)),
  ];

  try {
    runGit(cwd, ['add', '-A', '--', ...addPaths]);
    runGit(cwd, ['commit', '--allow-empty', '-m', `inception(${workUnit}): legacy-split ${currentSource}`]);
  } catch (e) {
    return {
      ok: false,
      stage: 'git_commit',
      error: e.message,
      recovery_hint:
        `commit failed (likely pre-commit hook). All file and manifest mutations are applied. ` +
        `Resolve the hook issue, commit manually, then clean the cache: ` +
        `rm -rf ${cacheDir}`,
    };
  }

  // Stage 7: cleanup cache dir.
  try {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  } catch {
    // Non-fatal; cache dir cleanup failure does not corrupt state.
  }

  return {
    ok: true,
    applied: {
      creates: creates.length,
      merges: merges.length,
    },
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 2) die('Usage: apply.cjs <work-unit> <current-source>');
  const result = apply(process.cwd(), args[0], args[1]);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (!result.ok) process.exit(1);
}

module.exports = { apply };

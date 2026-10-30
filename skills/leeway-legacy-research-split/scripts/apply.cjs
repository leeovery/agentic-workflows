#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { validate } = require('./validate.cjs');

const ENGINE_CLI = path.resolve(__dirname, '..', '..', 'leeway-engine', 'scripts', 'engine.cjs');
const { commitStateScoped } = require(path.resolve(__dirname, '..', '..', 'leeway-engine', 'scripts', 'domain', 'commit.cjs'));
const { syncKnowledge } = require(path.resolve(__dirname, '..', '..', 'leeway-engine', 'scripts', 'domain', 'knowledge', 'sync.cjs'));
const { ENGINE_COMMAND } = require(path.resolve(__dirname, '..', '..', 'leeway-engine', 'scripts', 'kernel', 'call.cjs'));
const { stateRoot } = require(path.resolve(__dirname, '..', '..', 'leeway-engine', 'scripts', 'kernel', 'state-root.cjs'));
const { isolatedGit } = require(path.resolve(__dirname, '..', '..', 'leeway-engine', 'scripts', 'kernel', 'isolated-git.cjs'));

function die(msg, code = 1) {
  process.stderr.write(`Error: ${msg}\n`);
  process.exit(code);
}

function runCli(cwd, args) {
  const r = spawnSync('node', [ENGINE_CLI, 'manifest', ...args], { cwd, encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`engine manifest failed (${args.join(' ')}): ${r.stderr || r.stdout}`);
  }
  return r.stdout;
}

// Index-truth check: does the state's git track this path? Reads the index,
// so it answers correctly even after the file has been moved on disk (the
// index still records the old path until we stage the move).
function isTracked(cwd, file) {
  return isolatedGit(stateRoot(cwd)).tryRun(['ls-files', '--error-unmatch', '--', file]) !== null;
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

function titleCase(kebab) {
  return kebab.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
}

function renderResearchTemplate(theme, currentSource) {
  // Standard research-file structure used everywhere else in the workflow.
  // Body comes from the cache file (the theme's substantive content).
  return (
    `# Research: ${titleCase(theme.kebab_name)}\n\n` +
    `${theme.summary}\n\n` +
    `## Starting Point\n\n` +
    `- Material extracted from legacy research file ${currentSource}.md via legacy-research-split.\n\n` +
    `---\n\n` +
    `${theme.cacheContent}`
  );
}

function loadDismissedList(cwd, workUnit) {
  const manifestPath = path.join(stateRoot(cwd), workUnit, 'manifest.json');
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const dismissed = manifest && manifest.phases && manifest.phases.discovery && manifest.phases.discovery.dismissed;
    return Array.isArray(dismissed) ? dismissed : [];
  } catch {
    return [];
  }
}

function apply(cwd, workUnit, currentSource) {
  const wuDir = path.join(stateRoot(cwd), workUnit);
  const researchDir = path.join(wuDir, 'research');
  const cacheDir = path.join(stateRoot(cwd), '.cache', workUnit, 'legacy-split', currentSource);
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
    runCli(cwd, ['set', `${workUnit}.discovery.${currentSource}`, 'legacy_split_state', 'in-progress']);
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
        `source file rename failed. Clear sentinel manually: engine manifest delete ${workUnit}.discovery.${currentSource} legacy_split_state`,
    };
  }

  // Stage 3: rename source research manifest item (set auto-creates the
  // renamed item — no separate init step).
  try {
    runCli(cwd, ['delete', `${workUnit}.research`, `items.${currentSource}`]);
    runCli(cwd, ['set', `${workUnit}.research.${supersededName}`, 'status', 'superseded']);
  } catch (e) {
    return {
      ok: false,
      stage: 'rename_source_research_item',
      error: e.message,
      recovery_hint:
        `manifest mutation failed partway through research-item rename. Source file is at ${supersededFile}; ` +
        `original research item may or may not still exist. Inspect manifest, restore manually, ` +
        `then clear sentinel: engine manifest delete ${workUnit}.discovery.${currentSource} legacy_split_state`,
    };
  }

  // Stage 4: delete source discovery item (releases the source name for theme reuse).
  // From here on, detect.cjs naturally excludes this source — the original file and
  // research item have been renamed, so the filter's file-exists and research-status
  // checks both fail. Manual recovery for crashes past this point is described in
  // the per-stage recovery_hint strings below.
  try {
    runCli(cwd, ['delete', `${workUnit}.discovery`, `items.${currentSource}`]);
  } catch (e) {
    return {
      ok: false,
      stage: 'delete_source_discovery',
      error: e.message,
      recovery_hint:
        `delete source discovery item failed. Source file/research renamed; ` +
        `manually delete: engine manifest delete ${workUnit}.discovery items.${currentSource}`,
    };
  }

  // Stage 4b: drop the source's chunks from the knowledge base. Best-effort —
  // a failure is surfaced but never aborts the apply.
  const kbWarnings = [];
  syncKnowledge(cwd, [{
    remove: { workUnit, phase: 'research', topic: currentSource },
    label: `knowledge remove (research/${currentSource})`,
  }], kbWarnings);

  // Stage 5: apply themes.
  const dismissed = loadDismissedList(cwd, workUnit);
  const created = [];
  try {
    for (const theme of plan.themes) {
      const newFile = path.join(researchDir, `${theme.kebab_name}.md`);
      const cacheFile = path.join(cacheDir, `${theme.kebab_name}.md`);

      // Read cache content, wrap with the standard research-file template,
      // write to the research dir, remove the cache file.
      const cacheContent = fs.readFileSync(cacheFile, 'utf8');
      const wrapped = renderResearchTemplate({ ...theme, cacheContent }, currentSource);
      fs.writeFileSync(newFile, wrapped);
      fs.unlinkSync(cacheFile);
      created.push({ name: theme.kebab_name, path: newFile });

      // If the name was previously dismissed via refinement, pull it from the
      // dismissed list so the re-add is clean.
      if (dismissed.includes(theme.kebab_name)) {
        runCli(cwd, ['pull', `${workUnit}.discovery`, 'dismissed', theme.kebab_name]);
      }

      // set auto-creates each item; discovery map items carry no status field.
      // The four discovery fields batch into one locked write — the engine
      // validates every pair before writing, so the item lands atomically.
      runCli(cwd, ['set', `${workUnit}.research.${theme.kebab_name}`, 'status', 'in-progress']);
      runCli(cwd, [
        'set', `${workUnit}.discovery.${theme.kebab_name}`,
        'routing=research',
        `summary=${theme.summary}`,
        `description=${theme.description}`,
        `source=legacy-split:${currentSource}`,
      ]);
    }
  } catch (e) {
    return {
      ok: false,
      stage: 'apply_themes',
      error: e.message,
      recovery_hint:
        `theme application failed mid-flight. Source file renamed to ${supersededFile}; ` +
        `source discovery item already deleted. Some themes may have been partially written. ` +
        `Inspect ${researchDir} and manifest items, clean up partial themes manually, ` +
        `then reopen the epic via /leeway.`,
    };
  }

  // Stage 6: commit through the door, scoped to exactly the split's paths.
  // Only reference the source's old path if git knows it. An untracked source
  // (never committed) was renamed away in Stage 2, so the old path matches
  // nothing on disk and nothing in the index.
  const sourceTracked = isTracked(cwd, sourceFile);
  const addPaths = [
    path.join(wuDir, 'manifest.json'),
    ...(sourceTracked ? [sourceFile] : []),
    supersededFile,
    ...created.map(c => c.path),
  ];

  // The split writes across several research topics at once, so no --topic
  // scope covers it: the work-unit form is the confined retry.
  const retry = `${ENGINE_COMMAND} commit ${workUnit} `
    + `-m "discovery(${workUnit}): legacy-split ${currentSource}"`;
  /** @type {string[]} */
  let commitWarnings;
  try {
    // Through the state door: the split runs beside live research and
    // discussion sessions on the same work unit, so it takes the writer lock
    // every other state commit takes, and stays confined to the paths it
    // wrote.
    commitWarnings = commitStateScoped(cwd, addPaths, `discovery(${workUnit}): legacy-split ${currentSource}`).warnings;
  } catch (e) {
    const recovery_hint = sourceTracked
      ? `commit failed. All file and manifest mutations are applied. ` +
        `Commit the split, then clean the cache: ${retry} && rm -rf ${cacheDir}`
      : `commit failed — the source file ${sourceFile} was never committed, so its pre-split ` +
        `history isn't in git. All file and manifest mutations are applied. Commit the split, ` +
        `then clean the cache: ${retry} && rm -rf ${cacheDir}`;
    return {
      ok: false,
      stage: 'git_commit',
      error: e.message,
      recovery_hint,
    };
  }

  // Stage 7: cleanup cache dir.
  try {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  } catch {
    // Non-fatal; cache dir cleanup failure does not corrupt state.
  }

  const result = {
    ok: true,
    applied: { themes: created.length },
  };
  if (kbWarnings.length > 0) result.kb_warnings = kbWarnings;
  if (commitWarnings.length > 0) result.warnings = commitWarnings;
  return result;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 2) die('Usage: apply.cjs <work-unit> <current-source>');
  const result = apply(process.cwd(), args[0], args[1]);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (!result.ok) process.exit(1);
}

module.exports = { apply };

#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

// Cache-shape contract validated here:
//
// .workflows/.cache/{work_unit}/legacy-split/{current_source}/
//   ├── plan.json
//   └── {kebab_name}.md   (one per theme, non-empty)
//
// plan.json schema:
// {
//   "themes": [
//     {
//       "kebab_name":  "<string, unique within plan>",
//       "summary":     "<non-empty, non-whitespace string>",
//       "description": "<non-empty, non-whitespace string>"
//     },
//     ...
//   ]
// }

function die(msg, code = 1) {
  process.stderr.write(`Error: ${msg}\n`);
  process.exit(code);
}

function loadDiscoveryItemNames(cwd, workUnit) {
  const manifestPath = path.join(cwd, '.workflows', workUnit, 'manifest.json');
  if (!fs.existsSync(manifestPath)) return null;
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const items = manifest && manifest.phases && manifest.phases.discovery && manifest.phases.discovery.items;
    return items && typeof items === 'object' ? new Set(Object.keys(items)) : new Set();
  } catch {
    return null;
  }
}

function validate(cwd, workUnit, currentSource) {
  const cacheDir = path.join(cwd, '.workflows', '.cache', workUnit, 'legacy-split', currentSource);
  const planPath = path.join(cacheDir, 'plan.json');
  const errors = [];

  // For collision check: existing discovery items the cache must not duplicate.
  // The source's own discovery item is exempt — apply.cjs deletes it before theme
  // creation, so a theme reusing the source name is the natural rename case.
  const discoveryNames = loadDiscoveryItemNames(cwd, workUnit);

  if (!fs.existsSync(planPath)) {
    return { ok: false, errors: [`plan.json not found at ${planPath}`] };
  }

  let plan;
  try {
    plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  } catch (e) {
    return { ok: false, errors: [`plan.json is not valid JSON: ${e.message}`] };
  }

  if (!plan || typeof plan !== 'object' || !Array.isArray(plan.themes)) {
    return { ok: false, errors: ['plan.json must be an object with a "themes" array'] };
  }

  if (plan.themes.length === 0) {
    return { ok: false, errors: ['plan.json has no themes'] };
  }

  const seenNames = new Map();
  for (let i = 0; i < plan.themes.length; i++) {
    const theme = plan.themes[i];
    const label = (theme && theme.kebab_name) || `theme[${i}]`;

    if (!theme || typeof theme !== 'object') {
      errors.push(`${label} is not an object`);
      continue;
    }

    const kebab = theme.kebab_name;
    if (typeof kebab !== 'string' || kebab.trim() === '') {
      errors.push(`${label} has empty or missing kebab_name`);
    } else if (seenNames.has(kebab)) {
      errors.push(`themes share kebab_name '${kebab}'`);
    } else {
      seenNames.set(kebab, true);
    }

    const summary = typeof theme.summary === 'string' ? theme.summary.trim() : '';
    if (summary === '') {
      errors.push(`theme '${label}' has empty summary`);
    }

    const description = typeof theme.description === 'string' ? theme.description.trim() : '';
    if (description === '') {
      errors.push(`theme '${label}' has empty description`);
    }

    if (typeof kebab === 'string' && kebab.trim() !== '') {
      const filePath = path.join(cacheDir, `${kebab}.md`);
      if (!fs.existsSync(filePath)) {
        errors.push(`theme '${kebab}' has no cache file at ${kebab}.md`);
      } else {
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.trim() === '') {
          errors.push(`theme '${kebab}' cache file is empty`);
        }
      }

      // Collision check: theme cannot share a name with an active discovery
      // item, except the source itself (which apply.cjs deletes before theme
      // creation — the natural source-rename case).
      if (discoveryNames && discoveryNames.has(kebab) && kebab !== currentSource) {
        errors.push(`theme '${kebab}' collides with an existing discovery item; rename the theme`);
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, plan };
}

module.exports = { validate };

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 2) die('Usage: validate.cjs <work-unit> <current-source>');
  const result = validate(process.cwd(), args[0], args[1]);
  // Strip the parsed plan from CLI output — callers only need ok/errors.
  const out = result.ok ? { ok: true } : { ok: false, errors: result.errors };
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
}

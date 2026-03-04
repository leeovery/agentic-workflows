'use strict';

const fs = require('fs');
const path = require('path');
const { loadActiveManifests, loadManifest, phaseData, fileExists } = require('../../workflow-shared/scripts/discovery-utils');

function discover(cwd) {
  const manifests = loadActiveManifests(cwd);
  const workflowsDir = path.join(cwd, '.workflows');

  const plans = [];
  const implementations = [];

  for (const m of manifests) {
    const planning = phaseData(m, 'planning');
    if (!planning.status) continue;

    const planFile = path.join(workflowsDir, m.name, 'planning', m.name, 'planning.md');
    if (!fileExists(planFile)) continue;

    const specFile = path.join(workflowsDir, m.name, 'specification', m.name, 'specification.md');
    const impl = phaseData(m, 'implementation');

    // External dependencies (object keyed by topic)
    const externalDepsObj = (planning.external_dependencies && typeof planning.external_dependencies === 'object' && !Array.isArray(planning.external_dependencies))
      ? planning.external_dependencies
      : {};

    const externalDeps = Object.entries(externalDepsObj).map(([topic, d]) => ({ topic, ...d }));
    const unresolvedCount = externalDeps.filter(d => d.state === 'unresolved').length;
    const hasUnresolved = unresolvedCount > 0;

    // Dependency resolution: inline per plan
    let depsSatisfied = true;
    const depsBlocking = [];

    for (const dep of externalDeps) {
      if (dep.state === 'unresolved') {
        depsSatisfied = false;
        depsBlocking.push({ topic: dep.topic, reason: 'dependency unresolved' });
      } else if (dep.state === 'resolved' && dep.task_id) {
        const depManifest = loadManifest(cwd, dep.topic);
        const depImpl = depManifest ? phaseData(depManifest, 'implementation') : {};
        const completedTasks = Array.isArray(depImpl.completed_tasks) ? depImpl.completed_tasks : [];

        if (!completedTasks.includes(dep.task_id)) {
          depsSatisfied = false;
          depsBlocking.push({ topic: dep.topic, task_id: dep.task_id, reason: 'task not yet completed' });
        }
      } else if (dep.state === 'resolved' && !dep.task_id) {
        depsSatisfied = false;
        depsBlocking.push({ topic: dep.topic, reason: 'resolved dependency missing task reference' });
      }
    }

    plans.push({
      name: m.name,
      topic: m.name,
      status: planning.status,
      work_type: m.work_type,
      format: planning.format || 'MISSING',
      specification: `${m.name}/specification/${m.name}/specification.md`,
      specification_exists: fileExists(specFile),
      ...(planning.plan_id && { plan_id: planning.plan_id }),
      external_deps: externalDeps.map(d => ({
        topic: d.topic || '', state: d.state || '',
        ...(d.task_id && { task_id: d.task_id }),
      })),
      has_unresolved_deps: hasUnresolved,
      unresolved_dep_count: unresolvedCount,
      deps_satisfied: depsSatisfied,
      deps_blocking: depsBlocking,
    });

    // Implementation tracking
    if (impl.status) {
      const completedPhases = Array.isArray(impl.completed_phases) ? impl.completed_phases : [];
      const completedTasks = Array.isArray(impl.completed_tasks) ? impl.completed_tasks : [];

      implementations.push({
        topic: m.name,
        status: impl.status,
        ...(impl.current_phase != null && impl.current_phase !== '~' && { current_phase: impl.current_phase }),
        completed_phases: completedPhases,
        completed_tasks: completedTasks,
      });
    }
  }

  // Environment
  const envFile = path.join(cwd, '.workflows', '.state', 'environment-setup.md');
  const envExists = fileExists(envFile);
  let requiresSetup = null;
  if (envExists) {
    try {
      const content = fs.readFileSync(envFile, 'utf8');
      requiresSetup = /no special setup required/i.test(content) ? false : true;
    } catch { requiresSetup = true; }
  }

  let scenario;
  if (plans.length === 0) scenario = 'no_plans';
  else if (plans.length === 1) scenario = 'single_plan';
  else scenario = 'multiple_plans';

  return {
    plans: { exists: plans.length > 0, files: plans, count: plans.length },
    implementation: {
      exists: implementations.length > 0,
      files: implementations,
    },
    environment: {
      setup_file_exists: envExists,
      setup_file: '.workflows/.state/environment-setup.md',
      requires_setup: requiresSetup,
    },
    state: {
      has_plans: plans.length > 0, plan_count: plans.length,
      scenario,
    },
  };
}

function format(result) {
  const lines = [];

  lines.push('=== PLANS ===');
  if (!result.plans.exists) {
    lines.push('  (none)');
  } else {
    for (const p of result.plans.files) {
      let deps = '';
      if (p.external_deps.length > 0) {
        deps = `, deps: ${p.external_deps.length} (${p.unresolved_dep_count} unresolved)`;
      }
      lines.push(`  ${p.name}: ${p.status}, format=${p.format}${deps}`);
      if (p.deps_blocking.length > 0) {
        for (const b of p.deps_blocking) {
          lines.push(`    blocked: ${b.topic}${b.task_id ? ':' + b.task_id : ''} (${b.reason})`);
        }
      }
    }
  }
  lines.push('');

  lines.push('=== IMPLEMENTATION ===');
  if (!result.implementation.exists) {
    lines.push('  (none)');
  } else {
    for (const i of result.implementation.files) {
      lines.push(`  ${i.topic}: ${i.status}, tasks=${i.completed_tasks.length} completed`);
    }
  }
  lines.push('');

  lines.push('=== ENVIRONMENT ===');
  lines.push(`  exists: ${result.environment.setup_file_exists}, requires_setup: ${result.environment.requires_setup}`);
  lines.push('');

  lines.push('=== STATE ===');
  lines.push(`scenario: ${result.state.scenario}`);
  lines.push(`plans: ${result.state.plan_count} total`);

  return lines.join('\n') + '\n';
}

if (require.main === module) {
  process.stdout.write(format(discover(process.cwd())));
}

module.exports = { discover };

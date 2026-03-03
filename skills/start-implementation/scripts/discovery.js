'use strict';

const path = require('path');
const { loadActiveManifests, loadManifest, phaseData, fileExists, listDirs } = require('../../workflow-shared/scripts/discovery-utils');

function discover(cwd) {
  const manifests = loadActiveManifests(cwd);
  const workflowsDir = path.join(cwd, '.workflows');

  const plans = [];
  const implementations = [];
  let plansConcluded = 0, plansWithUnresolvedDeps = 0;
  let implInProgress = 0, implCompleted = 0;

  // First pass: collect plan and impl data
  for (const m of manifests) {
    const planning = phaseData(m, 'planning');
    if (!planning.status) continue;

    const planFile = path.join(workflowsDir, m.name, 'planning', m.name, 'planning.md');
    if (!fileExists(planFile)) continue;

    const specFile = path.join(workflowsDir, m.name, 'specification', m.name, 'specification.md');
    const impl = phaseData(m, 'implementation');

    // External dependencies
    const externalDeps = Array.isArray(planning.external_dependencies)
      ? planning.external_dependencies
      : [];

    const unresolvedCount = externalDeps.filter(d => d.state === 'unresolved').length;
    const hasUnresolved = unresolvedCount > 0;

    if (planning.status === 'concluded') plansConcluded++;
    if (hasUnresolved) plansWithUnresolvedDeps++;

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

      if (impl.status === 'in-progress') implInProgress++;
      else if (impl.status === 'completed') implCompleted++;
    }
  }

  // Dependency resolution: cross-reference resolved deps against actual completion
  const depResolution = [];
  for (const plan of plans) {
    if (plan.external_deps.length === 0) continue;

    let allSatisfied = true;
    const blocking = [];

    for (const dep of plan.external_deps) {
      if (dep.state === 'unresolved') {
        allSatisfied = false;
        blocking.push({ topic: dep.topic, reason: 'dependency unresolved' });
      } else if (dep.state === 'resolved' && dep.task_id) {
        // Check if the referenced task is actually completed
        const depManifest = loadManifest(cwd, dep.topic);
        const depImpl = depManifest ? phaseData(depManifest, 'implementation') : {};
        const completedTasks = Array.isArray(depImpl.completed_tasks) ? depImpl.completed_tasks : [];

        if (!completedTasks.includes(dep.task_id)) {
          allSatisfied = false;
          blocking.push({ topic: dep.topic, task_id: dep.task_id, reason: 'task not yet completed' });
        }
      }
    }

    depResolution.push({ plan: plan.name, deps_satisfied: allSatisfied, deps_blocking: blocking });
  }

  // Compute ready count (concluded + all deps satisfied + not already in-progress/completed)
  let plansReady = 0;
  for (const plan of plans) {
    if (plan.status !== 'concluded') continue;

    // Skip if already implementing
    const implEntry = implementations.find(i => i.topic === plan.name);
    if (implEntry && (implEntry.status === 'in-progress' || implEntry.status === 'completed')) continue;

    // Check deps
    const resolution = depResolution.find(d => d.plan === plan.name);
    if (resolution && !resolution.deps_satisfied) continue;

    // Also check unresolved deps directly
    if (plan.has_unresolved_deps) continue;

    plansReady++;
  }

  // Environment
  const envFile = path.join(cwd, '.workflows', '.state', 'environment-setup.md');
  const envExists = fileExists(envFile);
  let requiresSetup = 'unknown';
  if (envExists) {
    try {
      const content = require('fs').readFileSync(envFile, 'utf8');
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
    dependency_resolution: depResolution,
    environment: {
      setup_file_exists: envExists,
      setup_file: '.workflows/.state/environment-setup.md',
      requires_setup: requiresSetup,
    },
    state: {
      has_plans: plans.length > 0, plan_count: plans.length,
      plans_concluded_count: plansConcluded,
      plans_with_unresolved_deps: plansWithUnresolvedDeps,
      plans_ready_count: plansReady,
      plans_in_progress_count: implInProgress,
      plans_completed_count: implCompleted,
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

  if (result.dependency_resolution.length > 0) {
    lines.push('=== DEPENDENCY RESOLUTION ===');
    for (const d of result.dependency_resolution) {
      lines.push(`  ${d.plan}: satisfied=${d.deps_satisfied}`);
      for (const b of d.deps_blocking) {
        lines.push(`    blocked: ${b.topic}${b.task_id ? ':' + b.task_id : ''} (${b.reason})`);
      }
    }
    lines.push('');
  }

  lines.push('=== ENVIRONMENT ===');
  lines.push(`  exists: ${result.environment.setup_file_exists}, requires_setup: ${result.environment.requires_setup}`);
  lines.push('');

  lines.push('=== STATE ===');
  lines.push(`scenario: ${result.state.scenario}`);
  lines.push(`plans: ${result.state.plan_count} total, ${result.state.plans_concluded_count} concluded, ${result.state.plans_ready_count} ready`);
  lines.push(`impl: ${result.state.plans_in_progress_count} in-progress, ${result.state.plans_completed_count} completed`);

  return lines.join('\n') + '\n';
}

if (require.main === module) {
  process.stdout.write(format(discover(process.cwd())));
}

module.exports = { discover };

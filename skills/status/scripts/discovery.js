'use strict';

const fs = require('fs');
const path = require('path');
const { loadActiveManifests, phaseData, listFiles, countFiles } = require('../../workflow-shared/scripts/discovery-utils');

function discover(cwd) {
  const manifests = loadActiveManifests(cwd);
  if (manifests.length === 0) {
    return {
      work_units: [],
      counts: {
        by_work_type: { epic: 0, feature: 0, bugfix: 0 },
        research: 0,
        discussion: { total: 0, concluded: 0, in_progress: 0 },
        specification: { active: 0, feature: 0, crosscutting: 0 },
        planning: { total: 0, concluded: 0, in_progress: 0 },
        implementation: { total: 0, completed: 0, in_progress: 0 },
      },
      state: { has_any_work: false },
    };
  }

  const workflowsDir = path.join(cwd, '.workflows');
  const workUnits = [];

  // Aggregated counts
  const byType = { epic: 0, feature: 0, bugfix: 0 };
  let researchCount = 0;
  let discTotal = 0, discConcluded = 0, discInProgress = 0;
  let specActive = 0, specFeature = 0, specCrosscutting = 0;
  let planTotal = 0, planConcluded = 0, planInProgress = 0;
  let implTotal = 0, implCompleted = 0, implInProgressCount = 0;

  for (const m of manifests) {
    const wt = m.work_type || 'feature';
    if (byType[wt] !== undefined) byType[wt]++;

    const baseDir = path.join(workflowsDir, m.name);
    const phases = m.phases || {};

    // Research
    const research = phaseData(m, 'research');
    const researchStatus = research.status || null;
    let fileCount = 0;
    if (researchStatus) {
      researchCount++;
      fileCount = countFiles(path.join(baseDir, 'research'), '.md');
    }

    // Discussion
    const disc = phaseData(m, 'discussion');
    const discStatus = disc.status || null;
    if (discStatus) {
      discTotal++;
      if (discStatus === 'concluded') discConcluded++;
      if (discStatus === 'in-progress') discInProgress++;
    }

    // Investigation
    const inv = phaseData(m, 'investigation');
    const invStatus = inv.status || null;

    // Specification
    const spec = phaseData(m, 'specification');
    const specStatus = spec.status || null;
    const specType = spec.type || 'feature';
    if (specStatus && specStatus !== 'superseded') {
      specActive++;
      if (specType === 'cross-cutting') specCrosscutting++;
      else specFeature++;
    }

    // Sources
    let sources = [];
    if (spec.sources && typeof spec.sources === 'object' && !Array.isArray(spec.sources)) {
      sources = Object.entries(spec.sources).map(([name, data]) => ({
        name,
        status: (typeof data === 'object') ? (data.status || 'incorporated') : 'incorporated',
      }));
    } else if (Array.isArray(spec.sources)) {
      sources = spec.sources;
    }

    // Planning
    const plan = phaseData(m, 'planning');
    const planStatus = plan.status || null;
    if (planStatus) {
      planTotal++;
      if (planStatus === 'concluded') planConcluded++;
      if (planStatus === 'in-progress') planInProgress++;
    }

    const externalDeps = Array.isArray(plan.external_dependencies) ? plan.external_dependencies : [];
    const hasUnresolved = externalDeps.some(d => d.state === 'unresolved');

    // Implementation
    const impl = phaseData(m, 'implementation');
    const implStatus = impl.status || null;
    if (implStatus) {
      implTotal++;
      if (implStatus === 'completed') implCompleted++;
      if (implStatus === 'in-progress') implInProgressCount++;
    }

    const completedTasks = Array.isArray(impl.completed_tasks) ? impl.completed_tasks.length : 0;
    let totalTasks = 0;
    const planFmt = plan.format || impl.format;
    if (planFmt === 'local-markdown') {
      totalTasks = countFiles(path.join(baseDir, 'planning', m.name, 'tasks'), '.md');
    }

    // Review
    const review = phaseData(m, 'review');
    const reviewStatus = review.status || null;

    workUnits.push({
      name: m.name, work_type: wt,
      description: m.description || '',
      research: { status: researchStatus, ...(researchStatus && { file_count: fileCount }) },
      discussion: { status: discStatus },
      investigation: { status: invStatus },
      specification: {
        status: specStatus,
        ...(specStatus && {
          type: specType,
          ...(spec.superseded_by && { superseded_by: spec.superseded_by }),
          sources,
        }),
      },
      planning: {
        status: planStatus,
        ...(planStatus && {
          format: plan.format || null,
          external_deps: externalDeps.map(d => ({
            topic: d.topic, state: d.state,
            ...(d.task_id && { task_id: d.task_id }),
          })),
          has_unresolved_deps: hasUnresolved,
        }),
      },
      implementation: {
        status: implStatus,
        ...(implStatus && {
          ...(impl.current_phase != null && impl.current_phase !== '~' && { current_phase: impl.current_phase }),
          completed_tasks: completedTasks,
          total_tasks: totalTasks,
        }),
      },
      review: { status: reviewStatus },
    });
  }

  return {
    work_units: workUnits,
    counts: {
      by_work_type: byType,
      research: researchCount,
      discussion: { total: discTotal, concluded: discConcluded, in_progress: discInProgress },
      specification: { active: specActive, feature: specFeature, crosscutting: specCrosscutting },
      planning: { total: planTotal, concluded: planConcluded, in_progress: planInProgress },
      implementation: { total: implTotal, completed: implCompleted, in_progress: implInProgressCount },
    },
    state: { has_any_work: true },
  };
}

function format(result) {
  const lines = [];

  if (!result.state.has_any_work) {
    lines.push('=== WORK UNITS ===');
    lines.push('  (none)');
    lines.push('');
    lines.push('=== STATE ===');
    lines.push('has_any_work: false');
    return lines.join('\n') + '\n';
  }

  lines.push('=== WORK UNITS ===');
  for (const u of result.work_units) {
    lines.push('');
    lines.push(`${u.name} (${u.work_type}, active)`);
    const phaseOrder = ['research', 'discussion', 'investigation', 'specification', 'planning', 'implementation', 'review'];
    for (const p of phaseOrder) {
      const pd = u[p];
      if (!pd.status) continue;
      let extra = '';
      if (p === 'research' && pd.file_count != null) extra = `, ${pd.file_count} files`;
      if (p === 'specification' && pd.type) extra = `, type=${pd.type}`;
      if (p === 'planning' && pd.format) extra = `, format=${pd.format}`;
      if (p === 'implementation' && pd.completed_tasks != null) extra = `, ${pd.completed_tasks}/${pd.total_tasks} tasks`;
      lines.push(`  ${p}: ${pd.status}${extra}`);
    }
  }
  lines.push('');

  lines.push('=== COUNTS ===');
  const c = result.counts;
  lines.push(`by_type: ${c.by_work_type.epic} epic, ${c.by_work_type.feature} feature, ${c.by_work_type.bugfix} bugfix`);
  lines.push(`discussion: ${c.discussion.total} (${c.discussion.concluded} concluded, ${c.discussion.in_progress} in-progress)`);
  lines.push(`specification: ${c.specification.active} active (${c.specification.feature} feature, ${c.specification.crosscutting} cross-cutting)`);
  lines.push(`planning: ${c.planning.total} (${c.planning.concluded} concluded)`);
  lines.push(`implementation: ${c.implementation.total} (${c.implementation.completed} completed, ${c.implementation.in_progress} in-progress)`);
  lines.push('');

  lines.push('=== STATE ===');
  lines.push('has_any_work: true');

  return lines.join('\n') + '\n';
}

if (require.main === module) {
  process.stdout.write(format(discover(process.cwd())));
}

module.exports = { discover };

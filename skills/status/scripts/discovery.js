'use strict';

const path = require('path');
const { loadActiveManifests, phaseItems, phaseStatus, countFiles } = require('../../workflow-shared/scripts/discovery-utils');

function discover(cwd) {
  const manifests = loadActiveManifests(cwd);
  if (manifests.length === 0) {
    return {
      work_units: [],
      counts: {
        by_work_type: { epic: 0, feature: 0, bugfix: 0 },
        research: 0,
        discussion: { total: 0, completed: 0, in_progress: 0 },
        specification: { active: 0, feature: 0, crosscutting: 0 },
        planning: { total: 0, completed: 0, in_progress: 0 },
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
  let discTotal = 0, discCompleted = 0, discInProgress = 0;
  let specActive = 0, specFeature = 0, specCrosscutting = 0;
  let planTotal = 0, planCompleted = 0, planInProgress = 0;
  let implTotal = 0, implCompleted = 0, implInProgressCount = 0;

  for (const m of manifests) {
    const wt = m.work_type || 'feature';
    if (byType[wt] !== undefined) byType[wt]++;

    const baseDir = path.join(workflowsDir, m.name);

    // Research
    const researchStatus = phaseStatus(m, 'research');
    let fileCount = 0;
    if (researchStatus) {
      researchCount++;
      fileCount = countFiles(path.join(baseDir, 'research'), '.md');
    }

    // Helper: aggregate item statuses into a single representative status
    // all completed → 'completed', any in-progress → 'in-progress', otherwise first item's status
    function aggregateStatus(items) {
      if (items.length === 0) return null;
      const statuses = items.map(i => i.status).filter(Boolean);
      if (statuses.length === 0) return null;
      if (statuses.every(s => s === 'completed')) return 'completed';
      if (statuses.some(s => s === 'in-progress')) return 'in-progress';
      return statuses[0];
    }

    // Discussion
    let discStatus = null;
    let discItemCount = 0;
    const discItems = phaseItems(m, 'discussion');
    if (discItems.length > 0) {
      discItemCount = discItems.length;
      discStatus = aggregateStatus(discItems);
      discTotal += discItems.length;
      discCompleted += discItems.filter(i => i.status === 'completed').length;
      discInProgress += discItems.filter(i => i.status === 'in-progress').length;
    }

    // Investigation
    const invStatus = phaseStatus(m, 'investigation');

    // Specification
    let specStatus = null;
    let specType = 'feature';
    let sources = [];
    let specItemCount = 0;
    const specItems = phaseItems(m, 'specification');
    if (specItems.length > 0) {
      specItemCount = specItems.length;
      const activeItems = specItems.filter(i => i.status !== 'superseded');
      specStatus = aggregateStatus(activeItems);
      for (const item of activeItems) {
        specActive++;
        const itemType = item.type || 'feature';
        if (itemType === 'cross-cutting') specCrosscutting++;
        else specFeature++;
      }
      // For single-item (feature/bugfix), extract item-level details
      if (specItems.length === 1) {
        const si = specItems[0];
        specType = si.type || 'feature';
        if (si.sources && typeof si.sources === 'object' && !Array.isArray(si.sources)) {
          sources = Object.entries(si.sources).map(([name, data]) => ({
            name,
            status: (typeof data === 'object') ? (data.status || 'incorporated') : 'incorporated',
          }));
        } else if (Array.isArray(si.sources)) {
          sources = si.sources;
        }
      }
    }

    // Planning
    let planStatus = null;
    let planFormat = null;
    let externalDepsObj = {};
    let hasUnresolved = false;
    let planItemCount = 0;
    const planItems = phaseItems(m, 'planning');
    if (planItems.length > 0) {
      planItemCount = planItems.length;
      planStatus = aggregateStatus(planItems);
      planTotal += planItems.length;
      planCompleted += planItems.filter(i => i.status === 'completed').length;
      planInProgress += planItems.filter(i => i.status === 'in-progress').length;
      // Use format from first item that has one
      const withFmt = planItems.find(i => i.format);
      planFormat = withFmt ? withFmt.format : null;
      // Aggregate external deps across all items
      for (const item of planItems) {
        const deps = (item.external_dependencies && typeof item.external_dependencies === 'object' && !Array.isArray(item.external_dependencies))
          ? item.external_dependencies : {};
        Object.assign(externalDepsObj, deps);
      }
      hasUnresolved = Object.values(externalDepsObj).some(d => d.state === 'unresolved');
    }

    // Implementation
    let implStatus = null;
    let completedTasks = 0;
    let totalTasks = 0;
    let implCurrentPhase = null;
    let implItemCount = 0;
    const implItems = phaseItems(m, 'implementation');
    if (implItems.length > 0) {
      implItemCount = implItems.length;
      implStatus = aggregateStatus(implItems);
      implTotal += implItems.length;
      implCompleted += implItems.filter(i => i.status === 'completed').length;
      implInProgressCount += implItems.filter(i => i.status === 'in-progress').length;
      // Sum tasks across all items
      for (const item of implItems) {
        completedTasks += Array.isArray(item.completed_tasks) ? item.completed_tasks.length : 0;
      }
      // Sum task files across all topics
      for (const pi of planItems) {
        const fmt = pi.format || planFormat;
        if (fmt === 'local-markdown') {
          totalTasks += countFiles(path.join(baseDir, 'planning', pi.name, 'tasks'), '.md');
        }
      }
      // For single-item, extract current_phase
      if (implItems.length === 1) {
        const ii = implItems[0];
        if (ii.current_phase != null && ii.current_phase !== '~') implCurrentPhase = ii.current_phase;
      }
    }

    // Review
    let reviewStatus = null;
    const reviewItems = phaseItems(m, 'review');
    if (reviewItems.length > 0) {
      reviewStatus = aggregateStatus(reviewItems);
    }

    // For single-item spec, extract superseded_by
    const singleSpec = specItems.length === 1 ? specItems[0] : null;

    workUnits.push({
      name: m.name, work_type: wt,
      description: m.description || '',
      research: { status: researchStatus, ...(researchStatus && { file_count: fileCount }) },
      discussion: { status: discStatus, ...(discItemCount > 1 && { item_count: discItemCount }) },
      investigation: { status: invStatus },
      specification: {
        status: specStatus,
        ...(singleSpec && singleSpec.superseded_by && { superseded_by: singleSpec.superseded_by }),
        ...(specStatus && {
          type: specItemCount > 1 ? 'mixed' : specType,
          ...(specItemCount <= 1 && { sources }),
          ...(specItemCount > 1 && { item_count: specItemCount }),
        }),
      },
      planning: {
        status: planStatus,
        ...(planStatus && {
          format: planFormat,
          external_deps: Object.entries(externalDepsObj).map(([topic, d]) => ({
            topic, state: d.state,
            ...(d.task_id && { task_id: d.task_id }),
          })),
          has_unresolved_deps: hasUnresolved,
          ...(planItemCount > 1 && { item_count: planItemCount }),
        }),
      },
      implementation: {
        status: implStatus,
        ...(implStatus && {
          ...(implCurrentPhase != null && { current_phase: implCurrentPhase }),
          completed_tasks: completedTasks,
          total_tasks: totalTasks,
          ...(implItemCount > 1 && { item_count: implItemCount }),
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
      discussion: { total: discTotal, completed: discCompleted, in_progress: discInProgress },
      specification: { active: specActive, feature: specFeature, crosscutting: specCrosscutting },
      planning: { total: planTotal, completed: planCompleted, in_progress: planInProgress },
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
  lines.push(`discussion: ${c.discussion.total} (${c.discussion.completed} completed, ${c.discussion.in_progress} in-progress)`);
  lines.push(`specification: ${c.specification.active} active (${c.specification.feature} feature, ${c.specification.crosscutting} cross-cutting)`);
  lines.push(`planning: ${c.planning.total} (${c.planning.completed} completed)`);
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

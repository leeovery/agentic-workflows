'use strict';

const path = require('path');
const { loadActiveManifests, phaseData, phaseItems, countFiles } = require('../../workflow-shared/scripts/discovery-utils');

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

    // Research
    const research = phaseData(m, 'research');
    const researchStatus = research.status || null;
    let fileCount = 0;
    if (researchStatus) {
      researchCount++;
      fileCount = countFiles(path.join(baseDir, 'research'), '.md');
    }

    // Helper: aggregate item statuses into a single representative status
    // all concluded → 'concluded', any in-progress → 'in-progress', otherwise first item's status
    function aggregateStatus(items) {
      if (items.length === 0) return null;
      const statuses = items.map(i => i.status).filter(Boolean);
      if (statuses.length === 0) return null;
      if (statuses.every(s => s === 'concluded' || s === 'completed')) return statuses[0];
      if (statuses.some(s => s === 'in-progress')) return 'in-progress';
      return statuses[0];
    }

    // Discussion
    let discStatus = null;
    let discItemCount = 0;
    if (wt === 'epic') {
      const items = phaseItems(m, 'discussion');
      if (items.length > 0) {
        discItemCount = items.length;
        discStatus = aggregateStatus(items);
        discTotal += items.length;
        discConcluded += items.filter(i => i.status === 'concluded').length;
        discInProgress += items.filter(i => i.status === 'in-progress').length;
      }
    } else {
      const disc = phaseData(m, 'discussion');
      discStatus = disc.status || null;
      if (discStatus) {
        discTotal++;
        if (discStatus === 'concluded') discConcluded++;
        if (discStatus === 'in-progress') discInProgress++;
      }
    }

    // Investigation
    const inv = phaseData(m, 'investigation');
    const invStatus = inv.status || null;

    // Specification
    let specStatus = null;
    let specType = 'feature';
    let sources = [];
    let specItemCount = 0;
    if (wt === 'epic') {
      const items = phaseItems(m, 'specification');
      if (items.length > 0) {
        specItemCount = items.length;
        const activeItems = items.filter(i => i.status !== 'superseded');
        specStatus = aggregateStatus(activeItems);
        for (const item of activeItems) {
          specActive++;
          const itemType = item.type || 'feature';
          if (itemType === 'cross-cutting') specCrosscutting++;
          else specFeature++;
        }
      }
    } else {
      const spec = phaseData(m, 'specification');
      specStatus = spec.status || null;
      specType = spec.type || 'feature';
      if (specStatus && specStatus !== 'superseded') {
        specActive++;
        if (specType === 'cross-cutting') specCrosscutting++;
        else specFeature++;
      }
      if (spec.sources && typeof spec.sources === 'object' && !Array.isArray(spec.sources)) {
        sources = Object.entries(spec.sources).map(([name, data]) => ({
          name,
          status: (typeof data === 'object') ? (data.status || 'incorporated') : 'incorporated',
        }));
      } else if (Array.isArray(spec.sources)) {
        sources = spec.sources;
      }
      if (spec.superseded_by) specType = spec.type || 'feature'; // preserve for output
    }

    // Planning
    let planStatus = null;
    let planFormat = null;
    let externalDepsObj = {};
    let hasUnresolved = false;
    let planItemCount = 0;
    if (wt === 'epic') {
      const items = phaseItems(m, 'planning');
      if (items.length > 0) {
        planItemCount = items.length;
        planStatus = aggregateStatus(items);
        planTotal += items.length;
        planConcluded += items.filter(i => i.status === 'concluded').length;
        planInProgress += items.filter(i => i.status === 'in-progress').length;
        // Use format from first item that has one
        const withFmt = items.find(i => i.format);
        planFormat = withFmt ? withFmt.format : null;
        // Aggregate external deps across all items
        for (const item of items) {
          const deps = (item.external_dependencies && typeof item.external_dependencies === 'object' && !Array.isArray(item.external_dependencies))
            ? item.external_dependencies : {};
          Object.assign(externalDepsObj, deps);
        }
        hasUnresolved = Object.values(externalDepsObj).some(d => d.state === 'unresolved');
      }
    } else {
      const plan = phaseData(m, 'planning');
      planStatus = plan.status || null;
      planFormat = plan.format || null;
      if (planStatus) {
        planTotal++;
        if (planStatus === 'concluded') planConcluded++;
        if (planStatus === 'in-progress') planInProgress++;
      }
      externalDepsObj = (plan.external_dependencies && typeof plan.external_dependencies === 'object' && !Array.isArray(plan.external_dependencies))
        ? plan.external_dependencies : {};
      hasUnresolved = Object.values(externalDepsObj).some(d => d.state === 'unresolved');
    }

    // Implementation
    let implStatus = null;
    let completedTasks = 0;
    let totalTasks = 0;
    let implCurrentPhase = null;
    let implItemCount = 0;
    if (wt === 'epic') {
      const items = phaseItems(m, 'implementation');
      if (items.length > 0) {
        implItemCount = items.length;
        implStatus = aggregateStatus(items);
        implTotal += items.length;
        implCompleted += items.filter(i => i.status === 'completed').length;
        implInProgressCount += items.filter(i => i.status === 'in-progress').length;
        // Sum tasks across all items
        for (const item of items) {
          completedTasks += Array.isArray(item.completed_tasks) ? item.completed_tasks.length : 0;
        }
        // Sum task files across all topics
        const planItems = phaseItems(m, 'planning');
        for (const pi of planItems) {
          const fmt = pi.format || planFormat;
          if (fmt === 'local-markdown') {
            totalTasks += countFiles(path.join(baseDir, 'planning', pi.name, 'tasks'), '.md');
          }
        }
      }
    } else {
      const impl = phaseData(m, 'implementation');
      implStatus = impl.status || null;
      if (implStatus) {
        implTotal++;
        if (implStatus === 'completed') implCompleted++;
        if (implStatus === 'in-progress') implInProgressCount++;
      }
      completedTasks = Array.isArray(impl.completed_tasks) ? impl.completed_tasks.length : 0;
      const planFmt = planFormat || impl.format;
      if (planFmt === 'local-markdown') {
        totalTasks = countFiles(path.join(baseDir, 'planning', m.name, 'tasks'), '.md');
      }
      if (impl.current_phase != null && impl.current_phase !== '~') implCurrentPhase = impl.current_phase;
    }

    // Review
    let reviewStatus = null;
    if (wt === 'epic') {
      const items = phaseItems(m, 'review');
      if (items.length > 0) {
        reviewStatus = aggregateStatus(items);
      }
    } else {
      const review = phaseData(m, 'review');
      reviewStatus = review.status || null;
    }

    const specData = phaseData(m, 'specification');
    workUnits.push({
      name: m.name, work_type: wt,
      description: m.description || '',
      research: { status: researchStatus, ...(researchStatus && { file_count: fileCount }) },
      discussion: { status: discStatus, ...(wt === 'epic' && discItemCount > 0 && { item_count: discItemCount }) },
      investigation: { status: invStatus },
      specification: {
        status: specStatus,
        ...(specStatus && {
          type: wt === 'epic' ? 'mixed' : specType,
          ...(wt !== 'epic' && specData.superseded_by && { superseded_by: specData.superseded_by }),
          ...(wt !== 'epic' && { sources }),
          ...(wt === 'epic' && specItemCount > 0 && { item_count: specItemCount }),
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
          ...(wt === 'epic' && planItemCount > 0 && { item_count: planItemCount }),
        }),
      },
      implementation: {
        status: implStatus,
        ...(implStatus && {
          ...(implCurrentPhase != null && { current_phase: implCurrentPhase }),
          completed_tasks: completedTasks,
          total_tasks: totalTasks,
          ...(wt === 'epic' && implItemCount > 0 && { item_count: implItemCount }),
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

'use strict';

const fs = require('fs');
const path = require('path');
const { loadActiveManifests, phaseData, fileExists, listDirs, listFiles } = require('../../workflow-shared/scripts/discovery-utils');

function discover(cwd) {
  const manifests = loadActiveManifests(cwd);
  const workflowsDir = path.join(cwd, '.workflows');

  const plans = [];
  const reviews = [];
  let implementedCount = 0, completedCount = 0, reviewedPlanCount = 0;

  for (const m of manifests) {
    const planning = phaseData(m, 'planning');
    if (!planning.status) continue;

    const planFile = path.join(workflowsDir, m.name, 'planning', m.name, 'planning.md');
    if (!fileExists(planFile)) continue;

    const specFile = path.join(workflowsDir, m.name, 'specification', m.name, 'specification.md');
    const impl = phaseData(m, 'implementation');
    const implStatus = impl.status || 'none';

    // Count review versions
    const reviewDir = path.join(workflowsDir, m.name, 'review', m.name);
    let reviewCount = 0, latestVersion = 0, latestVerdict = '';

    for (const rname of listDirs(reviewDir)) {
      if (!rname.startsWith('r')) continue;
      const reviewFile = path.join(reviewDir, rname, 'review.md');
      if (!fileExists(reviewFile)) continue;
      const rnum = parseInt(rname.slice(1), 10);
      if (isNaN(rnum)) continue;
      reviewCount++;
      if (rnum > latestVersion) {
        latestVersion = rnum;
        try {
          const content = fs.readFileSync(reviewFile, 'utf8');
          const match = content.match(/\*\*QA Verdict\*\*:\s*(.+)/);
          latestVerdict = match ? match[1].trim() : '';
        } catch { latestVerdict = ''; }
      }
    }

    const plan = {
      name: m.name, work_type: m.work_type,
      planning_status: planning.status,
      format: planning.format || 'MISSING',
      specification_exists: fileExists(specFile),
      implementation_status: implStatus,
      review_count: reviewCount,
      ...(planning.plan_id && { plan_id: planning.plan_id }),
    };

    if (reviewCount > 0) {
      plan.latest_review_version = latestVersion;
      plan.latest_review_verdict = latestVerdict;
    }

    plans.push(plan);

    if (implStatus !== 'none') implementedCount++;
    if (implStatus === 'completed') completedCount++;

    // Reviews section
    if (reviewCount > 0) {
      const latestPath = path.join(reviewDir, `r${latestVersion}`) + '/';

      // Check for synthesis
      const implDir = path.join(workflowsDir, m.name, 'implementation', m.name);
      const hasSynthesis = listFiles(implDir, '.md').some(f => f.startsWith('review-tasks-c'));

      reviews.push({
        name: m.name, versions: reviewCount,
        latest_version: latestVersion,
        latest_verdict: latestVerdict,
        latest_path: latestPath,
        has_synthesis: hasSynthesis,
      });

      reviewedPlanCount++;
    }
  }

  const allReviewed = implementedCount > 0 && reviewedPlanCount >= implementedCount;

  let scenario;
  if (plans.length === 0) scenario = 'no_plans';
  else if (plans.length === 1) scenario = 'single_plan';
  else scenario = 'multiple_plans';

  return {
    plans: { exists: plans.length > 0, files: plans, count: plans.length },
    reviews: { exists: reviews.length > 0, entries: reviews },
    state: {
      has_plans: plans.length > 0, plan_count: plans.length,
      implemented_count: implementedCount, completed_count: completedCount,
      reviewed_plan_count: reviewedPlanCount, all_reviewed: allReviewed,
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
      let extra = '';
      if (p.review_count > 0) extra = `, reviews: ${p.review_count} (latest: r${p.latest_review_version}, ${p.latest_review_verdict})`;
      lines.push(`  ${p.name} (${p.work_type}): planning=${p.planning_status}, impl=${p.implementation_status}, format=${p.format}${extra}`);
    }
  }
  lines.push('');

  lines.push('=== REVIEWS ===');
  if (!result.reviews.exists) {
    lines.push('  (none)');
  } else {
    for (const r of result.reviews.entries) {
      lines.push(`  ${r.name}: ${r.versions} versions, latest=r${r.latest_version} (${r.latest_verdict}), synthesis=${r.has_synthesis}`);
    }
  }
  lines.push('');

  lines.push('=== STATE ===');
  lines.push(`scenario: ${result.state.scenario}`);
  lines.push(`implemented: ${result.state.implemented_count}, completed: ${result.state.completed_count}, reviewed: ${result.state.reviewed_plan_count}, all_reviewed: ${result.state.all_reviewed}`);

  return lines.join('\n') + '\n';
}

if (require.main === module) {
  process.stdout.write(format(discover(process.cwd())));
}

module.exports = { discover };

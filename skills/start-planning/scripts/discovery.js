'use strict';

const { loadActiveManifests, phaseData, phaseItems } = require('../../workflow-shared/scripts/discovery-utils');

function discover(cwd) {
  const manifests = loadActiveManifests(cwd);

  const featureSpecs = [];
  const crosscuttingSpecs = [];
  const plans = [];
  let featureReady = 0, featureWithPlan = 0, featureActionableWithPlan = 0, featureImplemented = 0;
  let planFormatSeen = null, planFormatUnanimous = true;

  for (const m of manifests) {
    // Build a list of spec entries: for epic, iterate items; for feature/bugfix, use flat phase data
    const specEntries = [];
    if (m.work_type === 'epic') {
      for (const item of phaseItems(m, 'specification')) {
        specEntries.push({ topic: item.name, ...item });
      }
    } else {
      const sp = phaseData(m, 'specification');
      if (sp.status) {
        specEntries.push({ topic: m.name, ...sp });
      }
    }

    for (const spec of specEntries) {
      if (spec.status === 'superseded') continue;

      const specType = spec.type || 'feature';

      if (specType === 'cross-cutting') {
        crosscuttingSpecs.push({ name: spec.topic, status: spec.status });
        continue;
      }

      // Look up corresponding plan and implementation for this topic
      let plan, impl;
      if (m.work_type === 'epic') {
        const planItems = phaseItems(m, 'planning');
        plan = planItems.find(i => i.name === spec.topic) || {};
        const implItems = phaseItems(m, 'implementation');
        impl = implItems.find(i => i.name === spec.topic) || {};
      } else {
        plan = phaseData(m, 'planning');
        impl = phaseData(m, 'implementation');
      }

      const hasPlan = !!plan.status;
      const hasImpl = !!impl.status;

      const entry = {
        name: spec.topic, status: spec.status, work_type: m.work_type,
        has_plan: hasPlan,
        ...(hasPlan && { plan_status: plan.status }),
        has_impl: hasImpl,
        ...(hasImpl && { impl_status: impl.status }),
      };
      featureSpecs.push(entry);

      if (spec.status === 'concluded' && !hasPlan) featureReady++;
      if (hasPlan) {
        featureWithPlan++;
        if (impl.status !== 'completed') featureActionableWithPlan++;

        plans.push({
          name: spec.topic, format: plan.format || 'MISSING',
          status: plan.status, work_type: m.work_type,
          ...(plan.plan_id && { plan_id: plan.plan_id }),
        });

        if (plan.format && plan.format !== 'MISSING') {
          if (!planFormatSeen) planFormatSeen = plan.format;
          else if (planFormatSeen !== plan.format) planFormatUnanimous = false;
        }
      }
      if (impl.status === 'completed') featureImplemented++;
    }
  }

  const hasAnySpec = featureSpecs.length > 0 || crosscuttingSpecs.length > 0;
  const commonFormat = (planFormatUnanimous && planFormatSeen) ? planFormatSeen : '';

  let scenario;
  if (!hasAnySpec) scenario = 'no_specs';
  else if (featureReady === 0 && featureActionableWithPlan === 0) scenario = 'nothing_actionable';
  else scenario = 'has_options';

  return {
    specifications: {
      exists: hasAnySpec,
      feature: featureSpecs,
      crosscutting: crosscuttingSpecs,
      counts: {
        feature: featureSpecs.length, feature_ready: featureReady,
        feature_with_plan: featureWithPlan, feature_actionable_with_plan: featureActionableWithPlan,
        feature_implemented: featureImplemented, crosscutting: crosscuttingSpecs.length,
      },
    },
    plans: {
      exists: plans.length > 0,
      files: plans,
      common_format: commonFormat,
    },
    state: { has_specifications: hasAnySpec, has_plans: plans.length > 0, scenario },
  };
}

function format(result) {
  const lines = [];

  lines.push('=== SPECIFICATIONS ===');
  if (!result.specifications.exists) {
    lines.push('  (none)');
  } else {
    if (result.specifications.feature.length > 0) {
      lines.push('  Feature:');
      for (const s of result.specifications.feature) {
        let extra = s.has_plan ? `, plan: ${s.plan_status}` : '';
        if (s.has_impl) extra += `, impl: ${s.impl_status}`;
        lines.push(`    ${s.name}: ${s.status} (${s.work_type})${extra}`);
      }
    }
    if (result.specifications.crosscutting.length > 0) {
      lines.push('  Cross-cutting:');
      for (const s of result.specifications.crosscutting) {
        lines.push(`    ${s.name}: ${s.status}`);
      }
    }
  }
  lines.push('');

  lines.push('=== PLANS ===');
  if (!result.plans.exists) {
    lines.push('  (none)');
  } else {
    for (const p of result.plans.files) {
      lines.push(`  ${p.name}: ${p.status}, format=${p.format}`);
    }
    if (result.plans.common_format) {
      lines.push(`  common_format: ${result.plans.common_format}`);
    }
  }
  lines.push('');

  lines.push('=== STATE ===');
  lines.push(`scenario: ${result.state.scenario}`);
  const c = result.specifications.counts;
  lines.push(`specs: ${c.feature} feature (${c.feature_ready} ready), ${c.crosscutting} cross-cutting`);

  return lines.join('\n') + '\n';
}

if (require.main === module) {
  process.stdout.write(format(discover(process.cwd())));
}

module.exports = { discover };

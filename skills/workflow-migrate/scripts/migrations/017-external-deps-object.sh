#!/usr/bin/env bash
#
# 017-external-deps-object.sh
#
# Converts external_dependencies from array format to object-keyed-by-topic.
# Old: [{ "topic": "x", "state": "unresolved" }]
# New: { "x": { "state": "unresolved" } }
#
# Empty arrays become empty objects.
# Already-object values are left unchanged.
#
# Idempotent: safe to run multiple times.
#
# This script is sourced by migrate.sh and has access to:
#   - report_update
#   - report_skip

if [ ! -d ".workflows" ]; then
    return 0 2>/dev/null || exit 0
fi

for manifest in .workflows/*/manifest.json; do
    [ -f "$manifest" ] || continue

    work_unit="$(basename "$(dirname "$manifest")")"

    # Skip dot-prefixed directories
    case "$work_unit" in
        .*) continue ;;
    esac

    # Use node to convert array → object in-place
    node -e "
        const fs = require('fs');
        const data = JSON.parse(fs.readFileSync('$manifest', 'utf8'));
        let changed = false;

        if (data.phases) {
            for (const [phase, pdata] of Object.entries(data.phases)) {
                // Feature/bugfix: flat structure with external_dependencies
                if (Array.isArray(pdata.external_dependencies)) {
                    const obj = {};
                    for (const dep of pdata.external_dependencies) {
                        const { topic, ...rest } = dep;
                        if (topic) obj[topic] = rest;
                    }
                    pdata.external_dependencies = obj;
                    changed = true;
                }

                // Epic: items structure
                if (pdata.items) {
                    for (const [item, idata] of Object.entries(pdata.items)) {
                        if (Array.isArray(idata.external_dependencies)) {
                            const obj = {};
                            for (const dep of idata.external_dependencies) {
                                const { topic, ...rest } = dep;
                                if (topic) obj[topic] = rest;
                            }
                            idata.external_dependencies = obj;
                            changed = true;
                        }
                    }
                }
            }
        }

        if (changed) {
            fs.writeFileSync('$manifest', JSON.stringify(data, null, 2) + '\n');
            process.stdout.write('changed');
        }
    " 2>/dev/null

    if [ $? -eq 0 ]; then
        # Check if node reported a change (it writes 'changed' to stdout)
        result=$(node -e "
            const fs = require('fs');
            const data = JSON.parse(fs.readFileSync('$manifest', 'utf8'));
            let hasArray = false;
            if (data.phases) {
                for (const [phase, pdata] of Object.entries(data.phases)) {
                    if (Array.isArray(pdata.external_dependencies)) hasArray = true;
                    if (pdata.items) {
                        for (const [item, idata] of Object.entries(pdata.items)) {
                            if (Array.isArray(idata.external_dependencies)) hasArray = true;
                        }
                    }
                }
            }
            process.stdout.write(hasArray ? 'has_array' : 'ok');
        " 2>/dev/null)

        if [ "$result" = "ok" ]; then
            report_skip
        fi
    fi
done

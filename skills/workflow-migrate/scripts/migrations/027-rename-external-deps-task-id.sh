#!/usr/bin/env bash
#
# 027-rename-external-deps-task-id.sh
#
# Renames task_id → internal_id in external_dependencies entries.
# Old: { "state": "resolved", "task_id": "auth-1-3" }
# New: { "state": "resolved", "internal_id": "auth-1-3" }
#
# Entries that already have internal_id are left unchanged.
# Entries without task_id are left unchanged.
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

    result=$(node -e "
        const fs = require('fs');
        const data = JSON.parse(fs.readFileSync('$manifest', 'utf8'));
        let changed = false;

        if (data.phases) {
            for (const [phase, pdata] of Object.entries(data.phases)) {
                if (pdata.items) {
                    for (const [item, idata] of Object.entries(pdata.items)) {
                        if (idata.external_dependencies && typeof idata.external_dependencies === 'object' && !Array.isArray(idata.external_dependencies)) {
                            for (const [dep, ddata] of Object.entries(idata.external_dependencies)) {
                                if (ddata.task_id !== undefined && ddata.internal_id === undefined) {
                                    ddata.internal_id = ddata.task_id;
                                    delete ddata.task_id;
                                    changed = true;
                                }
                            }
                        }
                    }
                }
            }
        }

        if (changed) {
            fs.writeFileSync('$manifest', JSON.stringify(data, null, 2) + '\n');
            process.stdout.write('updated');
        } else {
            process.stdout.write('skip');
        }
    " 2>/dev/null)

    if [ "$result" = "updated" ]; then
        report_update
    else
        report_skip
    fi
done

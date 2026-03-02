#!/usr/bin/env bash
#
# 016-work-unit-restructure.sh
#
# Migrates from phase-first directory structure to work-unit-first.
# Moves artifacts from .workflows/{phase}/{topic}/ to .workflows/{topic}/{phase}/
# Creates manifest.json for each work unit via node.
# Renames greenfield → epic, plan.md → planning.md, tracking.md → implementation.md.
#
# Compatible with bash 3.2+ (no associative arrays).
#
# This script is sourced by migrate.sh and has access to:
#   - report_update "filepath" "description"
#   - report_skip "filepath"
#

# Skip if no .workflows directory
if [ ! -d ".workflows" ]; then
    return 0
fi

# Skip if any work unit manifest already exists (already migrated)
_found_manifest=""
for _d in .workflows/*/; do
    [ -d "$_d" ] || continue
    _dname=$(basename "$_d")
    case "$_dname" in
        .*|discussion|investigation|specification|planning|implementation|review|research) continue ;;
    esac
    if [ -f "$_d/manifest.json" ]; then
        _found_manifest=1
        break
    fi
done

# Check if there are any phase-first directories to migrate
_has_phase_dirs=""
for _phase in discussion investigation specification planning implementation review research; do
    if [ -d ".workflows/$_phase" ]; then
        _has_phase_dirs=1
        break
    fi
done

if [ -z "$_has_phase_dirs" ]; then
    return 0
fi

# If manifests already exist and no phase dirs remain, nothing to do
if [ -n "$_found_manifest" ] && [ -z "$_has_phase_dirs" ]; then
    return 0
fi

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_016_extract_frontmatter() {
    awk 'BEGIN{c=0} /^---$/{c++; if(c==2) exit; next} c==1{print}' "$1"
}

_016_extract_field() {
    local frontmatter="$1"
    local field="$2"
    local match
    match=$(echo "$frontmatter" | grep "^${field}:" | head -1) || true
    if [ -n "$match" ]; then
        echo "$match" | sed "s/^${field}: *//" | sed 's/^ *//;s/ *$//'
    fi
}

_016_normalize_work_type() {
    local wt="$1"
    case "$wt" in
        greenfield) echo "epic" ;;
        feature|bugfix|epic) echo "$wt" ;;
        *) echo "" ;;
    esac
}

# Use temp files for tracking instead of associative arrays
_016_TMPDIR=$(mktemp -d)

# Register a work unit: _016_register <name> <work_type>
_016_register() {
    local name="$1" wtype="$2"
    # Only register if not already registered
    if [ ! -f "$_016_TMPDIR/wu_$name" ]; then
        echo "$wtype" > "$_016_TMPDIR/wu_$name"
        echo "$name" >> "$_016_TMPDIR/wu_list"
    fi
}

# Get work type for a registered work unit
_016_get_wt() {
    local name="$1"
    if [ -f "$_016_TMPDIR/wu_$name" ]; then
        cat "$_016_TMPDIR/wu_$name"
    fi
}

# Store a path mapping: _016_store <category> <name> <path>
_016_store() {
    echo "$3" > "$_016_TMPDIR/${1}_${2}"
}

# Get a stored path: _016_fetch <category> <name>
_016_fetch() {
    if [ -f "$_016_TMPDIR/${1}_${2}" ]; then
        cat "$_016_TMPDIR/${1}_${2}"
    fi
}

# Append to a list: _016_append <list-name> <value>
_016_append() {
    echo "$2" >> "$_016_TMPDIR/list_$1"
}

# Read a list: _016_read_list <list-name>
_016_read_list() {
    if [ -f "$_016_TMPDIR/list_$1" ]; then
        cat "$_016_TMPDIR/list_$1"
    fi
}

V1_EPIC_NEEDED=false

# ---------------------------------------------------------------------------
# Phase 1: Scan and classify work units
# ---------------------------------------------------------------------------

# Scan discussions
if [ -d ".workflows/discussion" ]; then
    for file in ".workflows/discussion"/*.md; do
        [ -f "$file" ] || continue
        topic=$(basename "$file" .md)
        fm=$(_016_extract_frontmatter "$file")
        raw_wt=$(_016_extract_field "$fm" "work_type")
        wt=$(_016_normalize_work_type "$raw_wt")

        if [ "$wt" = "feature" ] || [ "$wt" = "bugfix" ]; then
            _016_register "$topic" "$wt"
            _016_store "disc" "$topic" "$file"
        else
            V1_EPIC_NEEDED=true
            _016_append "epic_discussions" "$file"
        fi
    done
fi

# Scan investigations (always bugfix)
if [ -d ".workflows/investigation" ]; then
    for dir in ".workflows/investigation"/*/; do
        [ -d "$dir" ] || continue
        topic=$(basename "$dir")
        if [ -f "${dir}investigation.md" ]; then
            if [ -z "$(_016_get_wt "$topic")" ]; then
                _016_register "$topic" "bugfix"
            fi
            _016_store "inv" "$topic" "$dir"
        fi
    done
fi

# Scan specifications
if [ -d ".workflows/specification" ]; then
    for dir in ".workflows/specification"/*/; do
        [ -d "$dir" ] || continue
        topic=$(basename "$dir")
        if [ -f "${dir}specification.md" ]; then
            fm=$(_016_extract_frontmatter "${dir}specification.md")
            raw_wt=$(_016_extract_field "$fm" "work_type")
            wt=$(_016_normalize_work_type "$raw_wt")

            if [ "$wt" = "feature" ] || [ "$wt" = "bugfix" ]; then
                if [ -z "$(_016_get_wt "$topic")" ]; then
                    _016_register "$topic" "$wt"
                fi
            else
                V1_EPIC_NEEDED=true
            fi
            _016_store "spec" "$topic" "$dir"
        fi
    done
fi

# Scan planning
if [ -d ".workflows/planning" ]; then
    for dir in ".workflows/planning"/*/; do
        [ -d "$dir" ] || continue
        topic=$(basename "$dir")
        if [ -f "${dir}plan.md" ]; then
            fm=$(_016_extract_frontmatter "${dir}plan.md")
            raw_wt=$(_016_extract_field "$fm" "work_type")
            wt=$(_016_normalize_work_type "$raw_wt")

            if [ "$wt" = "feature" ] || [ "$wt" = "bugfix" ]; then
                if [ -z "$(_016_get_wt "$topic")" ]; then
                    _016_register "$topic" "$wt"
                fi
            else
                V1_EPIC_NEEDED=true
            fi
            _016_store "plan" "$topic" "$dir"
        fi
    done
fi

# Scan implementation
if [ -d ".workflows/implementation" ]; then
    for dir in ".workflows/implementation"/*/; do
        [ -d "$dir" ] || continue
        topic=$(basename "$dir")
        if [ -f "${dir}tracking.md" ]; then
            fm=$(_016_extract_frontmatter "${dir}tracking.md")
            raw_wt=$(_016_extract_field "$fm" "work_type")
            wt=$(_016_normalize_work_type "$raw_wt")

            if [ "$wt" = "feature" ] || [ "$wt" = "bugfix" ]; then
                if [ -z "$(_016_get_wt "$topic")" ]; then
                    _016_register "$topic" "$wt"
                fi
            else
                V1_EPIC_NEEDED=true
            fi
            _016_store "impl" "$topic" "$dir"
        fi
    done
fi

# Scan review
if [ -d ".workflows/review" ]; then
    for dir in ".workflows/review"/*/; do
        [ -d "$dir" ] || continue
        topic=$(basename "$dir")
        _016_store "review" "$topic" "$dir"
    done
fi

# Scan research
if [ -d ".workflows/research" ]; then
    for file in ".workflows/research"/*.md; do
        [ -f "$file" ] || continue
        fm=$(_016_extract_frontmatter "$file")
        raw_wt=$(_016_extract_field "$fm" "work_type")
        wt=$(_016_normalize_work_type "$raw_wt")

        if [ "$wt" = "feature" ] || [ "$wt" = "bugfix" ]; then
            topic=$(basename "$file" .md)
            if [ -z "$(_016_get_wt "$topic")" ]; then
                _016_register "$topic" "$wt"
            fi
        else
            V1_EPIC_NEEDED=true
            _016_append "epic_research" "$file"
        fi
    done
fi

# Add "v1" epic if needed
if [ "$V1_EPIC_NEEDED" = true ]; then
    _016_register "v1" "epic"
fi

# Exit early if nothing to migrate
if [ ! -f "$_016_TMPDIR/wu_list" ]; then
    rm -rf "$_016_TMPDIR"
    return 0
fi

# ---------------------------------------------------------------------------
# Phase 2 & 3: Move files and build manifests
# ---------------------------------------------------------------------------

while IFS= read -r name; do
    wt=$(_016_get_wt "$name")

    # Skip if already migrated (idempotency)
    if [ -f ".workflows/$name/manifest.json" ]; then
        report_skip ".workflows/$name/manifest.json"
        continue
    fi

    mkdir -p ".workflows/$name"

    # Move discussion
    if [ "$name" = "v1" ]; then
        epic_discs=$(_016_read_list "epic_discussions")
        if [ -n "$epic_discs" ]; then
            mkdir -p ".workflows/$name/discussion"
            echo "$epic_discs" | while IFS= read -r dfile; do
                if [ -f "$dfile" ]; then
                    mv "$dfile" ".workflows/$name/discussion/"
                    report_update "$dfile" "moved to .workflows/$name/discussion/"
                fi
            done
        fi
    else
        disc_file=$(_016_fetch "disc" "$name")
        if [ -n "$disc_file" ] && [ -f "$disc_file" ]; then
            mkdir -p ".workflows/$name/discussion"
            mv "$disc_file" ".workflows/$name/discussion/${name}.md"
            report_update "$disc_file" "moved to .workflows/$name/discussion/${name}.md"
        fi
    fi

    # Move investigation (flat file: investigation.md → {name}.md)
    inv_dir=$(_016_fetch "inv" "$name")
    if [ -n "$inv_dir" ] && [ -d "$inv_dir" ]; then
        mkdir -p ".workflows/$name/investigation"
        if [ -f "${inv_dir}investigation.md" ]; then
            mv "${inv_dir}investigation.md" ".workflows/$name/investigation/${name}.md"
            report_update "${inv_dir}investigation.md" "moved to .workflows/$name/investigation/${name}.md"
        fi
        # Move any remaining files
        for ifile in "$inv_dir"*; do
            [ -e "$ifile" ] || continue
            bname=$(basename "$ifile")
            if [ ! -e ".workflows/$name/investigation/$bname" ]; then
                mv "$ifile" ".workflows/$name/investigation/"
            fi
        done
    fi

    # Move specification (topic subdir: specification/{name}/)
    spec_dir=$(_016_fetch "spec" "$name")
    if [ -n "$spec_dir" ] && [ -d "$spec_dir" ]; then
        mkdir -p ".workflows/$name/specification/$name"
        for sfile in "$spec_dir"*; do
            [ -e "$sfile" ] || continue
            mv "$sfile" ".workflows/$name/specification/$name/"
        done
        report_update "$spec_dir" "moved to .workflows/$name/specification/$name/"
    fi

    # Move planning (plan.md → planning.md, topic subdir: planning/{name}/)
    plan_dir=$(_016_fetch "plan" "$name")
    if [ -n "$plan_dir" ] && [ -d "$plan_dir" ]; then
        mkdir -p ".workflows/$name/planning/$name"
        if [ -f "${plan_dir}plan.md" ]; then
            mv "${plan_dir}plan.md" ".workflows/$name/planning/$name/planning.md"
            report_update "${plan_dir}plan.md" "moved and renamed to planning/$name/planning.md"
        fi
        if [ -d "${plan_dir}tasks" ]; then
            mv "${plan_dir}tasks" ".workflows/$name/planning/$name/tasks"
            report_update "${plan_dir}tasks/" "moved to .workflows/$name/planning/$name/tasks/"
        fi
        # Move remaining files
        for pfile in "$plan_dir"*; do
            [ -e "$pfile" ] || continue
            bname=$(basename "$pfile")
            if [ ! -e ".workflows/$name/planning/$name/$bname" ]; then
                mv "$pfile" ".workflows/$name/planning/$name/"
            fi
        done
    fi

    # Move implementation (tracking.md → implementation.md, topic subdir: implementation/{name}/)
    impl_dir=$(_016_fetch "impl" "$name")
    if [ -n "$impl_dir" ] && [ -d "$impl_dir" ]; then
        mkdir -p ".workflows/$name/implementation/$name"
        if [ -f "${impl_dir}tracking.md" ]; then
            mv "${impl_dir}tracking.md" ".workflows/$name/implementation/$name/implementation.md"
            report_update "${impl_dir}tracking.md" "moved and renamed to implementation/$name/implementation.md"
        fi
        for imfile in "$impl_dir"*; do
            [ -e "$imfile" ] || continue
            bname=$(basename "$imfile")
            if [ ! -e ".workflows/$name/implementation/$name/$bname" ]; then
                mv "$imfile" ".workflows/$name/implementation/$name/"
            fi
        done
    fi

    # Move review (topic subdir: review/{name}/)
    review_dir=$(_016_fetch "review" "$name")
    if [ -n "$review_dir" ] && [ -d "$review_dir" ]; then
        mkdir -p ".workflows/$name/review/$name"
        for ritem in "$review_dir"*; do
            [ -e "$ritem" ] || continue
            mv "$ritem" ".workflows/$name/review/$name/"
        done
        report_update "$review_dir" "moved to .workflows/$name/review/$name/"
    fi

    # Move research (for v1 epic)
    if [ "$name" = "v1" ]; then
        epic_research=$(_016_read_list "epic_research")
        if [ -n "$epic_research" ]; then
            mkdir -p ".workflows/$name/research"
            echo "$epic_research" | while IFS= read -r rfile; do
                if [ -f "$rfile" ]; then
                    mv "$rfile" ".workflows/$name/research/"
                    report_update "$rfile" "moved to .workflows/$name/research/"
                fi
            done
        fi
    fi

    # Move research analysis to per-work-unit state dir
    if [ -f ".workflows/.state/research-analysis.md" ] && [ "$name" = "v1" ]; then
        mkdir -p ".workflows/$name/.state"
        mv ".workflows/.state/research-analysis.md" ".workflows/$name/.state/research-analysis.md"
        report_update ".workflows/.state/research-analysis.md" "moved to .workflows/$name/.state/"
    fi

    # ------------------------------------------------------------------
    # Build manifest.json via node
    # ------------------------------------------------------------------

    # Collect all phase data and write manifest in a single node call
    node -e "
        var fs = require('fs');
        var path = require('path');

        var name = '$name';
        var workType = '$wt';
        var workDir = '.workflows/' + name;

        // Helper to extract frontmatter from a file
        function extractFrontmatter(filePath) {
            if (!fs.existsSync(filePath)) return {};
            var lines = fs.readFileSync(filePath, 'utf8').split('\n');
            var inFm = false, fmLines = [];
            for (var i = 0; i < lines.length; i++) {
                if (lines[i] === '---') {
                    if (inFm) break;
                    inFm = true;
                    continue;
                }
                if (inFm) fmLines.push(lines[i]);
            }
            var result = {};
            fmLines.forEach(function(line) {
                var m = line.match(/^(\w[\w_]*)\s*:\s*(.*)$/);
                if (m) result[m[1]] = m[2].trim();
            });
            return result;
        }

        var manifest = {
            name: name,
            work_type: workType,
            status: 'active',
            created: new Date().toISOString().slice(0, 10),
            description: name + ' work unit',
            phases: {}
        };

        // Discussion (feature/bugfix — single file: {name}.md)
        var discFile = path.join(workDir, 'discussion', name + '.md');
        if (fs.existsSync(discFile)) {
            var fm = extractFrontmatter(discFile);
            manifest.phases.discussion = { status: fm.status || 'in-progress' };
            if (fm.research_source) manifest.phases.discussion.research_source = fm.research_source;
            if (fm.date) manifest.created = fm.date;
        }

        // Discussion (epic — multiple files, items structure)
        if (name === 'v1') {
            var discDir = path.join(workDir, 'discussion');
            if (fs.existsSync(discDir)) {
                var files = fs.readdirSync(discDir).filter(function(f) { return f.endsWith('.md'); });
                if (files.length > 0) {
                    var items = {};
                    files.forEach(function(f) {
                        var topic = f.replace(/\.md$/, '');
                        var fm = extractFrontmatter(path.join(discDir, f));
                        items[topic] = { status: fm.status || 'in-progress' };
                    });
                    manifest.phases.discussion = { items: items };
                }
            }
        }

        // Investigation (flat file: {name}.md)
        var invFile = path.join(workDir, 'investigation', name + '.md');
        if (fs.existsSync(invFile)) {
            var fm = extractFrontmatter(invFile);
            manifest.phases.investigation = { status: fm.status || 'in-progress' };
            if (fm.date && !manifest.created) manifest.created = fm.date;
        }

        // Specification (topic subdir: specification/{name}/)
        var specFile = path.join(workDir, 'specification', name, 'specification.md');
        if (fs.existsSync(specFile)) {
            var fm = extractFrontmatter(specFile);
            var spec = { status: fm.status || 'in-progress' };
            if (fm.type) spec.type = fm.type;
            if (fm.review_cycle) spec.review_cycle = parseInt(fm.review_cycle, 10) || 0;
            if (fm.finding_gate_mode) spec.finding_gate_mode = fm.finding_gate_mode;
            manifest.phases.specification = spec;
        }

        // Planning (topic subdir: planning/{name}/)
        var planFile = path.join(workDir, 'planning', name, 'planning.md');
        if (fs.existsSync(planFile)) {
            var fm = extractFrontmatter(planFile);
            var plan = { status: fm.status || 'in-progress' };
            if (fm.format) plan.format = fm.format;
            if (fm.ext_id) plan.ext_id = fm.ext_id;
            if (fm.specification) plan.specification = fm.specification;
            if (fm.spec_commit) plan.spec_commit = fm.spec_commit;
            if (fm.task_gate_mode) plan.task_gate_mode = fm.task_gate_mode;
            if (fm.finding_gate_mode) plan.finding_gate_mode = fm.finding_gate_mode;
            if (fm.author_gate_mode) plan.author_gate_mode = fm.author_gate_mode;
            manifest.phases.planning = plan;
        }

        // Implementation (topic subdir: implementation/{name}/)
        var implFile = path.join(workDir, 'implementation', name, 'implementation.md');
        if (fs.existsSync(implFile)) {
            var fm = extractFrontmatter(implFile);
            var impl = { status: fm.status || 'in-progress' };
            if (fm.format) impl.format = fm.format;
            if (fm.task_gate_mode) impl.task_gate_mode = fm.task_gate_mode;
            if (fm.fix_gate_mode) impl.fix_gate_mode = fm.fix_gate_mode;
            if (fm.analysis_gate_mode) impl.analysis_gate_mode = fm.analysis_gate_mode;
            if (fm.fix_attempts) impl.fix_attempts = parseInt(fm.fix_attempts, 10) || 0;
            if (fm.analysis_cycle) impl.analysis_cycle = parseInt(fm.analysis_cycle, 10) || 0;
            if (fm.current_phase) impl.current_phase = fm.current_phase;
            if (fm.current_task) impl.current_task = fm.current_task;
            manifest.phases.implementation = impl;
        }

        // Research (v1 epic)
        var resDir = path.join(workDir, 'research');
        if (fs.existsSync(resDir) && fs.readdirSync(resDir).some(function(f) { return f.endsWith('.md'); })) {
            manifest.phases.research = { status: 'in-progress' };
        }

        fs.writeFileSync(
            path.join(workDir, 'manifest.json'),
            JSON.stringify(manifest, null, 2) + '\n'
        );
    "
    report_update ".workflows/$name/manifest.json" "created manifest for $wt work unit"

done < "$_016_TMPDIR/wu_list"

# ---------------------------------------------------------------------------
# Clean up empty phase directories
# ---------------------------------------------------------------------------

for phase_dir in discussion investigation specification planning implementation review research; do
    if [ -d ".workflows/$phase_dir" ]; then
        remaining=$(find ".workflows/$phase_dir" -type f 2>/dev/null | head -1)
        if [ -z "$remaining" ]; then
            rm -rf ".workflows/$phase_dir"
            report_update ".workflows/$phase_dir" "removed empty phase directory"
        fi
    fi
done

# Clean up temp files
rm -rf "$_016_TMPDIR"

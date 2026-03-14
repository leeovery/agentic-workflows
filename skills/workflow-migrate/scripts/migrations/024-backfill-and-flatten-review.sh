#!/bin/bash
#
# Migration 024: Backfill tracking arrays + normalise task IDs + flatten review dirs
#
#   1. Backfill completed_tasks / completed_phases from implementation.md
#      frontmatter into manifest.json (migration 016 missed these).
#   2. Normalise external IDs (e.g. tick IDs) to internal IDs using the
#      plan index table's ID ↔ Ext ID mapping.
#   3. Flatten review/{topic}/r{N}/ directories — move contents of the
#      highest r{N}/ up to review/{topic}/, remove all r{N}/ subdirs.
#   4. Rename ext_id → external_id in manifests and plan index files.
#   5. Rename ID → Internal ID in plan index task table headers.
#
# Idempotent. Direct node for JSON — never uses manifest CLI.
#

WORKFLOWS_DIR="${PROJECT_DIR:-.}/.workflows"

[ -d "$WORKFLOWS_DIR" ] || return 0

# ---------------------------------------------------------------------------
# Step 1 & 2: Backfill and normalise completed_tasks / completed_phases
# ---------------------------------------------------------------------------

for manifest in "$WORKFLOWS_DIR"/*/manifest.json; do
  [ -f "$manifest" ] || continue

  dir=$(dirname "$manifest")
  wu_name=$(basename "$dir")

  # Skip dot-prefixed directories
  case "$wu_name" in .*) continue ;; esac

  impl_base="$dir/implementation"
  [ -d "$impl_base" ] || continue

  for topic_dir in "$impl_base"/*/; do
    [ -d "$topic_dir" ] || continue
    topic=$(basename "$topic_dir")
    impl_file="$topic_dir/implementation.md"
    plan_file="$dir/planning/$topic/planning.md"

    # --- Extract completed_tasks from frontmatter (multi-line YAML) ---
    tasks_from_fm=""
    if [ -f "$impl_file" ]; then
      tasks_from_fm=$(awk '
        BEGIN { c=0; in_field=0 }
        /^---$/ { c++; if (c==2) exit; next }
        c==1 {
          if (/^completed_tasks:/) {
            val = $0; sub(/^completed_tasks: */, "", val)
            if (val ~ /^\[/) {
              # inline format: [a, b, c]
              gsub(/[\[\]]/, "", val)
              n = split(val, items, ",")
              for (i=1; i<=n; i++) {
                gsub(/^ +| +$/, "", items[i])
                gsub(/^["'"'"']|["'"'"']$/, "", items[i])
                if (items[i] != "") print items[i]
              }
              next
            }
            in_field=1; next
          }
          if (in_field) {
            if (/^  *- /) {
              val = $0; sub(/^ *- */, "", val)
              gsub(/^["'"'"']|["'"'"']$/, "", val)
              if (val != "") print val
            } else {
              in_field=0
            }
          }
        }
      ' "$impl_file")
    fi

    # --- Extract completed_phases from frontmatter ---
    phases_from_fm=""
    if [ -f "$impl_file" ]; then
      phases_from_fm=$(awk '
        BEGIN { c=0; in_field=0 }
        /^---$/ { c++; if (c==2) exit; next }
        c==1 {
          if (/^completed_phases:/) {
            val = $0; sub(/^completed_phases: */, "", val)
            if (val ~ /^\[/) {
              gsub(/[\[\]]/, "", val)
              n = split(val, items, ",")
              for (i=1; i<=n; i++) {
                gsub(/^ +| +$/, "", items[i])
                if (items[i] != "") print items[i]
              }
              next
            }
            in_field=1; next
          }
          if (in_field) {
            if (/^  *- /) {
              val = $0; sub(/^ *- */, "", val)
              if (val != "") print val
            } else {
              in_field=0
            }
          }
        }
      ' "$impl_file")
    fi

    # --- Build ext_id → internal_id map from plan index table ---
    ext_map=""
    if [ -f "$plan_file" ]; then
      ext_map=$(awk -F'|' '
        /^\|/ && NF >= 6 {
          id = $2; ext = $6
          gsub(/^[ \t]+|[ \t]+$/, "", id)
          gsub(/^[ \t]+|[ \t]+$/, "", ext)
          # Skip header rows and empty/placeholder values
          if (id != "" && id != "ID" && id != "Internal ID" && id !~ /^-+$/ && \
              ext != "" && ext != "Ext ID" && ext != "External ID" && ext != "-" && ext !~ /^-+$/) {
            print ext "=" id
          }
        }
      ' "$plan_file")
    fi

    # --- Apply backfill and normalisation via node ---
    result=$(node -e "
      const fs = require('fs');
      const m = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
      const topic = process.argv[2];
      const tasksRaw = process.argv[3];
      const phasesRaw = process.argv[4];
      const mapRaw = process.argv[5];

      const tasksFromFm = tasksRaw ? tasksRaw.split('\n').filter(Boolean) : [];
      const phasesFromFm = phasesRaw ? phasesRaw.split('\n').filter(Boolean) : [];
      const extMap = {};
      (mapRaw || '').split('\n').filter(Boolean).forEach(function(line) {
        var idx = line.indexOf('=');
        if (idx > 0) extMap[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
      });

      if (!m.phases) process.exit(0);

      // Resolve implementation entry (epic vs feature/bugfix)
      var impl;
      if (m.work_type === 'epic') {
        impl = m.phases.implementation &&
               m.phases.implementation.items &&
               m.phases.implementation.items[topic];
      } else {
        impl = m.phases.implementation;
      }
      if (!impl) process.exit(0);

      var changed = false;

      // Backfill completed_tasks if missing
      if ((!impl.completed_tasks || impl.completed_tasks.length === 0) && tasksFromFm.length > 0) {
        impl.completed_tasks = tasksFromFm;
        changed = true;
      }

      // Backfill completed_phases if missing
      if ((!impl.completed_phases || impl.completed_phases.length === 0) && phasesFromFm.length > 0) {
        impl.completed_phases = phasesFromFm.map(function(p) {
          return isNaN(p) ? p : Number(p);
        });
        changed = true;
      }

      // Normalise external IDs to internal IDs
      if (impl.completed_tasks && impl.completed_tasks.length > 0 && Object.keys(extMap).length > 0) {
        var normalised = impl.completed_tasks.map(function(id) { return extMap[id] || id; });
        if (JSON.stringify(normalised) !== JSON.stringify(impl.completed_tasks)) {
          impl.completed_tasks = normalised;
          changed = true;
        }
      }

      if (changed) {
        fs.writeFileSync(process.argv[1], JSON.stringify(m, null, 2) + '\n');
        console.log('updated');
      }
    " "$manifest" "$topic" "$tasks_from_fm" "$phases_from_fm" "$ext_map" 2>/dev/null) || true

    if [ "$result" = "updated" ]; then
      report_update "$manifest" "backfilled/normalised tracking for $topic"
    fi
  done
done

# ---------------------------------------------------------------------------
# Step 3: Flatten review directories (remove r{N}/ nesting)
# ---------------------------------------------------------------------------

for manifest in "$WORKFLOWS_DIR"/*/manifest.json; do
  [ -f "$manifest" ] || continue

  dir=$(dirname "$manifest")
  wu_name=$(basename "$dir")
  case "$wu_name" in .*) continue ;; esac

  review_base="$dir/review"
  [ -d "$review_base" ] || continue

  for topic_dir in "$review_base"/*/; do
    [ -d "$topic_dir" ] || continue
    topic=$(basename "$topic_dir")

    # Check for r{N} directories
    highest_rn=""
    highest_num=0
    for rn_dir in "$topic_dir"r[0-9]*/; do
      [ -d "$rn_dir" ] || continue
      rn_name=$(basename "$rn_dir")
      rn_num=${rn_name#r}
      if [ "$rn_num" -gt "$highest_num" ] 2>/dev/null; then
        highest_num=$rn_num
        highest_rn="$rn_dir"
      fi
    done

    # Skip if no r{N} directories (already flat or empty)
    [ -n "$highest_rn" ] || continue

    # Move contents of highest r{N}/ up to topic dir
    for item in "$highest_rn"*; do
      [ -e "$item" ] || continue
      mv "$item" "$topic_dir"
    done

    # Remove ALL r{N}/ directories (including lower versions)
    for rn_dir in "$topic_dir"r[0-9]*/; do
      [ -d "$rn_dir" ] || continue
      rm -rf "$rn_dir"
    done

    report_update "$topic_dir" "flattened review (kept r$highest_num)"
  done
done

# ---------------------------------------------------------------------------
# Step 4: Rename ext_id → external_id in manifests and plan index files
# ---------------------------------------------------------------------------

for manifest in "$WORKFLOWS_DIR"/*/manifest.json; do
  [ -f "$manifest" ] || continue

  dir=$(dirname "$manifest")
  wu_name=$(basename "$dir")
  case "$wu_name" in .*) continue ;; esac

  # Rename ext_id in manifest JSON (all occurrences at any depth)
  result=$(node -e "
    var fs = require('fs');
    var src = fs.readFileSync(process.argv[1], 'utf8');
    var replaced = src.replace(/\"ext_id\"/g, '\"external_id\"');
    if (replaced === src) process.exit(0);
    fs.writeFileSync(process.argv[1], replaced);
    console.log('updated');
  " "$manifest" 2>/dev/null) || true

  if [ "$result" = "updated" ]; then
    report_update "$manifest" "renamed ext_id to external_id"
  fi

  # Rename Ext ID → External ID in plan index files (planning.md)
  plan_base="$dir/planning"
  [ -d "$plan_base" ] || continue

  for plan_file in "$plan_base"/*/planning.md; do
    [ -f "$plan_file" ] || continue

    if grep -q 'Ext ID' "$plan_file" 2>/dev/null; then
      awk '{gsub(/Ext ID/, "External ID"); print}' "$plan_file" > "$plan_file.tmp" && mv "$plan_file.tmp" "$plan_file"
      # Also rename ext_id: field in phase entries
      awk '{sub(/^ext_id:/, "external_id:"); print}' "$plan_file" > "$plan_file.tmp" && mv "$plan_file.tmp" "$plan_file"
      report_update "$plan_file" "renamed Ext ID to External ID"
    fi
  done
done

# ---------------------------------------------------------------------------
# Step 5: Rename ID → Internal ID in plan index task table headers
# ---------------------------------------------------------------------------

for manifest in "$WORKFLOWS_DIR"/*/manifest.json; do
  [ -f "$manifest" ] || continue

  dir=$(dirname "$manifest")
  wu_name=$(basename "$dir")
  case "$wu_name" in .*) continue ;; esac

  plan_base="$dir/planning"
  [ -d "$plan_base" ] || continue

  for plan_file in "$plan_base"/*/planning.md; do
    [ -f "$plan_file" ] || continue

    # Match task table header: | ID | (but not | Internal ID | or | External ID |)
    if grep -q '^| ID |' "$plan_file" 2>/dev/null; then
      awk 'BEGIN{FS=OFS=""} /^[|] ID [|]/{sub(/^[|] ID [|]/, "| Internal ID |")} /^[|]----[|]/{sub(/^[|]----[|]/, "|-------------|")} {print}' "$plan_file" > "$plan_file.tmp" && mv "$plan_file.tmp" "$plan_file"
      report_update "$plan_file" "renamed ID to Internal ID in task table"
    fi
  done
done

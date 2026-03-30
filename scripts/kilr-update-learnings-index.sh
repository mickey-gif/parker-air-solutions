#!/bin/bash
# ============================================
# KILR Learnings Index Updater
# Regenerates .cursor/learnings/_index.md from files
# Usage: ./scripts/kilr-update-learnings-index.sh
# ============================================

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LEARNINGS_DIR="$REPO_ROOT/.antigravity/learnings"
INDEX_FILE="$LEARNINGS_DIR/_index.md"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Updating learnings index...${NC}"

# Count files in each category
count_files() {
  local dir="$1"
  if [ -d "$dir" ]; then
    find "$dir" -maxdepth 1 -name "*.md" ! -name "_index.md" | wc -l | tr -d ' '
  else
    echo "0"
  fi
}

PATTERN_COUNT=$(count_files "$LEARNINGS_DIR/patterns")
MISTAKE_COUNT=$(count_files "$LEARNINGS_DIR/mistakes")
REFINEMENT_COUNT=$(count_files "$LEARNINGS_DIR/refinements")
COMPONENT_COUNT=$(count_files "$LEARNINGS_DIR/components")
TRAINING_COUNT=$(count_files "$LEARNINGS_DIR/training")

# Build pattern table rows
build_pattern_rows() {
  if [ -d "$LEARNINGS_DIR/patterns" ]; then
    for f in "$LEARNINGS_DIR/patterns"/*.md; do
      [ -f "$f" ] || continue
      [[ "$(basename "$f")" == _* ]] && continue
      local slug=$(basename "$f" .md)
      local name=$(head -1 "$f" | sed 's/^# Pattern: //' | sed 's/^# //')
      local source=$(grep -m1 '^\- \*\*Project\*\*:' "$f" 2>/dev/null | sed 's/.*: //' || echo "Unknown")
      local summary=$(grep -m1 '^> \*\*Summary\*\*:' "$f" 2>/dev/null | sed 's/^> \*\*Summary\*\*: //' || echo "")
      local status=$(grep -m1 '^\- \*\*Status\*\*:' "$f" 2>/dev/null | sed 's/.*: //' || echo "—")
      echo "| [$name](patterns/$slug.md) | $summary | $source | $status |"
    done
  fi
}

build_mistake_rows() {
  if [ -d "$LEARNINGS_DIR/mistakes" ]; then
    for f in "$LEARNINGS_DIR/mistakes"/*.md; do
      [ -f "$f" ] || continue
      [[ "$(basename "$f")" == _* ]] && continue
      local slug=$(basename "$f" .md)
      local name=$(head -1 "$f" | sed 's/^# Mistake: //' | sed 's/^# //')
      local summary=$(grep -m1 '^> \*\*Summary\*\*:' "$f" 2>/dev/null | sed 's/^> \*\*Summary\*\*: //' || echo "")
      local source=$(grep -m1 '^\- \*\*Project\*\*:' "$f" 2>/dev/null | sed 's/.*: //' || echo "Unknown")
      echo "| [$name](mistakes/$slug.md) | $summary | $source |"
    done
  fi
}

build_refinement_rows() {
  if [ -d "$LEARNINGS_DIR/refinements" ]; then
    for f in "$LEARNINGS_DIR/refinements"/*.md; do
      [ -f "$f" ] || continue
      [[ "$(basename "$f")" == _* ]] && continue
      local slug=$(basename "$f" .md)
      local name=$(head -1 "$f" | sed 's/^# Refinement: //' | sed 's/^# //')
      local summary=$(grep -m1 '^> \*\*Summary\*\*:' "$f" 2>/dev/null | sed 's/^> \*\*Summary\*\*: //' || echo "")
      local source=$(grep -m1 '^\- \*\*Project\*\*:' "$f" 2>/dev/null | sed 's/.*: //' || echo "Unknown")
      echo "| [$name](refinements/$slug.md) | $summary | $source |"
    done
  fi
}

build_component_rows() {
  if [ -d "$LEARNINGS_DIR/components" ]; then
    for f in "$LEARNINGS_DIR/components"/*.md; do
      [ -f "$f" ] || continue
      [[ "$(basename "$f")" == _* ]] && continue
      local slug=$(basename "$f" .md)
      local name=$(head -1 "$f" | sed 's/^# Component: //' | sed 's/^# //')
      local source=$(grep -m1 '^\- \*\*Project\*\*:' "$f" 2>/dev/null | sed 's/.*: //' || echo "Unknown")
      local summary=$(grep -m1 '^> \*\*Summary\*\*:' "$f" 2>/dev/null | sed 's/^> \*\*Summary\*\*: //' || echo "")
      local status=$(grep -m1 '^\- \*\*Status\*\*:' "$f" 2>/dev/null | sed 's/.*: //' || echo "—")
      echo "| [$name](components/$slug.md) | $summary | $source | $status |"
    done
  fi
}

build_training_rows() {
  if [ -d "$LEARNINGS_DIR/training" ]; then
    for f in "$LEARNINGS_DIR/training"/*.md; do
      [ -f "$f" ] || continue
      [[ "$(basename "$f")" == _* ]] && continue
      local slug=$(basename "$f" .md)
      local name=$(head -1 "$f" | sed 's/^# //')
      echo "| [$name](training/$slug.md) |"
    done
  fi
}

# Write the index
cat > "$INDEX_FILE" << 'HEADER'
# KILR Framework Learnings Index

Accumulated knowledge from real projects — patterns discovered, mistakes avoided, refinements made, and components documented.

> **Learning Capture**: After solving a complex problem, run:
> ```bash
> ./scripts/kilr-capture-learning.sh <type> <slug> <project>
> ```
> Or tell Antigravity: "Capture what we just learned as a [pattern/mistake/refinement/component]"

---

HEADER

# Components section
cat >> "$INDEX_FILE" << 'EOF'
## Components (`components/`)

Verified component implementations from completed projects:

| Component | Summary | Source | Status |
|-----------|---------|--------|--------|
EOF
build_component_rows >> "$INDEX_FILE"

# Patterns section
cat >> "$INDEX_FILE" << 'EOF'

## Patterns (`patterns/`)

Reusable techniques discovered from projects:

| Pattern | Summary | Source | Status |
|---------|---------|--------|--------|
EOF
build_pattern_rows >> "$INDEX_FILE"

# Mistakes section
cat >> "$INDEX_FILE" << 'EOF'

## Mistakes (`mistakes/`)

Errors to avoid, learned from corrections:

| Mistake | Summary | Source |
|---------|---------|--------|
EOF
build_mistake_rows >> "$INDEX_FILE"

# Refinements section
cat >> "$INDEX_FILE" << 'EOF'

## Refinements (`refinements/`)

Improved approaches discovered over time:

| Refinement | Summary | Source |
|------------|---------|--------|
EOF
build_refinement_rows >> "$INDEX_FILE"

# Training section
cat >> "$INDEX_FILE" << 'EOF'

## Training (`training/`)

Deep analysis of reference implementations:

| Module |
|--------|
EOF
build_training_rows >> "$INDEX_FILE"

# Stats and usage guide
cat >> "$INDEX_FILE" << EOF

---

## Learning Metrics

| Category | Count |
|----------|-------|
| Components | $COMPONENT_COUNT |
| Patterns | $PATTERN_COUNT |
| Mistakes | $MISTAKE_COUNT |
| Refinements | $REFINEMENT_COUNT |
| Training | $TRAINING_COUNT |
| **Total** | **$(( COMPONENT_COUNT + PATTERN_COUNT + MISTAKE_COUNT + REFINEMENT_COUNT + TRAINING_COUNT ))** |

---

## How to Use

### Before Starting a Component
1. Check this index for similar patterns or components
2. Read relevant files — they contain working code
3. Review mistakes to avoid known pitfalls

### After Solving a Hard Problem
1. Run \`./scripts/kilr-capture-learning.sh <type> <slug> <project>\`
2. Fill in the template with what you learned
3. Run \`./scripts/kilr-update-learnings-index.sh\` to update this index

### Or Tell Antigravity
> "Capture what we just learned about [topic] as a [pattern/mistake/refinement/component]"

Antigravity will write the learning file and update the index automatically.
EOF

echo -e "${GREEN}✓ Learnings index updated${NC}"
echo "  File: $INDEX_FILE"
echo "  Components: $COMPONENT_COUNT | Patterns: $PATTERN_COUNT | Mistakes: $MISTAKE_COUNT | Refinements: $REFINEMENT_COUNT | Training: $TRAINING_COUNT"

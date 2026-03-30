#!/bin/bash
# ============================================
# KILR Learning Capture
# Captures a solved problem as persistent knowledge
# Usage: ./scripts/kilr-capture-learning.sh <type> <slug> [project]
#
# Types: pattern | mistake | refinement | component
# Example: ./scripts/kilr-capture-learning.sh pattern paper-tear-dividers kilr-studios
# ============================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
DIM='\033[2m'
NC='\033[0m'

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LEARNINGS_DIR="$REPO_ROOT/.antigravity/learnings"
INDEX_FILE="$LEARNINGS_DIR/_index.md"
DATE=$(date +%Y-%m-%d)

# Validate arguments
if [ -z "$1" ] || [ -z "$2" ]; then
  echo -e "${BLUE}============================================${NC}"
  echo -e "${BLUE}  KILR Learning Capture${NC}"
  echo -e "${BLUE}============================================${NC}"
  echo ""
  echo "Usage: $0 <type> <slug> [project]"
  echo ""
  echo "Types:"
  echo "  pattern      - Reusable technique (e.g., negative-margin-overlap)"
  echo "  mistake      - Error to avoid (e.g., incomplete-overrides)"
  echo "  refinement   - Improved approach (e.g., figma-spacing-reduction)"
  echo "  component    - Full component implementation (e.g., tear-divider)"
  echo ""
  echo "Examples:"
  echo "  $0 pattern paper-tear-dividers kilr-studios"
  echo "  $0 mistake wrong-nesting-level diamond-air"
  echo "  $0 component hero-section kilr-studios"
  echo ""
  exit 0
fi

TYPE="$1"
SLUG="$2"
PROJECT="${3:-unknown}"

# Validate type
case "$TYPE" in
  pattern|mistake|refinement|component) ;;
  *)
    echo -e "${RED}Error: Invalid type '$TYPE'. Must be: pattern, mistake, refinement, or component${NC}"
    exit 1
    ;;
esac

# Validate slug format
if [[ ! "$SLUG" =~ ^[a-z][a-z0-9-]*$ ]]; then
  echo -e "${RED}Error: Slug must be kebab-case (lowercase, hyphens). Got: '$SLUG'${NC}"
  exit 1
fi

# Set target directory and file
if [ "$TYPE" = "component" ]; then
  TARGET_DIR="$LEARNINGS_DIR/components"
else
  TARGET_DIR="$LEARNINGS_DIR/${TYPE}s"
fi

TARGET_FILE="$TARGET_DIR/$SLUG.md"

# Check if file already exists
if [ -f "$TARGET_FILE" ]; then
  echo -e "${YELLOW}Warning: Learning file already exists at:${NC}"
  echo "  $TARGET_FILE"
  echo ""
  read -p "Overwrite? (y/N) " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
  fi
fi

# Create directory if needed
mkdir -p "$TARGET_DIR"

# Convert slug to display name
DISPLAY_NAME=$(echo "$SLUG" | sed 's/-/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2));}1')
PROJECT_DISPLAY=$(echo "$PROJECT" | sed 's/-/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2));}1')

# Generate template based on type
case "$TYPE" in
  pattern)
    cat > "$TARGET_FILE" << EOF
# Pattern: $DISPLAY_NAME
> **Summary**: TODO: Provide a concise 1-sentence summary of this pattern.

## Problem Solved
<!-- What specific problem does this pattern solve? -->
TODO: Describe the problem

## Context
<!-- When did this come up? What were you building? -->
Discovered while building [$PROJECT_DISPLAY] — TODO: describe the scenario

## What Was Tried First (Failed)
<!-- What approach was attempted initially and why it didn't work? -->
1. TODO: First approach tried
2. TODO: Why it failed

## Solution
<!-- The working approach — include code -->

\`\`\`html
<!-- TODO: HTML structure -->
\`\`\`

\`\`\`css
/* TODO: CSS implementation */
\`\`\`

## Why This Works
<!-- Explain the principle behind the solution -->
TODO: Explain the mechanics

## When to Use
- TODO: Scenario 1
- TODO: Scenario 2

## When NOT to Use
- TODO: Anti-pattern scenario

## Key Principles
1. TODO: Most important takeaway
2. TODO: Second principle
3. TODO: Third principle

## Common Mistakes
- ❌ TODO: What people get wrong
- ✅ TODO: The correct approach

## Source
- **Project**: $PROJECT_DISPLAY
- **Date**: $DATE
- **Status**: CAPTURED — NEEDS REVIEW
EOF
    ;;

  mistake)
    cat > "$TARGET_FILE" << EOF
# Mistake: $DISPLAY_NAME
> **Summary**: TODO: Provide a concise 1-sentence summary of this mistake.

## What Went Wrong
<!-- Describe the error that was made -->
TODO: Describe the mistake

## Context
<!-- When did this happen? What were you trying to do? -->
Discovered while building [$PROJECT_DISPLAY] — TODO: describe the scenario

## Symptoms
<!-- How did you notice something was wrong? -->
- TODO: What looked broken or wrong

## Root Cause
<!-- Why did this happen? -->
TODO: The underlying reason

## Consequence
<!-- What was the impact? -->
TODO: What broke or degraded

## The Fix
<!-- How was it resolved? -->

\`\`\`css
/* WRONG */
TODO: The incorrect code

/* CORRECT */
TODO: The fixed code
\`\`\`

## Correct Approach Going Forward
<!-- How to avoid this in the future -->
1. TODO: Prevention step 1
2. TODO: Prevention step 2

## Detection
<!-- How can you catch this early? -->
- TODO: What to look for during code review

## Source
- **Project**: $PROJECT_DISPLAY
- **Date**: $DATE
- **Status**: CAPTURED — NEEDS REVIEW
EOF
    ;;

  refinement)
    cat > "$TARGET_FILE" << EOF
# Refinement: $DISPLAY_NAME
> **Summary**: TODO: Provide a concise 1-sentence summary of this refinement.

## Previous Approach
<!-- How we used to do it -->
TODO: The old way

## Discovery
<!-- What made us realize there's a better way? -->
Discovered while building [$PROJECT_DISPLAY] — TODO: describe what triggered the insight

## New Approach
<!-- How we do it now -->
TODO: The improved method

## Comparison

| Before | After |
|--------|-------|
| TODO: Old way | TODO: New way |
| TODO: Old result | TODO: New result |

## Impact
<!-- What improved? -->
- TODO: Quality improvement
- TODO: Speed improvement
- TODO: Reliability improvement

## When This Applies
- TODO: Scenario where this refinement matters

## Source
- **Project**: $PROJECT_DISPLAY
- **Date**: $DATE
- **Status**: CAPTURED — NEEDS REVIEW
EOF
    ;;

  component)
    cat > "$TARGET_FILE" << EOF
# Component: $DISPLAY_NAME
> **Summary**: TODO: Provide a concise 1-sentence summary of this component.

## Overview
<!-- What is this component? What does it do? -->
TODO: Brief description

## Visual Reference
<!-- Describe what it looks like or link to Figma -->
TODO: Visual description or Figma link

## HTML Structure

\`\`\`html
<!-- Framework levels 1-4, then custom at L5+ -->
<section class="section-xl">
  <div class="container-xl">
    <!-- TODO: Component HTML -->
  </div>
</section>
\`\`\`

## CSS Implementation

\`\`\`css
/* ---- $DISPLAY_NAME ---- */
/* TODO: Custom CSS (colors, backgrounds, decorations only) */
\`\`\`

## Framework Classes Used
| Level | Class | Purpose |
|-------|-------|---------|
| L1 | TODO: section-* | Section spacing |
| L2 | TODO: container-* | Content width |
| L3 | TODO: flex-grid gap-* | Grid layout |
| L4 | TODO: col-* | Column widths |

## Custom Classes Created
| Class | Purpose |
|-------|---------|
| TODO: .section_element | TODO: purpose |

## Framework vs Custom Ratio
- **Framework**: TODO: X%
- **Custom CSS**: TODO: Y%

## Key Decisions
1. TODO: Why this layout approach was chosen
2. TODO: Notable technique used

## Responsive Behavior
- **Desktop (1440px)**: TODO
- **Tablet (991px)**: TODO
- **Mobile (478px)**: TODO

## Gotchas & Lessons Learned
- TODO: Something that wasn't obvious
- TODO: A mistake that was made and corrected

## Source
- **Project**: $PROJECT_DISPLAY
- **Figma**: TODO: Link to Figma frame
- **Date**: $DATE
- **Status**: CAPTURED — NEEDS REVIEW
EOF
    ;;
esac

echo -e "${GREEN}✓ Learning captured!${NC}"
echo ""
echo -e "${BLUE}File created:${NC}"
echo "  $TARGET_FILE"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Fill in the TODO sections with actual details from your session"
echo "  2. Add code examples from the working solution"
echo "  3. Change status from 'CAPTURED — NEEDS REVIEW' to 'VERIFIED'"
echo "  4. Run: ./scripts/kilr-update-learnings-index.sh"
echo ""
echo -e "${DIM}Tip: Antigravity can fill this in automatically if you say:${NC}"
echo -e "${DIM}  \"Capture what we just learned about $SLUG as a $TYPE\"${NC}"
echo ""

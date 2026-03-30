#!/bin/bash
# ============================================
# KILR New Project Scaffolder
# Creates a new project from the template
# Usage: ./scripts/kilr-new-project.sh <client-name>
# ============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the repo root (parent of scripts/)
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEMPLATE_DIR="$REPO_ROOT/projects/.project-template"
PROJECTS_DIR="$REPO_ROOT/projects"

# Validate arguments
if [ -z "$1" ]; then
  echo -e "${RED}Error: Client name is required${NC}"
  echo ""
  echo "Usage: $0 <client-name>"
  echo "Example: $0 lms-electrical"
  echo ""
  echo "The client name should be lowercase with hyphens (kebab-case)."
  exit 1
fi

CLIENT_NAME="$1"
PROJECT_DIR="$PROJECTS_DIR/$CLIENT_NAME"

# Validate client name format (kebab-case)
if [[ ! "$CLIENT_NAME" =~ ^[a-z][a-z0-9-]*$ ]]; then
  echo -e "${RED}Error: Client name must be kebab-case (lowercase letters, numbers, hyphens)${NC}"
  echo "Example: lms-electrical, kilr-studios, diamond-air-energy"
  exit 1
fi

# Check if project already exists
if [ -d "$PROJECT_DIR" ]; then
  echo -e "${RED}Error: Project '$CLIENT_NAME' already exists at $PROJECT_DIR${NC}"
  exit 1
fi

# Check template exists
if [ ! -d "$TEMPLATE_DIR" ]; then
  echo -e "${RED}Error: Project template not found at $TEMPLATE_DIR${NC}"
  exit 1
fi

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  KILR New Project: ${GREEN}$CLIENT_NAME${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Create project directory
echo -e "${YELLOW}Creating project structure...${NC}"
mkdir -p "$PROJECT_DIR"

# Create folder structure
mkdir -p "$PROJECT_DIR/css"
mkdir -p "$PROJECT_DIR/js"
mkdir -p "$PROJECT_DIR/images"
mkdir -p "$PROJECT_DIR/analysis"

# Copy template files
cp "$TEMPLATE_DIR/index.html" "$PROJECT_DIR/"
cp "$TEMPLATE_DIR/README.md" "$PROJECT_DIR/"
cp "$TEMPLATE_DIR/_headers" "$PROJECT_DIR/"
cp "$TEMPLATE_DIR/_redirects" "$PROJECT_DIR/"
cp "$TEMPLATE_DIR/wrangler.toml" "$PROJECT_DIR/"
cp "$TEMPLATE_DIR/css/custom.css" "$PROJECT_DIR/css/"

# Copy CSS files
if [ -f "$TEMPLATE_DIR/css/variables.css" ]; then
  cp "$TEMPLATE_DIR/css/variables.css" "$PROJECT_DIR/css/"
fi

# Generate wrangler.toml
cat > "$PROJECT_DIR/wrangler.toml" << TOMLEOF
# Cloudflare Pages configuration for $CLIENT_NAME
name = "$CLIENT_NAME"
compatibility_date = "2024-01-01"
pages_build_output_dir = "./"

# Headers for security and performance
[[headers]]
for = "/*"
[headers.values]
X-Frame-Options = "DENY"
X-Content-Type-Options = "nosniff"
Referrer-Policy = "strict-origin-when-cross-origin"

# Cache static assets
[[headers]]
for = "/images/*"
[headers.values]
Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
for = "/css/*"
[headers.values]
Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
for = "/js/*"
[headers.values]
Cache-Control = "public, max-age=31536000, immutable"
TOMLEOF

# Replace placeholders in copied files
CLIENT_DISPLAY=$(echo "$CLIENT_NAME" | sed 's/-/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2));}1')
CURRENT_DATE=$(date +%Y-%m-%d)

# Replace placeholders in README.md
sed -i '' "s/\[Client Name\]/$CLIENT_DISPLAY/g" "$PROJECT_DIR/README.md" 2>/dev/null || true
sed -i '' "s/\[Project Name\]/$CLIENT_DISPLAY/g" "$PROJECT_DIR/README.md" 2>/dev/null || true
sed -i '' "s/\[Date\]/$CURRENT_DATE/g" "$PROJECT_DIR/README.md" 2>/dev/null || true
sed -i '' "s/\[client-slug\]/$CLIENT_NAME/g" "$PROJECT_DIR/README.md" 2>/dev/null || true

# Replace placeholders in index.html
sed -i '' "s/\[Company Name\]/$CLIENT_DISPLAY/g" "$PROJECT_DIR/index.html" 2>/dev/null || true
sed -i '' "s/\[Project Name\]/$CLIENT_DISPLAY/g" "$PROJECT_DIR/index.html" 2>/dev/null || true

echo -e "${GREEN}✓ Project structure created${NC}"
echo ""

# Show what was created
echo -e "${BLUE}Project structure:${NC}"
echo ""
echo "  $CLIENT_NAME/"
echo "  ├── README.md                 (Unified Single Source of Truth)"
echo "  ├── index.html                (Main HTML)"
echo "  ├── wrangler.toml             (Cloudflare Pages config)"
echo "  ├── _headers                  (Security & Cache headers)"
echo "  ├── _redirects                (URL redirects)"
echo "  ├── css/"
echo "  │   ├── variables.css         (Brand color/font overrides)"
173:   │   └── custom.css            (Custom styles only)
echo "  ├── images/                   (Project assets)"
echo "  ├── js/                       (Project scripts)"
echo "  └── analysis/                 (Phase 2 analysis files)"
echo ""

echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Open README.md and fill in Figma URL and Component List"
echo "  2. Start the 5-phase workflow"
echo ""
echo -e "${GREEN}Done! Project '$CLIENT_NAME' is ready.${NC}"

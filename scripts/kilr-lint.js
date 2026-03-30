#!/usr/bin/env node

/**
 * KILR Framework Linter
 * Validates HTML and CSS against framework rules
 *
 * Usage: node scripts/kilr-lint.js <project-path>
 * Example: node scripts/kilr-lint.js projects/kilr-studios
 */

const fs = require('fs');
const path = require('path');

// ============================================
// Configuration
// ============================================

// Framework utility classes (Levels 1-4 ONLY)
const FRAMEWORK_CLASSES = {
  section: [
    'section-xxl', 'section-xl', 'section-l', 'section-m',
    'section-s', 'section-xs', 'section-xxs'
  ],
  container: [
    'container-max', 'container-xxl', 'container-xl', 'container-l',
    'container-m', 'container-s', 'container-xs', 'container-xxs'
  ],
  grid: ['flex-grid'],
  gap: [
    'gap-xxl', 'gap-xl', 'gap-l', 'gap-m',
    'gap-s', 'gap-xs', 'gap-xxs', 'gap-0'
  ],
  column: [
    'col-100', 'col-75', 'col-70', 'col-66', 'col-60',
    'col-50', 'col-40', 'col-33', 'col-30', 'col-25',
    'col-20', 'col-16', 'col-content'
  ],
  typography: [
    'heading-xxl', 'heading-xl', 'heading-l', 'heading-m',
    'heading-s', 'heading-xs', 'heading-xxs',
    'paragraph-xxl', 'paragraph-xl', 'paragraph-l', 'paragraph-m',
    'paragraph-s', 'paragraph-xs', 'paragraph-xxs'
  ],
  modifier: ['is-centered', 'is-sticky']
};

// All framework classes in a flat set
const ALL_FRAMEWORK_CLASSES = new Set(
  Object.values(FRAMEWORK_CLASSES).flat()
);

// L1-L4 classes only (the ones that MUST be framework-only)
const L1_CLASSES = new Set(FRAMEWORK_CLASSES.section);
const L2_CLASSES = new Set(FRAMEWORK_CLASSES.container);
const L3_CLASSES = new Set([...FRAMEWORK_CLASSES.grid, ...FRAMEWORK_CLASSES.gap]);
const L4_CLASSES = new Set(FRAMEWORK_CLASSES.column);

// Allowed combo patterns on sections (framework class + custom background/decoration)
// e.g., <section class="section-xl hero_bg">
const SECTION_COMBO_PATTERN = /_bg$|_background$|_overlay$/;

// Navigation exception: nav elements can use custom classes at any level
const NAV_TAGS = ['nav'];
const NAV_CLASS_PREFIXES = ['nav', 'navbar', 'menu', 'dropdown', 'hamburger'];

// ============================================
// Colors
// ============================================
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const DIM = '\x1b[2m';
const NC = '\x1b[0m';

// ============================================
// Linting Rules
// ============================================

function lintCSS(cssContent, filePath) {
  const errors = [];
  const warnings = [];
  const lines = cssContent.split('\n');

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed === '') {
      return;
    }

    // Rule 1: No px values (except in allowed contexts)
    const pxMatches = trimmed.match(/:\s*[^;]*\b(\d+(?:\.\d+)?)px\b/g);
    if (pxMatches) {
      // Allow px in standard CSS contexts where px is correct/unavoidable
      const isClamp = /clamp\(/.test(trimmed);
      const isCalc = /calc\(/.test(trimmed);
      const isBorder = /border[^:]*:\s*\d+px\s+(solid|dashed|dotted|double|none)/.test(trimmed);
      const isBoxShadow = /box-shadow\s*:/.test(trimmed);
      const isOnePxBorder = /:\s*1px\s/.test(trimmed);
      const isTranslate = /translate/.test(trimmed);
      const isMediaQuery = /^@media/.test(trimmed);
      const isBlur = /blur\(\d+px\)/.test(trimmed);
      const isOneOrTwoPx = /:\s*[12]px[;\s]/.test(trimmed);
      const isOutline = /outline/.test(trimmed);
      const isLetterSpacing = /letter-spacing/.test(trimmed);

      if (!isClamp && !isCalc && !isMediaQuery && !isBlur) {
        // Allow 1-2px values for borders, outlines, letter-spacing (pixel-precision items)
        if ((isBorder || isOutline || isLetterSpacing) && isOneOrTwoPx) {
          // Acceptable pixel-precision values
        } else if (isBorder && isOnePxBorder) {
          // 1px borders are acceptable
        } else if (isBoxShadow) {
          // Box shadows with px are a warning, not error
          warnings.push({
            file: filePath,
            line: lineNum,
            rule: 'px-values',
            message: `Consider using rem for box-shadow values`,
            context: trimmed
          });
        } else if (isOneOrTwoPx && /(width|height)\s*:\s*[12]px/.test(trimmed)) {
          // Allow 1px/2px width/height (e.g., screen-reader-only, dividers)
        } else if (isTranslate) {
          // translate with px is a warning
          warnings.push({
            file: filePath,
            line: lineNum,
            rule: 'px-values',
            message: `Consider using rem or % for translate values`,
            context: trimmed
          });
        } else {
          errors.push({
            file: filePath,
            line: lineNum,
            rule: 'no-px',
            message: `Found px value — use rem (px ÷ 16) or framework variables`,
            context: trimmed
          });
        }
      }
    }

    // Rule 2: No hardcoded font-size (should use framework typography classes)
    if (/font-size\s*:/.test(trimmed) && !trimmed.includes('var(--')) {
      warnings.push({
        file: filePath,
        line: lineNum,
        rule: 'use-typography-class',
        message: `Hardcoded font-size — consider using framework heading-*/paragraph-* classes instead`,
        context: trimmed
      });
    }

    // Rule 3: No hardcoded padding/margin that matches framework section sizes
    if (/^(padding|margin)(-top|-bottom)?\s*:/.test(trimmed) && !trimmed.includes('var(--')) {
      if (/:\s*\d+rem/.test(trimmed)) {
        warnings.push({
          file: filePath,
          line: lineNum,
          rule: 'use-framework-spacing',
          message: `Hardcoded spacing — consider using framework section-*/gap-* classes or --space-* variables`,
          context: trimmed
        });
      }
    }
  });

  return { errors, warnings };
}

function lintHTML(htmlContent, filePath) {
  const errors = [];
  const warnings = [];
  const lines = htmlContent.split('\n');

  // Track hierarchy for structural checks
  let inNav = false;

  // Simple tag-by-tag analysis
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmed = line.trim();

    // Track nav context
    if (/<nav[\s>]/.test(trimmed)) inNav = true;
    if (/<\/nav>/.test(trimmed)) inNav = false;

    // Skip nav sections (exception to framework rules)
    if (inNav) return;

    // Rule 1: Sections must have a framework section-* class
    const sectionMatch = trimmed.match(/<section\s+class="([^"]+)"/);
    if (sectionMatch) {
      const classes = sectionMatch[1].split(/\s+/);
      const hasFrameworkSection = classes.some(c => L1_CLASSES.has(c));
      if (!hasFrameworkSection) {
        errors.push({
          file: filePath,
          line: lineNum,
          rule: 'L1-section-class',
          message: `Section missing framework section-* class (L1). Found: "${sectionMatch[1]}"`,
          context: trimmed
        });
      }

      // Check for custom classes at L1 (only bg/decoration combos allowed)
      const customClasses = classes.filter(c =>
        !L1_CLASSES.has(c) && !SECTION_COMBO_PATTERN.test(c)
      );
      if (customClasses.length > 0) {
        // Check if these look like old-style section names
        const layoutClasses = customClasses.filter(c =>
          !c.endsWith('_bg') && !c.endsWith('_background') && !c.endsWith('_overlay')
        );
        if (layoutClasses.length > 0) {
          warnings.push({
            file: filePath,
            line: lineNum,
            rule: 'L1-custom-class',
            message: `Custom class "${layoutClasses.join(', ')}" at section level (L1). Only bg/decoration combos allowed (e.g., hero_bg)`,
            context: trimmed
          });
        }
      }
    }

    // Rule 2: Sections should have a container child (check same line or next few lines)
    if (/<section\s/.test(trimmed)) {
      // Look ahead up to 5 lines for a container
      const lookAhead = lines.slice(index, Math.min(index + 6, lines.length)).join('\n');
      const hasContainer = FRAMEWORK_CLASSES.container.some(c =>
        lookAhead.includes(`class="`) && lookAhead.includes(c)
      );
      if (!hasContainer) {
        // Check a wider range (10 lines) before flagging
        const widerLookAhead = lines.slice(index, Math.min(index + 11, lines.length)).join('\n');
        const hasContainerWider = FRAMEWORK_CLASSES.container.some(c =>
          widerLookAhead.includes(c)
        );
        if (!hasContainerWider) {
          warnings.push({
            file: filePath,
            line: lineNum,
            rule: 'L2-container-missing',
            message: `Section may be missing a container-* child (L2). Check hierarchy.`,
            context: trimmed
          });
        }
      }
    }

    // Rule 3: Check for layout without grid system
    // Look for multiple sibling divs that should be using flex-grid + col-*
    // This is a heuristic: if we see custom "wrapper" or "row" classes, flag it
    const classMatch = trimmed.match(/class="([^"]+)"/);
    if (classMatch) {
      const classes = classMatch[1].split(/\s+/);
      const suspiciousLayoutClasses = classes.filter(c =>
        (c.includes('_wrapper') || c.includes('_row') || c.includes('_grid') || c.includes('_columns')) &&
        !ALL_FRAMEWORK_CLASSES.has(c)
      );
      if (suspiciousLayoutClasses.length > 0) {
        warnings.push({
          file: filePath,
          line: lineNum,
          rule: 'use-framework-grid',
          message: `"${suspiciousLayoutClasses.join(', ')}" looks like custom layout — use flex-grid + col-* instead`,
          context: trimmed
        });
      }
    }

    // Rule 4: Check for inline styles
    if (/style="/.test(trimmed)) {
      // Allow style on background images (common pattern)
      if (/background-image/.test(trimmed) || /background:.*url/.test(trimmed)) {
        // Acceptable for dynamic bg images
      } else {
        warnings.push({
          file: filePath,
          line: lineNum,
          rule: 'no-inline-style',
          message: `Inline style found — move to custom.css`,
          context: trimmed.substring(0, 100)
        });
      }
    }
  });

  return { errors, warnings };
}

// ============================================
// Main
// ============================================

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`${BLUE}KILR Framework Linter${NC}`);
    console.log('');
    console.log('Usage: node scripts/kilr-lint.js <project-path>');
    console.log('Example: node scripts/kilr-lint.js projects/kilr-studios');
    process.exit(0);
  }

  const projectPath = path.resolve(args[0]);

  if (!fs.existsSync(projectPath)) {
    console.error(`${RED}Error: Project path not found: ${projectPath}${NC}`);
    process.exit(1);
  }

  console.log(`${BLUE}============================================${NC}`);
  console.log(`${BLUE}  KILR Framework Linter${NC}`);
  console.log(`${BLUE}  Project: ${GREEN}${path.basename(projectPath)}${NC}`);
  console.log(`${BLUE}============================================${NC}`);
  console.log('');

  let totalErrors = 0;
  let totalWarnings = 0;

  // Lint HTML files
  const htmlFiles = findFiles(projectPath, '.html');
  htmlFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf-8');
    const relPath = path.relative(projectPath, file);
    const result = lintHTML(content, relPath);
    totalErrors += result.errors.length;
    totalWarnings += result.warnings.length;
    printResults(relPath, result);
  });

  // Lint CSS files (only custom CSS, not framework)
  const cssFiles = findFiles(projectPath, '.css').filter(f =>
    !f.includes('kilr-framework') && !f.includes('node_modules')
  );
  cssFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf-8');
    const relPath = path.relative(projectPath, file);
    const result = lintCSS(content, relPath);
    totalErrors += result.errors.length;
    totalWarnings += result.warnings.length;
    printResults(relPath, result);
  });

  // Summary
  console.log('');
  console.log(`${BLUE}============================================${NC}`);
  console.log(`${BLUE}  Summary${NC}`);
  console.log(`${BLUE}============================================${NC}`);
  console.log('');
  console.log(`  Files checked:  ${htmlFiles.length} HTML, ${cssFiles.length} CSS`);
  console.log(`  ${RED}Errors:   ${totalErrors}${NC}  ${DIM}(must fix before deploy)${NC}`);
  console.log(`  ${YELLOW}Warnings: ${totalWarnings}${NC}  ${DIM}(should review)${NC}`);
  console.log('');

  if (totalErrors === 0 && totalWarnings === 0) {
    console.log(`  ${GREEN}✓ All checks passed!${NC}`);
  } else if (totalErrors === 0) {
    console.log(`  ${YELLOW}⚠ Passed with warnings. Review recommended.${NC}`);
  } else {
    console.log(`  ${RED}✗ Failed. Fix errors before deploying.${NC}`);
  }
  console.log('');

  // Exit with error code if there are errors
  process.exit(totalErrors > 0 ? 1 : 0);
}

function findFiles(dir, ext) {
  const results = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      // Skip node_modules, .wrangler, hidden dirs
      if (item.name.startsWith('.') || item.name === 'node_modules') continue;
      results.push(...findFiles(fullPath, ext));
    } else if (item.name.endsWith(ext)) {
      results.push(fullPath);
    }
  }
  return results;
}

function printResults(filePath, result) {
  const { errors, warnings } = result;
  if (errors.length === 0 && warnings.length === 0) return;

  console.log(`${DIM}─── ${filePath} ───${NC}`);

  errors.forEach(e => {
    console.log(`  ${RED}ERROR${NC} [${e.rule}] Line ${e.line}: ${e.message}`);
    console.log(`    ${DIM}${e.context}${NC}`);
  });

  warnings.forEach(w => {
    console.log(`  ${YELLOW}WARN${NC}  [${w.rule}] Line ${w.line}: ${w.message}`);
    console.log(`    ${DIM}${w.context}${NC}`);
  });

  console.log('');
}

main();

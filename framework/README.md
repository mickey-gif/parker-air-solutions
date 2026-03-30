# KILR Website Framework Summary

This directory contains the complete documentation, proofs of concept, and reusable assets for the KILR Website Building System.

## 1. Core Documentation (Start Here)

*   **[`PROCESS.md`](PROCESS.md)**: The Master Workflow. Read this first. It defines the "Visual Deconstruction" process: Ask questions -> Find Invisible Boxes -> Build.
*   **[`box-model-analysis.md`](box-model-analysis.md)**: The philosophy of "Thinking in Boxes". Explains how to handle complex layouts like Layered Backgrounds and Dual Containers.
*   **[`framework-checklist.md`](framework-checklist.md)**: A mandatory pre-flight checklist for developers to use before starting any section.
*   **[`naming-conventions.md`](naming-conventions.md)**: The strict "Utility-First + Combo Class" naming rule set.

## 2. Live Demos (Proofs of Concept)

These HTML files demonstrate the framework in action, reconstructing real-world examples from NuEge, Shieldcoat, and Toughcoat.

*   **[`demo/layered-hero.html`](demo/layered-hero.html)**: A generic template for the "Layered Background + Dual Container" strategy derived from Visual Deconstruction.
*   **[`demo/nuege-hero.html`](demo/nuege-hero.html)**: Demonstrates a clean split layout using Utility classes.
*   **[`demo/shieldcoat-hero.html`](demo/shieldcoat-hero.html)**: Demonstrates handling overlays and white-background aesthetics.
*   **[`demo/toughcoat-hero.html`](demo/toughcoat-hero.html)**: Demonstrates complex absolute positioning and dark mode theming within the grid.
*   **[`demo/index.html`](demo/index.html)**: The Fluid Sizing system visualization.
*   **[`demo/columns.html`](demo/columns.html)**: The Responsive Flex Grid system.

## 3. CSS Framework (The Code)

These files form the basis of the CSS system you will deploy.

*   **[`demo/variables.css`](demo/variables.css)**: The "Single Source of Truth" for Fluid Sizing and Brand Colors.
*   **[`demo/page-structure.css`](demo/page-structure.css)**: Global structure classes (`.section-xxl`, `.container-l`).
*   **[`demo/flex-columns.css`](demo/flex-columns.css)**: The Grid System (`.flex-grid`, `.col-50`, `.gap-m`).
*   **[`demo/typography.css`](demo/typography.css)**: Global Type Utilities (`.heading-xxl`, `.paragraph-m`).
*   **[`demo/utilities.css`](demo/utilities.css)**: Helper classes (`.truncate-3`, etc.).

## 4. JavaScript Attributes

*   **`kilr-*` Attributes**: Functionality is decoupled from CSS classes.
    *   `kilr-animation`: Scroll-trigger animations.
    *   `kilr-nav`: Navigation behaviors.
    *   `kilr-toggle`: Click interaction handlers.
    *   `kilr-scroll-move`: Element translation on scroll.

## Next Steps for Development

1.  Link the framework CSS (`framework/dist/kilr-framework.css`) in your HTML files.
2.  Follow `PROCESS.md` for every new section: **Deconstruct > Map Boxes > Name Classes**.
3.  Use `framework-checklist.md` to validate your plan before coding.
4.  Use Cursor's visual builder tools to build directly in your codebase.

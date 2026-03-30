# KILR Website Builder

**AI-assisted Figma → Website conversion using the KILR Framework**

Train AI agents to convert Figma designs into fully developed, responsive websites with 95%+ visual accuracy.

---

## 📚 Knowledge Architecture

This repository uses a **unified knowledge system** designed for AI training and retention, now centralized in the `.antigravity` directory:

```
.antigravity/
├── learnings/            # ACCUMULATED KNOWLEDGE (Patterns & Mistakes)
└── reference/            # QUICK LOOKUPS (Class lookups, PX-to-REM)
```

---

## 🚀 Quick Start

### For New Projects

```bash
# 1. Create project using the scaffolder
./scripts/kilr-new-project.sh client-name

# 2. Open the new project's README.md
# This is the Single Source of Truth for the build.
# Fill in the Figma URL and Component Checklist immediately.

# 3. Start the 5-phase workflow
# See .antigravityrules for the core development laws.
```

### For AI Agents

At the START of every session, follow the **Session Start Protocol** defined in `.antigravityrules`.

---

## 📁 Repository Structure

```
kilr-website-builder/
├── .antigravity/         # AI knowledge system (Memory & Principles)
├── framework/            # KILR CSS Framework (Core Utilities)
├── kilr-js-libraries/    # Reusable JavaScript (Nav, Sliders)
├── projects/             # Active & Completed Client Projects
│   ├── .project-template/# Scaffolding template
│   └── kilr-studios/     # Portfolio site
├── reference-projects/   # Training reference (e.g., Diamond Air)
├── scripts/              # Utility scripts (Scaffolding, Learnings)
└── .antigravityrules       # Central Command (Development Rules)
```

---

## 🎯 The 5-Phase Workflow

```
PHASE 1: Pre-Work
└─ Figma access, component identification

PHASE 2: Visual Deconstruction (CRITICAL)
└─ Box mapping, measurements, structure plan
└─ WAIT FOR USER CONFIRMATION

PHASE 3: Implementation
└─ HTML structure, framework classes, custom CSS

PHASE 4: Validation
└─ Screenshot comparison, responsive testing

PHASE 5: Documentation
└─ Update local README, capture learnings to .antigravity
```

---

## 🚫 Absolute Prohibitions

1. **NEVER use px** → Always rem (px ÷ 16)
2. **NEVER skip the container** → Section → Container → Row → Column
3. **NEVER skip Phase 2** → Visual deconstruction is mandatory
4. **NEVER create custom classes for Levels 1-4** → Framework only
5. **NEVER build entire pages at once** → Component-by-component

---

## 🛠️ Technologies

- **KILR Framework**: Utility-first CSS + BEM combo classes
- **Webflow**: Deployment target (Visual development logic)
- **Figma**: Primary design source
- **Antigravity**: Agent-based development with persistent memory

---

## 📖 Key Documentation

| Document | Purpose |
|----------|---------|
| `.antigravityrules` | Core prohibitions and development laws |
| `.antigravity/learnings/` | Database of discovered patterns and mistakes |
| `framework/dist/STYLE_GUIDE.md` | CSS Framework class reference |
| `projects/[client]/README.md` | Single Source of Truth for active project context |

---

**Last Updated**: March 2026  
**Agent Focus**: Antigravity Native Workflow

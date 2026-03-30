# KILR Studios

**Client**: KILR Studios
**Type**: Agency / Brand Management Website
**Status**: ⏳ In Progress

---

## Project Context

| Field | Value |
|-------|-------|
| **Figma URL** | https://www.figma.com/design/YBQSflx9wkjfguXbhwNHMx/KILR-STUDIO-WEBSITE |
| **Node ID** | 916-110 (Hero) |
| **Deployment** | Cloudflare Pages |

### Brand Personality
Bold, confident, sports-inspired agency voice. "Dominate The Game" — positioned for ambitious business owners who want to claim their market.

### Color Palette & Typography
| Token | Value |
|-------|-------|
| Primary (Gold) | `#fabd02` |
| Dark | `#1c1c1c` |
| Light | `#ffffff` |
| Display font | Benguiat Pro ITC (self-hosted) |
| Body/UI font | Degular (self-hosted) |

> **Font note**: Benguiat Pro ITC and Degular are premium licensed fonts. Add `@font-face` declarations or embed from your font host in `index.html`.

---

## Master Component List

| # | Component | Status | Notes |
|---|-----------|--------|-------|
| 1 | Navigation | ⏳ Pending | Transparent → scrolled state |
| 2 | Hero | ✅ Done | node 916:110 |
| 3 | Footer | ⏳ Pending | Placeholder only |

---

## Development

### Local Start
```bash
cd projects/kilr-studios
python3 -m http.server 8000
```

### Deployment
```bash
wrangler pages deploy . --project-name=kilr-studios
```

---

## File Structure
```
kilr-studios/
├── index.html
├── css/
│   ├── variables.css   # Brand tokens (colors, fonts)
│   └── custom.css      # Component styles
├── js/
├── images/
│   ├── hero-bg.jpg     # Hero background photo (from Figma)
│   └── hero-tear.png   # Torn paper edge decoration (from Figma)
└── README.md
```

---

## Phase Checklist
- [x] Phase 1: Pre-Work (Figma analysis, project setup)
- [x] Phase 2: Hero Section Implementation
- [ ] Phase 3: Additional Sections (Services, Work, About, Contact)
- [ ] Phase 4: Validation & Cross-browser check
- [ ] Phase 5: Deployment

**Last Updated**: 2026-03-15

# KILR Starting Template

This is the **starting template** for all new KILR website projects. Use this template as the foundation when building new websites.

## Overview

The KILR Starting Template is a Webflow-based starter template that includes:

- **Navigation System**: Pre-configured navigation with dropdown support, hamburger menu, and mobile responsiveness
- **KILR Framework**: Integrated KILR Framework CSS for consistent styling and layout
- **JavaScript Components**: Pre-built JS libraries for navigation, sliders, and class management
- **Base Structure**: Clean HTML structure ready for customization

## Structure

```
kilr-starting-template/
├── index.html          # Main HTML file with navigation structure
├── css/
│   └── kilr-starter-template.webflow.css  # Webflow CSS styles
├── js/
│   ├── nav.js          # Navigation functionality (v1.5.1)
│   ├── add-class.js    # Add class handler (v1.0.6)
│   └── slider.js       # Slider component (v2.7.9)
└── images/
    └── [logo and assets]
```

## Key Features

### Navigation (`nav.js`)
- Responsive hamburger menu
- Dropdown menus with sub-dropdowns
- Mobile/desktop breakpoint handling
- Hover and click interactions
- React hydration compatibility

### Slider (`slider.js`)
- Touch/swipe support
- Keyboard navigation
- Loop mode support
- Product image integration
- Accessibility features

### Add Class Handler (`add-class.js`)
- Hover, click, and scroll triggers
- Breakpoint-based behavior
- Group exclusivity mode
- Scroll-based animations

## Usage

1. **Duplicate this folder** for each new website project
2. **Rename the folder** to match your project name
3. **Customize** the HTML, CSS, and content as needed
4. **Update** logo and images in the `images/` folder
5. **Modify** navigation links and structure in `index.html`

## Dependencies

- **KILR Framework CSS**: Loaded via CDN in `index.html`
- **KILR Nav Component**: Loaded via CDN (`https://scripts.kilr.au/components/nav.js`)
- **Webflow CSS**: Normalize and base Webflow styles
- **Google Fonts**: Montserrat and Poppins (configured in `index.html`)

## Notes

- This template is designed to work with Webflow exports
- All KILR components use data attributes for configuration
- The template follows the KILR Framework structure: Section → Container → Row → Column
- CSS variables are defined in the Webflow CSS file for easy customization

## Version History

- **Current Version**: Based on Webflow export from December 16, 2025
- **Nav.js**: v1.5.1
- **Add-class.js**: v1.0.6
- **Slider.js**: v2.7.9

---

**Important**: Always duplicate this template when starting a new project. Do not modify this template directly - it should remain as the clean starting point for all new websites.


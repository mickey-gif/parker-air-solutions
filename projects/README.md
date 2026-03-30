# Projects Folder

This folder contains all client projects built with the KILR Framework.

## 📁 **Folder Structure**

Each project should be in its own folder with this structure:

```
projects/
├── project-name/
│   ├── index.html              # Main HTML file(s)
│   ├── css/
│   │   └── custom.css          # Custom CSS for this project
│   ├── js/
│   │   └── *.js                # JavaScript files (nav.js, slider.js, etc.)
│   ├── images/
│   │   └── *.png, *.jpg, *.svg # All project images
│   ├── ASSETS_NEEDED.md        # List of Figma assets to export
│   ├── IMPLEMENTATION_SUMMARY.md # Phase 3 summary
│   ├── PHASE_4_*.md            # Testing & validation docs
│   └── README.md               # Project-specific documentation
```

---

## 🆕 **Creating a New Project**

When starting a new project, follow these steps:

### **Step 1: Create Project Folder**
```bash
cd projects
mkdir project-name
cd project-name
```

**Naming convention**: Use `kebab-case` (lowercase with hyphens)
- ✅ Good: `lms-electrical`, `acme-corp`, `solar-solutions`
- ❌ Bad: `LMS Electrical`, `AcmeCorp`, `solar_solutions`

### **Step 2: Create Project Structure**
```bash
mkdir css js images
touch index.html css/custom.css
```

### **Step 3: Link KILR Framework**
In your HTML file:
```html
<!-- KILR Framework -->
<link rel="stylesheet" href="../../framework/dist/kilr-framework.css">

<!-- Custom Styles -->
<link rel="stylesheet" href="css/custom.css">
```

### **Step 4: Copy JavaScript Files (if needed)**
```bash
# Copy from kilr-js-libraries
cp ../../kilr-js-libraries/nav.js js/
cp ../../kilr-js-libraries/slider.js js/
cp ../../kilr-js-libraries/add-class.js js/
```

### **Step 5: Follow MASTER_PROCESS.md**
Always follow the 5-phase process:
1. **Phase 1**: Pre-Work (confirm Figma access)
2. **Phase 2**: Visual Deconstruction (CRITICAL - don't skip!)
3. **Phase 3**: Implementation
4. **Phase 4**: Testing & Validation
5. **Phase 5**: Documentation

---

## 📋 **Current Projects**

### **1. LMS Electrical** (`lms-electrical/`)
- **Client**: LMS Electrical
- **Type**: Solar energy landing page
- **Status**: In development (Phase 4 - Testing)
- **Figma**: [LMS KILR Design](https://www.figma.com/design/MEmKnrfiTjA5kWObXriYu1/LMS-KILR-?node-id=62-386)
- **Features**: 12 sections, hero cards, testimonials, projects showcase

---

## 🗂️ **Project Naming Guidelines**

### **Folder Names** (kebab-case)
- Use lowercase
- Separate words with hyphens
- Keep it short and descriptive
- Examples: `client-name`, `project-type`, `client-project`

### **File Names**
- **HTML**: `index.html`, `landing-page.html`, `about.html`
- **CSS**: `custom.css`, `project-name.css`, `landing.css`
- **Images**: Use descriptive names: `hero-bg.png`, `logo.svg`, `icon-sun.svg`
- **Documentation**: Use CAPS for major docs: `README.md`, `ASSETS_NEEDED.md`

---

## 🚀 **Starting a Project with AI**

When an AI agent starts a new project, it should:

1. **Create the project folder**:
   ```bash
   mkdir -p projects/client-name/{css,js,images}
   ```

2. **Create initial files**:
   ```bash
   touch projects/client-name/index.html
   touch projects/client-name/css/custom.css
   touch projects/client-name/README.md
   ```

3. **Add to this README** under "Current Projects"

4. **Follow MASTER_PROCESS.md** strictly (especially Phase 2!)

---

## 📦 **What Goes in Each Project Folder?**

### **Required Files**
- ✅ HTML file(s)
- ✅ `css/custom.css` - Custom styles
- ✅ `images/` folder with all assets
- ✅ `ASSETS_NEEDED.md` - List of Figma assets
- ✅ `README.md` - Project documentation

### **Optional Files**
- `js/*.js` - JavaScript files (if interactive)
- `IMPLEMENTATION_SUMMARY.md` - Phase 3 summary
- `PHASE_4_*.md` - Testing documentation
- `VISUAL_COMPARISON.md` - Design validation

### **Never Include**
- ❌ Framework CSS files (use relative links)
- ❌ Node modules or dependencies
- ❌ Temporary files or backups
- ❌ IDE-specific files

---

## 🔍 **Finding a Project**

All projects are in `projects/` with descriptive folder names:

```bash
projects/
├── lms-electrical/      # LMS Electrical landing page
├── acme-solar/          # Acme Solar website
└── green-energy/        # Green Energy Solutions
```

To work on a project:
```bash
cd projects/project-name
python3 -m http.server 8000
```

Then open: `http://localhost:8000/index.html`

---

## 📚 **Related Documentation**

- **Framework**: `../framework/dist/WEBFLOW_STYLE_GUIDE.md`
- **Process**: `../MASTER_PROCESS.md`
- **Quick Reference**: `../QUICK_REFERENCE.md`
- **JavaScript**: `../kilr-js-libraries/`

---

## ✅ **Best Practices**

1. **One folder per project** - Keep everything isolated
2. **Follow naming conventions** - Use kebab-case consistently
3. **Document everything** - README, assets needed, decisions made
4. **Use relative paths** - Link to framework with `../../framework/`
5. **Keep it clean** - Delete temporary files when done
6. **Test locally** - Always run a local server and test

---

**Last Updated**: January 9, 2026



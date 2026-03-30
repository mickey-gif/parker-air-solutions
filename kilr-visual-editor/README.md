# KILR Visual Editor

Visual drag-and-drop editor for KILR websites, powered by [GrapesJS Studio SDK](https://app.grapesjs.com/docs-sdk/overview/getting-started).

## Edit your projects

1. **Run the editor**: `npm run dev` → open http://localhost:5173/
2. **Pick a project** in the toolbar dropdown (or use `?project=kilr-studios-v2` in the URL)
3. **Edit** – drag blocks, use the layer panel, adjust styles
4. **Export** – click **Export** to download `index.html` (replace the project file manually)

### How it works

```
┌─────────────────────────────────────────────────────────────────┐
│ Project Select → fetch /projects/{id}/index.html + css/custom.css │
│                       ↓                                          │
│ Parse HTML → inject framework + custom CSS → load into editor     │
│                       ↓                                          │
│ Edit in Studio (blocks, layers, styles)                          │
│                       ↓                                          │
│ Export → studio:projectFiles → download index.html               │
└─────────────────────────────────────────────────────────────────┘
```

- Projects are served from `public/projects` (symlink to `../../projects`)
- Edits are autosaved to `sessionStorage` until you export
- Export produces a single HTML file with inline styles

## License

- **Localhost**: Works without a license
- **Public domain**: Create a license at [app.grapesjs.com](https://app.grapesjs.com/dashboard/sdk/licenses) and add `licenseKey: 'your-key'` in `main.js`

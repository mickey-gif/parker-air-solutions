import createStudioEditor from '@grapesjs/studio-sdk';
import '@grapesjs/studio-sdk/style';

const STORAGE_KEY = 'kilr-editor-project';
const PROJECTS = ['kilr-studios', 'kilr-studios-v2', 'kilr-studios_v1', 'lms-electrical'];

function getProjectFromUrl() {
  const params = new URLSearchParams(location.search);
  return params.get('project') || sessionStorage.getItem('kilr-editor-current-project');
}

function setProjectInUrl(projectId) {
  sessionStorage.setItem('kilr-editor-current-project', projectId);
  const url = new URL(location.href);
  url.searchParams.set('project', projectId);
  history.replaceState({}, '', url);
}

/** Fetch project HTML and build GrapesJS-compatible component with styles */
async function loadProjectHtml(projectId) {
  const base = `/projects/${projectId}`;
  const baseHref = `${location.origin}/projects/${projectId}/`;
  const [htmlRes, varsRes, cssRes] = await Promise.all([
    fetch(`${base}/index.html`),
    fetch(`${base}/css/variables.css`).catch(() => null),
    fetch(`${base}/css/custom.css`).catch(() => null),
  ]);
  if (!htmlRes.ok) throw new Error(`Project "${projectId}" not found`);
  const html = await htmlRes.text();
  const varsCss = varsRes?.ok ? await varsRes.text() : '';
  const customCss = cssRes?.ok ? await cssRes.text() : '';

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const body = doc.body;

  // Rewrite asset paths to be absolute from server root
  const rewritePaths = (el, attr) => {
    el.querySelectorAll(`[${attr}]`).forEach((node) => {
      const val = node.getAttribute(attr);
      if (!val || val.startsWith('http') || val.startsWith('data:') || val.startsWith('/')) return;
      const baseDir = baseHref;
      const resolved = new URL(val, baseHref).pathname;
      node.setAttribute(attr, resolved);
    });
  };
  rewritePaths(body, 'href');
  rewritePaths(body, 'src');

  const bodyHtml = body.innerHTML;

  const styleBlock = [
    varsCss  ? `<style>/* variables.css */\n${varsCss}</style>`   : '',
    customCss ? `<style>/* custom.css */\n${customCss}</style>`   : '',
  ].filter(Boolean).join('\n');

  return `${styleBlock}
<link rel="stylesheet" href="/framework/dist/kilr-framework.css">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,700;1,9..40,400&display=swap" rel="stylesheet">
<base href="${baseHref}">
${bodyHtml}`;
}

async function initEditor() {
  const projectId = getProjectFromUrl();
  let initialProject = null;

  if (projectId && PROJECTS.includes(projectId)) {
    setProjectInUrl(projectId);
    try {
      const component = await loadProjectHtml(projectId);
      initialProject = {
        pages: [{ name: 'Home', component }],
      };
    } catch (e) {
      console.warn('Could not load project, using default:', e);
    }
  }

  const defaultProject = {
    pages: [
      { name: 'Home', component: '<h1>Home page</h1>' },
      { name: 'About', component: '<h1>About page</h1>' },
      { name: 'Contact', component: '<h1>Contact page</h1>' },
    ],
  };

  createStudioEditor({
    licenseKey: '',
    root: '#editor-root',
    project: {
      type: 'web',
      default: defaultProject,
    },
    storage: {
      type: 'self',
      autosaveChanges: 5,
      ...(initialProject && { project: initialProject }),
      ...(!initialProject && {
        onLoad: async () => {
          const stored = sessionStorage.getItem(STORAGE_KEY);
          if (stored) {
            try {
              return { project: JSON.parse(stored) };
            } catch (_) {}
          }
          return { project: defaultProject };
        },
      }),
      onSave: async ({ project }) => {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(project));
      },
    },
    onEditor: (editor) => {
      window.__kilrEditor = editor;
      setupToolbar(editor);
    },
  });
}

function setupToolbar(editor) {
  const select = document.getElementById('project-select');
  const exportBtn = document.getElementById('export-btn');
  const currentProject = getProjectFromUrl();

  if (select) {
    select.value = currentProject || '';
    select.addEventListener('change', () => {
      const project = select.value || null;
      const url = new URL(location.href);
      if (project) {
        url.searchParams.set('project', project);
      } else {
        url.searchParams.delete('project');
      }
      sessionStorage.removeItem(STORAGE_KEY);
      location.href = url.toString();
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      try {
        const files = await editor.runCommand('studio:projectFiles', { styles: 'inline' });
        const htmlFile = files?.find((f) => f.mimeType === 'text/html');
        if (htmlFile) {
          const blob = new Blob([htmlFile.content], { type: 'text/html' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = htmlFile.name || 'index.html';
          a.click();
          URL.revokeObjectURL(a.href);
        }
      } catch (e) {
        console.error('Export failed:', e);
      }
    });
  }
}

initEditor();

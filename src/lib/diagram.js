// src/lib/diagram.js — client-side learning diagrams via Mermaid.
//
// Mermaid is LAZY-LOADED through a dynamic import() so it never sits in the main
// bundle — the ~500KB engine is fetched as its own chunk only when a diagram is
// actually drawn. Diagrams are theme-aware: colors are read from the live CSS
// tokens (--text-primary / --accent / --rule / surfaces), so they match light
// and dark and never hardcode hex. The model returns Mermaid ONLY; we validate
// with mermaid.parse before rendering and the caller falls back to a text
// outline on a parse error rather than showing a broken diagram.

let _mermaid = null;
async function getMermaid() {
  if (_mermaid) return _mermaid;
  const mod = await import('mermaid');
  _mermaid = mod.default || mod;
  return _mermaid;
}

// Read a CSS custom property's computed value off :root, with a fallback so a
// diagram still renders if a token is missing (e.g. in a test harness).
function tok(name, fallback) {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  } catch { return fallback; }
}

// The diagram families we ask the model to choose from.
export const DIAGRAM_KINDS = ['flowchart', 'sequenceDiagram', 'mindmap', 'timeline', 'quadrantChart'];

// Strip code fences and any stray prose; keep from the first Mermaid keyword on.
export function cleanMermaid(raw) {
  let s = String(raw || '').replace(/```(?:mermaid)?/gi, '').trim();
  const m = s.match(/(?:flowchart|graph|sequenceDiagram|mindmap|timeline|quadrantChart|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|gitGraph)\b[\s\S]*/i);
  return stripMermaidColors((m ? m[0] : s).trim());
}

// Enforcement (not just prompting, same pattern as capTierMarkers): a model emits
// literal hex — `style N fill:#c0392b`, `classDef … stroke:#27ae60` — which doesn't
// theme and violates the token rule. Strip every color directive so the app's
// theme-aware `themeVariables` govern the palette. Removes whole
// classDef/style/linkStyle lines, `:::class` assignments, and any leftover inline
// `fill/stroke/color:#hex`.
export function stripMermaidColors(s) {
  return String(s || '')
    .split('\n')
    .filter((l) => !/^\s*(classDef|style|linkStyle)\b/i.test(l))
    .join('\n')
    .replace(/:::[A-Za-z0-9_-]+/g, '')
    .replace(/\b(fill|stroke|color|background)\s*:\s*#[0-9a-fA-F]{3,8}\b/gi, '')
    .replace(/#[0-9a-fA-F]{6}\b/g, '') // any leftover 6-digit hex (model's format)
    .trim();
}

function themeVars() {
  return {
    fontFamily: 'inherit',
    // Never below --fs-sm; on mobile the container scrolls rather than shrinking.
    fontSize: '14px',
    background: tok('--bg', '#ffffff'),
    primaryColor: tok('--surface', '#f4f4f5'),
    primaryTextColor: tok('--text-primary', '#111111'),
    primaryBorderColor: tok('--rule', '#cccccc'),
    secondaryColor: tok('--surf2', tok('--surface', '#eeeeee')),
    tertiaryColor: tok('--surface', '#fafafa'),
    lineColor: tok('--accent', '#2563eb'),
    textColor: tok('--text-primary', '#111111'),
    nodeBorder: tok('--rule', '#cccccc'),
    mainBkg: tok('--surface', '#f4f4f5'),
    clusterBkg: tok('--bg', '#ffffff'),
    clusterBorder: tok('--rule', '#cccccc'),
    titleColor: tok('--text-primary', '#111111'),
    actorBorder: tok('--rule', '#cccccc'),
    actorBkg: tok('--surface', '#f4f4f5'),
    noteBkgColor: tok('--surf2', '#eeeeee'),
    noteTextColor: tok('--text-primary', '#111111'),
  };
}

// Validate is separate so callers can decide before committing to render.
// Returns true if the syntax parses.
export async function validateMermaid(code) {
  const clean = cleanMermaid(code);
  if (!clean) return false;
  try {
    const mermaid = await getMermaid();
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'base', themeVariables: themeVars() });
    await mermaid.parse(clean);
    return true;
  } catch { return false; }
}

// Render to an SVG string. Returns { ok:true, svg, code } or { ok:false, error }.
// Re-initializes with the current theme tokens every call, so a theme toggle +
// re-render redraws in the new palette.
export async function renderMermaid(id, code) {
  const clean = cleanMermaid(code);
  if (!clean) return { ok: false, error: 'empty' };
  try {
    const mermaid = await getMermaid();
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'base', themeVariables: themeVars() });
    await mermaid.parse(clean);                       // throws on invalid syntax
    const { svg } = await mermaid.render(id, clean);
    return { ok: true, svg, code: clean };
  } catch (e) {
    return { ok: false, error: e?.message || 'render failed' };
  }
}

// Deterministic text-outline fallback from the source content — shown when the
// model can't produce renderable Mermaid, so the user still gets structure.
export function toOutline(content) {
  const text = String(content || '').replace(/```[\s\S]*?```/g, ' ').trim();
  const lines = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const h = line.match(/^#{1,6}\s+(.*)$/);
    if (h) { lines.push({ depth: 0, text: h[1].replace(/[*_`]/g, '').trim() }); continue; }
    const b = line.match(/^([-*•]|\d+[.)])\s+(.*)$/);
    if (b) { lines.push({ depth: 1, text: b[2].replace(/[*_`]/g, '').trim().slice(0, 120) }); continue; }
  }
  const picked = lines.slice(0, 14);
  if (!picked.length) {
    // No structure to mine — first few sentences.
    return text.split(/(?<=[.!?])\s+/).slice(0, 5).map((s) => `• ${s.trim()}`).join('\n');
  }
  return picked.map((l) => (l.depth === 0 ? l.text : `  • ${l.text}`)).join('\n');
}

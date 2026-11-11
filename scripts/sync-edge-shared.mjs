#!/usr/bin/env node
// scripts/sync-edge-shared.mjs — keeps supabase/functions/_shared/ byte-identical to
// the app's single sources, so the Edge Functions run the SAME code as Vercel:
//   api/_kv.js                  → _shared/kv.js            (the kv PostgREST client)
//   prompts/prompts.generated.js→ _shared/prompts.generated.js (LENS, SUBJECT_FIDELITY, packs)
//   api/_providers.js MODELS    → _shared/models.generated.js  (model ids live in ONE place)
// Edge Functions can't import outside their bundle, so these are copies — but
// generated, never hand-edited. `--check` (in npm run build) fails if any drifted.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SHARED = path.join(ROOT, 'supabase/functions/_shared');
const HEADER = (src) => `// GENERATED from ${src} by scripts/sync-edge-shared.mjs — DO NOT EDIT.\n`;
const { MODELS } = await import(path.join(ROOT, 'api/_providers.js'));

const files = {
  'kv.js': HEADER('api/_kv.js') + fs.readFileSync(path.join(ROOT, 'api/_kv.js'), 'utf8'),
  'prompts.generated.js': HEADER('prompts/prompts.generated.js') + fs.readFileSync(path.join(ROOT, 'prompts/prompts.generated.js'), 'utf8'),
  'models.generated.js': HEADER('api/_providers.js MODELS') + `export const MODELS = ${JSON.stringify(MODELS, null, 2)};\n`,
};

const check = process.argv.includes('--check');
let stale = [];
for (const [name, body] of Object.entries(files)) {
  const p = path.join(SHARED, name);
  if (check) { if (!fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== body) stale.push(name); }
  else fs.writeFileSync(p, body);
}
if (check && stale.length) { console.error(`supabase/functions/_shared out of sync: ${stale.join(', ')} — run node scripts/sync-edge-shared.mjs`); process.exit(1); }
console.log(check ? 'sync-edge-shared: up to date' : `sync-edge-shared: wrote ${Object.keys(files).length} files`);

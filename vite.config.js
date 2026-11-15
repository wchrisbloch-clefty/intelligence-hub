import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'

// Build id = git SHA, so a ?debug=1 Copy report names exactly what was running.
// Vercel exposes VERCEL_GIT_COMMIT_SHA (the .git dir isn't always present there).
function buildId() {
  const v = process.env.VERCEL_GIT_COMMIT_SHA;
  if (v) return v.slice(0, 7);
  try { return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); }
  catch { return 'unknown'; }
}

export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_ID__: JSON.stringify(buildId()),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString().replace(/\.\d+Z$/, 'Z')),
  },
})

import { defineConfig, searchForWorkspaceRoot } from 'vite';
import react from '@vitejs/plugin-react';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Local test harness only. In SharePoint the same src/ is built by the SPFx toolchain.

const devDir: string = fileURLToPath(new URL('.', import.meta.url));
const projectDir: string = resolve(devDir, '..');

// The node_modules folder Vite was installed in: the project's own, or the shared
// one in the SharePoint workspace folder (e.g. <workspace>/node_modules).
const nodeModulesDir: string = dirname(dirname(createRequire(import.meta.url).resolve('vite/package.json')));
const workspaceDir: string = dirname(nodeModulesDir);

export default defineConfig({
  root: devDir,
  // Keep the cache in the shared node_modules, so no local node_modules is created in the project.
  cacheDir: resolve(nodeModulesDir, '.vite', 'assurance-learning-calendar'),
  plugins: [react()],
  resolve: {
    // One React copy, even if other workspace projects use a different version.
    dedupe: ['react', 'react-dom']
  },
  css: {
    modules: {
      localsConvention: 'camelCaseOnly',
      generateScopedName: '[local]_[hash:base64:6]'
    },
    preprocessorOptions: {
      scss: { api: 'modern-compiler' }
    }
  },
  server: {
    port: 5173,
    open: false,
    fs: {
      // src/ lives outside the Vite root (dev/), and node_modules may be in the workspace folder.
      allow: [projectDir, workspaceDir, searchForWorkspaceRoot(projectDir)]
    }
  },
  build: {
    outDir: resolve(projectDir, 'dist-local'),
    emptyOutDir: true
  }
});

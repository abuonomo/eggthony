import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        // gear_editor is dev-only, excluded from prod by not being in the default input
      },
    },
  },
  server: {
    // Serve tools/ directory so gear editor is accessible at /tools/gear_editor.html
    fs: {
      allow: ['.'],
    },
  },
});

import { defineConfig } from 'vite';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const desktopNodeModules = path.resolve(__dirname, './node_modules');

export default defineConfig({
  envDir: path.resolve(__dirname, '../../'),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: '@openclaw-ui', replacement: path.resolve(__dirname, '../../../openclaw/ui/src') },
      { find: '@', replacement: path.resolve(__dirname, './src') },
      { find: /^lit$/, replacement: path.resolve(desktopNodeModules, 'lit/index.js') },
      { find: /^lit\/(.*)$/, replacement: path.resolve(desktopNodeModules, 'lit/$1') },
      {
        find: /^dompurify$/,
        replacement: path.resolve(desktopNodeModules, 'dompurify/dist/purify.es.mjs'),
      },
      {
        find: /^marked$/,
        replacement: path.resolve(desktopNodeModules, 'marked/lib/marked.esm.js'),
      },
      {
        find: /^@noble\/ed25519$/,
        replacement: path.resolve(desktopNodeModules, '@noble/ed25519/index.js'),
      },
    ],
  },
  server: {
    fs: {
      allow: [
        path.resolve(__dirname, '../../'),
        path.resolve(__dirname, '../../../openclaw'),
      ],
    },
  },
});

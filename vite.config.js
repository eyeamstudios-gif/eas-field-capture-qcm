import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: false,
  server: {
    port: 8080,
    open: false,
  },
  preview: {
    port: 4173,
  },
});

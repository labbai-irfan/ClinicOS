import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    // Capacitor's WebView loads the built app from a native shell — during native
    // development the dev server must still be reachable from a device/emulator.
    host: true,
  },
  build: {
    sourcemap: true,
  },
});

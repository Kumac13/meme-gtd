import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const apiPort = process.env.VITE_API_PORT || '3000';
  const webPort = process.env.VITE_WEB_PORT || '5173';

  return {
    plugins: [react()],
    server: {
      port: parseInt(webPort, 10),
      proxy: {
        '/api': {
          target: `http://localhost:${apiPort}`,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './tests/setup.ts',
    },
  };
});

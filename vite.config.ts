import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'unikorn360-backend-middleware',
        configureServer(server) {
          if (command === 'serve') {
            import('./backend/server.ts')
              .then(({ default: backendApp }) => {
                server.middlewares.use((req, res, next) => {
                  if (req.url && (req.url.startsWith('/api') || req.url.startsWith('/ai'))) {
                    return backendApp(req as any, res as any, next);
                  }
                  next();
                });
                console.log('Backend server mounted successfully in Vite dev middleware');
              })
              .catch((err) => {
                console.error('Failed to mount backend server in Vite dev middleware:', err);
              });
          }
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true,
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    preview: {
      allowedHosts: true,
    },
  };
});


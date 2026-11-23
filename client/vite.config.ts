import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import path from 'node:path';

// The site's Content-Security-Policy, written into the built index.html as a <meta> (Caddy only serves
// the files). It is made here because the inline script in index.html is allowed by its hash, which
// must follow every change to that script. Only for the build: the dev server injects scripts of its own.
// Header-only parts (frame-ancestors) are covered by Caddy's X-Frame-Options.
function contentSecurityPolicy(apiBase: string): Plugin {
  return {
    name: 'lovestory-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const inlineScripts = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)];
        const hashes = inlineScripts.map((m) => `'sha256-${createHash('sha256').update(m[1]!).digest('base64')}'`);
        // VITE_API_BASE is normally the same-origin "/api"; an absolute one must be reachable too.
        const apiOrigin = /^https?:\/\//.test(apiBase) ? new URL(apiBase).origin : '';
        const policy = [
          "default-src 'self'",
          ['script-src', "'self'", ...hashes].join(' '),
          // MUI (emotion) adds <style> tags at runtime; Google Fonts serves the stylesheets of the fonts.
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' data: https://fonts.gstatic.com",
          // Photos may come from S3/CloudFront later, the placeholder splash from Unsplash, previews are blobs.
          "img-src 'self' data: blob: https:",
          `connect-src 'self'${apiOrigin ? ` ${apiOrigin}` : ''}`,
          // The map on the home page (settings.schema.ts allows only Google Maps embeds).
          'frame-src https://www.google.com https://maps.google.com https://google.com',
          // The HEIC converter (admin) runs in a worker made from a blob.
          "worker-src 'self' blob:",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join('; ');
        // Right after the charset (which must come first), before any script it governs.
        const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}" />`;
        return /<meta charset[^>]*>/i.test(html)
          ? html.replace(/(<meta charset[^>]*>)/i, `$1\n    ${meta}`)
          : html.replace(/<head>/i, `<head>\n    ${meta}`);
      },
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), contentSecurityPolicy(loadEnv(mode, __dirname, 'VITE_').VITE_API_BASE ?? '/api')],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  css: {
    preprocessorOptions: {
      scss: {
        // Modules import tokens explicitly via: @use '@/styles/tokens' as t;
        api: 'modern-compiler',
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      // Photos uploaded from the admin (STORAGE_DRIVER=local) are served by the API.
      '/uploads': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          mui: ['@mui/material', '@mui/icons-material'],
        },
      },
    },
  },
}));

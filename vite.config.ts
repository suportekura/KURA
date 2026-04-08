import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'placeholder.svg', 'apple-icons/*.png'],
      manifest: {
        name: 'Kura - Brechó Online',
        short_name: 'Kura',
        description: 'Descubra peças únicas perto de você!',
        theme_color: '#5a7a32',
        background_color: '#f7f5f0',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/apple-icons/apple-touch-icon-180x180.png',
            sizes: '180x180',
            type: 'image/png',
          },
          {
            src: '/apple-icons/apple-touch-icon-167x167.png',
            sizes: '167x167',
            type: 'image/png',
          },
          {
            src: '/apple-icons/apple-touch-icon-152x152.png',
            sizes: '152x152',
            type: 'image/png',
          },
          {
            src: '/apple-icons/apple-touch-icon-120x120.png',
            sizes: '120x120',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/~oauth/],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24,
              },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));

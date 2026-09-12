import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      registerType: "autoUpdate",

      includeAssets: [
        "favicon.png",
        "favicon-32x32.png",
        "apple-touch-icon.png",
      ],

      manifest: {
        name: "MoneyTrack",
        short_name: "MoneyTrack",

        description:
          "Aplicación web para gestionar ingresos, gastos y metas financieras.",

        start_url: "/",
        scope: "/",

        display: "standalone",

        theme_color: "#081631",
        background_color: "#081631",

        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
        ],
      },

      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: "/index.html",

        /*
         * El Service Worker generado por Workbox
         * importa este archivo adicional para
         * recibir notificaciones Web Push.
         */
        importScripts: [
          "push-sw.js",
        ],

        globPatterns: [
          "**/*.{js,css,html,ico,png,svg,woff,woff2}",
        ],

        /*
         * Bootstrap Icons agrega un identificador
         * en la URL de sus fuentes, por ejemplo:
         *
         * bootstrap-icons.woff2?dd6703...
         *
         * Lo ignoramos al buscar el archivo
         * dentro del precache.
         */
        ignoreURLParametersMatching: [
          /^utm_/,
          /^fbclid$/,
          /^dd[0-9a-f]+$/,
        ],

        /*
         * Respaldo adicional para cualquier
         * fuente utilizada por MoneyTrack.
         */
        runtimeCaching: [
          {
            urlPattern: ({
              request,
            }) =>
              request.destination ===
              "font",

            handler: "CacheFirst",

            options: {
              cacheName:
                "moneytrack-fonts-v1",

              expiration: {
                maxEntries: 20,
                maxAgeSeconds:
                  60 *
                  60 *
                  24 *
                  365,
              },

              cacheableResponse: {
                statuses: [
                  0,
                  200,
                ],
              },
            },
          },
        ],
      },
    }),
  ],
});

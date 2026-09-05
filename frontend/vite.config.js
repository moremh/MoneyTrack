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
      },
    }),
  ],
});
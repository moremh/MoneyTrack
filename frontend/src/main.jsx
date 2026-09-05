import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

import App from "./App";

import AuthProvider from "./context/AuthContext";
import FinanceProvider from "./context/FinanceContext";

import "./styles/reset.css";
import "./styles/variables.css";
import "./styles/global.css";

import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";

const UPDATE_INTERVAL_MS = 60 * 60 * 1000;

let updateServiceWorker = () => {};

updateServiceWorker = registerSW({
  immediate: true,

  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;

    const checkForUpdates = async () => {
      if (!navigator.onLine) return;

      if (registration.installing) return;

      try {
        await registration.update();
      } catch (error) {
        console.warn(
          "MoneyTrack no pudo comprobar si hay una actualización disponible:",
          error
        );
      }
    };

    // Comprobar al abrir MoneyTrack
    checkForUpdates();

    // Comprobar una vez por hora
    window.setInterval(
      checkForUpdates,
      UPDATE_INTERVAL_MS
    );

    // Comprobar cuando vuelve internet
    window.addEventListener(
      "online",
      checkForUpdates
    );

    // Comprobar cuando el usuario vuelve a la app
    document.addEventListener(
      "visibilitychange",
      () => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          checkForUpdates();
        }
      }
    );
  },

  onNeedRefresh() {
    // Instala la nueva versión y recarga MoneyTrack
    updateServiceWorker(true);
  },

  onRegisterError(error) {
    console.error(
      "No se pudo registrar el Service Worker de MoneyTrack:",
      error
    );
  },
});

ReactDOM.createRoot(
  document.getElementById("root")
).render(
  <React.StrictMode>
    <AuthProvider>
      <FinanceProvider>
        <App />
      </FinanceProvider>
    </AuthProvider>
  </React.StrictMode>
);
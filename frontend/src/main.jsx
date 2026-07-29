import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

import AuthProvider from "./context/AuthContext";
import FinanceProvider from "./context/FinanceContext";

import "./styles/reset.css";
import "./styles/variables.css";
import "./styles/global.css";

import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <FinanceProvider>
        <App />
      </FinanceProvider>
    </AuthProvider>
  </React.StrictMode>
);
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import App from "./App.jsx";
import { WalletProvider } from "./context/WalletContext.jsx";
import log from "./utils/logger.js";
import "./index.css";

// ── Boot activity logger ────────────────────────────────────────────────────
log.boot();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <WalletProvider>
        <App />

        {/* Toast notifications */}
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 5000,
            style: {
              background: "rgba(15,15,26,0.95)",
              color: "#e2e8f0",
              border: "1px solid rgba(99,102,241,0.25)",
              backdropFilter: "blur(20px)",
              borderRadius: "0.75rem",
              fontSize: "0.875rem",
              maxWidth: "400px",
            },
            success: {
              iconTheme: { primary: "#10b981", secondary: "#0a0a12" },
            },
            error: {
              iconTheme: { primary: "#ef4444", secondary: "#0a0a12" },
            },
            loading: {
              iconTheme: { primary: "#6366f1", secondary: "#0a0a12" },
            },
          }}
        />
      </WalletProvider>
    </BrowserRouter>
  </React.StrictMode>
);

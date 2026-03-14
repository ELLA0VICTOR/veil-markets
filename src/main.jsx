import "./polyfills.js";
import React from "react";
import ReactDOM from "react-dom/client";
import AppProviders from "./AppProviders";
import "./index.css";
import "@solana/wallet-adapter-react-ui/styles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppProviders />
  </React.StrictMode>
);

import React from "react";
import ReactDOM from "react-dom/client";
import { OptionsPage } from "./OptionsPage";
import "../styles/theme.css";
import "./options.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <OptionsPage />
  </React.StrictMode>
);

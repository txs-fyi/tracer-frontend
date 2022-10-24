import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { HomePage } from "./pages/HomePage";
import { TracePage } from "./pages/TracePage";
import reportWebVitals from "./reportWebVitals";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { GeistProvider, CssBaseline } from "@geist-ui/core";

import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  // <React.StrictMode>
    <GeistProvider themeType="light">
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="tx/:txhash" element={<TracePage />} />
        </Routes>
      </BrowserRouter>
    </GeistProvider>
  // </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

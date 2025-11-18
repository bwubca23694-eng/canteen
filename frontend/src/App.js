// src/App.js
import React from "react";
import { Routes, Route } from "react-router-dom";

import Dashboard from "./components/Owner/Dashboard";
import OrderPreview from "./pages/OrderPreview";
import PaymentPage from "./pages/PaymentPage";

import "./App.css";

export default function App() {
  return (
    <Routes>
      {/* Customer payment page, tableId optional */}
      <Route path="/payment/:tableId?" element={<PaymentPage />} />

      {/* Customer landing / preview */}
      <Route path="/" element={<OrderPreview />} />

      {/* Owner Dashboard */}
      <Route path="/dashboard" element={<Dashboard />} />
    </Routes>
  );
}

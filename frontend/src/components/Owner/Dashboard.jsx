// src/components/Owner/Dashboard.jsx
import React, { useState } from "react";
import ItemSection from "./ItemSection";
import OrderSection from "./OrderSection";
import RevenueSection from "./RevenueSection";
import "../../App.css";

const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function Dashboard() {
  const [active, setActive] = useState("Orders");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [age, setAge] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const menu = [
    { id: "Orders", label: "Orders", icon: "orders" },
    { id: "Items", label: "Items", icon: "items" },
    { id: "Revenue", label: "Revenue", icon: "revenue" },
  ];

  // Send update request
  async function updateOwner(e) {
    e.preventDefault();
    setMsg(null);

    if (!age.trim() || !password.trim()) {
      setMsg("Both fields are required.");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch(`${BASE_URL}/api/owner/update`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ age, password })
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Failed to update");

      setMsg("Updated successfully!");
      setTimeout(() => {
        setShowModal(false);
        setMsg(null);
      }, 1200);
    } catch (err) {
      setMsg(err.message || "Error updating");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-shell ios-shell">
      {/* LEFT SIDEBAR */}
      <aside className="app-sidebar ios-sidebar" aria-label="Main navigation">
        <div className="sidebar-top">
          <div className="logo">
            <div className="logo-text">BWU Canteen</div>
            <div className="logo-badge">Owner</div>
          </div>
          <div className="sidebar-desc">Manage orders, menu & reports</div>
        </div>

        <nav aria-label="Primary" className="sidebar-nav ios-nav">
          {menu.map((m) => (
            <button
              key={m.id}
              className={`nav-button ${active === m.id ? "active" : ""}`}
              onClick={() => setActive(m.id)}
              aria-current={active === m.id ? "page" : undefined}
            >
              <span className="nav-icon" aria-hidden>
                {m.icon === "orders" && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="4" width="18" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                    <rect x="3" y="10" width="18" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                    <rect x="3" y="16" width="10" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                )}
                {m.icon === "items" && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M12 3l7 4v6l-7 4-7-4V7l7-4z" stroke="currentColor" strokeWidth="1.4" fill="none" />
                  </svg>
                )}
                {m.icon === "revenue" && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2v20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M5 12h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                )}
              </span>

              <span className="nav-label">{m.label}</span>

              {active === m.id && <span className="nav-dot" aria-hidden>●</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer ios-sidebar-footer">
          <div className="small-muted">Signed in as</div>
          <div className="user-name">Aditya Mondal</div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="app-main ios-main">
        <header className="topbar ios-topbar">
          <div className="top-left">
            <h1 className="page-title">Owner Dashboard</h1>
            <div className="page-sub">Welcome back — manage your canteen smoothly</div>
          </div>

          <div className="top-actions ios-top-actions">
            <button className="btn ios-btn">Notifications</button>
            <button 
              className="btn btn-primary ios-btn-primary"
              onClick={() => setShowModal(true)}
            >
              Update Password
            </button>
          </div>
        </header>

        {/* CONTENT SHELL */}
        <div className="ios-content">
          <div className="content-card">
            {active === "Orders" && <OrderSection />}
            {active === "Items" && <ItemSection />}
            {active === "Revenue" && <RevenueSection />}
          </div>
        </div>
      </div>

      {/* UPDATE PASSWORD MODAL */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h2>Update Owner Details</h2>

            {msg && <div className="modal-msg">{msg}</div>}

            <form onSubmit={updateOwner} className="modal-form">
              <label>
                Age
                <input 
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  required
                />
              </label>

              <label>
                New Password
                <input 
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>

              <div className="modal-actions">
                <button 
                  type="button"
                  className="btn cancel"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>

                <button 
                  type="submit"
                  className="btn save"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

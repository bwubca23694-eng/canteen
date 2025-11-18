// src/pages/OrderPreview.jsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";

const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
const POLL_MS = 8000;

export default function OrderPreview() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]); // items to render

  // read cart from localStorage safely
  function readCart() {
    try {
      const raw = localStorage.getItem("cart");
      if (!raw) return [];
      return JSON.parse(raw);
    } catch (e) {
      return [];
    }
  }

  // initialize cart from localStorage so it's persisted across navigations
  const [cart, setCart] = useState(() => readCart()); // { itemId, name, price, qty, image }
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const mountedRef = useRef(true);
  const { tableId } = useParams();

  // -----------------------
  // Login modal state
  // -----------------------
  const [loginOpen, setLoginOpen] = useState(false);
  const [age, setAge] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState(null);

  // Navigate to payment and pass cart + total (and optional tableId) via router state
  function goToPayment() {
    navigate(`/payment/${tableId || ""}`, {
      state: {
        cart,
        total,
        tableId: tableId || ""
      }
    });
  }

  // persist cart to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem("cart", JSON.stringify(cart));
    } catch (e) {
      console.warn("Failed to persist cart to localStorage", e);
    }
  }, [cart]);

  // debug helper: logs with prefix
  function log(...args) { console.debug("[OrderPreview]", ...args); }

  // fetch items (customer view)
  async function fetchItems() {
    try {
      const res = await fetch(`${BASE_URL}/api/items`, { cache: "no-store" });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (err) {
        // If server returned non-JSON, show text for debugging
        log("Non-JSON response from /api/items:", text);
        return { ok: false, data: null, status: res.status, raw: text };
      }
      log("Fetch /api/items response:", data);
      return { ok: res.ok, data, status: res.status };
    } catch (err) {
      console.error("fetchItems error:", err);
      return { ok: false, data: null, error: err };
    }
  }

  // process latest items and remove unavailable ones from cart
  function processLatest(latest) {
    if (!Array.isArray(latest)) {
      // handle case server returned a single object
      if (latest && typeof latest === "object") latest = [latest];
      else latest = [];
    }

    setItems(latest);

    // remove cart entries that are no longer available
    const allowed = new Set(latest.map(i => i._id));
    const removed = cart.filter(c => !allowed.has(c.itemId));
    if (removed.length > 0) {
      setCart(prev => prev.filter(c => allowed.has(c.itemId)));
      const names = removed.map(r => r.name).join(", ");
      setNotice(`${names} removed from cart (now unavailable)`);
      setTimeout(() => setNotice(null), 5000);
    }
  }

  // initial load + polling
  useEffect(() => {
    mountedRef.current = true;
    let intervalId = null;

    async function load() {
      setLoading(true);
      const r = await fetchItems();
      if (!mountedRef.current) return;
      if (r.ok) processLatest(r.data);
      else {
        // if data is present but r.ok false, still try to process it
        if (r.data) processLatest(r.data);
        else {
          log("Failed to load /api/items:", r);
        }
      }
      setLoading(false);

      // start polling
      intervalId = setInterval(async () => {
        const rr = await fetchItems();
        if (!mountedRef.current) return;
        if (rr.ok) processLatest(rr.data);
        else if (rr.data) processLatest(rr.data);
      }, POLL_MS);
    }

    load();

    return () => {
      mountedRef.current = false;
      if (intervalId) clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once

  // cart helpers
  function findCart(itemId) {
    return cart.find(c => c.itemId === itemId);
  }

  function addToCart(item, n = 1) {
    setCart(prev => {
      const ex = prev.find(p => p.itemId === item._id);
      if (ex) return prev.map(p => p.itemId === item._id ? { ...p, qty: p.qty + n } : p);
      return [{ itemId: item._id, name: item.name, price: Number(item.price), qty: n, image: item.image || null }, ...prev];
    });
  }

  function decItem(itemId) {
    setCart(prev => {
      const ex = prev.find(p => p.itemId === itemId);
      if (!ex) return prev;
      if (ex.qty <= 1) return prev.filter(p => p.itemId !== itemId);
      return prev.map(p => p.itemId === itemId ? { ...p, qty: p.qty - 1 } : p);
    });
  }

  const total = cart.reduce((s, p) => s + p.price * p.qty, 0);

  function handlePay() {
    if (cart.length === 0) return alert("Cart is empty.");
    // next: hook to POST /api/orders
    const summary = cart.map(c => `${c.name} x${c.qty}`).join("\n");
    alert(`Order (demo):\n${summary}\nTotal: ₹${total}`);
  }

  // Render helpers
  const qtyFor = id => (findCart(id) ? findCart(id).qty : 0);

  // -----------------------
  // Login flow
  // -----------------------
  function openLoginModal() {
    setLoginError(null);
    setAge("");
    setPassword("");
    setLoginOpen(true);
  }

  async function submitLogin(e) {
    e.preventDefault();
    setLoginError(null);

    if (!age || !password) {
      setLoginError("Please enter age and password.");
      return;
    }

    setLoginLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/owner/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ age: Number(age), password })
      });

      // if backend returns a JSON body with message, parse it
      let body = null;
      try { body = await res.json(); } catch (err) { /* ignore parse errors */ }

      if (!res.ok) {
        // Display meaningful backend message if available
        setLoginError((body && body.message) ? body.message : `Login failed (${res.status})`);
        setLoginLoading(false);
        return;
      }

      // success -> go to dashboard
      setLoginOpen(false);
      navigate("/dashboard");
    } catch (err) {
      console.error("Login error:", err);
      setLoginError("Network error — try again");
    } finally {
      setLoginLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#fff8ee" }}>
      {/* header — SINGLE click opens login modal */}
      <header
        style={{ background: "linear-gradient(180deg,#ffd98a,#ffd26a)", padding: 16, textAlign: "center", cursor: "pointer" }}
        onClick={openLoginModal}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter") openLoginModal(); }}
        aria-label="BWU CANTEEN — click to login as owner"
      >
        <div style={{ fontWeight: 800, fontSize: 20, color: "#111827" }}>BWU CANTEEN</div>
      </header>

      {/* transient notice */}
      {notice && <div style={{ padding: "8px 12px", background: "#fff6f6", color: "#7f1d1d", textAlign: "center" }}>{notice}</div>}

      <main style={{ padding: 14, maxWidth: 1000, margin: "0 auto", flex: "1 1 auto", width: "100%" }}>
        <h3 style={{ fontWeight: 800, marginBottom: 10 }}>Available Items</h3>

        {loading ? (
          <div style={{ color: "#6b7280" }}>Loading menu…</div>
        ) : !items || items.length === 0 ? (
          <div style={{ color: "#6b7280" }}>No items available right now.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
            {items.map(item => (
              <div key={item._id} style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 10px 24px rgba(16,24,40,0.06)", display: "flex", flexDirection: "column", minHeight: 260 }}>
                <div style={{ height: 150, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(180deg,#fff8f0,#fff1e6)" }}>
                  {item.image ? <img src={item.image} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ padding: 12, color: "#999", fontWeight: 700 }}>No image</div>}
                </div>

                <div style={{ margin: 12, background: "#fffbee", borderRadius: 10, padding: 10, display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid rgba(0,0,0,0.04)" }}>
                  <div style={{ fontWeight: 800, color: "#111827" }}>{item.name}</div>
                  <div style={{ color: "#6b7280", fontWeight: 700 }}>₹{item.price}</div>
                </div>

                <div style={{ margin: "0 12px 14px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button onClick={() => decItem(item._id)} style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid rgba(0,0,0,0.06)", background: "transparent", fontWeight: 800, cursor: "pointer" }} disabled={qtyFor(item._id) === 0}>−</button>
                    <div style={{ minWidth: 26, textAlign: "center", fontWeight: 800 }}>{qtyFor(item._id)}</div>
                    <button onClick={() => addToCart(item, 1)} style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid rgba(0,0,0,0.06)", background: "transparent", fontWeight: 800, cursor: "pointer" }}>＋</button>
                  </div>

                  <button onClick={() => addToCart(item, 1)} style={{ background: "#ff6a3d", color: "#fff", padding: "8px 12px", borderRadius: 10, border: "0", fontWeight: 800, cursor: "pointer" }}>
                    Add
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* cart strip */}
      <div style={{ padding: "8px 12px" }}>
        <div style={{ display: "flex", gap: 10, overflowX: "auto" }}>
          {cart.length === 0 ? <div style={{ color: "#6b7280" }}>Cart is empty</div> : cart.map((c) => (
            <div key={c.itemId} style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", padding: 8, borderRadius: 10, boxShadow: "0 6px 18px rgba(16,24,40,0.06)" }}>
              <div style={{ width: 44, height: 36 }}>
                {c.image ? <img src={c.image} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 6 }} /> : <div style={{ width: 44, height: 36, background: "linear-gradient(180deg,#fff7f3,#ffdcae)", borderRadius: 6 }} />}
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontWeight: 700 }}>{c.name}</div>
                <div style={{ color: "#6b7280" }}>x{c.qty}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <footer style={{ position: "sticky", bottom: 0, padding: 10, background: "transparent", borderTop: "1px solid rgba(16,24,40,0.03)" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", background: "linear-gradient(180deg,#fff,#fff)", padding: 12, borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 6px 24px rgba(16,24,40,0.04)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Total <strong>₹{total.toFixed(2)}</strong></div>
          </div>

          <div>
            <button
               className="pay-now-btn"
                onClick={goToPayment}
                      >
                Pay Now
            </button>

          </div>
        </div>
      </footer>

      {/* Login Modal */}
      {loginOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setLoginOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.32)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div className="modal-box" style={{ width: 360, background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Owner Login</h3>

            {loginError && (
              <div style={{ background: "#fff6f0", color: "#9b2c00", padding: "8px 10px", borderRadius: 8, marginBottom: 10 }}>
                {loginError}
              </div>
            )}

            <form onSubmit={submitLogin}>
              <label style={{ display: "block", marginBottom: 10 }}>
                Age
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  style={{ width: "100%", padding: 10, marginTop: 6, borderRadius: 8, border: "1px solid #e6eef6" }}
                  required
                />
              </label>

              <label style={{ display: "block", marginBottom: 10 }}>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ width: "100%", padding: 10, marginTop: 6, borderRadius: 8, border: "1px solid #e6eef6" }}
                  required
                />
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button type="button" className="btn cancel" onClick={() => setLoginOpen(false)} style={{ padding: "8px 12px", borderRadius: 8 }}>
                  Cancel
                </button>

                <button type="submit" className="btn save" disabled={loginLoading} style={{ padding: "8px 14px", background: "#ff4d30", color: "#fff", borderRadius: 8 }}>
                  {loginLoading ? "Checking..." : "Login"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

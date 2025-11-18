// src/pages/PaymentPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import "../App.css";
import "./PaymentPage.css";
import { useParams, useNavigate, useLocation } from "react-router-dom";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

function readCart() {
  try {
    const raw = localStorage.getItem("cart");
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

export default function PaymentPage({ tableId: initialTableId }) {
  const { tableId: paramTableId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [cart, setCart] = useState(() => readCart() || []);
  const [checked, setChecked] = useState({});
  const [upiQrUrl, setUpiQrUrl] = useState("");
  const [upiId, setUpiId] = useState("");
  const [upiLoading, setUpiLoading] = useState(false);
  const [upiError, setUpiError] = useState(null);

  const [screenshotFile, setScreenshotFile] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState(null);
  const [tableId, setTableId] = useState(initialTableId || paramTableId || "");
  const [placing, setPlacing] = useState(false);
  const [message, setMessage] = useState(null);
  const [successModal, setSuccessModal] = useState(false);
  const [itemsMap, setItemsMap] = useState({});
  const [loadingItems, setLoadingItems] = useState(false);

  // initialize checked map (select all by default) whenever cart changes
  useEffect(() => {
    const map = {};
    cart.forEach(i => { if (i._id) map[i._id] = true; });
    setChecked(map);
  }, [cart]);

  // accept router state cart
  useEffect(() => {
    const incoming = location && location.state && Array.isArray(location.state.cart) ? location.state.cart : null;
    if (incoming && incoming.length > 0) {
      const normalized = incoming.map(ci => ({
        _id: ci._id || ci.itemId || ci.id,
        name: ci.name,
        price: Number(ci.price || 0),
        qty: Number(ci.qty || 1),
        image: ci.image || null,
        ...ci
      }));

      setCart(normalized);
      try { localStorage.setItem("cart", JSON.stringify(normalized)); } catch {}
      const map = {};
      normalized.forEach(i => { if (i._id) map[i._id] = true; });
      setChecked(map);

      if (location.state && location.state.total !== undefined) {
        setMessage(`Order total loaded: ₹${Number(location.state.total).toFixed(2)}`);
        setTimeout(() => setMessage(null), 3000);
      }
      return;
    }

    // fallback localStorage already handled by initial state
  }, [location.key]); // update when location changes

  // fetch latest items and refresh cart (prices/availability)
  useEffect(() => {
    if (!cart || cart.length === 0) return;
    let mounted = true;
    async function fetchItems() {
      setLoadingItems(true);
      try {
        const res = await fetch(`${API}/api/items`);
        if (!res.ok) throw new Error("Failed to fetch items");
        const items = await res.json();
        if (!mounted) return;
        const map = {};
        items.forEach(it => { if (it._id) map[it._id] = it; });
        setItemsMap(map);

        // merge fresh data
        const merged = cart.map(ci => {
          const fresh = map[ci._id];
          if (fresh) {
            return {
              ...ci,
              name: fresh.name ?? ci.name,
              price: fresh.price ?? ci.price,
              image: fresh.image ?? ci.image,
              available: fresh.available !== undefined ? fresh.available : true
            };
          }
          return ci;
        }).filter(c => c.available !== false);

        if (JSON.stringify(merged) !== JSON.stringify(cart)) {
          setCart(merged);
          localStorage.setItem("cart", JSON.stringify(merged));
        }
      } catch (err) {
        console.warn("Could not refresh items:", err);
      } finally {
        if (mounted) setLoadingItems(false);
      }
    }
    fetchItems();
    return () => { mounted = false; };
  }, [cart]);

  // load payment QR from backend
  async function fetchPaymentQr() {
    setUpiLoading(true);
    setUpiError(null);
    try {
      const res = await fetch(`${API}/api/payment-qr`);
      if (res.status === 404) {
        setUpiQrUrl("");
        setUpiId("");
        return;
      }
      if (!res.ok) throw new Error(`Failed to load payment QR (${res.status})`);
      const data = await res.json();
      setUpiQrUrl(data.url || "");
      if (data.providerMeta && data.providerMeta.upi_id) setUpiId(data.providerMeta.upi_id);
      else if (data.upiId) setUpiId(data.upiId);
    } catch (err) {
      console.error("fetchPaymentQr:", err);
      setUpiError(err.message || "Failed to load UPI QR");
    } finally {
      setUpiLoading(false);
    }
  }
  useEffect(() => { fetchPaymentQr(); }, []);

  // compute selected items & total
  const { selectedItems, total } = useMemo(() => {
    const selected = cart.filter(i => checked[i._id]);
    const tot = selected.reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 1)), 0);
    return { selectedItems: selected, total: tot };
  }, [cart, checked]);

  function handleToggle(id) {
    setChecked(prev => ({ ...prev, [id]: !prev[id] }));
  }

  function handleFileChange(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) {
      if (screenshotPreview) { URL.revokeObjectURL(screenshotPreview); }
      setScreenshotFile(null);
      setScreenshotPreview(null);
      return;
    }
    setScreenshotFile(f);
    const url = URL.createObjectURL(f);
    setScreenshotPreview(url);
  }

  function removeScreenshot() {
    if (screenshotPreview) URL.revokeObjectURL(screenshotPreview);
    setScreenshotPreview(null);
    setScreenshotFile(null);
  }

  const placeDisabled = placing || !screenshotFile || selectedItems.length === 0;

  async function placeOrder() {
    if (selectedItems.length === 0) { setMessage("Please select at least one item."); return; }
    if (!screenshotFile) { setMessage("Please upload payment screenshot (required)."); return; }
    setMessage(null);
    setPlacing(true);
    try {
      const fd = new FormData();
      fd.append("tableId", tableId || "");
      fd.append("items", JSON.stringify(selectedItems));
      fd.append("total", String(total));
      fd.append("screenshot", screenshotFile);

      const res = await fetch(`${API}/api/orders`, { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Server returned ${res.status}`);
      }
      const created = await res.json();

      // remove ordered items from cart and persist
      const remaining = cart.filter(i => !checked[i._id]);
      setCart(remaining);
      localStorage.setItem("cart", JSON.stringify(remaining));

      setSuccessModal(true);
      removeScreenshot();

      setTimeout(() => {
        setSuccessModal(false);
        navigate("/");
      }, 1800);

    } catch (err) {
      console.error("Place order error:", err);
      setMessage(err.message || "Failed to place order");
    } finally {
      setPlacing(false);
      setTimeout(() => setMessage(null), 4000);
    }
  }

  // copy upi id helper
  function copyUpi() {
    if (!upiId) return;
    navigator.clipboard?.writeText(upiId).then(() => {
      setMessage("UPI id copied");
      setTimeout(() => setMessage(null), 2000);
    }).catch(() => {
      setMessage("Copy failed");
      setTimeout(() => setMessage(null), 2000);
    });
  }

  return (
    <div className="payment-page">
      <header className="payment-header">
        <div className="brand-left">
          <h1 className="brand-link" onClick={() => navigate("/owner")}>BWU Canteen</h1>
          <div className="brand-sub">Secure payment & order</div>
        </div>

        <div className="table-input">
          <label>Table</label>
          <input value={tableId} onChange={e => setTableId(e.target.value)} placeholder="Table id (optional)" />
        </div>
      </header>

      {message && <div className="payment-msg">{message}</div>}

      <main className="payment-main">
        <section className="left-col">
          <div className="upi-card">
            <div className="upi-qr-wrap">
              {upiLoading ? (
                <div className="upi-placeholder">Loading QR…</div>
              ) : upiQrUrl ? (
                <img src={upiQrUrl} alt="UPI QR" />
              ) : (
                <div className="upi-placeholder">UPI QR</div>
              )}
            </div>

            <div className="upi-meta">
              <div className="small-muted" style={{ marginTop: 8 }}>Scan the QR or use the UPI id above, then upload your payment screenshot below.</div>
            </div>
          </div>

          <div className="screenshot-uploader">
            <label className="label">Upload payment screenshot</label>
            <input type="file" accept="image/*" onChange={handleFileChange} />
            {screenshotPreview && (
              <div className="screenshot-preview">
                <img src={screenshotPreview} alt="preview" />
                <div className="screenshot-actions">
                  <button className="btn small danger" onClick={removeScreenshot}>Remove</button>
                </div>
              </div>
            )}
            <div className="small-muted" style={{ marginTop: 8 }}>
              Screenshot required — Place order will be enabled after upload.
            </div>
          </div>
        </section>

        <aside className="right-col">
          <div className="cart-panel">
            <div className="cart-header">
              <h3>Order Items</h3>
              {loadingItems && <div className="muted small">Refreshing prices…</div>}
            </div>

            <ul className="cart-list">
              {cart.length === 0 && <li className="muted">No items in cart.</li>}
              {cart.map(it => (
                <li key={it._id} className="cart-item">
                  <label className="cart-row">
                    <input type="checkbox" checked={!!checked[it._id]} onChange={() => handleToggle(it._id)} />
                    <div className="cart-left">
                      <div className="thumb">
                        {it.image ? <img src={it.image} alt={it.name} /> : <div className="thumb-empty" />}
                      </div>
                      <div className="cart-meta">
                        <div className="item-name">{it.name}</div>
                        <div className="small-muted">₹{Number(it.price).toFixed(2)}</div>
                      </div>
                    </div>
                  </label>

                  <div className="item-meta">
                    <span className="qty">x{it.qty}</span>
                    <span className="price">₹{(Number(it.price || 0) * Number(it.qty || 1)).toFixed(2)}</span>
                  </div>
                </li>
              ))}
            </ul>

            <div className="cart-summary">
              <div className="summary-row"><span>Items</span><span>{selectedItems.length}</span></div>
              <div className="summary-row total"><strong>Total</strong><strong>₹{total.toFixed(2)}</strong></div>
            </div>

            <div className="actions">
              <button
                className="btn btn-primary full"
                onClick={placeOrder}
                disabled={placeDisabled}
                title={placeDisabled ? "Upload payment screenshot to enable" : "Place order"}
              >
                {placing ? "Placing…" : "Place order"}
              </button>
            </div>

            {message && <div className="message muted">{message}</div>}
          </div>
        </aside>
      </main>

      {/* Success modal */}
      {successModal && (
        <div className="success-modal">
          <div className="success-box">
            <svg className="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
              <circle className="checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
              <path className="checkmark-check" fill="none" d="M14 27l7 7 17-17"/>
            </svg>
            <div style={{ marginTop: 10, fontWeight: 700 }}>Order placed</div>
            <div className="small-muted" style={{ marginTop: 6 }}>We have received your payment. Thank you.</div>
          </div>
        </div>
      )}
    </div>
  );
}

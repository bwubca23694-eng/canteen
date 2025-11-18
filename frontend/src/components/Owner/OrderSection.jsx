// src/components/Owner/OrderSection.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import "../../App.css";

const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function OrderSection() {
  // Tables & payment QR state
  const [showTableModal, setShowTableModal] = useState(false);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newLink, setNewLink] = useState("");
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentQr, setPaymentQr] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewSrc, setPreviewSrc] = useState(null);

  // Orders
  const [orders, setOrders] = useState([]); // oldest-first
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState(null);

  // single-choice view control
  const [view, setView] = useState("ongoing");
  const listRef = useRef(null);

  // ---------- tables helpers ----------
  async function loadTables() {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/tables`);
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Failed to fetch tables: ${res.status} ${txt}`);
      }
      const data = await res.json();
      setTables(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("loadTables:", err);
      setTables([]);
      setMessage("Failed to load tables");
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    // load tables on mount so we can resolve table numbers in orders
    loadTables();
  }, []);

  function computeNextNumber(existingTables) {
    if (!Array.isArray(existingTables) || existingTables.length === 0) return "1";
    const nums = existingTables
      .map((t) => {
        const n = parseInt(String(t.number || "").replace(/\D+/g, ""), 10);
        return Number.isFinite(n) ? n : null;
      })
      .filter((v) => v !== null);
    if (nums.length === 0) return String(existingTables.length + 1);
    return String(Math.max(...nums) + 1);
  }

  async function addTable() {
    setMessage(null);
    const nextNum = computeNextNumber(tables);
    setSaving(true);
    try {
      const payload = {
        number: String(nextNum),
        link: newLink ? String(newLink).trim() : "",
      };
      const res = await fetch(`${BASE_URL}/api/tables`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Create failed (${res.status})`);
      }
      await loadTables();
      setMessage(`Table ${nextNum} added`);
      setNewLink("");
      setTimeout(() => setMessage(null), 2200);
    } catch (err) {
      console.error("addTable:", err);
      setMessage(err.message || "Failed to add table");
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setSaving(false);
    }
  }

  async function deleteTable(id) {
    if (!window.confirm("Delete this table?")) return;
    try {
      const res = await fetch(`${BASE_URL}/api/tables/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Delete failed (${res.status})`);
      }
      await loadTables();
      setMessage("Deleted");
      setTimeout(() => setMessage(null), 1800);
    } catch (err) {
      console.error("deleteTable:", err);
      setMessage("Delete failed");
      setTimeout(() => setMessage(null), 3000);
    }
  }

  // ---------- payment QR ----------
  async function loadPaymentQr() {
    try {
      const res = await fetch(`${BASE_URL}/api/payment-qr`);
      if (!res.ok) {
        if (res.status === 404) {
          setPaymentQr(null);
          return;
        }
        throw new Error(`Failed to fetch payment qr (${res.status})`);
      }
      const data = await res.json();
      setPaymentQr(data || null);
    } catch (err) {
      console.error("loadPaymentQr:", err);
      setPaymentQr(null);
    }
  }
  function openPaymentModal() {
    setShowPaymentModal(true);
    setPreviewSrc(null);
    setSelectedFile(null);
    setUploadError(null);
    loadPaymentQr();
  }
  function closePaymentModal() {
    setShowPaymentModal(false);
    setPreviewSrc(null);
    setSelectedFile(null);
    setUploadError(null);
  }

  // file input
  function onFileChange(e) {
    setUploadError(null);
    const f = e.target.files && e.target.files[0];
    if (!f) {
      setSelectedFile(null);
      setPreviewSrc(null);
      return;
    }
    if (!f.type.startsWith("image/")) {
      setUploadError("Please select an image file");
      return;
    }
    setSelectedFile(f);
    const r = new FileReader();
    r.onload = (ev) => setPreviewSrc(ev.target.result);
    r.readAsDataURL(f);
  }

  async function uploadToCloud(file) {
    const fd2 = new FormData();
    fd2.append("image", file);
    const backRes = await fetch(`${BASE_URL}/api/upload`, {
      method: "POST",
      body: fd2,
    });
    if (!backRes.ok) {
      const text = await backRes.text().catch(() => "");
      throw new Error(`Upload failed: ${backRes.status} ${text}`);
    }
    return await backRes.json();
  }

  async function savePaymentQr() {
    if (!selectedFile) {
      setUploadError("Select an image first");
      return;
    }
    setUploading(true);
    try {
      const uploaded = await uploadToCloud(selectedFile);
      const payload = {
        url: uploaded.url || uploaded.secure_url || uploaded.secureUrl,
        providerMeta: uploaded.meta || uploaded,
      };
      const method = paymentQr && paymentQr._id ? "PUT" : "POST";
      const endpoint =
        paymentQr && paymentQr._id
          ? `${BASE_URL}/api/payment-qr/${paymentQr._id}`
          : `${BASE_URL}/api/payment-qr`;
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Save failed (${res.status})`);
      }
      const saved = await res.json();
      setPaymentQr(saved);
      setSelectedFile(null);
      setPreviewSrc(null);
      setUploadError(null);
      setMessage("Payment QR saved");
      setTimeout(() => setMessage(null), 2200);
    } catch (err) {
      console.error("savePaymentQr:", err);
      setUploadError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function deletePaymentQr() {
    if (!paymentQr || !paymentQr._id) return;
    if (!window.confirm("Delete payment QR?")) return;
    try {
      const res = await fetch(`${BASE_URL}/api/payment-qr/${paymentQr._id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Delete failed (${res.status})`);
      }
      setPaymentQr(null);
      setMessage("Deleted");
      setTimeout(() => setMessage(null), 1800);
    } catch (err) {
      console.error("deletePaymentQr:", err);
      setUploadError("Delete failed");
      setTimeout(() => setUploadError(null), 3000);
    }
  }

  // ---------- Orders handling ----------
  async function fetchRecentOrders(limit = 50) {
    const res = await fetch(`${BASE_URL}/api/orders?limit=${limit}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Failed to fetch orders: ${res.status} ${txt}`);
    }
    const data = await res.json();
    return Array.isArray(data) ? data : Array.isArray(data.data) ? data.data : [];
  }

  useEffect(() => {
    let mounted = true;
    async function init() {
      setOrdersLoading(true);
      setOrdersError(null);
      try {
        const recent = await fetchRecentOrders(50);
        if (!mounted) return;
        const ordered = recent.slice().reverse(); // oldest-first
        setOrders(ordered);
        requestAnimationFrame(() => {
          if (listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
          }
        });
      } catch (err) {
        console.error("initial load orders:", err);
        if (!mounted) return;
        setOrders([]);
        setOrdersError(err.message || "Failed to load orders");
      } finally {
        if (mounted) setOrdersLoading(false);
      }
    }
    init();
    return () => {
      mounted = false;
    };
  }, []);

  // polling
  useEffect(() => {
    let stopped = false;
    let intervalId = null;

    async function pollOnce() {
      try {
        const recent = await fetchRecentOrders(20);
        if (stopped) return;
        if (!Array.isArray(recent) || recent.length === 0) return;

        const recentOldestFirst = recent.slice().reverse();
        const known = new Set(orders.map((o) => String(o._id || o.id)));
        const toAppend = recentOldestFirst.filter(
          (o) => !known.has(String(o._id || o.id))
        );
        if (toAppend.length === 0) return;

        const flagged = toAppend.map((o) => ({ ...o, _isNew: true }));
        setOrders((prev) => {
          const knownNow = new Set(prev.map((p) => String(p._id || p.id)));
          const actuallyNew = flagged.filter(
            (o) => !knownNow.has(String(o._id || o.id))
          );
          if (actuallyNew.length === 0) return prev;
          return [...prev, ...actuallyNew];
        });

        flagged.forEach((n) => {
          const idKey = String(n._id || n.id);
          setTimeout(() => {
            setOrders((prev) =>
              prev.map((o) =>
                String(o._id || o.id) === idKey ? { ...o, _isNew: false } : o
              )
            );
          }, 8000);
        });

        if (listRef.current) {
          const el = listRef.current;
          const distanceFromBottom =
            el.scrollHeight - (el.scrollTop + el.clientHeight);
          const nearBottom = distanceFromBottom < 120;
          if (nearBottom)
            el.scrollTo({ top: el.scrollHeight + 200, behavior: "smooth" });
        }
      } catch (err) {
        console.warn("pollOrders:", err);
      }
    }

    intervalId = setInterval(() => pollOnce(), 5000);
    pollOnce();

    return () => {
      stopped = true;
      if (intervalId) clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  async function finishOrder(orderId) {
    try {
      const res = await fetch(`${BASE_URL}/api/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Update failed (${res.status})`);
      }
      const updated = await res.json();
      setOrders((prev) =>
        prev.map((o) =>
          String(o._id || o.id) === String(updated._id || updated.id)
            ? updated
            : o
        )
      );
      setMessage("Order finished");
      setTimeout(() => setMessage(null), 1800);
    } catch (err) {
      console.error("finishOrder:", err);
      setMessage(err.message || "Failed to finish order");
      setTimeout(() => setMessage(null), 3000);
    }
  }

  function fmtDate(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleString();
    } catch {
      return String(iso);
    }
  }

  const ongoingOrders = useMemo(
    () => orders.filter((o) => (o.status || "pending") !== "completed"),
    [orders]
  );
  const completedOrders = useMemo(
    () => orders.filter((o) => (o.status || "pending") === "completed"),
    [orders]
  );

  // map tableId / table to actual table.number so badge always shows number
  const tableLookup = useMemo(() => {
    const map = {};
    if (Array.isArray(tables)) {
      tables.forEach((t) => {
        const key = String(t._id || t.id || t.number);
        map[key] = t;
      });
    }
    return map;
  }, [tables]);

  function getTableLabel(order) {
    const rawKey =
      order.tableId ||
      order.table ||
      order.tableNumber ||
      order.tableNo ||
      order.table_id;
    if (rawKey && tableLookup[String(rawKey)]) {
      return tableLookup[String(rawKey)].number || rawKey;
    }
    if (rawKey) return rawKey;
    return "—";
  }

  // derive tablesComputed for modal QR display
  // FIXED VERSION — uses the exact link you enter
const tablesComputed = useMemo(() => {
  return Array.isArray(tables)
    ? tables.map((t) => {
        const rawLink = (t.link || "").trim();
        let outgoing;

        if (rawLink.includes("{table}")) {
          // replace placeholder
          outgoing = rawLink.replace(/{table}/g, t.number);
        } else if (rawLink) {
          // if full url, use directly
          if (/^https?:\/\//i.test(rawLink)) {
            outgoing = rawLink;
          } else {
            // if relative path, prefix with BASE_URL
            const path = rawLink.startsWith("/") ? rawLink : `/${rawLink}`;
            outgoing = `${BASE_URL.replace(/\/$/, "")}${path}`;
          }
        } else {
          // fallback if no link was provided
          outgoing = `${BASE_URL.replace(/\/$/, "")}/order/${t.number}`;
        }

        const qr = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
          outgoing
        )}&format=png`;

        return { ...t, outgoing, qr };
      })
    : [];
}, [tables]);


  return (
    <section className="panel order-panel">
      {/* HEADER: Orders title + toggle under it, buttons on the right */}
      <div className="panel-header order-header">
        <div className="order-header-left">
          <h2>Orders</h2>
          <div
            className="segmented order-toggle"
            role="tablist"
            aria-label="Orders view"
          >
            <button
              role="tab"
              aria-selected={view === "ongoing"}
              onClick={() => setView("ongoing")}
              className={`seg-item ${view === "ongoing" ? "active" : ""}`}
            >
              Ongoing
            </button>
            <button
              role="tab"
              aria-selected={view === "completed"}
              onClick={() => setView("completed")}
              className={`seg-item ${view === "completed" ? "active" : ""}`}
            >
              Completed
            </button>
          </div>
        </div>

        <div className="order-header-right">
          <button
            className="btn-icon"
            title="Tables"
            onClick={() => {
              setShowTableModal(true);
              loadTables();
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 7h18M3 12h18M3 17h18"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <span>Tables</span>
          </button>

          <button
            className="btn-icon primary"
            title="Payment QR"
            onClick={openPaymentModal}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <rect
                x="2"
                y="6"
                width="20"
                height="12"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M7 10h.01M12 10h.01M17 10h.01"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <span>Payment QR</span>
          </button>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        {message && <div className="order-message">{message}</div>}

        {ordersLoading ? (
          <div className="loader">Loading…</div>
        ) : ordersError ? (
          <div className="error">Error: {ordersError}</div>
        ) : (view === "ongoing" ? ongoingOrders.length === 0 : completedOrders.length === 0) ? (
          <div className="muted">
            {view === "ongoing" ? "No ongoing orders." : "No completed orders."}
          </div>
        ) : (
          <div ref={listRef} className="orders-list">
            {(view === "ongoing" ? ongoingOrders : completedOrders).map(
              (order) => {
                const isNew = !!order._isNew;
                const tableLabel = getTableLabel(order);

                return (
                  <article
                    key={order._id || order.id}
                    className={`order-card ${isNew ? "order-new" : ""}`}
                    aria-live={isNew ? "polite" : "off"}
                  >
                    {/* LEFT: highlighted table badge + compact screenshot */}
                    <div className="order-left-left">
                      <div className="table-badge-side">
                        Table <span>{tableLabel}</span>
                      </div>

                      <div className="screenshot-container-side">
                        {order.screenshot ? (
                          <div className="screenshot-wrap">
                            <img
                              src={order.screenshot}
                              alt="Payment screenshot"
                              className={`screenshot-img ${
                                isNew ? "screenshot-highlight" : ""
                              }`}
                              onClick={() =>
                                window.open(order.screenshot, "_blank")
                              }
                              draggable={false}
                            />
                            {isNew && <div className="new-label">NEW</div>}
                          </div>
                        ) : (
                          <div className="screenshot-placeholder">
                            No screenshot
                          </div>
                        )}
                      </div>
                    </div>

                    {/* RIGHT: details, items, totals */}
                    <div className="order-right">
                      <div className="order-top-row">
                        <div className="meta-left">
                          <div className="order-status">
                            Status:{" "}
                            <strong
                              style={{ textTransform: "capitalize" }}
                            >
                              {order.status || "pending"}
                            </strong>
                          </div>
                          <div className="order-created">
                            {fmtDate(order.createdAt || order.updatedAt || "")}
                          </div>
                        </div>

                        <div className="meta-right">
                          <div className="order-total">
                            ₹{Number(order.total || 0).toFixed(2)}
                          </div>
                          <div className="order-count">
                            {order.items && order.items.length
                              ? `${order.items.length} item${
                                  order.items.length > 1 ? "s" : ""
                                }`
                              : "No items"}
                          </div>

                          {view === "ongoing" &&
                            (order.status || "pending") !== "completed" && (
                              <div className="finish-wrap">
                                <button
                                  className="btn btn-primary"
                                  onClick={() =>
                                    finishOrder(order._id || order.id)
                                  }
                                >
                                  Finish
                                </button>
                              </div>
                            )}
                        </div>
                      </div>

                      {/* ITEMS – bigger, bold, very readable */}
                      <div className="items-wrap">
                        {Array.isArray(order.items) &&
                        order.items.length > 0 ? (
                          order.items.map((it, idx) => (
                            <div key={idx} className="item-pill no-thumb">
                              <div className="item-meta">
                                <div className="item-name">{it.name}</div>
                                <div className="item-sub">
                                  Qty: <strong>{it.qty}</strong> • ₹
                                  {(
                                    Number(it.price || 0) *
                                    Number(it.qty || 1)
                                  ).toFixed(2)}
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="muted">No items listed.</div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              }
            )}
          </div>
        )}
      </div>

      {/* TABLE modal */}
      {showTableModal && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal-content modal-tables">
            <div className="modal-header">
              <h3>Tables</h3>
              <div className="modal-header-right">
                <div className="small-muted">
                  {loading ? "Loading…" : `${tables.length} table(s)`}
                </div>
                <button className="btn small" onClick={() => setShowTableModal(false)}>
                  Close
                </button>
              </div>
            </div>

            <div className="tables-grid">
              <div className="tables-list-wrapper">
                {loading ? (
                  <div className="muted">Loading tables…</div>
                ) : tablesComputed.length === 0 ? (
                  <div className="muted">No tables yet.</div>
                ) : (
                  <div className="tables-list">
                    {tablesComputed.map((tbl) => (
                      <div key={tbl._id} className="table-row table-row-v2">
                        <div className="table-qr-wrap">
                          <img
                            src={tbl.qr}
                            alt={`QR ${tbl.number}`}
                            width={96}
                            height={96}
                          />
                        </div>
                        <div className="table-row-body">
                          <div className="table-row-title">
                            Table {tbl.number}
                          </div>
                          <div className="table-row-link">
                            {tbl.outgoing}
                          </div>
                          <div className="table-row-actions">
                            <button
                              className="btn btn-primary small"
                              onClick={() => {
                                const a = document.createElement("a");
                                a.href = tbl.qr;
                                a.target = "_blank";
                                a.click();
                              }}
                            >
                              Open
                            </button>
                            <button
                              className="btn small danger"
                              onClick={() => deleteTable(tbl._id)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <aside className="add-table-panel">
                <div className="add-table-title">Add New Table</div>
                <label className="add-table-label">
                  Link (optional)
                  <input
                    value={newLink}
                    onChange={(e) => setNewLink(e.target.value)}
                    placeholder="Optional: paste full URL or include {table}"
                  />
                </label>
                <div className="add-table-actions">
                  <button
                    className="btn btn-primary"
                    onClick={addTable}
                    disabled={saving}
                  >
                    {saving ? "Adding..." : "Add Table"}
                  </button>
                </div>
                {message && (
                  <div className="add-table-message">{message}</div>
                )}
              </aside>
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT QR modal — compact QR, buttons always visible */}
      {showPaymentModal && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal-content payment-modal">
            <div className="modal-header">
              <h3>Payment QR</h3>
              <div className="modal-header-right">
                <button className="btn small" onClick={closePaymentModal}>
                  Close
                </button>
              </div>
            </div>

            <div className="payment-modal-inner">
              {/* LEFT: current QR (small, centered) */}
              <div className="qr-preview-box">
                <div className="qr-preview-title">Current UPI QR</div>
                {paymentQr && paymentQr.url ? (
                  <>
                    <div className="qr-image-wrap">
                      <img
                        src={paymentQr.url}
                        alt="Payment QR"
                        onClick={() => window.open(paymentQr.url, "_blank")}
                      />
                    </div>
                    <div className="qr-actions">
                      <button
                        className="btn small"
                        onClick={() => window.open(paymentQr.url, "_blank")}
                      >
                        Open
                      </button>
                      <button
                        className="btn small danger"
                        onClick={deletePaymentQr}
                      >
                        Delete
                      </button>
                    </div>
                    <div className="qr-caption">
                      Tap the QR to open it in a new tab.
                    </div>
                  </>
                ) : (
                  <div className="muted">
                    No payment QR saved. Upload one from the right.
                  </div>
                )}
              </div>

              {/* RIGHT: upload panel */}
              <aside className="qr-upload-box">
                <div className="qr-upload-title">Upload / Update QR</div>
                <input type="file" accept="image/*" onChange={onFileChange} />

                {previewSrc && (
                  <div className="qr-upload-preview">
                    <img src={previewSrc} alt="Preview" />
                  </div>
                )}

                {uploadError && (
                  <div className="qr-error-text">{uploadError}</div>
                )}

                <div className="qr-upload-actions">
                  <button
                    className="btn btn-primary"
                    onClick={savePaymentQr}
                    disabled={uploading || !selectedFile}
                  >
                    {uploading ? "Uploading..." : "Upload QR"}
                  </button>
                  <button
                    className="btn"
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewSrc(null);
                      setUploadError(null);
                      const input = document.querySelector(
                        ".payment-modal input[type=file]"
                      );
                      if (input) input.value = "";
                    }}
                  >
                    Clear
                  </button>
                </div>

                <div className="qr-help">
                  Use a clear, high-contrast image of your UPI QR so staff can
                  verify payments easily.
                </div>
              </aside>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

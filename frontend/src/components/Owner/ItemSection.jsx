// src/components/Owner/ItemSection.jsx
import React, { useEffect, useState } from "react";
import "../../App.css";

const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function ItemSection() {
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    name: "",
    price: "",
    description: "",
    imageFile: null,
    imageUrl: "",
    available: true,
  });

  async function loadItems() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_URL}/api/items/all`);
      if (!res.ok) throw new Error("Failed to fetch items");
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Failed to load items");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadItems();
  }, []);

  function openAdd() {
    setEditing(null);
    setForm({ name: "", price: "", description: "", imageFile: null, imageUrl: "", available: true });
    setShowForm(true);
    setError(null);
  }

  function openEdit(item) {
    setEditing(item);
    setForm({
      name: item.name || "",
      price: item.price || "",
      description: item.description || "",
      imageFile: null,
      imageUrl: item.image || "",
      available: !!item.available,
    });
    setShowForm(true);
    setError(null);
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setForm((p) => ({ ...p, imageFile: null }));
      return;
    }
    setForm((p) => ({ ...p, imageFile: file, imageUrl: URL.createObjectURL(file) }));
  }

  async function uploadToCloudinary(file) {
    const fd = new FormData();
    fd.append("image", file);
    const res = await fetch(`${BASE_URL}/api/upload`, { method: "POST", body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Upload failed");
    }
    const json = await res.json();
    return json.url;
  }

  async function saveItem(e) {
    e.preventDefault();
    setError(null);

    if (!form.name || !String(form.name).trim()) {
      setError("Name is required");
      return;
    }
    const p = Number(form.price);
    if (Number.isNaN(p) || p < 0) {
      setError("Price must be a non-negative number");
      return;
    }

    setSaving(true);
    try {
      let imageUrl = form.imageUrl || null;
      if (form.imageFile) imageUrl = await uploadToCloudinary(form.imageFile);

      const payload = { name: form.name.trim(), price: p, description: form.description || "", image: imageUrl, available: !!form.available };

      let res;
      if (editing) {
        res = await fetch(`${BASE_URL}/api/items/${editing._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`${BASE_URL}/api/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Save failed");
      }

      await loadItems();
      setShowForm(false);
      setEditing(null);
    } catch (err) {
      console.error(err);
      setError(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(item) {
    if (!window.confirm("Delete this item?")) return;
    try {
      const res = await fetch(`${BASE_URL}/api/items/${item._id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Delete failed");
      }
      setItems((prev) => prev.filter((i) => i._id !== item._id));
    } catch (err) {
      alert("Failed to delete: " + (err.message || ""));
    }
  }

  async function toggleAvailable(e, item) {
    e.stopPropagation();
    try {
      const res = await fetch(`${BASE_URL}/api/items/${item._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ available: !item.available }),
      });
      if (!res.ok) throw new Error("Update failed");
      setItems((prev) => prev.map((i) => (i._id === item._id ? { ...i, available: !i.available } : i)));
    } catch (err) {
      alert("Failed to update availability: " + (err.message || ""));
    }
  }

  return (
    <section className="panel item-panel">
      <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Items</h2>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="btn ios-btn-primary" onClick={openAdd}>+ Add Item</button>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        {loading ? (
          <div className="loader">Loading…</div>
        ) : error ? (
          <div className="error">{error}</div>
        ) : items.length === 0 ? (
          <div className="muted">No items yet. Add one.</div>
        ) : (
          <div className="items-grid">
            {items.map((item) => (
              <article key={item._id} className="item-card ios-item-card">
                <div className="card-media">
                  {item.image ? (
                    <img src={item.image} className="thumb" alt={item.name} />
                  ) : (
                    <div className="thumb placeholder">No Image</div>
                  )}
                </div>

                <div className="card-body">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <div className="card-title">{item.name}</div>
                    <div className="card-price">₹{Number(item.price || 0).toFixed(0)}</div>
                  </div>

                  <div className="card-desc muted">{item.description || ""}</div>

                  <div className="card-actions" style={{ marginTop: 14 }}>
                    <button type="button" className="btn btn-edit" onClick={() => openEdit(item)}>Edit</button>
                    <button type="button" className="btn btn-delete" onClick={() => remove(item)}>Delete</button>
                  </div>
                </div>

                <button
                  type="button"
                  className={`ios-availability ${item.available ? "available" : "unavailable"}`}
                  onClick={(e) => toggleAvailable(e, item)}
                  aria-pressed={item.available}
                >
                  {item.available ? "Available" : "Unavailable"}
                </button>
              </article>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="modal" role="dialog" aria-modal="true" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="modal-content form-dialog" role="document" aria-labelledby="formTitle">
            <button className="dialog-close" onClick={() => { setShowForm(false); setEditing(null); }} aria-label="Close dialog">✕</button>

            <form onSubmit={saveItem} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <h3 id="formTitle" style={{ margin: 0 }}>{editing ? "Edit Item" : "Add Item"}</h3>

              {error && <div style={{ color: "crimson", marginBottom: 6 }}>{error}</div>}

              <label className="form-label">
                <div className="form-label-title">Name</div>
                <input required value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
              </label>

              <label className="form-label">
                <div className="form-label-title">Price</div>
                <input required type="number" step="0.01" value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))} />
              </label>

              <label className="form-label">
                <div className="form-label-title">Description</div>
                <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
              </label>

              <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                <label style={{ flex: 1 }}>
                  <div className="form-label-title">Image</div>
                  <input type="file" accept="image/*" onChange={handleFileChange} />
                </label>

                {form.imageUrl && (
                  <div style={{ minWidth: 160 }}>
                    <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>Preview</div>
                    <img src={form.imageUrl} alt="preview" className="preview-img" />
                  </div>
                )}
              </div>

              <label className="form-label-inline" style={{ marginTop: 6 }}>
                <input type="checkbox" checked={form.available} onChange={(e) => setForm((p) => ({ ...p, available: e.target.checked }))} />
                <span style={{ marginLeft: 10 }}>Available</span>
              </label>

              <div className="modal-actions" style={{ marginTop: 6 }}>
                <button type="submit" className="btn btn-save" disabled={saving}>{saving ? "Saving..." : "Save"}</button>
                <button type="button" className="btn btn-cancel" onClick={() => { setShowForm(false); setEditing(null); }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

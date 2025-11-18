// backend/routes/orders.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const streamifier = require("streamifier");
const cloudinary = require("cloudinary").v2;
const Order = require("../models/Order");

// configure cloudinary via env earlier in server.js (cloudinary.config({...}))

// multer memory
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 8 * 1024 * 1024 } });

// helper: upload buffer to cloudinary (returns result)
function uploadBufferToCloudinary(buffer, folder = "canteen_orders") {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder }, (error, result) => {
      if (result) resolve(result);
      else reject(error);
    });
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

// ----------------- GET /api/orders -----------------
// List orders. Query params:
//   ?limit=N   - limit results (default 50)
//   ?status=x  - optional filter by status
router.get("/", async (req, res) => {
  try {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const filter = {};
    if (req.query.status) filter.status = String(req.query.status);

    // newest first
    const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(limit).lean().exec();
    return res.json(orders);
  } catch (err) {
    console.error("GET /api/orders error:", err);
    return res.status(500).json({ message: "Failed to fetch orders", error: err.message || err });
  }
});

// ----------------- POST /api/orders -----------------
// Create new order. fields expected: tableId, items (JSON string), total, screenshot (file)
router.post("/", upload.single("screenshot"), async (req, res) => {
  try {
    const { tableId = "", items = "[]", total = 0 } = req.body;
    let screenshotUrl = "";

    if (req.file && req.file.buffer) {
      const result = await uploadBufferToCloudinary(req.file.buffer, "canteen_orders");
      screenshotUrl = result.secure_url || result.url || "";
    }

    const parsedItems = (() => {
      try { return JSON.parse(items); } catch { return []; }
    })();

    const order = new Order({
      tableId: String(tableId || ""),
      items: parsedItems,
      total: Number(total || 0),
      screenshot: screenshotUrl,
      status: "pending",
    });

    await order.save();
    return res.status(201).json(order);
  } catch (err) {
    console.error("POST /api/orders error:", err);
    return res.status(500).json({ message: "Server error", error: err.message || err });
  }
});

// ----------------- PUT /api/orders/:id -----------------
// Update an order (e.g., change status). Accepts JSON body with fields to update.
// Example: { status: "served" }
router.put("/:id", express.json(), async (req, res) => {
  try {
    const id = req.params.id;
    const updates = req.body || {};

    // Only allow some fields to be updated
    const allowed = ["status", "tableId", "total", "items", "screenshot"];
    const patch = {};
    for (const k of allowed) {
      if (updates[k] !== undefined) patch[k] = updates[k];
    }
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ message: "No updatable fields provided" });
    }

    patch.updatedAt = new Date();

    const updated = await Order.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean().exec();
    if (!updated) return res.status(404).json({ message: "Order not found" });
    return res.json(updated);
  } catch (err) {
    console.error("PUT /api/orders/:id error:", err);
    return res.status(500).json({ message: "Update failed", error: err.message || err });
  }
});

// ----------------- DELETE /api/orders/:id -----------------
router.delete("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const removed = await Order.findByIdAndDelete(id).lean().exec();
    if (!removed) return res.status(404).json({ message: "Order not found" });
    return res.json({ message: "Deleted", id: removed._id });
  } catch (err) {
    console.error("DELETE /api/orders/:id error:", err);
    return res.status(500).json({ message: "Delete failed", error: err.message || err });
  }
});

module.exports = router;

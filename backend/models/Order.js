// backend/models/Order.js
const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema({
  tableId: { type: String, default: "" },
  items: [{ name: String, price: Number, qty: Number, itemId: String }],
  total: { type: Number, default: 0 },
  screenshot: { type: String, default: "" }, // Cloudinary secure_url
  status: { type: String, default: "pending" },
}, { timestamps: true });

module.exports = mongoose.model("Order", OrderSchema);

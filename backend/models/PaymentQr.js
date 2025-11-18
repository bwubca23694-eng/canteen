// models/PaymentQr.js
const mongoose = require('mongoose');

const PaymentQrSchema = new mongoose.Schema({
  url: { type: String, required: true }, // public image URL (secure_url)
  providerMeta: { type: mongoose.Schema.Types.Mixed }, // full cloudinary response (public_id, etc.)
}, { timestamps: true });

module.exports = mongoose.model('PaymentQr', PaymentQrSchema);

// backend/models/Item.js
const mongoose = require('mongoose');

const ItemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  description: { type: String, default: '' },
  image: { type: String, default: null }, // stores Cloudinary URL
  available: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Item', ItemSchema);

// backend/models/Table.js
const mongoose = require('mongoose');

const TableSchema = new mongoose.Schema({
  number: { type: String, required: true, trim: true },
  link: { type: String, default: "" }, // optional custom link (may include {table} placeholder)
}, { timestamps: true });

module.exports = mongoose.model('Table', TableSchema);

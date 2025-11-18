// models/Owner.js
const mongoose = require("mongoose");

const OwnerSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  age: {
    type: Number,
    required: false
  }
});

module.exports = mongoose.model("Owner", OwnerSchema);
